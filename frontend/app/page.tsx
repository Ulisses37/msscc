import React from 'react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans">

      {/* WEBSITE HEADER */}
      <header className="text-center mb-16 pb-8 border-b border-[#1a1a1a]">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-[#264653]">
          Home Page
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
      </section>
    </main>
  );
}
