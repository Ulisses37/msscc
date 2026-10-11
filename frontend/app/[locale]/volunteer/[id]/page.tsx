'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { getSlotsByEventId } from '@/services/volunteerService';
import { getEventById } from '@/services/eventService';
import type { Event } from '@/types/event';

interface VolunteerSlot {
  volunteer_slot_id: number;
  position_name: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  capacity: number;
  filled_count: number;
  event: number;
}

function formatSlotDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

function formatSlotTime(datetime: string): string {
  return new Date(datetime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VolunteerShiftsPage() {
  const { id, locale } = useParams();

  const [shifts, setShifts] = useState<VolunteerSlot[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftError, setShiftError] = useState('');
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const loadShifts = async () => {
      try {
        const data = await getSlotsByEventId(Number(id));
        setShifts(data || []);
      } catch (error) {
        console.error('Failed to fetch volunteer shifts:', error);
        setShiftError('Failed to load volunteer shifts.');
      } finally {
        setIsLoadingShifts(false);
      }
    };

    loadShifts();
  }, [id]);

  useEffect(() => {
    const loadEvent = async () => {
      const eventData = await getEventById(Number(id));
      if (eventData) setEvent(eventData);
    };
    loadEvent();
  }, [id]);

  return (
    <main style={{
      maxWidth: '75rem',
      margin: '0 auto',
      padding: 'var(--space-10) var(--space-6)',
      fontFamily: 'var(--font-body)',
    }}>
      <Link
        href={`/${locale}/events/${id}`}
        style={{
          color: 'var(--color-teal)',
          fontSize: 'var(--fs-body-sm)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 'var(--space-6)',
        }}
        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        ← Back to event
      </Link>

      {/* Corresponding Event Title */}
      {event && (
        <header style={{
          borderBottom: '0.5px solid var(--color-gray-light)',
          marginBottom: 'var(--space-10)',
          paddingBottom: 'var(--space-6)',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-teal)',
            fontSize: 'var(--fs-display)',
            margin: 0,
          }}>
            {locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn}
          </h1>
        </header>
      )}

      {/* Loading state */}
      {isLoadingShifts && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
        }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-gray-mid)',
            fontSize: 'var(--fs-body)',
            margin: 0,
          }}>
            Loading shifts...
          </p>
        </div>
      )}

      {/* Error state */}
      {!isLoadingShifts && shiftError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
        }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-danger)',
            fontSize: 'var(--fs-body)',
            margin: 0,
          }}>
            {shiftError}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoadingShifts && !shiftError && shifts.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
        }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-gray-mid)',
            fontSize: 'var(--fs-body)',
            margin: 0,
          }}>
            No volunteer shifts available for this event at this time.
          </p>
        </div>
      )}

      {/* Shift list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxWidth: '65rem',
        margin: '0 auto',
      }}>
        {shifts.map((shift) => (
          <div
            key={shift.volunteer_slot_id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{
              border: '0.5px solid var(--color-gray-light)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4) var(--space-6)',
              backgroundColor: 'var(--color-white)',
            }}
          >
            {/* Shift date and time */}
            <div className="sm:flex-[0_0_35%]">
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--color-gray-dark)',
                margin: 0,
                fontWeight: 700,
              }}>
                {formatSlotDate(shift.start_datetime)}
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--color-gray-mid)',
                margin: 0,
              }}>
                {formatSlotTime(shift.start_datetime)} – {formatSlotTime(shift.end_datetime)}
              </p>
            </div>

            {/* Position name and filled count */}
            <div className="sm:flex-[0_0_40%]">
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--color-gray-dark)',
                margin: 0,
                fontWeight: 700,
              }}>
                {shift.position_name}
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-caption)',
                color: '#dc2626',
                margin: 0,
              }}>
                {shift.filled_count} of {shift.capacity} filled
              </p>
            </div>

            {/* Volunteer button or Full indicator */}
            <div className="flex sm:flex-[0_0_20%] sm:justify-end">
              {shift.filled_count >= shift.capacity ? (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-body-sm)',
                  color: 'var(--color-gray-mid)',
                  margin: 0,
                }}>
                  Full
                </p>
              ) : (
                <Link href={`/${locale}/volunteer/${id}/signup?slot_id=${shift.volunteer_slot_id}`}>
                  <Button text="Volunteer" padding="8px 16px" fontSize="12px" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

    </main>
  );
}
