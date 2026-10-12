// React/Next.js
import React from 'react';

// Third-party
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

// Components
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { Banner } from '@/components/layout/Banner';
import { PublicFooter } from '@/components/layout/PublicFooter';
import GalleryBackground from '@/components/layout/GalleryBackground';

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className="relative isolate flex min-h-screen flex-col">
            <GalleryBackground />
            {/* Banner Section.*/}
            <div className="relative z-10">
              <Banner />
            </div>
            {/* Navbar Section. Banner content goes above this. */}

            {/* Navbar Section. Banner content goes above this. */}
            <div className="relative z-10">
              <PublicNavbar />
            </div>

            {/* Main content area */}
            <main className="relative z-10 flex-grow pb-10">
              {children}
            </main>

            {/* <Footer /> */}
            <div className="relative z-10">
              <PublicFooter />
            </div>
      </div>
    </NextIntlClientProvider>
  );
}
