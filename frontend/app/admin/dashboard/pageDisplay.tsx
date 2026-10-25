'use client'

import Link from 'next/link';

import { getPageList } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks } from '@/config/adminNavLinks';

import Image from 'next/image';
import type { Event } from '@/types/event';
import type { DonationEntry } from '@/components/admin/DonationDetailDrawer';
import { formatCurrency } from '@/utils/formatCurrency';

import { useRef } from "react";
import { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';

const GAP = 16; // gap-4 = 1rem = 16px

const pageDescriptions: Record<string, string>={
  Events: "Manage MSSCC events.",
  Volunteers: "Manage event volunteers.",
  Members: "Manage membership data records.",
  Donations: "Manage donation data records.",
  Partners: "Manage MSSCC partner data records.",
  'Edit Pages': "Manage public page text, translation, and images.",
  'Board of Directors': "Manage board member list.",
  'Permissions Pages': "Manage the information and permissions of MSSC Admins.",
  Media: "Manage media images across the website",
}

export function AvailablePages(
  {
    CategoryTitle
  }:{
    CategoryTitle: string;
}){
  const pageList = getPageList(CategoryTitle);
  return(
    <div className="flex flex-col mt-2 pl-1">
      {pageList && pageList.map((page) =>(
        <PageCard key={page} PageTitle={page}/>
      ))}
    </div>
  )
}

function PageCard(
  {
    PageTitle,
  } : {
    PageTitle: string;
  }
){
  const link = adminNavLinks.find((l) => l.label === PageTitle);
  const description = pageDescriptions[PageTitle];

  return(
    <div className="">
      {link ? (
          <Link href={link.href} className="text-xl underline !text-black">
            {PageTitle}
          </Link>
        ) : (
          <div className="text-xl text-gray-800">{PageTitle}</div>
        )}
      <div className="pl-4">
        {description}
      </div>

    </div>
  )
}

export function EventCarousel({ data }:{ data: Event[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) return null;

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;

    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 192) + GAP;

    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  }

  return (
  <div>
    <h2 className="font-heading text-heading-2 text-msscc-teal">
      Events
    </h2>
    <div className="flex items-stretch bg-msscc-pink-light rounded-md">
<button
  onClick={() => scroll("left")}
  aria-label="Scroll left"
  className="rounded-l-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ‹
</button>

        <div
          ref={scrollRef}
          className="flex-1 min-w-0 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 scroll-pl-1"
        >
          {data.map((event) => (
          <EventCard key={event.id} event={event} />
         ))}
        </div>
<button
  onClick={() => scroll("right")}
  aria-label="Scroll right"
  className="rounded-r-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ›
</button>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const eventUrl = `/en/events/${event.id}`;
  const title = event.titleEn;
  const isPastEvent = new Date(event.endDatetime).getTime() < Date.now();

  return (
    <div className="snap-start flex-shrink-0 w-full sm:w-64 border border-msscc-pink rounded-sm">
      <Link href={eventUrl} className="relative block">
        {event.media?.fileUrl ? (
          <Image
            src={event.media.fileUrl}
            alt={event.media.altText ?? title}
            width={200}
            height={132}
            sizes="(min-width: 640px) 256px, 192px"
            className="w-full aspect-[200/132] object-cover"
          />
        ) : (
          <div
          className="w-full aspect-[200/132] flex items-center justify-center"
          style={{ backgroundColor: "var(--color-gray-faint)" }}
          >
            {/* placeholder svg unchanged */}
          </div>
        )}

        {/* Title + date overlay */}
        <div
  className="absolute bottom-[var(--space-2)] left-[var(--space-2)] max-w-[90%] flex flex-col items-start gap-1 font-body text-xs sm:text-body-sm font-bold text-white"
>
  <div className="bg-[rgba(38,70,83,0.85)] rounded-[var(--radius-sm)] px-1.5 py-0.5 sm:px-2 sm:py-1">
    {title}
  </div>
  <div className="sm:whitespace-nowrap bg-[rgba(38,70,83,0.85)] rounded-[var(--radius-sm)] px-1.5 py-0.5 sm:px-2 sm:py-1 text-[0.65rem] sm:text-label sm:tracking-label">
    {isPastEvent
      ? `Event Ended: ${formatDate(event.endDatetime)}`
      : formatDate(event.startDatetime)}
  </div>
</div>
      </Link>
    </div>
  );
}

export function DonationCarousel({ data }:{ data: DonationEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) return null;

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;

    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 192) + GAP;

    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  }

  return (
    <div>
    <h2 className="font-heading text-heading-2 text-msscc-teal">
      Donations
    </h2>
    <div className="flex items-stretch bg-msscc-pink-light rounded-md">
<button
  onClick={() => scroll("left")}
  aria-label="Scroll left"
  className="rounded-l-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ‹
</button>

        <div
          ref={scrollRef}
          className="flex-1 min-w-0 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 scroll-pl-1"
        >
          {data.map((donation) => (
          <DonationCard key={donation.donation_id} donation={donation} />
         ))}
        </div>
<button
  onClick={() => scroll("right")}
  aria-label="Scroll right"
  className="rounded-r-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ›
</button>
      </div>
    </div>
  );
}


