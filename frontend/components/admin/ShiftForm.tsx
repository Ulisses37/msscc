'use client';

import { useState } from 'react';

export interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  positionName: string;
  description: string;
  capacity: string;
}

interface ShiftFormProps {
  onClose: () => void;
  onSubmit: (data: ShiftFormData) => Promise<void>;
  submitLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  isSubmitting?: boolean;
  initialData?: ShiftFormData;
}

export function ShiftForm({
  onClose,
  onSubmit,
  submitLabel = 'Confirm',
  successMessage = '',
  errorMessage = '',
  isSubmitting = false,
  initialData = {
    date: '',
    startTime: '',
    endTime: '',
    positionName: '',
    description: '',
    capacity: '',
  },
}: ShiftFormProps) {
  const [formData, setFormData] = useState({
  ...initialData,
});
  // const [isSubmitting, setIsSubmitting] = useState(false);
  // const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async () => {
    // setSaveMessage('');
    setSaveError('');

    // Validate required fields
    const missingFields = [];
    if (!formData.date) missingFields.push('Date');
    if (!formData.startTime) missingFields.push('Start Time');
    if (!formData.endTime) missingFields.push('End Time');
    if (!formData.positionName) missingFields.push('Job Name');
    if (!formData.capacity) missingFields.push('Number of Volunteers');

    if (missingFields.length > 0) {
      setSaveError(`Please fill in the following required fields: ${missingFields.join(', ')}.`);
      return;
    }

    // Validate end time is not before start time
    if (formData.startTime && formData.endTime) {
      if (formData.endTime < formData.startTime) {
        setSaveError('End time cannot be before start time.');
        return;
      }
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Shift form submission failed:', error);
      setSaveError('Failed to save shift. Please try again.');
    }
  };

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
      padding: 'var(--space-4)',
    }}>
      <div style={{
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '30rem',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Modal header */}
        <div style={{
          backgroundColor: 'var(--color-teal)',
          padding: 'var(--space-4) var(--space-6)',
          flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-white)',
            fontSize: 'var(--fs-heading-3)',
            margin: 0,
          }}>
            {submitLabel === 'Confirm' ? 'New Shift' : 'Edit Shift'}
          </h2>
        </div>

        {/* Modal body */}
        <div style={{
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          overflowY: 'auto',
          }}>

          {/* Date */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Date <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Start and End time side by side */}
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{ flex: 1 }}>
              <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                Start Time <span className="text-msscc-danger">*</span>
              </label>
              <input
                required
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                End Time <span className="text-msscc-danger">*</span>
              </label>
              <input
                required
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
              />
            </div>
          </div>

          {/* Position Name */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Job Name <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Booth Attendant"
              value={formData.positionName}
              onChange={(e) => setFormData({ ...formData, positionName: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Greet visitors at the booth"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Number of Volunteers Wanted <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="number"
              min="1"
              placeholder="e.g. 5"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Feedback messages */}
          <div className="h-6">
            {successMessage && (
              <p className="text-body-sm text-msscc-teal">{successMessage}</p>
            )}
            {(errorMessage || saveError) && (
              <p className="text-body-sm text-msscc-danger">{errorMessage || saveError}</p>
            )}
          </div>

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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
