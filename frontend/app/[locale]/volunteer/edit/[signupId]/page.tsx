'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function VolunteerEditPage() {
  const t = useTranslations('VolunteerEditPage');
  const { signupId, locale } = useParams();
  const router = useRouter();

  // State Management
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  
  // UI Popup States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const validatePhone = (phone: string) => {
    const phoneRegex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
    return phoneRegex.test(phone);
  };

  useEffect(() => {
    const fetchSignupData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/${signupId}/`);
        if (!response.ok) throw new Error('Volunteer registration request failed.');
        
        const data = await response.json();
        setFormData({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || '',
        });
        setEventTitle(data.event_details?.title || t('defaultEvent'));
      } catch (fetchError) {
        console.error('Failed to load volunteer registration:', fetchError);
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchSignupData();
  }, [signupId, t]);

  const handleUpdate = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!validatePhone(formData.phone)) {
      setError(t('phoneError'));
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/${signupId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Volunteer registration update failed.');
      
      setSuccessMessage(t('saved'));
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (updateError) {
      console.error('Failed to update volunteer registration:', updateError);
      setError(t('updateError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/${signupId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Volunteer registration deletion failed.');
      router.push(`/${locale}/events`);
    } catch (deleteError) {
      console.error('Failed to cancel volunteer registration:', deleteError);
      setError(t('deleteError'));
      setShowDeleteConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <main style={{ padding: '4rem', textAlign: 'center' }}>{t('loading')}</main>;

  return (
    <main style={{ maxWidth: '75rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-body)' }}>
      
      {/* DELETE CONFIRMATION SITE POPUP */}
     {/* DELETE CONFIRMATION SITE POPUP */}
{/* DELETE CONFIRMATION SITE POPUP */}
{showDeleteConfirm && (
  <div style={modalOverlayStyle}>
    <div style={modalContentStyle}>
      <h2 style={{ color: '#d72638', marginBottom: '1rem', fontSize: '1.5rem' }}>{t('confirmationTitle')}</h2>
      <p style={{ marginBottom: '2rem', fontSize: '1rem' }}>
        {t('confirmationMessage', { event: eventTitle })}
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
        {/* Primary Action: Yes, Cancel */}
        <Button 
          text={isProcessing ? '...' : t('confirmCancel')}
          onClick={handleDelete} 
          width="140px"
          padding="12px 0px" 
        />
        
        {/* Secondary Action: Go Back (Now using the same Button component) */}
        <div className="secondary-button-wrapper" style={{ 
          filter: 'invert(0)' 
        }}>
          <Button 
            text={t('goBack')}
            onClick={() => setShowDeleteConfirm(false)}
            width="140px"
            padding="12px 0px"
            // We can pass custom styles if your Button component supports them,
            // otherwise, we can use a simple wrapper to handle the "Go Back" style
          />
        </div>
      </div>
    </div>
  </div>
)}
      <Link href={`/${locale}/events`} style={{ color: 'var(--color-teal)', textDecoration: 'none' }}>
        ← {t('backToEvents')}
      </Link>

      <section style={{ marginTop: 'var(--space-8)' }}>
        <h1 style={{ color: '#d72638' }}>{t('heading')}</h1>
        <h2>{eventTitle}</h2>
      </section>

      <hr style={{ border: '0.5px solid var(--color-gray-light)', margin: 'var(--space-10) 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {error && (
            <div style={{ padding: '1rem', backgroundColor: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', color: '#c53030' }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{ padding: '1rem', backgroundColor: '#f0fff4', border: '1px solid #68d391',
             borderRadius: '8px', color: '#2f855a', fontWeight: 600 }}>
              {successMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input required placeholder={t('firstName')} style={inputStyle} value={formData.first_name}
             onChange={e => setFormData({...formData, first_name: e.target.value})} />
            <input required placeholder={t('lastName')} style={inputStyle} value={formData.last_name}
             onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>

          <input type="email" required placeholder={t('email')} style={inputStyle} value={formData.email}
           onChange={e => setFormData({...formData, email: e.target.value})} />
          
          <div>
            <input 
              type="tel" 
              required
              placeholder={t('phone')}
              style={inputStyle} 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
              title={t('phoneHelp')}
            />
            <small style={{ color: 'var(--color-gray-mid)', marginTop: '4px', display: 'block' }}>{t('phoneHint')}</small>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Button 
              text={isProcessing && !showDeleteConfirm ? t('saving') : t('update')}
              onClick={handleUpdate}
              padding="12px 32px"
            />
            <Button 
              text={t('cancel')}
              onClick={() => setShowDeleteConfirm(true)}
              padding="12px 32px"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// Styles consistent with msscc project
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-gray-light)', backgroundColor: 'white' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
   backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px',
   maxWidth: '30rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' };
