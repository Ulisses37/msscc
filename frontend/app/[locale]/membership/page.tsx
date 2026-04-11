import React from 'react';
import Button from '@/components/ui/Button';

export default function MembershipPage() {
  return (
    <div>
      <h1>Membership Page</h1>

      {/* Test Button / Placeholder button */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button text="View Event →" padding="6px 10px"/>
        <Button text="Printable Membership Button" padding="15px 30px" fontSize="14px"/>
      </div>
    </div>
  );
}
