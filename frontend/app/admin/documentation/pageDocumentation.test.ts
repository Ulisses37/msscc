import { adminPageList } from './pageDocumentation';

describe('admin financial import help', () => {
  // The help page filters by permission key; both workflows must be present
  // under Finances for non-executive financial admins.
  const finances = adminPageList.find((page) => page.pageName === 'Finances');
  const instructions = finances?.pageInstructions.join(' ') ?? '';

  it('preserves the membership CSV rules', () => {
    expect(finances).toBeDefined();
    expect(instructions).toContain('first_name, last_name, membership_type and status');
    expect(instructions).toContain('0.00 means a known zero');
    expect(instructions).toContain('MM/DD/YYYY');
    expect(instructions).toContain('500 data rows');
    expect(instructions).toContain('Preview does not save records');
    expect(instructions).toContain('retry the same reviewed file');
  });

  it('preserves donation-specific rules alongside membership help', () => {
    expect(finances).toBeDefined();
    expect(instructions).toContain('amount and donation_date');
    expect(instructions).toContain('2, 2.5 or 2.50');
    expect(instructions).toContain('MM/DD/YYYY');
    expect(instructions).toContain('cash, check, card or bank_transfer');
    expect(instructions).toContain('500 data rows');
    expect(instructions).toContain('Preview does not save records');
    expect(instructions).toContain('retry with the same reviewed file');
    expect(instructions).not.toContain('Team setup');
  });
});