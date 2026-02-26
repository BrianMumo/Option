import { KENYAN_PHONE_REGEX, normalizeKenyanPhone } from '@stakeoption/shared';

export function validateKenyanPhone(phone: string): boolean {
  return KENYAN_PHONE_REGEX.test(phone);
}

export function toMpesaFormat(phone: string): string {
  return normalizeKenyanPhone(phone);
}

export function toDisplayFormat(phone: string): string {
  const normalized = normalizeKenyanPhone(phone);
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
}
