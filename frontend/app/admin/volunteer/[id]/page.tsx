'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShiftCard } from '@/components/admin/ShiftCard';
import { ShiftForm } from '@/components/admin/ShiftForm';
import { getSlotsByEventId } from '@/services/volunteerService';

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

export default function VolunteerCreationPage() {
  const { id } = useParams();
  const [showForm, setShowForm] = useState(false);
  const [shifts, setShifts] = useState<VolunteerSlot[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftError, setShiftError] = useState('');

// Fetch shifts for this event, reusable so it can be called again after creating a shift
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

  useEffect(() => {
    loadShifts();
  }, [id]);

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-gray-faint)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Back link */}
      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Link
          href={`/admin/events?edit=${id}`}
          style={{
            color: 'var(--color-gray-dark)',
            fontSize: 'var(--fs-body-sm)',
            textDecoration: 'none',
          }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          ← Back
        </Link>
      </div>

      {/* Main content area */}
      <div style={{
        margin: '0 var(--space-6)',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-md)',
        minHeight: '70vh',
        padding: 'var(--space-6)',
      }}>

        {/* New Shift button — top right when shifts exist */}
        {shifts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
            >
              New Shift +
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoadingShifts && (
          <p style={{ color: 'var(--color-gray-mid)', fontSize: 'var(--fs-body-sm)' }}>
            Loading shifts...
          </p>
        )}

        {/* Error state */}
        {!isLoadingShifts && shiftError && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-body-sm)' }}>
            {shiftError}
          </p>
        )}

        {/* Empty state — button below text when no shifts */}
        {!isLoadingShifts && !shiftError && shifts.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 'var(--space-4)',
          }}>
            <p style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--fs-heading-2)',
              color: 'var(--color-gray-dark)',
              margin: 0,
            }}>
              No Shifts Scheduled for this Event
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
            >
              New Shift +
            </button>
          </div>
        )}

        {/* Scrollable shift list */}
        {!isLoadingShifts && shifts.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-6)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {shifts.map((shift) => (
              <ShiftCard
                key={shift.volunteer_slot_id}
                shiftId={shift.volunteer_slot_id}
                date={new Date(shift.start_datetime).toLocaleDateString()}
                startTime={new Date(shift.start_datetime).toLocaleTimeString()}
                endTime={new Date(shift.end_datetime).toLocaleTimeString()}
                positionName={shift.position_name}
                filledCount={shift.filled_count}
                capacity={shift.capacity}
                onEdit={() => setShowForm(true)}
                onDelete={() => {}}
              />
            ))}
          </div>
        )}

      </div>

      {/* Shift form modal that refreshes shift list on close */}
      {showForm && (
        <ShiftForm
          onClose={() => {
            setShowForm(false)
            loadShifts();
          }}
          eventId={Number(id)}
          />
      )}

    </main>
  );
}
