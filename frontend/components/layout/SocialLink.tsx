import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import fbIcon from '@/public/icons/FB_Icon.svg';

// Facebook link: 44px tap target, icon scales by screen size and sits further left on mobile
export const SocialIcon = () => {
  const t = useTranslations('SocialLink');

  return (
    <a
      href="https://www.facebook.com/MSSCC1/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('facebook')}
      className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex h-[44px] w-[44px] items-center justify-start pl-[6px] md:left-[clamp(8px,2vw,24px)] md:justify-center md:pl-0"
    >
      <Image
        src={fbIcon}
        alt=""
        style={{ filter: 'brightness(0) invert(1)' }}
        className="h-[20px] w-[20px] min-[390px]:h-[24px] min-[390px]:w-[24px] md:h-[clamp(28px,4vw,40px)] md:w-[clamp(28px,4vw,40px)]"
      />
    </a>
  );
};
