
import React from 'react';
import Image from 'next/image';

import bannerBg from '@/public/images/banner-background.png';
import mssccLogo from '@/public/images/msscc-logo.png';

export const Banner = () => {
  return (
    <div className="relative w-full h-[18vh] md:h-[22vh] overflow-hidden">
      {/* Background */}
      <Image
        src={bannerBg}
        alt="Banner Background"
        fill
        priority
        className="object-cover"
      />

      {/* to try with blur div className= backdrop-blur-sm px-4 py-2 rounded-md */}
      {/* Logo */}
      <div className="relative z-10 flex h-full items-center justify-center">
        <div className="px-4 py-2 rounded-md">
          <Image
            src={mssccLogo}
            alt="MSSCC Logo"
            width={400}
            height={140}
            className="h-auto w-auto drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
};
