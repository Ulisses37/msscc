'use client';

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import type { Event } from '@/types/event';

interface EventCalendarProps {
  event: Event;
}

export function EventCalendar({ event }: EventCalendarProps) {
  const startDate = new Date(event.startDatetime);
  const endDate = new Date(event.endDatetime);

  // Generate all dates between start and end inclusive
  function getEventDates(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    while (current <= endDay) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  const eventDates = getEventDates(startDate, endDate);

  // Check if a given calendar tile date matches any event date
  function isTileHighlighted(date: Date): boolean {
    return eventDates.some(
      (eventDate) =>
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate(),
    );
  }

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '0.5px solid var(--color-gray-light)',
      maxWidth: '300px',
      marginLeft: 'auto',
    }}>
      {/* Custom static teal header */}
      <div style={{
        backgroundColor: 'var(--color-teal)',
        padding: 'var(--space-3) var(--space-4)',
        textAlign: 'center',
      }}>
        <p style={{
          color: 'var(--color-white)',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--fs-body-sm)',
          margin: 0,
          fontWeight: 600,
        }}>
          {startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
        </p>
      </div>

      <Calendar
        locale="en-US"  // to have calendar be sun, mon, ..., fri, sat
        activeStartDate={new Date(startDate.getFullYear(), startDate.getMonth(), 1)}
        showNavigation={false}
        onClickDay={() => null}
        tileClassName={({ date }) =>
          isTileHighlighted(date) ? 'event-highlight' : null
        }
      />
    </div>
  );
}
