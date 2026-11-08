import { pageList } from './pageDocumentation';

describe('admin membership import help', () => {
  it('provides the important CSV rules without exposing tester setup on the membership page', () => {
    // Non-executive financial admins need this entry to survive the help page's
    // permission-key filter; there is no separate Members permission.
    const members = pageList.find((page) => page.pageName === 'Finances');
    expect(members).toBeDefined();
    const instructions = members?.pageInstructions.join(' ') ?? '';
    expect(instructions).toContain('first_name, last_name, membership_type and status');
    expect(instructions).toContain('0.00 means a known zero');
    expect(instructions).toContain('MM/DD/YYYY');
    expect(instructions).toContain('500 data rows');
    expect(instructions).toContain('Preview does not save records');
    expect(instructions).toContain('retry the same reviewed file');
  });
});