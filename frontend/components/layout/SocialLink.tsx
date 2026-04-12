import React from 'react';
import SmallIcon from '@/public/icons/FB_Icon.svg';

export const LeftBannerIcon = () => {
  return (
    <a
      href="https://www.facebook.com/MSSCC1/"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-4 top-1/2 -translate-y-1/2 z-20"
    >
      <SmallIcon className="w-8 h-8 md:w-10 md:h-10 drop-shadow-lg" />
    </a>
  );
};
