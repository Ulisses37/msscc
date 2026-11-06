import { formatCurrency } from '@/utils/formatCurrency';

/** Preserve unknown financial values instead of coercing them to zero. */
export function membershipAmount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** Format a known amount, including zero, without inventing missing payments. */
export function formatMembershipAmount(value: unknown): string {
  const amount = membershipAmount(value);
  return amount === null ? 'Unknown' : formatCurrency(amount);
}

/** Parse a calendar date locally and reject JavaScript's automatic date rollover. */
export function parseMembershipDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1) return null;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 &&
    date.getDate() === day ? date : null;
}

/** Accept API timestamps only when their calendar date and timestamp are valid. */
export function parseMembershipTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
    .exec(value);
  if (!match || !parseMembershipDate(match[1]) || Number(match[2]) > 23 ||
      Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Display missing or invalid dates explicitly, without exposing invalid date text. */
export function formatMembershipDate(value: unknown, timestamp = false): string {
  const date = timestamp ? parseMembershipTimestamp(value) : parseMembershipDate(value);
  if (!date) return 'Not provided';
  return new Intl.DateTimeFormat('en-US', {
    month: timestamp ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
    ...(timestamp ? { hour: 'numeric', minute: '2-digit' } as const : {}),
  }).format(date);
}

/** Keep unknown values last in either sort direction. */
export function compareMembershipValues(
  left: number | string | null,
  right: number | string | null,
  direction: number,
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return direction * (typeof left === 'number' && typeof right === 'number'
    ? left - right : String(left).localeCompare(String(right)));
}