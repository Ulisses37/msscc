'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSignupsBySlotId, VolunteerSignup } from '@/services/volunteerService';
import {
  AdminVolunteerForm,
  type VolunteerFormData,
} from '@/components/admin/AdminVolunteerForm';

function formatDateTime(datetime: string): string {
  return new Date(datetime).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VolunteerSignupsPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event_id');
  const [signups, setSignups] = useState<VolunteerSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSignup, setSelectedSignup] = useState<VolunteerSignup | null>(null);

  useEffect(() => {
    const loadSignups = async () => {
      try {
        const data = await getSignupsBySlotId(Number(id));
        setSignups(data || []);
      } catch (err) {
        console.error('Failed to fetch volunteer signups:', err);
        setError('Failed to load volunteer signups.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSignups();
  }, [id]);

  const handleRemoveSignup = async (signup: VolunteerSignup) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${signup.first_name} ${signup.last_name} from this shift?`,
    );

    if (!confirmed) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/${signup.volunteer_signup_id}/`,
        { method: 'DELETE' },
      );

      if (!res.ok) throw new Error('Failed to remove signup.');

      setSignups((prev) =>
        prev.filter((s) => s.volunteer_signup_id !== signup.volunteer_signup_id),
      );

    } catch (err) {
      console.error('Signup removal failed:', err);
      setError('Failed to remove signup. Please try again.');
    }
  };

  const handleAddVolunteer = async (data: VolunteerFormData) => {
    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: Number(id),
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
            status: 'approved',
          }),
        },
      );

      if (!res.ok) throw new Error('Failed to add volunteer.');

      const newSignup = await res.json();
      setSignups((prev) => [newSignup, ...prev]);

      setSaveMessage('Volunteer added successfully.');
      setTimeout(() => {
        setSaveMessage('');
        setShowForm(false);
      }, 1500);

    } catch (err) {
      console.error('Add volunteer failed:', err);
      setSaveError('Failed to add volunteer. Please try again.');
      setTimeout(() => setSaveError(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVolunteer = async (data: VolunteerFormData) => {
    if (!selectedSignup) return;

    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/${selectedSignup.volunteer_signup_id}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
          }),
        },
      );

      if (!res.ok) throw new Error('Failed to update volunteer.');

      const updatedSignup = await res.json();
      setSignups((prev) =>
        prev.map((s) =>
          s.volunteer_signup_id === selectedSignup.volunteer_signup_id ? updatedSignup : s,
        ),
      );

      setSaveMessage('Volunteer updated successfully.');
      setTimeout(() => {
        setSaveMessage('');
        setShowForm(false);
        setIsEditing(false);
        setSelectedSignup(null);
      }, 1500);

    } catch (err) {
      console.error('Update volunteer failed:', err);
      setSaveError('Failed to update volunteer. Please try again.');
      setTimeout(() => setSaveError(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSignup = (signup: VolunteerSignup) => {
    setSelectedSignup(signup);
    setIsEditing(true);
    setShowForm(true);
  };

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-gray-faint)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Back link */}
      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Link
          href={eventId ? `/admin/volunteer/${eventId}` : '/admin/events'}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-teal)',
            fontSize: 'var(--fs-heading-3)',
            margin: 0,
          }}>
            Volunteer Signups
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelectedSignup(null);
              setIsEditing(false);
              setShowForm(true);
            }}
            className="rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
          >
            + Add Volunteer
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <p style={{ color: 'var(--color-gray-mid)', fontSize: 'var(--fs-body-sm)' }}>
            Loading signups...
          </p>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-body-sm)' }}>
            {error}
          </p>
        )}

        {/* Empty state */}
        {!isLoading && !error && signups.length === 0 && (
          <p style={{ color: 'var(--color-gray-mid)', fontSize: 'var(--fs-body-sm)' }}>
            No one has signed up for this shift yet.
          </p>
        )}

        {/* Signup list */}
        {!isLoading && !error && signups.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {signups.map((signup) => (
              <div
                key={signup.volunteer_signup_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                style={{
                  border: '0.5px solid var(--color-gray-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4) var(--space-6)',
                  backgroundColor: 'var(--color-white)',
                }}
              >
                <div>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs-body-sm)',
                    color: 'var(--color-gray-dark)',
                    fontWeight: 700,
                    margin: 0,
                  }}>
                    {signup.first_name} {signup.last_name}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--color-gray-mid)',
                    margin: 0,
                  }}>
                    {signup.email} · {signup.phone}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--color-gray-mid)',
                    margin: 0,
                  }}>
                    Status: {signup.status} · Signed up {formatDateTime(signup.submitted_at)}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => handleEditSignup(signup)}
                    className="rounded-sm bg-msscc-teal px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-teal-dark transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSignup(signup)}
                    className="rounded-sm bg-msscc-danger px-4 py-2 text-white text-btn tracking-btn hover:opacity-80 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {showForm && (
      <AdminVolunteerForm
        initialData={
          isEditing && selectedSignup
            ? {
                firstName: selectedSignup.first_name,
                lastName: selectedSignup.last_name,
                email: selectedSignup.email,
                phone: selectedSignup.phone,
              }
            : undefined
        }
        onClose={() => {
          setShowForm(false);
          setIsEditing(false);
          setSelectedSignup(null);
        }}
        onSubmit={isEditing ? handleUpdateVolunteer : handleAddVolunteer}
        isSubmitting={isSubmitting}
        submitLabel={isEditing ? 'Save Changes' : 'Add Volunteer'}
        successMessage={saveMessage}
        errorMessage={saveError}
      />
    )}

    </main>
  );
}
