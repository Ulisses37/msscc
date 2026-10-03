'use client';

import { useState } from 'react';

export interface VolunteerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface AdminVolunteerFormProps {
  initialData?: VolunteerFormData;
  onClose: () => void;
  onSubmit: (data: VolunteerFormData) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  successMessage?: string;
  errorMessage?: string;
}

export function AdminVolunteerForm({
  initialData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  },
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Add Volunteer',
  successMessage = '',
  errorMessage = '',
}: AdminVolunteerFormProps) {
  const [formData, setFormData] = useState<VolunteerFormData>({ ...initialData });
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async () => {
    setSaveError('');

    const missingFields = [];
    if (!formData.firstName) missingFields.push('First Name');
    if (!formData.lastName) missingFields.push('Last Name');
    if (!formData.email) missingFields.push('Email');
    if (!formData.phone) missingFields.push('Phone');

    if (missingFields.length > 0) {
      setSaveError(`Please fill in the following required fields: ${missingFields.join(', ')}.`);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setSaveError('Please enter a valid email address.');
      return;
    }

    // Validate phone number length (10 digits, ignoring formatting characters)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setSaveError('Please enter a valid 10-digit phone number.');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Volunteer form submission failed:', error);
      setSaveError('Failed to save volunteer. Please try again.');
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
            {submitLabel === 'Add Volunteer' ? 'Add Volunteer' : 'Edit Volunteer'}
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

          {/* First Name */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              First Name <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Last Name <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Email <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Phone <span className="text-msscc-danger">*</span>
            </label>
            <input
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
