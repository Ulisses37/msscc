import type { VolunteerSignup, VolunteerSlot } from '@/services/volunteerService';
import { getVolunteerExportData } from '@/services/volunteerService';
import { downloadXlsx, type XlsxColumn } from '@/utils/exportXlsx';

import {
  buildVolunteerExportRows,
  exportEventVolunteers,
  type VolunteerExportRow,
} from './volunteerExport';

jest.mock('@/utils/exportXlsx', () => ({ downloadXlsx: jest.fn() }));
jest.mock('@/services/volunteerService', () => ({ getVolunteerExportData: jest.fn() }));

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
    capacity: 6,
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

type ExportCall = [
  string,
  string,
  VolunteerExportRow[],
  XlsxColumn<VolunteerExportRow>[],
];

/** Run the export with mocked data and return what would have been written to the file. */
async function runExport(
  slotList: VolunteerSlot[],
  signupsBySlot: VolunteerSignup[][],
  title = 'Spring Picnic & Fun!',
) {
  jest.mocked(getVolunteerExportData).mockResolvedValue({ slots: slotList, signupsBySlot });
  const exported = await exportEventVolunteers(7, title);
  const call = jest.mocked(downloadXlsx).mock.calls[0] as unknown as ExportCall | undefined;
  return { exported, call };
}

function cell(call: ExportCall, header: string, row: VolunteerExportRow) {
  const column = call[3].find((candidate) => candidate.header === header);
  if (!column) throw new Error(`No column named ${header}`);
  return column.getCell(row) as Record<string, unknown> | null;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildVolunteerExportRows', () => {
  it('orders shifts by start time and approved volunteers by name', () => {
    const rows = buildVolunteerExportRows(slots, [
      [],
      [
        signup({ volunteer_signup_id: 2, first_name: 'Mina', last_name: 'Yamada' }),
        signup({ volunteer_signup_id: 3, first_name: 'Ken', last_name: 'Ito' }),
      ],
    ]);

    expect(
      rows.map((row) => [row.slot.position_name, row.signup?.last_name, row.spot]),
    ).toEqual([
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

describe('exportEventVolunteers', () => {
  it('downloads nothing and returns false for an event with no shifts', async () => {
    const { exported, call } = await runExport([], []);

    expect(exported).toBe(false);
    expect(call).toBeUndefined();
  });

  it('names the file from the event title and the date', async () => {
    const { call } = await runExport([slots[1]], [[signup({})]]);

    expect(call?.[0]).toMatch(/^volunteers-spring-picnic-fun-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('falls back to the event id when the title has no usable characters', async () => {
    const { call } = await runExport([slots[1]], [[signup({})]], '!!!');

    expect(call?.[0]).toMatch(/^volunteers-event-7-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('writes formula-looking text as a plain string cell', async () => {
    const formula = '=HYPERLINK("http://example.com","x")';
    const { call } = await runExport(
      [slots[1]],
      [[signup({ first_name: '=1+1', comments: formula })]],
    );
    const row = call![2][0];

    expect(cell(call!, 'First Name', row)).toMatchObject({
      value: '=1+1',
      type: String,
      format: '@',
    });
    expect(cell(call!, 'Comments', row)).toMatchObject({
      value: formula,
      type: String,
      format: '@',
    });
  });

  it('keeps leading zeros and plus signs in phone numbers', async () => {
    const { call } = await runExport(
      [slots[1]],
      [
        [
          signup({ volunteer_signup_id: 1, last_name: 'Aoki', phone: '0123456789' }),
          signup({ volunteer_signup_id: 2, last_name: 'Baba', phone: '+15551234567' }),
        ],
      ],
    );
    const [first, second] = call![2];

    expect(cell(call!, 'Phone', first)).toMatchObject({ value: '0123456789', type: String });
    expect(cell(call!, 'Phone', second)).toMatchObject({ value: '+15551234567', type: String });
  });

  it('leaves empty and whitespace-only comments blank', async () => {
    const { call } = await runExport(
      [slots[1]],
      [
        [
          signup({ volunteer_signup_id: 1, last_name: 'Aoki', comments: null }),
          signup({ volunteer_signup_id: 2, last_name: 'Baba', comments: '   ' }),
        ],
      ],
    );
    const [first, second] = call![2];

    expect(cell(call!, 'Comments', first)).toBeNull();
    expect(cell(call!, 'Comments', second)).toBeNull();
  });

  it("shows each volunteer's spot as text so it is not read as a date", async () => {
    const { call } = await runExport(
      [slots[1]],
      [
        [
          signup({ volunteer_signup_id: 1, last_name: 'Aoki' }),
          signup({ volunteer_signup_id: 2, last_name: 'Baba' }),
        ],
      ],
    );
    const [first, second] = call![2];

    expect(cell(call!, 'Spot', first)).toMatchObject({ value: '1/6', type: String, format: '@' });
    expect(cell(call!, 'Spot', second)).toMatchObject({ value: '2/6', type: String, format: '@' });
  });

  it('gives an empty shift one row with blank volunteer columns and a 0 spot', async () => {
    const { call } = await runExport([slots[0]], [[]]);
    const [row] = call![2];

    expect(call![2]).toHaveLength(1);
    expect(cell(call!, 'Shift/Position', row)).toMatchObject({ value: 'Setup' });
    expect(cell(call!, 'Spot', row)).toMatchObject({ value: '0/2' });
    for (const header of ['First Name', 'Last Name', 'Email', 'Phone', 'Comments', 'Signed Up']) {
      expect(cell(call!, header, row)).toBeNull();
    }
  });

  it('writes shift times as date cells with a readable format', async () => {
    const { call } = await runExport([slots[1]], [[signup({})]]);
    const [row] = call![2];
    const sourceDate = new Date(slots[1].start_datetime);
    const spreadsheetDate = cell(call!, 'Shift Start', row)?.value as Date;

    expect(cell(call!, 'Shift Start', row)).toMatchObject({
      type: Date,
      format: 'mm/dd/yyyy h:mm AM/PM',
    });
    expect(spreadsheetDate).toBeInstanceOf(Date);
    expect(spreadsheetDate.getUTCHours()).toBe(sourceDate.getHours());
    expect(spreadsheetDate.getUTCMinutes()).toBe(sourceDate.getMinutes());
  });

  it("writes the admin's local clock time, because spreadsheets store no time zone", async () => {
    const { call } = await runExport([slots[1]], [[signup({})]]);
    const [row] = call![2];
    const start = new Date(slots[1].start_datetime);
    const written = cell(call!, 'Shift Start', row)?.value as Date;

    expect(written.getUTCHours()).toBe(start.getHours());
    expect(written.getUTCMinutes()).toBe(start.getMinutes());
    expect(written.getUTCDate()).toBe(start.getDate());
    expect(written.getUTCMonth()).toBe(start.getMonth());
  });
});