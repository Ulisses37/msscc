'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { NextIntlClientProvider, useMessages, useTranslations } from 'next-intl';

import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { FallBack } from '@/components/content/ContentFallBack';
import { MembershipForm } from '@/components/membership/MembershipForm';
import { MembershipOptions } from '@/components/membership/MembershipOptions';
import { MembershipPaymentElement } from '@/components/membership/MembershipPaymentElement';
import { MembershipSummary } from '@/components/membership/MembershipSummary';
import Button from '@/components/ui/Button';

import {
  MEMBERSHIP_OPTIONS,
  type MembershipOptionId,
} from '@/constants/membershipOptions';
import { createMembershipPaymentSession } from '@/services/paymentService';
import type { DbContentBlock } from '@/types/content';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import type { MembershipIdentity, PaymentSession } from '@/types/payment';

import { usePreviewBlocks } from '@/hooks/usePreviewBlocks';
import { fetchPageContent, getCachedPageContent } from '@/utils/content';

export default function MembershipPage() {
  const params = useParams();
  const locale = String(params?.locale ?? 'en');
  const parentMessages = useMessages();
  // This page can be loaded after a navigation from a layout rendered before
  // MembershipPage messages were added. Keep other namespaces from the layout,
  // but supply this page's messages from the same bundle as its UI.
  const membershipMessages = locale === 'ja'
    ? jaMessages.MembershipPage
    : enMessages.MembershipPage;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ ...parentMessages, MembershipPage: membershipMessages }}
    >
      <MembershipPageContent locale={locale} />
    </NextIntlClientProvider>
  );
}

function MembershipPageContent({ locale }: { locale: string }) {
  const t = useTranslations('MembershipPage');
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>(
    getCachedPageContent('membership'),
  );

  // Keep only the stable option ID in page state. The controls, summary, and
  // form validation all use it, so membership details are never duplicated.
  const [selectedOptionId, setSelectedOptionId] =
    useState<MembershipOptionId | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentSessionError, setPaymentSessionError] = useState(false);
  const [membershipInformationValid, setMembershipInformationValid] = useState(false);
  const [membershipIdentity, setMembershipIdentity] = useState<MembershipIdentity | null>(null);
  const [paymentState, setPaymentState] = useState<'ready' | 'confirming' | 'submitted'>('ready');
  const sessionRequestInFlight = useRef(false);
  const sessionRequestVersion = useRef(0);

  const previewReceivedRef = usePreviewBlocks(setContentBlocks);

  const selectedOption =
    MEMBERSHIP_OPTIONS.find((option) => option.id === selectedOptionId) ?? null;

  const handleOptionChange = (optionId: MembershipOptionId) => {
    // An in-flight confirmation may already be charging this option. Do not
    // allow another option/intent until Stripe has returned a failure.
    if (paymentState !== 'ready') return;
    if (optionId === selectedOptionId) return;

    // Invalidate the prior option's in-flight result as well as any prepared
    // client secret; a PaymentIntent for one option cannot pay for another.
    sessionRequestVersion.current += 1;
    sessionRequestInFlight.current = false;
    setSelectedOptionId(optionId);
    setPaymentSession(null);
    setPaymentSessionError(false);
    setIsPreparingPayment(false);
  };

  const handleContinueToPayment = async () => {
    if (!selectedOptionId || !membershipIdentity || sessionRequestInFlight.current || paymentSession) {
      return;
    }

    const requestVersion = ++sessionRequestVersion.current;
    sessionRequestInFlight.current = true;
    setIsPreparingPayment(true);
    setPaymentSessionError(false);

    try {
      const session = await createMembershipPaymentSession({
        membershipOptionId: selectedOptionId,
        ...membershipIdentity,
      });
      if (sessionRequestVersion.current === requestVersion) {
        // SCRUM-508 will mount Stripe Elements using this client secret.
        setPaymentSession(session);
      }
    } catch {
      if (sessionRequestVersion.current === requestVersion) {
        // Never show a raw backend error or Stripe response to the visitor.
        setPaymentSessionError(true);
      }
    } finally {
      if (sessionRequestVersion.current === requestVersion) {
        sessionRequestInFlight.current = false;
        setIsPreparingPayment(false);
      }
    }
  };

  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('membership');

        if (previewReceivedRef.current) {
          return;
        }

        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/media/`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch media list');
      }

      const items = await response.json();

      const formItem = items.find(
        (item: { file_name: string; file_url: string }) =>
          item.file_name === 'Printable_Membership_Form.pdf',
      );

      if (!formItem?.file_url) {
        alert(t('printFormUnavailable'));
        return;
      }

      const fileResponse = await fetch(formItem.file_url);
      const blob = await fileResponse.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Membership_Form.pdf');

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <main className="w-full min-w-0 max-w-full">
      {/* Staff-editable membership content */}
      <section
        className="
          mx-auto w-full min-w-0 max-w-content
          px-4 py-8
          [overflow-wrap:anywhere]
          sm:px-6 sm:py-10
          [&_h2]:text-[clamp(2rem,10vw,4rem)]
        "
      >
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={locale}
          />
        ))}

        {!contentBlocks.length && <FallBack source="membership" />}
      </section>

      {/* Printable membership form */}
      <div className="mb-6 px-4 text-center">
        <Button
          text={t('printForm')}
          padding="12px 24px"
          fontSize="16px"
          onClick={handleDownload}
        />
      </div>

      {/* Membership selection */}
      <section className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-10 sm:px-6">
        <MembershipOptions
          locale={locale}
          selectedOptionId={selectedOptionId}
          onOptionChange={handleOptionChange}
          disabled={paymentState !== 'ready'}
        />

        {/* Lock identity after requesting an intent so its member cannot change. */}
        <MembershipForm
          selectedOptionId={selectedOptionId}
          onValidityChange={setMembershipInformationValid}
          onInformationChange={setMembershipIdentity}
          isInformationLocked={isPreparingPayment || paymentSession !== null || paymentState !== 'ready'}
          onContinueToPayment={handleContinueToPayment}
          isPreparingPayment={isPreparingPayment}
          isPaymentSessionReady={paymentSession !== null}
        >
          <MembershipSummary
            selectedOption={selectedOption}
            locale={locale}
          />
        </MembershipForm>
        {paymentSessionError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {t('paymentSessionError')}
          </p>
        )}
        {/* The PaymentIntent secret only lives in memory and is passed directly
            to Stripe Elements once the validated checkout has a session. */}
        {paymentSession && (
          <MembershipPaymentElement
            key={paymentSession.sessionId}
            clientSecret={paymentSession.clientSecret}
            locale={locale}
            membershipInformationValid={membershipInformationValid}
            onPaymentStateChange={setPaymentState}
          />
        )}
      </section>
    </main>
  );
}
