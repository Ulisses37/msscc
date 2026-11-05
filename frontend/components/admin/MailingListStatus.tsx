'use client';

import { useEffect, useState } from 'react';

import { fetchSubscriptionStatus } from '@/services/subscriptionStatusService';

import type { FinancialRecordResource, SubscriptionStatus } from '@/types/subscriptionStatus';

interface MailingListStatusProps {
  resource: FinancialRecordResource;
  recordId: number;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  subscribed: 'Subscribed (confirmed)',
  pending: 'Confirmation pending',
  unsubscribed: 'Unsubscribed',
  not_recorded: 'No recorded subscription',
  email_unavailable: 'Email unavailable',
};

/** Fetch current consent when details open or the selected record changes. */
export function MailingListStatus({ resource, recordId }: MailingListStatusProps) {
  const [result, setResult] = useState({ key: '', label: 'Loading status…' });
  const key = `${resource}:${recordId}`;

  useEffect(() => {
    const controller = new AbortController();
    setResult({ key, label: 'Loading status…' });
    void fetchSubscriptionStatus(resource, recordId, controller.signal).then(
      (status) => {
        if (!controller.signal.aborted) setResult({ key, label: STATUS_LABELS[status] });
      },
      () => {
        if (!controller.signal.aborted) setResult({ key, label: 'Status unavailable' });
      },
    );
    return () => controller.abort();
  }, [key, resource, recordId]);

  return (
    <div className="space-y-2 border-b border-msscc-gray-light py-3">
      <dt className="text-label uppercase tracking-label text-msscc-gray-mid">Mailing-list status</dt>
      <dd className="space-y-2 text-body-sm text-msscc-gray-dark">
        <span role="status">{result.key === key ? result.label : 'Loading status…'}</span>
      </dd>
    </div>
  );
}