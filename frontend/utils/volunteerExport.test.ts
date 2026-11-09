import type { VolunteerSignup, VolunteerSlot } from '@/services/volunteerService';

import { buildVolunteerExportRows } from './volunteerExport';

const slots: VolunteerSlot[] = [
  {
    volunteer_slot_id: 2,
    position_name: 'Setup',
    description: 'Arrange tables.',
    start_datetime: '2026-12-25T12:00:00Z',
    end_datetime: '2026-12-25T14:00:00Z',
    capacity: 2,
    filled_count: 0,
    event: 1,
  },
  {
    volunteer_slot_id: 1,
    position_name: 'Greeter',
    description: 'Welcome attendees.',
    start_datetime: '2026-12-25T10:00:00Z',
    end_datetime: '2026-12-25T12:00:00Z',
    capacity: 2,
    filled_count: 2,
    event: 1,
  },
];

function signup(overrides: Partial<VolunteerSignup>): VolunteerSignup {
  return {
    volunteer_signup_id: 1,
    slot: 1,
    first_name: 'Aiko',
    last_name: 'Tanaka',
    email: 'aiko@example.com',
    phone: '916-555-0100',
    comments: null,
    status: 'approved',
    submitted_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('buildVolunteerExportRows', () => {
  it('orders shifts by start time and approved volunteers by name', () => {
    const rows = buildVolunteerExportRows(slots, [
      [],
      [
        signup({ volunteer_signup_id: 2, first_name: 'Mina', last_name: 'Yamada' }),
        signup({ volunteer_signup_id: 3, first_name: 'Ken', last_name: 'Ito' }),
      ],
    ]);

    expect(rows.map((row) => [row.slot.position_name, row.signup?.last_name, row.spot])).toEqual([
      ['Greeter', 'Ito', 1],
      ['Greeter', 'Yamada', 2],
      ['Setup', undefined, 0],
    ]);
  });

  it('excludes signups that are not approved', () => {
    const rows = buildVolunteerExportRows([slots[0]], [[signup({ status: 'cancelled' })]]);

    expect(rows).toEqual([{ slot: slots[0], signup: null, spot: 0 }]);
  });
});