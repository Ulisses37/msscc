'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Event } from '@/types/event';

interface EventsCalendarViewProps {
  events: Event[];
}

interface VisibleMonth {
  year: number;
  month: number; // 0 = January
}

const DAYS_IN_WEEK = 7;

// One key per calendar day, in the visitor's local time zone
function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function EventsCalendarView({ events }: EventsCalendarViewProps) {
  const t = useTranslations('EventsCalendar');
  const locale = useLocale();

  // Today and the visible month are set after the page loads. The server and the
  // visitor's browser can disagree about the date and time zone, which would cause a
  // hydration mismatch if they were computed during the first render.
  const [today, setToday] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth | null>(null);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // Group events by the day they start so each cell can look its events up quickly
  const eventsByDay = useMemo(() => {
    const groups = new Map<string, Event[]>();

    for (const event of events) {
      const key = getDateKey(new Date(event.startDatetime));
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }

    return groups;
  }, [events]);

  // Weekday names in the current language, starting on Sunday (2026-01-04 is a Sunday)
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
      formatter.format(new Date(2026, 0, 4 + index)),
    );
  }, [locale]);

  // Rows of seven cells. Days outside the month are null and drawn as empty cells.
  const weeks = useMemo(() => {
    if (!visibleMonth) return [];

    const { year, month } = visibleMonth;
    const leadingBlanks = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];

    while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let start = 0; start < cells.length; start += DAYS_IN_WEEK) {
      rows.push(cells.slice(start, start + DAYS_IN_WEEK));
    }

    return rows;
  }, [visibleMonth]);

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => {
      if (!current) return current;

      // Date handles rolling over between December and January for us
      const next = new Date(current.year, current.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  // Keeps the space reserved until today's date is known
  if (!today || !visibleMonth) {
    return (
      <div
        aria-hidden="true"
        className="min-h-[420px] rounded-md border border-msscc-gray-light bg-msscc-white"
      />
    );
  }

  const { year, month } = visibleMonth;
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));
  const todayKey = getDateKey(today);

  const arrowClassName =
    'rounded-full p-2 text-msscc-teal transition-colors hover:bg-msscc-gray-faint '
    + 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-msscc-teal';

  return (
    <section className="rounded-md border border-msscc-gray-light bg-msscc-white p-3">
      {/* Month header with previous and next arrows */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={t('previousMonth')}
          className={arrowClassName}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 4 6.5 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h2
          aria-live="polite"
          className="text-center font-heading text-heading-2 text-msscc-teal"
        >
          {monthLabel}
        </h2>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label={t('nextMonth')}
          className={arrowClassName}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="m7.5 4 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Month grid */}
      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {weekdayLabels.map((label, index) => (
              <th
                key={index}
                scope="col"
                className="pb-1 text-center text-label font-normal tracking-label text-msscc-gray-mid"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((day, dayIndex) => {
                // Cells outside the current month stay empty
                if (day === null) {
                  return (
                    <td
                      key={dayIndex}
                      className="h-[52px] bg-msscc-gray-faint opacity-50"
                    />
                  );
                }

                const dateKey = getDateKey(new Date(year, month, day));
                const dayEvents = eventsByDay.get(dateKey) ?? [];
                const hasEvents = dayEvents.length > 0;
                const isToday = dateKey === todayKey;

                // Today gets a filled circle. A day with events gets a pink date number.
                const dateNumberClassName = isToday
                  ? 'bg-msscc-teal font-semibold text-white'
                  : hasEvents
                    ? 'font-semibold text-msscc-pink'
                    : 'text-msscc-gray-mid';

                return (
                  <td
                    key={dayIndex}
                    aria-current={isToday ? 'date' : undefined}
                    // On table cells, height acts as the minimum height
                    className={`h-[52px] p-1 align-top ${
                      hasEvents
                        ? 'border border-msscc-pink bg-msscc-white'
                        : 'bg-msscc-gray-faint'
                    }`}
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-body-sm ${dateNumberClassName}`}
                      >
                        {day}
                      </span>

                      {hasEvents && (
                        <>
                          {/* Marker for small calendars, where there's no room for event details */}
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-msscc-pink"
                          />
                          <span className="sr-only">
                            {t('eventCount', { count: dayEvents.length })}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