function DonationCard({ donation}: {donation: DonationEntry}){
  const name = `${donation.donor_first_name} ${donation.donor_last_name}`.trim();

  return (
<div className="snap-start flex-shrink-0 w-full sm:w-48 border border-msscc-pink rounded-sm bg-msscc-white px-3 py-2 sm:p-3 flex flex-col gap-0.5 sm:gap-2 sm:justify-between font-body">
  <div className="font-heading text-body-sm sm:text-base text-msscc-teal break-words">
    {name}
  </div>
  <div className="font-heading text-base sm:text-heading-2 text-msscc-teal">
    {formatCurrency(Number(donation.total_amount))}
  </div>
  <div className="text-label sm:text-body-sm text-msscc-gray-mid">
    {formatDate(donation.created_at)}
  </div>
</div>
  );
}

export function MembershipCarousel({ data }:{ data: MembershipEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) return null;

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;

    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 192) + GAP;

    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  }

  return (
    <div>
    <h2 className="font-heading text-heading-2 text-msscc-teal">
      Membership
    </h2>
    <div className="flex items-stretch bg-msscc-pink-light rounded-md">
<button
  onClick={() => scroll("left")}
  aria-label="Scroll left"
  className="rounded-l-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ‹
</button>

        <div
          ref={scrollRef}
          className="flex-1 min-w-0 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 scroll-pl-1"
        >
          {data.map((membership) => (
          <MembershipCard key={membership.membership_id} membership={membership} />
         ))}
        </div>
<button
  onClick={() => scroll("right")}
  aria-label="Scroll right"
  className="rounded-r-md flex-shrink-0 w-5 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-lg sm:text-2xl"
>
  ›
</button>
      </div>
    </div>
  );
}

function MembershipCard({ membership}: {membership: MembershipEntry}){
  const name = `${membership.first_name} ${membership.last_name}`.trim();

  return (
<div className="snap-start flex-shrink-0 w-full sm:w-48 border border-msscc-pink rounded-sm bg-msscc-white px-3 py-2 sm:p-3 flex flex-col gap-0.5 sm:gap-2 sm:justify-between font-body">
  <div className="font-heading text-body-sm sm:text-base text-msscc-teal break-words">
    {name}
  </div>
  <div className="font-heading text-base sm:text-heading-2 text-msscc-teal first-letter:uppercase">
    {membership.membership_type}
  </div>
  <div className="text-label sm:text-body-sm text-msscc-gray-mid">
    {formatDate(membership.created_at)}
  </div>
</div>
  );
}


// Formats ISO datetime string to readable date
function formatDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}


