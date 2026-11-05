import type { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';
import { createCsvContent } from './exportCsv';
import { createXlsxSheetData } from './exportXlsx';
import { createMembershipXlsxCell, membershipCsvValue } from './membershipExport';

const membership: MembershipEntry = {
  membership_id: 1,
  first_name: 'Test', last_name: 'Member', email: null, phone: null,
  membership_type: 'individual', amount_paid: null, payment_status: null,
  reference_id: 'test', start_date: null, end_date: null, renewal_date: null,
  status: 'active', notes: '', created_at: '', updated_at: '',
};

describe('membership exports', () => {
  it.each<keyof MembershipEntry>([
    'amount_paid', 'start_date', 'end_date', 'renewal_date', 'created_at', 'updated_at',
  ])('leaves unknown %s empty in CSV and XLSX', (field) => {
    expect(membershipCsvValue(membership, field)).toBeNull();
    expect(createMembershipXlsxCell(membership, field)).toBeNull();
    expect(createCsvContent([membership], [{
      header: field, getValue: (row) => membershipCsvValue(row, field),
    }])).toContain('\r\n""\r\n');
  });

  it.each([0, '0.00'])('exports known zero %p as a number', (amount) => {
    const row = { ...membership, amount_paid: amount };
    expect(membershipCsvValue(row, 'amount_paid')).toBe(0);
    expect(createMembershipXlsxCell(row, 'amount_paid')).toMatchObject({
      value: 0, type: Number,
    });
    expect(createXlsxSheetData([row], [{
      header: 'Amount', width: 16,
      getCell: (entry) => createMembershipXlsxCell(entry, 'amount_paid'),
    }])[1][0]).toMatchObject({ value: 0, type: Number });
  });

  it.each(['invalid', '2026-02-30'])('does not export fabricated dates for %s', (date) => {
    const row = { ...membership, start_date: date, created_at: `${date}T12:00:00Z` };
    for (const field of ['start_date', 'created_at'] as const) {
      expect(membershipCsvValue(row, field)).toBeNull();
      expect(createMembershipXlsxCell(row, field)).toBeNull();
    }
  });

  it('keeps valid dates as CSV text and typed spreadsheet dates', () => {
    const row = { ...membership, start_date: '2024-02-29' };
    expect(membershipCsvValue(row, 'start_date')).toBe('2024-02-29');
    expect(createMembershipXlsxCell(row, 'start_date')).toMatchObject({
      value: expect.any(Date), type: Date,
    });
  });
});