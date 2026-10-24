'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { getPaymentReceipt, type PaymentReceipt as Receipt } from '@/services/paymentService';
import { formatCurrency } from '@/utils/formatCurrency';

/** View-only details loaded after a result page confirms a completed payment. */
export function PaymentReceipt({ reference, locale }: { reference: string; locale: string }) {
  const t = useTranslations('PaymentReceipt');
  const options = useTranslations('MembershipPage.options');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // A reference change or unmount makes the earlier request stale; never
    // display its receipt for a different payment or after navigation.
    let active = true;
    setReceipt(null);
    setError(false);
    void getPaymentReceipt(reference).then(
      (data) => { if (active) setReceipt(data); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [reference]);

  // Receipt failures are separate from payment status. The parent continues
  // showing its backend-confirmed success even when this read fails.
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
        {/* Show saved breakdowns only; legacy memberships have no base amount. */}
        {receipt.baseAmount &&
          receipt.processingCostContribution && (
          <>
            <dt className="font-medium">{t('baseAmount')}</dt>
            <dd>{formatCurrency(Number(receipt.baseAmount), locale, receipt.currency.toUpperCase())}</dd>
            <dt className="font-medium">{t('processingCostAmount')}</dt>
            <dd>{formatCurrency(Number(receipt.processingCostContribution), locale, receipt.currency.toUpperCase())}</dd>
          </>
        )}
        <dt className="font-medium">{t('amount')}</dt>
        <dd>{amount}</dd>
        <dt className="font-medium">{t('date')}</dt>
        <dd>{date}</dd>
        <dt className="font-medium">{t('reference')}</dt>
        <dd className="break-all">{receipt.confirmationReference}</dd>
        {/* Catalog option IDs are translated; never show backend IDs or a
            legacy free-text membership type as a receipt option. */}
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