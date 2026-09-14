'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function VolunteerShiftsPage() {
  const { id, locale } = useParams();
  const router = useRouter();

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

      {/* Temporary test button */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <Button
          text="Go to Signup (Test)"
          onClick={() => router.push(`/${locale}/volunteer/${id}/signup`)}
        />
      </div>

    </main>
  );
}
