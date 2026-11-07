interface GoogleCalendarEventInput {
  title: string;
  start: string;
  end: string;
  details?: string;
  location?: string;
}

// Google expects UTC timestamps so the event lands at the right time in the viewer's calendar.
function toCalendarDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Build a "create event" link for Google Calendar, or null if the dates are invalid. */
export function buildGoogleCalendarUrl({
  title,
  start,
  end,
  details,
  location,
}: GoogleCalendarEventInput): string | null {
  const startDate = toCalendarDate(start);
  const endDate = toCalendarDate(end);
  if (!startDate || !endDate) return null;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startDate}/${endDate}`,
  });
  if (details) params.set('details', details);
  if (location) params.set('location', location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}