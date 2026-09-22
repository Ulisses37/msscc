'use client';

interface ShiftCardProps {
  shiftId: number;
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      border: '0.5px solid var(--color-gray-light)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4) var(--space-6)',
      backgroundColor: 'var(--color-white)',
    }}>

      {/* Date and time */}
      <div style={{ flex: '0 0 35%' }}>
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
      <div style={{ flex: '0 0 40%' }}>
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

      {/* Edit and Delete buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
