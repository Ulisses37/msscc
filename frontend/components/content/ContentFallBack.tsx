
import Image from 'next/image';
import img from '@/assets/Placeholder.png';
import type { ReactNode } from "react";

type FallbackSource = "home" | "about" | "partners" | "membership" | "events" | "support";

const fallbackContent: Record<FallbackSource, ReactNode> = {
  home: <HomeFallback />,
  about: <AboutFallback />,
  partners: <PartnersFallback />,
  membership: <MembershipFallback />,
  events: <EventsFallback />,
  support: <SupportFallback />
}


function HomeFallback() {
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Welcome to the MSSCC Website</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Since 1981, the Matsuyama–Sacramento Sister City Corporation (MSSCC) has been a vibrant community built on cultural exchange and international friendship. Founded by dedicated citizens, we connect Sacramento, California and Matsuyama, Japan through programs that immerse participants in each city’s unique traditions—creating lasting relationships, lifelong memories, and a stronger global community.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Mission</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        To strengthen international relations between Matsuyama and Sacramento by sharing our diversity and commonality through business, civic, cultural, and educational activities.
      </p><br />

    </div>
  );
}

function AboutFallback() {
  return <p>Learn more about us!</p>;
}

function PartnersFallback() {
  return <p>Discover our partner organizations!</p>;
}

function MembershipFallback() {
  return <p>Learn about our membership benefits!</p>;
}

function EventsFallback() {
  return <p>Check out our upcoming events!</p>;
}

function SupportFallback() {
  return <p>Get help and support!</p>;
}


export function FallBack({ source }: { source: FallbackSource }) {
  const staticContent = fallbackContent[source];

  return (

    <section className="mx-auto max-w-content px-6 py-10">

        <h3 className="font-heading text-[18px] font-bold text-msscc-teal">Our MSSCC website is currently being updated.</h3><br />
        <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
          This is the MSSCC website! Thank you for visiting and we please ask for your patience while we work to update our content.
        </p><br />
        <div className="flex justify-center">
          <Image src={img} alt="Illustration" className="item-center text-center h-auto max-w-full" />
        </div>

      <div>
        <br/>
        {staticContent}
      </div>
    </section>
  );
}

