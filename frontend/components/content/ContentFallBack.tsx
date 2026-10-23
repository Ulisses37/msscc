'use client';

import Image from 'next/image';
import img from '@/assets/Placeholder.png';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { ContentDisplayState } from '@/hooks/useDelayedFallback';

export type FallbackSource = "home" | "about" | "partners" | "membership" | "events" | "support";

function FallbackContent({ source }: { source: FallbackSource }) {
  const t = useTranslations('ContentFallback');
  const headingClass = "font-heading text-[64px] font-normal text-[#D72638]";
  const paragraphClass = "whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]";

  switch (source) {
    case 'home':
      return (
        <div>
          <h2 className={headingClass}>{t('home.heading1')}</h2><br />
          <p className={paragraphClass}>{t('home.body1')}</p><br />
          <h2 className={headingClass}>{t('home.heading2')}</h2><br />
          <p className={paragraphClass}>{t('home.body2')}</p><br />
        </div>
      );
    case 'about':
      return (
        <div>
          <h2 className={headingClass}>{t('about.aboutHeading1')}</h2><br />
          <p className={paragraphClass}>{t('about.body1')}</p><br />
          <h2 className={headingClass}>{t('about.aboutHeading2')}</h2><br />
          <p className={paragraphClass}>{t('about.body2')}</p><br />
        </div>
      );
    case 'partners':
    case 'events':
      return (
        <div>
          <h2 className={headingClass}>{t('events.eventHeading1')}</h2><br />
          <p className={paragraphClass}>{t('events.body1')}</p><br />
          <p className={paragraphClass}>{t('events.body2')}</p><br />
          <h2 className={headingClass}>{t('events.eventHeading2')}</h2><br />
          <p className={paragraphClass}>{t('events.body3')}</p><br />
        </div>
      );
    case 'membership':
      return (
        <div>
          <h2 className={headingClass}>{t('membership.membershipHeading1')}</h2><br />
          <p className={paragraphClass}>{t('membership.body1')}</p><br />
          <p className={paragraphClass}>{t('membership.body2')}</p><br />
          <h2 className={headingClass}>{t('membership.membershipHeading2')}</h2><br />
          <p className={paragraphClass}>{t('membership.body3')}</p>
        </div>
      );
    case 'support':
      return (
        <div>
          <h2 className={headingClass}>{t('support.supportHeading1')}</h2><br />
          <p className={paragraphClass}>
            {t('support.body1')}{"\n\n"}
            {t('support.body2')}{"\n\n"}
            {t('support.body3')}
          </p><br />
          <h2 className={headingClass}>{t('support.supportHeading2')}</h2><br />
          <p className={paragraphClass}>{t('support.body4')}</p>
        </div>
      );
  }
}


export function FallBack({ source }: { source: FallbackSource }) {
  const t = useTranslations('ContentFallback');

  return (
    <section className="mx-auto max-w-content px-6 py-10">

      <h3 className="font-heading text-[18px] font-bold text-msscc-teal">{t('noticeHeading')}</h3><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        {t('noticeBody')}
      </p><br />
      <div className="flex justify-center">
        <Image src={img} alt={t('illustrationAlt')} className="item-center text-center h-auto max-w-full" />
      </div>

      <div>
        <br/>
        <FallbackContent source={source} />
      </div>
    </section>
  );
}

export function ContentLoading() {
  const t = useTranslations('ContentFallback');

  return (
    <div
      role="status"
      aria-live="polite"
      className="py-10 text-center font-body text-body text-msscc-gray-mid"
    >
      {t('loading')}
    </div>
  );
}

interface ContentStateTransitionProps {
  state: ContentDisplayState;
  source: FallbackSource;
  children: ReactNode;
}

export function ContentStateTransition({
  state,
  source,
  children,
}: ContentStateTransitionProps) {
  return (
    <div key={state} className="content-state-fade-in">
      {state === 'loading' ? (
        <ContentLoading />
      ) : state === 'fallback' ? (
        <FallBack source={source} />
      ) : (
        children
      )}
    </div>
  );
}

