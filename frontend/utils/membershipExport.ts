import {
  membershipAmount,
  parseMembershipDate,
  parseMembershipTimestamp,
} from '@/utils/membershipValues';

import type { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';
import type { XlsxCell } from '@/utils/exportXlsx';

function isDateField(field: keyof MembershipEntry): boolean {
  return ['start_date', 'end_date', 'renewal_date'].includes(field);
}

function isTimestampField(field: keyof MembershipEntry): boolean {
  return field === 'created_at' || field === 'updated_at';
}

/** Preserve unknown membership values as empty CSV cells. */
export function membershipCsvValue(membership: MembershipEntry, field: keyof MembershipEntry) {
  const value = membership[field];
  if (field === 'amount_paid') return membershipAmount(value);
  if (isDateField(field) && !parseMembershipDate(value)) return null;
  if (isTimestampField(field) && !parseMembershipTimestamp(value)) return null;
  return value;
}

/** Keep known spreadsheet amounts and dates typed, leaving unknown values empty. */
export function createMembershipXlsxCell(
  membership: MembershipEntry,
  field: keyof MembershipEntry,
): XlsxCell {
  const value = membershipCsvValue(membership, field);
  if (value === null || value === undefined || value === '') return null;
  if (field === 'membership_id' || field === 'amount_paid') {
    return {
      value: Number(value),
      type: Number,
      format: field === 'amount_paid' ? '[$$-409]#,##0.00' : '0',
    };
  }
  if (isDateField(field) || isTimestampField(field)) {
    const date = isDateField(field)
      ? parseMembershipDate(value) : parseMembershipTimestamp(value);
    return date ? {
      value: date,
      type: Date,
      format: isDateField(field) ? 'mm/dd/yyyy' : 'mm/dd/yyyy h:mm AM/PM',
    } : null;
  }
  return {
    value: String(value),
    type: String,
    format: '@',
    wrap: field === 'notes',
    alignVertical: field === 'notes' ? 'top' : 'center',
  };
}