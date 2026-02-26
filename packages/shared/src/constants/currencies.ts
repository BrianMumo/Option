export const KES = {
  code: 'KES',
  symbol: 'KSh',
  name: 'Kenyan Shilling',
  decimals: 2,
} as const;

export function formatKES(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const DEPOSIT_LIMITS = {
  min: 100,
  max: 300_000,
} as const;

export const WITHDRAWAL_LIMITS = {
  min: 100,
  max: 150_000,
} as const;
