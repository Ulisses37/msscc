import { buildGoogleCalendarUrl } from '@/utils/googleCalendar';

describe('buildGoogleCalendarUrl', () => {
  it('builds a Google Calendar URL with UTC event dates and optional fields', () => {
    expect(buildGoogleCalendarUrl({
      title: 'Volunteer Shift',
      start: '2026-11-25T14:15:00-08:00',
      end: '2026-11-25T16:45:00-08:00',
      details: 'Bring a name tag.',
      location: 'Sacramento, CA',
    })).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Volunteer+Shift'
      + '&dates=20261125T221500Z%2F20261126T004500Z&details=Bring+a+name+tag.'
      + '&location=Sacramento%2C+CA',
    );
  });

  it('omits optional fields when they are unavailable', () => {
    expect(buildGoogleCalendarUrl({
      title: 'Volunteer Shift',
      start: '2026-11-25T14:15:00Z',
      end: '2026-11-25T16:45:00Z',
    })).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Volunteer+Shift'
      + '&dates=20261125T141500Z%2F20261125T164500Z',
    );
  });

  it('returns null when either event date is invalid', () => {
    expect(buildGoogleCalendarUrl({
      title: 'Volunteer Shift',
      start: 'not-a-date',
      end: '2026-11-25T16:45:00Z',
    })).toBeNull();
  });
});