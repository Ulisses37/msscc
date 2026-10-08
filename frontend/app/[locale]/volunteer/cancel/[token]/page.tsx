'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import {
  getVolunteerCancellationDetails,
  type VolunteerCancellationDetails,
} from '@/services/volunteerService';

export default function VolunteerCancellationPage() {
  const params = useParams<{ token: string }>();
  const locale = useLocale();
  const t = useTranslations('VolunteerCancellationPage');
  const [details, setDetails] = useState<VolunteerCancellationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadCancellationDetails = async () => {
      try {
        const cancellationDetails = await getVolunteerCancellationDetails(params.token);
        setDetails(cancellationDetails);
      } catch (error) {
        console.error('Failed to load volunteer cancellation details:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadCancellationDetails();
  }, [params.token]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-content px-6 py-10 text-center">
        <p className="font-body text-body text-msscc-gray-mid">{t('loading')}</p>
      </section>
    );
  }

  if (hasError || !details) {
    return (
      <section className="mx-auto max-w-content px-6 py-10 text-center">
        <div className="mx-auto max-w-prose border border-msscc-danger bg-msscc-gray-faint p-6">
          <h1 className="font-heading text-display text-msscc-teal">{t('errorTitle')}</h1>
          <p className="mt-4 font-body text-body text-msscc-gray-dark">{t('errorMessage')}</p>
        </div>
      </section>
    );
  }

  const eventTitle = locale === 'ja' && details.event_title_ja
    ? details.event_title_ja
    : details.event_title_en;
  const shiftDateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).formatRange(
    new Date(details.slot_start_datetime),
    new Date(details.slot_end_datetime),
  );

  return (
    <section className="mx-auto max-w-content px-6 py-10 text-center">
      <div className="mx-auto max-w-prose border border-msscc-gray-light bg-msscc-white p-6 sm:p-10">
        <h1 className="font-heading text-display text-msscc-teal">{t('title')}</h1>
        <p className="mt-4 font-body text-body text-msscc-gray-dark">{t('description')}</p>

        <dl className="mt-8 divide-y divide-msscc-gray-light border-y border-msscc-gray-light">
          <div className="grid gap-1 py-4 text-center sm:grid-cols-3 sm:gap-6">
            <dt className="font-body text-body-sm font-semibold text-msscc-gray-mid">{t('name')}</dt>
            <dd className="font-body text-body text-msscc-gray-dark sm:col-span-2">
              {details.first_name} {details.last_name}
            </dd>
          </div>
          <div className="grid gap-1 py-4 text-center sm:grid-cols-3 sm:gap-6">
            <dt className="font-body text-body-sm font-semibold text-msscc-gray-mid">{t('event')}</dt>
            <dd className="font-body text-body text-msscc-gray-dark sm:col-span-2">{eventTitle}</dd>
          </div>
          <div className="grid gap-1 py-4 text-center sm:grid-cols-3 sm:gap-6">
            <dt className="font-body text-body-sm font-semibold text-msscc-gray-mid">{t('shift')}</dt>
            <dd className="font-body text-body text-msscc-gray-dark sm:col-span-2">{shiftDateTime}</dd>
          </div>
          <div className="grid gap-1 py-4 text-center sm:grid-cols-3 sm:gap-6">
            <dt className="font-body text-body-sm font-semibold text-msscc-gray-mid">{t('role')}</dt>
            <dd className="font-body text-body text-msscc-gray-dark sm:col-span-2">{details.role}</dd>
          </div>
        </dl>

        <p className="mt-6 font-body text-body-sm text-msscc-gray-mid">{t('reviewNotice')}</p>
      </div>
    </section>
  );
}