// Third-Party
import React from 'react';
import Image from 'next/image';
import img from '/./src/assets/illustration.jpg';
import { useTranslations } from 'next-intl';

/**
 * This is the general view home page
 *
 */

export default function HomePage() {
  const t = useTranslations('HomePageTest');

  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans">

      {/* WEBSITE HEADER */}
      <header className="text-center mb-16 pb-8 border-b border-[#1a1a1a]">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-[#264653]">
          {/* Dynamically swaps 'Home' based on the current locale */}
          {t('home')} Page
        </h1>
      </header>

      {/* WELCOME SECTION*/}
      <section className="max-w-[800px] text-left">
        <h2 className="text-[#8b2020] text-3xl font-semibold mb-6">
          Welcome
        </h2>

        <p className="text-lg leading-relaxed text-[#171717]">
          Since 1981, the <span className="font-bold">Matsuyama–Sacramento Sister City Corporation (MSSCC)</span> has
          been a vibrant community built on cultural exchange and international friendship.
          Founded by dedicated citizens, we connect Sacramento, California and Matsuyama,
          Japan through programs that immerse participants in each city’s unique
          traditions—creating lasting relationships, lifelong memories, and a
          stronger global community.
        </p>

        {/* Image Content for Welcome Section */}
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
          {/**
           * Supplys image from database
           * By Calling a function that pulls, given distinct ID
           */}
          <div className="md:w-3/4">
            <Image
              src={img}
              alt="img"
            />
          </div>
          <div className="md:w-1/4">
            <p className="text-sm text-[#555]">
              A glimpse of our vibrant cultural exchange programs in action.
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
