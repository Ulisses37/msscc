'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
// import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { getSlotsByEventId } from '@/services/volunteerService';

interface VolunteerSlot {
  volunteer_slot_id: number;
  position_name: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  capacity: number;
  filled_count: number;
  event: number;
}

export default function VolunteerShiftsPage() {
  const { id, locale } = useParams();
  const router = useRouter();

  const [shifts, setShifts] = useState<VolunteerSlot[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftError, setShiftError] = useState('');

  useEffect(() => {
    const loadShifts = async () => {
      try {
        const data = await getSlotsByEventId(Number(id));
        setShifts(data || []);
      } catch (error) {
        console.error('Failed to fetch volunteer shifts:', error);
        setShiftError('Failed to load volunteer shifts.');
      } finally {
        setIsLoadingShifts(false);
      }
    };

    loadShifts();
  }, [id]);

  return (
    <main style={{
      maxWidth: '75rem',
      margin: '0 auto',
      padding: 'var(--space-10) var(--space-6)',
      fontFamily: 'var(--font-body)',
    }}>
      <Link
        href={`/${locale}/events/${id}`}
        style={{
          color: 'var(--color-teal)',
          fontSize: 'var(--fs-body-sm)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 'var(--space-6)',
        }}
        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        ← Back to event
      </Link>

    </main>
  );
}
