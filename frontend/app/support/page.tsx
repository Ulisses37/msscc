import React from 'react';

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center">

      {/* WEBSITE HEADER */}
      <header className="w-full max-w-[1200px] text-center mb-16 pb-8 border-b border-[#1a1a1a]">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-[#264653]">
          Support Page
        </h1>
      </header>

      {/* SECTION: Changed to grid-cols-1 to stack vertically */}
      <section className="grid grid-cols-1 gap-10 w-full max-w-[1200px]">
        
        {/* BLOCK ONE */}
        <article className="flex flex-col border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
          <header>
            <h3 className="text-xl font-bold text-red-600 mb-3">
              Every Donation Counts
            </h3>
          </header>
          
          
          <p className="text-base text-[#171717] mb-6">
            Investing in this partnership means investing in a future where knowledge 
            and cultural appreciation bring people together. Your support ensures that 
            this connection continues to thrive for generations to come.
          </p>

          <p className="text-base text-[#171717] mb-6">
            Philanthropic donations play a vital role in sustaining our mission, 
            ensuring that every dollar directly supports meaningful programs and 
            contributes to the long-term strength and growth of our organization.
          </p>

          <p className="text-base text-[#171717] mb-6">
            Your sponsorship may be tax-deductible. Please consult with your tax advisor 
            as to the deductibility of your sponsorship.
          </p>
        </article>

        {/* BLOCK TWO Sponsorship*/}
        <article className="flex flex-col border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
          <header>
            <h3 className="text-xl font-bold text-red-600 mb-3">
              Sponsorship
            </h3>
          </header>
          
          <p className="text-base text-[#171717] mb-6">
            Corporate sponsorships not only elevate the impact of our mission
             but also provide essential overhead support that ensures the sustainability 
             and operational strength of our organization. By partnering with us, sponsors 
             play a key role in expanding our reach, enhancing program quality, and fostering 
             long-term community engagement. We’d love the opportunity to discuss how a larger 
             corporate donation could impact our growth. 
          </p>

          {/* payment option placeholder */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center min-h-[150px]">
             <span className="text-gray-400 italic">[ payment option ]</span>
          </div>
        </article>
      </section>

      {/* WEBSITE FOOTER: Moved outside the section to match the header style */}
      <footer className="w-full max-w-[1200px] mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        Matsuyama-Sacramento Sister City Corporation  
      </footer>

    </main>
  );
}