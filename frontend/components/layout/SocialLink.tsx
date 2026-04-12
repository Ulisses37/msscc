import React from 'react';
import Image from 'next/image';
import fbIcon from '@/public/icons/FB_Icon.svg';

export const SocialIcon = () => {
  return (
    <a
      href="https://www.facebook.com/MSSCC1/"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-[clamp(8px,2vw,24px)] top-1/2 -translate-y-1/2 z-20"
    >
      <Image 
        src={fbIcon} 
        alt="Facebook" 
        style={{ filter: 'brightness(0) invert(1)' }}
        className="w-[clamp(0px,3vw,40px)] h-[clamp(0px,3vw,40px)]"
      />
    </a>
  );
};
