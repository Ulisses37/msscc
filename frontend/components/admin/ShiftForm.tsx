'use client';

interface ShiftFormProps {
  onClose: () => void;
}

export function ShiftForm({ onClose }: ShiftFormProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '30rem',
      }}>

        {/* Modal header */}
        <div style={{
          backgroundColor: 'var(--color-teal)',
          padding: 'var(--space-4) var(--space-6)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-white)',
            fontSize: 'var(--fs-heading-3)',
            margin: 0,
          }}>
            New Shift
          </h2>
        </div>

        {/* Modal body placeholder */}
        <div style={{ padding: 'var(--space-6)' }}>
          <p style={{
            color: 'var(--color-gray-mid)',
            fontSize: 'var(--fs-body-sm)',
            fontFamily: 'var(--font-body)',
          }}>
            Shift fields coming soon.
          </p>

          {/* Confirm and Cancel buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-6)',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-msscc-gray-light px-4 py-2 text-msscc-gray-dark text-btn tracking-btn hover:bg-msscc-gray-faint transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
