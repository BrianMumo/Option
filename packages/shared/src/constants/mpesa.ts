export const KENYAN_PHONE_REGEX = /^\+254[0-9]{9}$/;
export const KENYAN_PHONE_RAW_REGEX = /^254[0-9]{9}$/;

export const MPESA_STK_TIMEOUT_MS = 120_000;
export const MPESA_TRANSACTION_TYPES = {
  STK_PUSH: 'CustomerPayBillOnline',
  B2C_PAYMENT: 'BusinessPayment',
} as const;

export function normalizeKenyanPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = '254' + cleaned;
  return cleaned;
}

export function formatKenyanPhone(phone: string): string {
  const normalized = normalizeKenyanPhone(phone);
  return '+' + normalized;
}
