'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
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
// Cells at least this wide (in px) list each event's time and title directly.
// Narrower cells show a marker instead, and the events appear in a popup on hover, focus or tap.
const FULL_DETAILS_MIN_CELL_WIDTH = 100;

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
  // Day of the visible month whose events are showing in the popup (narrow calendar only)
  const [activeDay, setActiveDay] = useState<number | null>(null);
  // Width of one day cell, measured from the calendar itself rather than the screen
  const [cellWidth, setCellWidth] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const isReady = today !== null && visibleMonth !== null;

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // Track the grid's width so the cells can show more detail as the calendar grows
  useEffect(() => {
    const element = gridRef.current;
    if (!isReady || !element) return;

    const observer = new ResizeObserver(([entry]) => {
      setCellWidth(entry.contentRect.width / DAYS_IN_WEEK);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [isReady]);

  // Close the popup when a tap or click lands outside it, or when Esc is pressed
  useEffect(() => {
    if (activeDay === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-event-day]')) setActiveDay(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDay(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDay]);

  // Group events by the day they start so each cell can look its events up quickly
  const eventsByDay = useMemo(() => {
    const groups = new Map<string, Event[]>();

    for (const event of events) {
      const key = getDateKey(new Date(event.startDatetime));
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }

    return groups;
  }, [events]);

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const dayLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [locale],
  );

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
    // The open popup belongs to the month being left
    setActiveDay(null);
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

  const showEventDetails = cellWidth >= FULL_DETAILS_MIN_CELL_WIDTH;
  const cellHeightClassName = showEventDetails ? 'h-[96px]' : 'h-[52px]';

  // Japanese visitors see the Japanese title when one has been entered
  const getTitle = (event: Event): string =>
    locale === 'ja' && event.titleJa ? event.titleJa : event.titleEn;

  // An event counts as past once it has ended
  const isPastEvent = (event: Event): boolean =>
    new Date(event.endDatetime).getTime() < today.getTime();

  const getEventHref = (event: Event): string => `/${locale}/events/${event.id}`;

  const eventLinkClassName =
    'block rounded-sm hover:underline '
    + 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-msscc-teal';

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
      <div ref={gridRef}>
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
                      className={`${cellHeightClassName} bg-msscc-gray-faint opacity-50`}
                    />
                  );
                }

                const dateKey = getDateKey(new Date(year, month, day));
                const dayEvents = eventsByDay.get(dateKey) ?? [];
                const hasEvents = dayEvents.length > 0;
                const hasUpcomingEvent = dayEvents.some((event) => !isPastEvent(event));
                const isToday = dateKey === todayKey;
                const canShowPopup = hasEvents && !showEventDetails;
                const isActive = canShowPopup && activeDay === day;
                const popupId = `calendar-popup-${year}-${month}-${day}`;
                const dayLabel = dayLabelFormatter.format(new Date(year, month, day));
                // A day with exactly one event links straight to it
                const singleEvent = dayEvents.length === 1 ? dayEvents[0] : null;

                // Today gets a filled circle. A day with events gets a teal date number.
                const dateNumberClassName = isToday
                  ? 'bg-msscc-teal font-semibold text-white'
                  : hasEvents
                    ? 'font-semibold text-msscc-teal'
                    : 'text-msscc-gray-mid';
                const dateNumber = (
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-body-sm ${dateNumberClassName}`}
                  >
                    {day}
                  </span>
                );

                const cellContent = showEventDetails ? (
                  <>
                    <div className="flex justify-end">{dateNumber}</div>

                    {hasEvents && (
                      <ul className="mt-1 flex flex-col gap-1.5 text-left">
                        {dayEvents.map((event) => {
                          const isPast = isPastEvent(event);

                          return (
                            <li
                              key={event.id}
                              className={isPast ? 'text-msscc-gray-mid' : 'text-msscc-gray-dark'}
                            >
                              <Link
                                href={getEventHref(event)}
                                className={`${eventLinkClassName}${
                                  singleEvent ? ' after:absolute after:inset-0' : ''
                                }`}
                              >
                                <span className="block text-caption font-semibold">
                                  {timeFormatter.format(new Date(event.startDatetime))}
                                </span>
                                <span
                                  className="break-words text-caption"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {getTitle(event)}
                                </span>
                                {isPast && (
                                  <span className="sr-only">{t('pastEvent')}</span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    {dateNumber}

                   {hasEvents && (
                      // Marker for narrow calendars: pink if something is still to come, gray if all past
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasUpcomingEvent ? 'bg-msscc-pink' : 'bg-msscc-gray-mid'
                        }`}
                      />
                    )}
                  </div>
                );

                return (
                  <td
                    key={dayIndex}
                    aria-current={isToday ? 'date' : undefined}
                    // A mouse opens the popup by hovering. Keyboard focus and taps open it too.
                    onMouseEnter={canShowPopup ? () => setActiveDay(day) : undefined}
                    onMouseLeave={canShowPopup ? () => setActiveDay(null) : undefined}
                    onFocus={canShowPopup ? () => setActiveDay(day) : undefined}
                    onBlur={
                      canShowPopup
                        ? (event) => {
                            // Stay open while focus moves between things inside this cell
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setActiveDay(null);
                            }
                          }
                        : undefined
                    }
                    // On table cells, height acts as the minimum height
                    className={`${cellHeightClassName} relative p-1 align-top ${
                      hasEvents
                        ? 'border border-msscc-teal bg-msscc-white'
                        : 'bg-msscc-gray-faint'
                    }`}
                  >
                    {canShowPopup ? (
                      <>
                        {singleEvent ? (
                          <Link
                            href={getEventHref(singleEvent)}
                            aria-label={`${dayLabel}: ${getTitle(singleEvent)}`}
                            aria-describedby={popupId}
                            data-event-day
                            className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-msscc-teal"
                          >
                            {cellContent}
                          </Link>
                        ) : (
                          <div
                            tabIndex={0}
                            role="group"
                            aria-label={`${dayLabel}, ${t('eventCount', { count: dayEvents.length })}`}
                            aria-describedby={popupId}
                            data-event-day
                            onClick={() => setActiveDay(day)}
                            className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-msscc-teal"
                          >
                            {cellContent}
                          </div>
                        )}

                        {/* Events for this day. Left-side columns open to the right, right-side
                            columns open to the left, and the last rows open upward so the popup
                            stays inside the calendar. */}
                        <div
                          id={popupId}
                          data-event-day
                          className={`${isActive ? 'block' : 'hidden'} absolute z-20 w-56 rounded-md border border-msscc-gray-light bg-msscc-white p-3 text-left shadow-lg ${
                            dayIndex <= 2 ? 'left-0' : 'right-0'
                          } ${weekIndex >= weeks.length - 2 ? 'bottom-full' : 'top-full'}`}
                        >
                          <p className="mb-2 text-body-sm font-semibold text-msscc-teal">
                            {dayLabel}
                          </p>

                          <ul className="flex flex-col gap-2">
                            {dayEvents.map((event) => {
                              const isPast = isPastEvent(event);

                              return (
                                <li
                                  key={event.id}
                                  className={isPast ? 'text-msscc-gray-mid' : 'text-msscc-gray-dark'}
                                >
                                  {/* On a single-event day the date cell is already a link to this
                                      event, so Tab skips this one. It can still be clicked. */}
                                  <Link
                                    href={getEventHref(event)}
                                    tabIndex={singleEvent ? -1 : undefined}
                                    className={eventLinkClassName}
                                  >
                                    <span className="block text-caption font-semibold">
                                      {timeFormatter.format(new Date(event.startDatetime))}
                                    </span>
                                    <span className="block text-body-sm">{getTitle(event)}</span>
                                    {isPast && <span className="sr-only">{t('pastEvent')}</span>}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </>
                    ) : (
                      cellContent
                    )}
                  </td>
                );
              })}
            </tr>
                    ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
