import {
  getVolunteerExportData,
  type VolunteerSignup,
  type VolunteerSlot,
} from '@/services/volunteerService';
import { downloadXlsx, type XlsxCell, type XlsxColumn } from '@/utils/exportXlsx';

export type VolunteerExportRow = {
  slot: VolunteerSlot;
  signup: VolunteerSignup | null;
};

const DATE_TIME_FORMAT = 'mm/dd/yyyy h:mm AM/PM';

/** Write text as a real string cell so spreadsheet apps never run it as a formula. */
function textCell(value: string | null | undefined, wrap = false): XlsxCell {
  const text = value?.trim();
  if (!text) return null;
  return {
    value: text,
    type: String,
    format: '@',
    wrap,
    alignVertical: wrap ? 'top' : 'center',
  };
}

function dateTimeCell(value: string | null | undefined): XlsxCell {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { value: date, type: Date, format: DATE_TIME_FORMAT };
}

const volunteerExportColumns: XlsxColumn<VolunteerExportRow>[] = [
  {
    header: 'Shift/Position',
    width: 24,
    getCell: ({ slot }) => textCell(slot.position_name),
  },
  {
    header: 'Description',
    width: 36,
    getCell: ({ slot }) => textCell(slot.description, true),
  },
  {
    header: 'Shift Start',
    width: 22,
    getCell: ({ slot }) => dateTimeCell(slot.start_datetime),
  },
  {
    header: 'Shift End',
    width: 22,
    getCell: ({ slot }) => dateTimeCell(slot.end_datetime),
  },
  {
    header: 'Capacity',
    width: 10,
    getCell: ({ slot }) => ({ value: slot.capacity, type: Number, format: '0' }),
  },
  {
    header: 'First Name',
    width: 16,
    getCell: ({ signup }) => textCell(signup?.first_name),
  },
  {
    header: 'Last Name',
    width: 16,
    getCell: ({ signup }) => textCell(signup?.last_name),
  },
  {
    header: 'Email',
    width: 30,
    getCell: ({ signup }) => textCell(signup?.email),
  },
  // Text format keeps leading zeros and a leading "+" in phone numbers.
  {
    header: 'Phone',
    width: 18,
    getCell: ({ signup }) => textCell(signup?.phone),
  },
  {
    header: 'Comments',
    width: 40,
    getCell: ({ signup }) => textCell(signup?.comments, true),
  },
  {
    header: 'Signed Up',
    width: 22,
    getCell: ({ signup }) => dateTimeCell(signup?.submitted_at),
  },
];

/** One row per approved volunteer, plus one blank-volunteer row for a shift nobody joined. */
export function buildVolunteerExportRows(
  slots: VolunteerSlot[],
  signupsBySlot: VolunteerSignup[][],
): VolunteerExportRow[] {
  const rows: VolunteerExportRow[] = [];

  const orderedSlots = slots
    .map((slot, index) => ({ slot, signups: signupsBySlot[index] ?? [] }))
    .sort((a, b) => a.slot.start_datetime.localeCompare(b.slot.start_datetime));

  for (const { slot, signups } of orderedSlots) {
    const approved = signups
      .filter((signup) => signup.status === 'approved')
      .sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name)
          || a.first_name.localeCompare(b.first_name)
          || a.submitted_at.localeCompare(b.submitted_at),
      );

    if (approved.length === 0) {
      rows.push({ slot, signup: null });
      continue;
    }
    for (const signup of approved) rows.push({ slot, signup });
  }

  return rows;
}

function exportFilename(eventId: number, eventTitle: string): string {
  const slug =
    eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    || `event-${eventId}`;
  const now = new Date();
  const dateStamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return `volunteers-${slug}-${dateStamp}.xlsx`;
}

/** Download an event's volunteers as XLSX. Returns false when the event has no shifts. */
export async function exportEventVolunteers(
  eventId: number,
  eventTitle: string,
): Promise<boolean> {
  const { slots, signupsBySlot } = await getVolunteerExportData(eventId);
  if (slots.length === 0) return false;

  const rows = buildVolunteerExportRows(slots, signupsBySlot);
  await downloadXlsx(
    exportFilename(eventId, eventTitle),
    'Volunteers',
    rows,
    volunteerExportColumns,
  );
  return true;
}