'use client';

import React, { useState, useEffect } from 'react';
import Button from './Button';

interface SupportFormProps {
  onClose: () => void;
}

export default function SupportForm({ onClose }: SupportFormProps) {
  // idle → submitting → success OR error
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // Stores all user input fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    description: '',
  });

  /**
   * ESC KEY HANDLING + SCROLL LOCK
   * When the modal opensn disable page scrolling and add Escape key listener 
   * When the modal closes restore original scroll behavior,Remove Escape listener
   */
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  /**
   *  FORM SUBMISSION LOGIC
   * sets status to "submitting", sends data to your API route,
   * and updates status based on success or failure.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      // 1. Point to your actual backend (e.g., localhost:8000)
      // 2. Ensure headers include Content-Type
      const res = await fetch('http://localhost:8000/api/admin/admin_support/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          is_deleted: false, // Match the boolean column in your ERD
        }),
      });

      if (!res.ok) {
  const errorDetails = await res.json();
  console.error("DEBUG: Backend rejected request because:", errorDetails);
  throw new Error();
}
      if (!res.ok) throw new Error('Server responded with an error');

      setStatus('success');
    } catch (err) {
      console.error("Submission error:", err);
      setStatus('error');
    }
  };

  /**
   *  SUCCESS STATE UI
   * If the form submitted successfully, show a confirmation message instead of the form.
   */
  if (status === 'success') {
    return (
      <div className="p-10 text-center animate-in fade-in zoom-in duration-200">
        <div className="text-green-500 mb-4 text-5xl">✓</div>
        <h3 className="text-xl font-bold text-gray-900">Request Received</h3>
        <p className="text-sm text-gray-500 mt-2 mb-8">
          We will review your message shortly.
        </p>
        <Button text="Close" onClick={onClose} width="120px" />
      </div>
    );
  }

  return (
    <div className="relative p-8 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Technical Support</h2>

        {/* Close button (X icon) */}
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* FORM START */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/*INPUT VALIDATION 
            HTML5 validation happens here via the "required" attribute. 
            This is where the browser checks:
              - Name must not be empty
              - Email must not be empty AND must be a valid email format
              - Subject must not be empty
              - Description must not be empty*/}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Name
            </label>
            <input
              required  // <-- INPUT VALIDATION
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#d72638] border-gray-300 outline-none transition-shadow"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Email
            </label>
            <input
              required  // <-- INPUT VALIDATION
              type="email" // <-- EMAIL FORMAT VALIDATION
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#d72638] border-gray-300 outline-none transition-shadow"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Subject
          </label>
          <input
            required  // <-- INPUT VALIDATION
            className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#d72638] border-gray-300 outline-none transition-shadow"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Issue Description
          </label>
          <textarea
            required  // <-- INPUT VALIDATION
            rows={4}
            className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#d72638] border-gray-300 outline-none resize-none transition-shadow"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Error message (only shown if API call fails) */}
        {status === 'error' && (
          <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2">
            Something went wrong. Please check your connection and try again.
          </div>
        )}

        {/* Submit button */}
        <div className="pt-2">
          <Button
            text={status === 'submitting' ? 'Sending...' : 'Submit Support Request'}
            width="100%"
            height="48px"
            fontSize="14px"
          />
        </div>
      </form>
    </div>
  );
}
