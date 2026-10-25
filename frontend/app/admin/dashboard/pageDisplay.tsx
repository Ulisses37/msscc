'use client'

import Link from 'next/link';

import { getPageList } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks } from '@/config/adminNavLinks';

import Image from 'next/image';
import type { Event } from '@/types/event';

import { useRef } from "react";

const GAP = 16; // gap-4 = 1rem = 16px

const pageDescriptions: Record<string, string>={
  Events: "Manage MSSCC events.",
  Volunteers: "Manage event volunteers.",
  Members: "Manage membership data records.",
  Donations: "Manage donation data records.",
  Partners: "Manage MSSCC partner data records.",
  'Edit Pages': "Manage public page text, translation, and images.",
  'Board of Directors': "Manage board member list.",
  'Permissions Pages': "Manage the information and permissions of MSSCC Admins.",
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
    <div className="flex flex-col pl-1">
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
    <div className="my-1">
      {link ? (
        <Link
          href={link.href}
          className="font-heading text-heading-2 text-msscc-teal underline transition-colors hover:text-msscc-pink"
        >
          {PageTitle}
        </Link>
      ) : (
        <div className="font-heading text-heading-2 text-msscc-teal-light">{PageTitle}</div>
      )}
      <div className="pl-4 text-body-sm text-msscc-gray-mid">
        {description}
      </div>
    </div>
  )
}

export function previewCards(){

}

export function CardCarousel({
  carouselType,
  data,
}: {
  carouselType: string;
  data: Event[];
}) {
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
      {carouselType}
      <div className="flex items-stretch bg-msscc-pink-light rounded-md">
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="rounded-l-md flex-shrink-0 w-8 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-2xl"
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
          className="rounded-r-md flex-shrink-0 w-8 sm:w-10 flex items-center justify-center bg-msscc-pink-light hover:bg-msscc-pink text-2xl"
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
    <div className="snap-start flex-shrink-0 w-48 sm:w-64 border border-msscc-pink rounded-sm">
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
          className="max-w-[90%] flex flex-col items-start gap-1"
          style={{
            position: "absolute",
            bottom: "var(--space-2)",
            left: "var(--space-2)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-caption)",
            fontWeight: 700,
            lineHeight: 1.4,
            color: "var(--color-white)",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(38, 70, 83, 0.85)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {title}
          </div>
          <div
          className="whitespace-nowrap"
            style={{
              backgroundColor: "rgba(38, 70, 83, 0.85)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.7rem",
            }}
          >
            {isPastEvent
              ? `Event Ended: ${formatDate(event.endDatetime)}`
              : formatDate(event.startDatetime)}
          </div>
        </div>
      </Link>
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


