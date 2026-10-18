'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { getSlotsByEventId } from '@/services/volunteerService';
import { getEventById } from '@/services/eventService';
import type { Event } from '@/types/event';
import { formatLocalizedDate } from '@/utils/dateLocalization';

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

function formatSlotDate(datetime: string, locale: string | string[] | undefined): string {
  return formatLocalizedDate(datetime, locale, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

function formatSlotTime(datetime: string, locale: string | string[] | undefined): string {
  return formatLocalizedDate(datetime, locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VolunteerShiftsPage() {
  const t = useTranslations('VolunteerShiftsPage');
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
        setShiftError(t('loadError'));
      } finally {
        setIsLoadingShifts(false);
      }
    };

    loadShifts();
  }, [id, t]);

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
        ← {t('backToEvent')}
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
            {t('loading')}
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
            {t('empty')}
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
                {/* The route locale controls labels and date presentation, not the stored shift time. */}
                {formatSlotDate(shift.start_datetime, locale)}
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--color-gray-mid)',
                margin: 0,
              }}>
                {formatSlotTime(shift.start_datetime, locale)} –{' '}
                {formatSlotTime(shift.end_datetime, locale)}
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
                {t('filled', { filled: shift.filled_count, capacity: shift.capacity })}
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
                  {t('full')}
                </p>
              ) : (
                <Link href={`/${locale}/volunteer/${id}/signup?slot_id=${shift.volunteer_slot_id}`}>
                  <Button text={t('volunteer')} padding="8px 16px" fontSize="12px" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

    </main>
  );
}
