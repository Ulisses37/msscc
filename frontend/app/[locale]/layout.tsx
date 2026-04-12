// React/Next.js
import React from 'react';

// Third-party
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

// Components
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { Banner } from '@/components/layout/Banner';

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
      <div className="flex min-h-screen flex-col">
            {/* Banner Section.*/}
            <Banner />
            {/* Navbar Section. Banner content goes above this. */}

            {/* Navbar Section. Banner content goes above this. */}
            <PublicNavbar />

            {/* Main content area */}
            <main className="flex-grow">
              {children}
            </main>

            {/* <Footer /> */}
          </div>
    </NextIntlClientProvider>
  );
}
