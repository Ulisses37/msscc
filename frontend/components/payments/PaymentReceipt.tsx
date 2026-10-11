'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { getPaymentReceipt, type PaymentReceipt as Receipt } from '@/services/paymentService';

export function PaymentReceipt({ reference, locale }: { reference: string; locale: string }) {
  const t = useTranslations('PaymentReceipt');
  const options = useTranslations('MembershipPage.options');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setReceipt(null);
    setError(false);
    void getPaymentReceipt(reference).then(
      (data) => { if (active) setReceipt(data); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [reference]);

  if (error) return <p role="alert" className="mt-4 text-slate-700">{t('unavailable')}</p>;
  if (!receipt) return <p role="status" className="mt-4">{t('loading')}</p>;

  let amount: string;
  let date: string;
  try {
    // The backend sends decimal strings and an ISO timestamp. Intl applies the
    // user's locale only for display; neither value comes from URL parameters.
    amount = new Intl.NumberFormat(locale, {
      style: 'currency', currency: receipt.currency.toUpperCase(),
    }).format(Number(receipt.amount));
    date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(receipt.completedAt));
  } catch {
    return <p role="alert" className="mt-4 text-slate-700">{t('unavailable')}</p>;
  }

  return (
    <section aria-label={t('heading')} className="mt-6 w-full max-w-full rounded-md border border-slate-200 bg-white p-4 text-slate-800 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">{t('heading')}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <dt className="font-medium">{t('type')}</dt>
        <dd>{t(receipt.paymentPurpose)}</dd>
        <dt className="font-medium">{t('amount')}</dt>
        <dd>{amount}</dd>
        <dt className="font-medium">{t('date')}</dt>
        <dd>{date}</dd>
        <dt className="font-medium">{t('reference')}</dt>
        <dd className="break-all">{receipt.confirmationReference}</dd>
        {receipt.paymentPurpose === 'membership' && receipt.membershipOption && (
          <>
            <dt className="font-medium">{t('membershipOption')}</dt>
            <dd>{options(receipt.membershipOption)}</dd>
          </>
        )}
        {receipt.paymentPurpose === 'donation' && receipt.donationPurpose && (
          <>
            <dt className="font-medium">{t('donationPurpose')}</dt>
            <dd className="break-words">{receipt.donationPurpose}</dd>
          </>
        )}
      </dl>
    </section>
  );
}