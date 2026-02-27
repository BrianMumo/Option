import { db } from '../config/database';
import { redis } from '../config/redis';
import { mpesaRequests, transactions } from '../db/schema';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { normalizeKenyanPhone } from '@stakeoption/shared';
import { creditWallet, debitWallet, reverseDebit } from './wallet.service';
import { eq } from 'drizzle-orm';

const DARAJA_BASE_URL = env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Helper to parse JSON responses from Daraja API
async function parseJson(response: Response): Promise<any> {
  return response.json() as Promise<any>;
}

// ── OAuth Token Management ────────────────────────────

async function getOAuthToken(): Promise<string> {
  // Check Redis cache first
  const cached = await redis.get('mpesa:oauth_token');
  if (cached) return cached;

  const credentials = Buffer.from(
    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await fetch(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, 'M-Pesa OAuth failed');
    throw new AppError('M-Pesa authentication failed', 502, 'MPESA_AUTH_FAILED');
  }

  const data = await parseJson(response);
  const token = data.access_token;

  // Cache with TTL slightly less than expiry (3500 of 3599 seconds)
  await redis.set('mpesa:oauth_token', token, 'EX', 3500);

  return token;
}

// ── STK Push Password ─────────────────────────────────

function generateStkPassword(): { password: string; timestamp: string } {
  const now = new Date();
  const timestamp = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');

  const password = Buffer.from(
    `${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  return { password, timestamp };
}

// ── STK Push (Deposits) ──────────────────────────────

export async function initiateSTKPush(
  userId: string,
  amount: number,
  phone: string
) {
  const normalizedPhone = normalizeKenyanPhone(phone);
  const token = await getOAuthToken();
  const { password, timestamp } = generateStkPassword();

  // Create M-Pesa request record
  const [mpesaReq] = await db.insert(mpesaRequests).values({
    user_id: userId,
    type: 'stk_push',
    phone: normalizedPhone,
    amount: amount.toString(),
    status: 'initiated',
  }).returning();

  try {
    const response = await fetch(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: normalizedPhone,
          PartyB: env.MPESA_SHORTCODE,
          PhoneNumber: normalizedPhone,
          CallBackURL: `${env.MPESA_CALLBACK_BASE_URL}/api/mpesa/callback/stk`,
          AccountReference: 'StakeOption',
          TransactionDesc: 'Deposit to StakeOption',
        }),
      }
    );

    const result = await parseJson(response);

    if (result.ResponseCode !== '0') {
      logger.error({ result }, 'STK Push initiation failed');
      await db.update(mpesaRequests)
        .set({ status: 'failed', result_desc: result.ResponseDescription || 'STK Push failed', updated_at: new Date() })
        .where(eq(mpesaRequests.id, mpesaReq.id));

      throw new AppError(
        result.ResponseDescription || 'Failed to initiate M-Pesa payment',
        502,
        'STK_PUSH_FAILED'
      );
    }

    // Update with Safaricom IDs
    await db.update(mpesaRequests)
      .set({
        merchant_request_id: result.MerchantRequestID,
        checkout_request_id: result.CheckoutRequestID,
        status: 'pending',
        updated_at: new Date(),
      })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    // Store in Redis for timeout tracking (120 second TTL)
    await redis.set(
      `mpesa:pending:${result.CheckoutRequestID}`,
      JSON.stringify({ userId, amount, mpesaRequestId: mpesaReq.id }),
      'EX',
      120
    );

    logger.info({ userId, amount, checkoutRequestId: result.CheckoutRequestID }, 'STK Push initiated');

    return {
      request_id: mpesaReq.id,
      checkout_request_id: result.CheckoutRequestID,
      merchant_request_id: result.MerchantRequestID,
      amount,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'STK Push request failed');
    throw new AppError('Failed to initiate M-Pesa payment', 502, 'STK_PUSH_FAILED');
  }
}

// ── STK Push Callback Handler ─────────────────────────

export async function handleSTKCallback(payload: any) {
  const callback = payload?.Body?.stkCallback;
  if (!callback) {
    logger.warn({ payload }, 'Invalid STK callback payload');
    return;
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

  logger.info({ CheckoutRequestID, ResultCode, ResultDesc }, 'STK callback received');

  // Find our request
  const [mpesaReq] = await db
    .select()
    .from(mpesaRequests)
    .where(eq(mpesaRequests.checkout_request_id, CheckoutRequestID))
    .limit(1);

  if (!mpesaReq) {
    logger.error({ CheckoutRequestID }, 'STK callback: request not found');
    return;
  }

  // Idempotency check - already processed
  if (mpesaReq.status === 'completed' || mpesaReq.status === 'failed') {
    logger.warn({ CheckoutRequestID, status: mpesaReq.status }, 'STK callback: already processed');
    return;
  }

  // Distributed lock to prevent duplicate callback processing
  const lockKey = `mpesa:lock:${CheckoutRequestID}`;
  const acquired = await redis.set(lockKey, '1', 'EX', 300, 'NX');
  if (!acquired) {
    logger.warn({ CheckoutRequestID }, 'STK callback: already being processed (lock held)');
    return;
  }

  try {
  if (ResultCode === 0) {
    // SUCCESS - Extract metadata
    const items = CallbackMetadata?.Item || [];
    const metadataMap: Record<string, any> = {};
    for (const item of items) {
      metadataMap[item.Name] = item.Value;
    }

    const mpesaReceipt = metadataMap['MpesaReceiptNumber'];
    const paidAmount = metadataMap['Amount'];

    // Credit the user's wallet
    const { transaction, new_balance } = await creditWallet(
      mpesaReq.user_id,
      parseFloat(paidAmount || mpesaReq.amount),
      'deposit',
      mpesaReceipt,
      { mpesa_request_id: mpesaReq.id, checkout_request_id: CheckoutRequestID }
    );

    // Update M-Pesa request
    await db.update(mpesaRequests)
      .set({
        status: 'completed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: mpesaReceipt,
        transaction_id: transaction.id,
        callback_payload: payload,
        updated_at: new Date(),
      })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    // Clean up Redis
    await redis.del(`mpesa:pending:${CheckoutRequestID}`);

    // Publish event for WebSocket notification
    await redis.publish('wallet:events', JSON.stringify({
      event: 'deposit:confirmed',
      userId: mpesaReq.user_id,
      data: {
        amount: parseFloat(paidAmount || mpesaReq.amount),
        mpesa_receipt: mpesaReceipt,
        new_balance,
      },
    }));

    logger.info({
      userId: mpesaReq.user_id,
      amount: paidAmount,
      receipt: mpesaReceipt,
      new_balance,
    }, 'Deposit completed via M-Pesa');

  } else {
    // FAILED
    await db.update(mpesaRequests)
      .set({
        status: 'failed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        callback_payload: payload,
        updated_at: new Date(),
      })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    await redis.del(`mpesa:pending:${CheckoutRequestID}`);

    // Publish failure event
    await redis.publish('wallet:events', JSON.stringify({
      event: 'deposit:failed',
      userId: mpesaReq.user_id,
      data: {
        amount: parseFloat(mpesaReq.amount),
        reason: ResultDesc || 'Payment was not completed',
      },
    }));

    logger.info({ userId: mpesaReq.user_id, ResultCode, ResultDesc }, 'Deposit failed via M-Pesa');
  }
  } finally {
    await redis.del(lockKey);
  }
}

// ── B2C Withdrawal ────────────────────────────────────

export async function initiateB2CWithdrawal(
  userId: string,
  amount: number,
  phone: string
) {
  const normalizedPhone = normalizeKenyanPhone(phone);

  // Debit wallet first (hold funds)
  const { transaction } = await debitWallet(
    userId,
    amount,
    'withdrawal',
    'processing',
    { phone: normalizedPhone }
  );

  // Create M-Pesa request record
  const [mpesaReq] = await db.insert(mpesaRequests).values({
    user_id: userId,
    transaction_id: transaction.id,
    type: 'b2c',
    phone: normalizedPhone,
    amount: amount.toString(),
    status: 'initiated',
  }).returning();

  logger.info({ userId, amount, mpesaRequestId: mpesaReq.id }, 'B2C withdrawal initiated, pending admin approval');

  return {
    withdrawal_id: mpesaReq.id,
    transaction_id: transaction.id,
    amount,
    status: 'pending',
  };
}

/**
 * Execute the actual B2C payment (called after admin approval).
 */
export async function executeB2CPayment(mpesaRequestId: string) {
  const [mpesaReq] = await db
    .select()
    .from(mpesaRequests)
    .where(eq(mpesaRequests.id, mpesaRequestId))
    .limit(1);

  if (!mpesaReq || mpesaReq.type !== 'b2c') {
    throw new AppError('Withdrawal request not found', 404);
  }

  if (mpesaReq.status !== 'initiated') {
    throw new AppError('Withdrawal already processed', 400);
  }

  const token = await getOAuthToken();

  const response = await fetch(
    `${DARAJA_BASE_URL}/mpesa/b2c/v3/paymentrequest`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        OriginatorConversationID: mpesaReq.id,
        InitiatorName: env.MPESA_INITIATOR_NAME,
        SecurityCredential: env.MPESA_SECURITY_CREDENTIAL,
        CommandID: 'BusinessPayment',
        Amount: Math.round(parseFloat(mpesaReq.amount)),
        PartyA: env.MPESA_B2C_SHORTCODE,
        PartyB: mpesaReq.phone,
        Remarks: 'StakeOption Withdrawal',
        QueueTimeOutURL: `${env.MPESA_CALLBACK_BASE_URL}/api/mpesa/callback/b2c/timeout`,
        ResultURL: `${env.MPESA_CALLBACK_BASE_URL}/api/mpesa/callback/b2c/result`,
        Occasion: 'Withdrawal',
      }),
    }
  );

  const result = await parseJson(response);

  if (result.ResponseCode !== '0') {
    logger.error({ result }, 'B2C payment initiation failed');
    // Reverse the wallet debit
    if (mpesaReq.transaction_id) {
      await reverseDebit(mpesaReq.user_id, mpesaReq.transaction_id);
    }
    await db.update(mpesaRequests)
      .set({ status: 'failed', result_desc: result.ResponseDescription, updated_at: new Date() })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    throw new AppError('B2C payment failed', 502, 'B2C_FAILED');
  }

  await db.update(mpesaRequests)
    .set({
      conversation_id: result.ConversationID,
      originator_conversation_id: result.OriginatorConversationID,
      status: 'pending',
      updated_at: new Date(),
    })
    .where(eq(mpesaRequests.id, mpesaReq.id));

  logger.info({ mpesaRequestId, conversationId: result.ConversationID }, 'B2C payment sent to Safaricom');

  return { conversation_id: result.ConversationID };
}

// ── B2C Result Callback ───────────────────────────────

export async function handleB2CResultCallback(payload: any) {
  const result = payload?.Result;
  if (!result) {
    logger.warn({ payload }, 'Invalid B2C result callback');
    return;
  }

  const { ConversationID, ResultCode, ResultDesc, ResultParameters } = result;

  logger.info({ ConversationID, ResultCode, ResultDesc }, 'B2C result callback received');

  const [mpesaReq] = await db
    .select()
    .from(mpesaRequests)
    .where(eq(mpesaRequests.conversation_id, ConversationID))
    .limit(1);

  if (!mpesaReq) {
    logger.error({ ConversationID }, 'B2C callback: request not found');
    return;
  }

  if (mpesaReq.status === 'completed' || mpesaReq.status === 'failed') {
    logger.warn({ ConversationID, status: mpesaReq.status }, 'B2C callback: already processed');
    return;
  }

  if (ResultCode === 0) {
    // Extract receipt number from result parameters
    const params = ResultParameters?.ResultParameter || [];
    const receiptParam = params.find((p: any) => p.Key === 'TransactionReceipt');
    const receipt = receiptParam?.Value || null;

    // Mark transaction as completed
    if (mpesaReq.transaction_id) {
      await db.update(transactions)
        .set({ status: 'completed', external_reference: receipt, updated_at: new Date() })
        .where(eq(transactions.id, mpesaReq.transaction_id));
    }

    await db.update(mpesaRequests)
      .set({
        status: 'completed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: receipt,
        callback_payload: payload,
        updated_at: new Date(),
      })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    await redis.publish('wallet:events', JSON.stringify({
      event: 'withdrawal:completed',
      userId: mpesaReq.user_id,
      data: { amount: parseFloat(mpesaReq.amount), receipt },
    }));

    logger.info({ userId: mpesaReq.user_id, amount: mpesaReq.amount, receipt }, 'B2C withdrawal completed');
  } else {
    // Failed - reverse the debit
    if (mpesaReq.transaction_id) {
      await reverseDebit(mpesaReq.user_id, mpesaReq.transaction_id);
    }

    await db.update(mpesaRequests)
      .set({
        status: 'failed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        callback_payload: payload,
        updated_at: new Date(),
      })
      .where(eq(mpesaRequests.id, mpesaReq.id));

    await redis.publish('wallet:events', JSON.stringify({
      event: 'withdrawal:failed',
      userId: mpesaReq.user_id,
      data: { amount: parseFloat(mpesaReq.amount), reason: ResultDesc },
    }));

    logger.info({ userId: mpesaReq.user_id, ResultCode, ResultDesc }, 'B2C withdrawal failed, debit reversed');
  }
}

// ── B2C Timeout Callback ──────────────────────────────

export async function handleB2CTimeoutCallback(payload: any) {
  const result = payload?.Result;
  if (!result) return;

  const { ConversationID } = result;
  logger.warn({ ConversationID }, 'B2C timeout callback received');

  const [mpesaReq] = await db
    .select()
    .from(mpesaRequests)
    .where(eq(mpesaRequests.conversation_id, ConversationID))
    .limit(1);

  if (!mpesaReq || mpesaReq.status !== 'pending') return;

  // Mark as failed and reverse
  if (mpesaReq.transaction_id) {
    await reverseDebit(mpesaReq.user_id, mpesaReq.transaction_id);
  }

  await db.update(mpesaRequests)
    .set({
      status: 'failed',
      result_desc: 'Transaction timed out',
      callback_payload: payload,
      updated_at: new Date(),
    })
    .where(eq(mpesaRequests.id, mpesaReq.id));

  logger.info({ userId: mpesaReq.user_id, mpesaRequestId: mpesaReq.id }, 'B2C timeout, debit reversed');
}

// ── STK Push Query (for timeout handling) ─────────────

export async function querySTKPushStatus(checkoutRequestId: string) {
  const token = await getOAuthToken();
  const { password, timestamp } = generateStkPassword();

  const response = await fetch(
    `${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    }
  );

  return parseJson(response);
}
