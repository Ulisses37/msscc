'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getEventById } from '@/services/eventService'; 
import { getSlotsByEventId, submitVolunteerSignup } from '@/services/volunteerService'; 
import type { Event } from '@/types/event';
import Button from '@/components/ui/Button';

export default function VolunteerSignupPage() {
  const { id, locale } = useParams();
  const router = useRouter();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<any | null>(null);
  
  const [selectedSlotId, setSelectedSlotId] = useState<number | ''>('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate phone number before proceeding
    if (!validatePhone(formData.phone)) {
      setSubmitError("Please enter a valid phone number (e.g., 123-456-7890).");
      return;
    }

    setIsSubmitting(true);
    const payload = { 
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      slot_id: selectedSlotId === '' ? null : Number(selectedSlotId),
      status: 'pending'
    };

    try {
      const res = await submitVolunteerSignup(payload);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData) || "Submission failed.");
      }
      const successData = await res.json();
      setSubmittedData(successData); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: '4rem', textAlign: 'center' }}>Loading...</main>;

  return (
    <main style={{ maxWidth: '75rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-body)' }}>
      
      {/* SUCCESS CONFIRMATION MODAL */}
      {submittedData && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={modalHeadingStyle}>Registration Confirmed!</h2>
            <p style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.1rem' }}>Please save this information:</p>
            <div style={infoBoxStyle}>
              <p><strong>Signup ID:</strong> <span style={{ color: '#d72638', fontWeight: 800 }}>{submittedData.volunteer_signup_id}</span></p>
              <p><strong>Event:</strong> {event?.title}</p>
              <p><strong>Name:</strong> {submittedData.first_name} {submittedData.last_name}</p>
              <p><strong>Email:</strong> {submittedData.email}</p>
              <p><strong>Phone:</strong> {submittedData.phone || 'N/A'}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button text="Finish & Return" onClick={() => router.push(`/${locale}/events/${id}`)} padding="12px 48px" />
            </div>
          </div>
        </div>
      )}

      <Link href={`/${locale}/events/${id}`} style={{ color: 'var(--color-teal)', textDecoration: 'none' }}>← Back to Event</Link>

      <section style={{ marginTop: 'var(--space-8)' }}>
        <h1 style={{ color: '#d72638' }}>Volunteer Signup</h1>
        <h2>{event?.title}</h2>
      </section>

      <hr style={{ border: '0.5px solid var(--color-gray-light)', margin: 'var(--space-10) 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {submitError && (
            <div style={{ padding: '1rem', backgroundColor: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', color: '#c53030' }}>
              {submitError}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>Position (Optional)</label>
            <select style={inputStyle} value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">-- General Volunteer --</option>
              {slots.filter(s => s.filled_count < s.capacity).map(slot => (
                <option key={slot.volunteer_slot_id} value={slot.volunteer_slot_id}>{slot.position_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input required placeholder="First Name" style={inputStyle} value={formData.first_name}
             onChange={e => setFormData({...formData, first_name: e.target.value})} />
            <input required placeholder="Last Name" style={inputStyle} value={formData.last_name} 
            onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>

          <input type="email" required placeholder="Email" style={inputStyle} value={formData.email}
           onChange={e => setFormData({...formData, email: e.target.value})} />
          
          {/* Phone Input with validation and hover tooltip */}
          <div>
            <input 
              type="tel" 
              required
              placeholder="Phone Number (e.g. 123-456-7890)" 
              style={inputStyle} 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
              title="Please enter a 10-digit phone number (e.g., 123-456-7890)"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button text={isSubmitting ? "Processing..." : "Register Now"} />
          </div>
        </form>
      </div>
    </main>
  );
}

// Re-usable styles
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-gray-light)', backgroundColor: 'white' };
const modalOverlayStyle: React.CSSProperties =
 { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)',
   display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' };
const modalContentStyle: React.CSSProperties = 
{ backgroundColor: 'white', padding: '3rem', borderRadius: '12px', maxWidth: '42rem', width: '100%',
   boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', textAlign: 'left' };
const modalHeadingStyle: React.CSSProperties =
 { color: '#d72638', marginBottom: '2rem', textAlign: 'center', fontSize: '2.5rem', fontWeight: 800 };
const infoBoxStyle: React.CSSProperties = 
{ backgroundColor: '#f8f9fa', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', lineHeight: '2.2', fontSize: '1.1rem' };