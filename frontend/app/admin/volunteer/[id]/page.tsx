'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShiftCard } from '@/components/admin/ShiftCard';
import { ShiftForm } from '@/components/admin/ShiftForm';

export default function VolunteerCreationPage() {
  const { id } = useParams();
  const [showForm, setShowForm] = useState(false);

  // Placeholder empty shifts array —  will get to in later subtask
  const shifts: never[] = [];

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-gray-faint)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Back link */}
      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Link
          href="/admin/events"
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

        {/* Empty state — button below text when no shifts */}
        {shifts.length === 0 && (
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

        {/* Shift list */}
        {shifts.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-6)',
          }}>
            {shifts.map((shift: any) => (
              <ShiftCard
                key={shift.volunteer_slot_id}
                shiftId={shift.volunteer_slot_id}
                date={shift.date}
                startTime={shift.startTime}
                endTime={shift.endTime}
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

      {/* Shift form modal */}
      {showForm && (
        <ShiftForm
          onClose={() => setShowForm(false)}
          eventId={Number(id)}
          />
      )}

    </main>
  );
}
