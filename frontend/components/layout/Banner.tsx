'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import bannerBg from '@/public/images/banner-background.png';
import mssccLogo from '@/public/images/msscc-logo.png';
import { SocialIcon } from './SocialLink'

import { LoginButton } from '@/components/ui/Loginbutton';
import { LogoutButton } from "@/components/ui/Logoutbutton";
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useAuth } from '@/context/AuthContext'

export const Banner = () =>{

  const { isAuthenticated } = useAuth();

  const handleLoginClick = () => {
    // TODO(ulisses): Open LoginModal once SCRUM-4 is built
  };

  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

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
      {/* FB ICON  */}
      <SocialIcon />

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

      {/* Bottom-right actions: social media buttons will go left of LoginButton */}
      <div className="absolute bottom-2 right-4 z-10 flex items-center gap-2">
        {!isAdminRoute && <LanguageToggle />}
        {isAuthenticated ? <LogoutButton /> : <LoginButton onLoginClick={handleLoginClick} />}
      </div>


    </div>
  );
};
