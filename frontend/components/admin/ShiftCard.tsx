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
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    style={{
      border: '0.5px solid var(--color-gray-light)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4) var(--space-6)',
      backgroundColor: 'var(--color-white)',
    }}>

      {/* Date and time */}
      <div className="sm:flex-[0_0_35%]">
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
      <div className="sm:flex-[0_0_40%]">
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
      <div className="flex gap-2 sm:flex-[0_0_20%] sm:justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 sm:flex-none rounded-sm bg-msscc-teal px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-teal-dark transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 sm:flex-none rounded-sm bg-msscc-danger px-4 py-2 text-white text-btn tracking-btn hover:opacity-80 transition-opacity"
        >
          Delete
        </button>
      </div>

    </div>
  );
}
