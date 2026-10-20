'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getEventById } from '@/services/eventService';
import { getSlotsByEventId, submitVolunteerSignup } from '@/services/volunteerService';
import type { Event } from '@/types/event';
import Button from '@/components/ui/Button';

// Keep this in step with the comments limit in the signup serializer
const COMMENTS_MAX_LENGTH = 500;

export default function VolunteerSignupPage() {
  const t = useTranslations('VolunteerSignupPage');
  const { id, locale } = useParams();
  const router = useRouter();

  interface VolunteerSlot {
    volunteer_slot_id: number;
    position_name: string;
    description: string | null;
    start_datetime: string;
    end_datetime: string;
    capacity: number;
    filled_count: number;
  }

  interface SignupSuccessData {
    volunteer_signup_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  }

  const [event, setEvent] = useState<Event | null>(null);
  const [slots, setSlots] = useState<VolunteerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<SignupSuccessData | null>(null);
  // The shifts page links here with ?slot_id=<shift>
  const slotIdParam = useSearchParams().get('slot_id');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    comments: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventIdNum = Number(id);
        const [eventData, slotsData] = await Promise.all([
          getEventById(eventIdNum),
          getSlotsByEventId(eventIdNum)
        ]);
        setEvent(eventData ?? null);
        setSlots(slotsData || []);
      } catch (error) {
        console.error("Error loading volunteer data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  /**
   * Validates phone format: supports 123-456-7890, (123) 456-7890, or 1234567890
   */
  const validatePhone = (phone: string) => {
    const phoneRegex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
    return phoneRegex.test(phone);
  };

  // Without a slot_id this is a general signup for the event
  const selectedSlot = slotIdParam
    ? slots.find((slot) => slot.volunteer_slot_id === Number(slotIdParam))
    : undefined;
  const isShiftMissing = Boolean(slotIdParam) && !selectedSlot;
  const isShiftFull = selectedSlot
    ? selectedSlot.filled_count >= selectedSlot.capacity
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate phone number before proceeding
    if (!validatePhone(formData.phone)) {
      setSubmitError(t('phoneError'));
      return;
    }

    setIsSubmitting(true);
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      comments: formData.comments.trim() || null,                     // A blank or whitespace-only comment is stored as no comment
      slot_id: selectedSlot ? selectedSlot.volunteer_slot_id : null,
    };

    try {
      const res = await submitVolunteerSignup(payload);
      if (!res.ok) {
        throw new Error('Volunteer signup request failed.');
      }
      const successData = await res.json();
      setSubmittedData(successData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to submit volunteer registration:', error);
      setSubmitError(t('submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: '4rem', textAlign: 'center' }}>{t('loading')}</main>;

  if (!event) {
    return <main style={{ padding: '4rem', textAlign: 'center' }}>{t('eventNotFound')}</main>;
  }

  const title = locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn;

  const dateLocale = locale === 'ja' ? 'ja-JP' : 'en-US';
  const formatShiftDate = (datetime: string) =>
    new Date(datetime).toLocaleDateString(dateLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  const formatShiftTime = (datetime: string) =>
    new Date(datetime).toLocaleTimeString(dateLocale, {
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <main style={{ maxWidth: '75rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-body)' }}>

      {/* SUCCESS CONFIRMATION MODAL */}
      {submittedData && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={modalHeadingStyle}>{t('confirmationTitle')}</h2>
            <p style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.1rem' }}>
              {t('saveInformation')}
            </p>
            <div style={infoBoxStyle}>
              <p><strong>{t('signupId')}</strong> <span style={{ color: '#d72638', fontWeight: 800 }}>{submittedData.volunteer_signup_id}</span></p>
              <p><strong>{t('event')}</strong> {title}</p>
              <p><strong>{t('name')}</strong> {submittedData.first_name} {submittedData.last_name}</p>
              <p><strong>{t('email')}</strong> {submittedData.email}</p>
              <p><strong>{t('phone')}</strong> {submittedData.phone || t('notAvailable')}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button text={t('finish')} onClick={() => router.push(`/${locale}/events/${id}`)} padding="12px 48px" />
            </div>
          </div>
        </div>
      )}

      <Link href={`/${locale}/volunteer/${id}`} style={{ color: 'var(--color-teal)', textDecoration: 'none' }}>← {t('backToShifts')}</Link>

      <section style={{ marginTop: 'var(--space-8)' }}>
        <h1 style={{ color: '#d72638' }}>{t('heading')}</h1>
        <h2>{title}</h2>
      </section>

      <hr style={{ border: '0.5px solid var(--color-gray-light)', margin: 'var(--space-10) 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isShiftMissing || isShiftFull ? (
          <div style={{ width: '100%', maxWidth: '40rem', padding: '1rem', backgroundColor: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', color: '#c53030' }}>
            {isShiftFull ? t('shiftFull') : t('shiftNotFound')}
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {submitError && (
            <div style={{ padding: '1rem', backgroundColor: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', color: '#c53030' }}>
              {submitError}
            </div>
          )}

          {/* The shift being signed up for */}
          <div>
            <p style={{ marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 700, color: '#d72638' }}>
              {t('shiftHeading')}
            </p>
            {selectedSlot ? (
              <>
                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>{selectedSlot.position_name}</p>
                <p>{formatShiftDate(selectedSlot.start_datetime)}</p>
                <p>
                  {formatShiftTime(selectedSlot.start_datetime)} – {formatShiftTime(selectedSlot.end_datetime)}
                </p>
                {selectedSlot.description && (
                  <p style={{ marginTop: '0.5rem', overflowWrap: 'anywhere' }}>{selectedSlot.description}</p>
                )}
              </>
            ) : (
              <p style={{ fontWeight: 700 }}>{t('generalVolunteer')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder={t('firstName')} style={inputStyle} value={formData.first_name}
             onChange={e => setFormData({...formData, first_name: e.target.value})} />
            <input required placeholder={t('lastName')} style={inputStyle} value={formData.last_name}
            onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>

          <input type="email" required placeholder={t('emailPlaceholder')} style={inputStyle} value={formData.email}
           onChange={e => setFormData({...formData, email: e.target.value})} />

          {/* Phone Input with validation and hover tooltip */}
          <div>
            <input
              type="tel"
              required
              placeholder={t('phonePlaceholder')}
              style={inputStyle}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              title={t('phoneHelp')}
            />
          </div>

          {/* Optional comment for the organizers */}
          <div>
            <label
              htmlFor="volunteer-comments"
              style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}
            >
              {t('commentsLabel')}
            </label>
            <textarea
              id="volunteer-comments"
              rows={4}
              maxLength={COMMENTS_MAX_LENGTH}
              placeholder={t('commentsPlaceholder')}
              aria-describedby="volunteer-comments-count"
              style={{
                ...inputStyle,
                minHeight: '8rem',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              value={formData.comments}
              onChange={e => setFormData({ ...formData, comments: e.target.value })}
            />
            <p
              id="volunteer-comments-count"
              style={{
                marginTop: '0.25rem',
                textAlign: 'right',
                fontSize: '0.875rem',
                color: 'var(--color-gray-mid)',
              }}
            >
              {t('commentsCount', {
                count: formData.comments.length,
                max: COMMENTS_MAX_LENGTH,
              })}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button text={isSubmitting ? t('processing') : t('register')} />
          </div>
        </form>
        )}
      </div>
    </main>
  );
}

// Re-usable styles
const inputStyle = { width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid var(--color-gray-light)', backgroundColor: 'white' };
const modalOverlayStyle: React.CSSProperties =
 { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)',
   display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' };
const modalContentStyle: React.CSSProperties =
{ backgroundColor: 'white', padding: 'clamp(1.25rem, 5vw, 3rem)', borderRadius: '12px', maxWidth: '42rem', width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', textAlign: 'left' };
const modalHeadingStyle: React.CSSProperties =
 { color: '#d72638', marginBottom: '1.25rem', textAlign: 'center', fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 800 };
const infoBoxStyle: React.CSSProperties =
{ backgroundColor: '#f8f9fa', padding: 'clamp(1rem, 4vw, 2rem)', borderRadius: '8px', marginBottom: '1.5rem', lineHeight: '1.8', fontSize: '1rem', overflowWrap: 'anywhere' };
