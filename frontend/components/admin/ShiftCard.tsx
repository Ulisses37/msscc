'use client';

import Link from 'next/link';

interface ShiftCardProps {
  shiftId: number;
  eventId: number;
  date: string;
  startTime: string;
  endTime: string;
  positionName: string;
  filledCount: number;
  capacity: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShiftCard({
  shiftId,
  eventId,
  date,
  startTime,
  endTime,
  positionName,
  filledCount,
  capacity,
  onEdit,
  onDelete,
}: ShiftCardProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      style={{
        border: '0.5px solid var(--color-gray-light)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-6)',
        backgroundColor: 'var(--color-white)',
      }}
    >

      {/* Date and time */}
      <div className="sm:flex-1">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-dark)',
          fontWeight: 700,
          margin: 0,
        }}>
          {date}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          {startTime} - {endTime}
        </p>
      </div>

      {/* Position name and filled count */}
      <div className="sm:flex-1">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-dark)',
          fontWeight: 700,
          margin: 0,
        }}>
          {positionName}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-caption)',
          color: '#dc2626',
          margin: 0,
        }}>
          {filledCount} of {capacity} filled
        </p>
      </div>

      {/* View Volunteers, Edit and Delete buttons */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:flex-[0_0_auto] sm:justify-end">
        <Link
          href={`/admin/volunteer/${shiftId}/signups?event_id=${eventId}`}
          className="rounded-sm bg-msscc-pink px-3 py-2 text-white no-underline text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors text-center whitespace-nowrap"
          style={{ color: '#FFFFFF' }}
        >
          View Volunteers
        </Link>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-sm bg-msscc-teal px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-teal-dark transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-sm bg-msscc-danger px-4 py-2 text-white text-btn tracking-btn hover:opacity-80 transition-opacity"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
