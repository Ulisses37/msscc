
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
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">History</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Since 1981, when Sacramento Mayor Phil Isenberg, Matsuyama Mayor Tokio Nakamura, and dedicated citizens from both countries came together under President Eisenhower’s People to People Program, our sister city partnership has brought the people of Sacramento and Matsuyama closer than ever. Over the years, students, professionals, community leaders, and families have crossed the Pacific—building friendships, fostering understanding, and creating lifelong memories between our two great cities.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">The Corporation</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        The Corporation is led by a volunteer Board of fifteen Directors, including five Officers. Directors serve staggered three-year terms, while Officers are elected annually. There are no term limits for either role.
      </p><br />
    </div>
  )
}

function PartnersFallback() {
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Programs and Events</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Connection, exchange, and friendship are at the heart of our sister city mission. Through active participation in community events and cultural festivals, we offer engaging booth experiences that showcase Japan’s rich heritage and the value of international friendship.
      </p><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Our outreach extends to student cultural exchanges and reciprocal friendship trips between Sacramento and Matsuyama, creating life-changing opportunities for participants to immerse themselves in each other’s traditions, language, and way of life. These experiences foster cross-cultural understanding, global awareness, and meaningful connections that last a lifetime.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Student Exchange Programs</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        MSSCC works to facilitate the sister school programs by providing administrative and exchange support between the Sacramento and Matsuyama sister city corporations, the teachers of the sister schools, and with Matsuyama education and business professionals.
      </p><br />

    </div>
  )
}

function MembershipFallback() {
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Membership</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Whether you&apos;re a student, parent, educator, businessperson, or simply a global citizen at heart, your involvement helps carry forward a legacy of unity, respect, and shared learning between our two cities.
      </p><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Ready to be part of something inspiring? Join us today by selecting your membership category and completing the online form. Prefer paper? Click below to download a printable version.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Benefits</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        By becoming a member, you show your support for our sister city and exchange programs—helping to create meaningful connections across cultures, inspiring young minds, and spreading goodwill around the world. It feels good to be part of something that brings people together and makes a lasting difference.
      </p>
    </div>

  )
}

function EventsFallback() {
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Programs and Events</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Connection, exchange, and friendship are at the heart of our sister city mission. Through active participation in community events and cultural festivals, we offer engaging booth experiences that showcase Japan’s rich heritage and the value of international friendship.
      </p><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Our outreach extends to student cultural exchanges and reciprocal friendship trips between Sacramento and Matsuyama, creating life-changing opportunities for participants to immerse themselves in each other’s traditions, language, and way of life. These experiences foster cross-cultural understanding, global awareness, and meaningful connections that last a lifetime.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Student Exchange Programs</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        MSSCC works to facilitate the sister school programs by providing administrative and exchange support between the Sacramento and Matsuyama sister city corporations, the teachers of the sister schools, and with Matsuyama education and business professionals.
      </p>
    </div>

  )
}

function SupportFallback() {
  return (
    <div>
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Every Donation Counts</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Investing in this partnership means investing in a future where knowledge and cultural appreciation bring people together. Your support ensures that this connection continues to thrive for generations to come.

        Philanthropic donations play a vital role in sustaining our mission, ensuring that every dollar directly supports meaningful programs and contributes to the long-term strength and growth of our organization.

        Your sponsorship may be tax-deductible. Please consult with your tax advisor as to the deductibility of your sponsorship.
      </p><br />
      <h2 className="font-heading text-[64px] font-normal text-[#D72638]">Sponsorship</h2><br />
      <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
        Corporate sponsorships not only elevate the impact of our mission but also provide essential overhead support that ensures the sustainability and operational strength of our organization. By partnering with us, sponsors play a key role in expanding our reach, enhancing program quality, and fostering long-term community engagement. We’d love the opportunity to discuss how a larger corporate donation could impact our growth.
      </p>

    </div>
  );
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

