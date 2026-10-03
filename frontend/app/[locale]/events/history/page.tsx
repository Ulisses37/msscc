'use client';

import { useEffect, useState } from 'react';

import { Link } from '@/i18n/routing';

import { PostPages } from '@/components/content/Pagination';
import { EventCard } from '@/components/events/EventCard';

import { useTranslation } from '@/hooks/useTranslation';
import { getEvents } from '@/services/eventService';

import type { Event } from '@/types/event';

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

/** Displays published past events from newest to oldest. */
export default function EventHistoryPage() {
  const t = useTranslation('EventHistoryPage');
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchPastEvents = async () => {
      try {
        const events = await getEvents();
        const currentTime = Date.now();
        const sortedPastEvents = events
          .filter(
            (event) =>
              event.isPublished && new Date(event.endDatetime).getTime() < currentTime,
          )
          // End time determines when an event enters history, so it also determines recency.
          .sort(
            (firstEvent, secondEvent) =>
              new Date(secondEvent.endDatetime).getTime() -
              new Date(firstEvent.endDatetime).getTime(),
          );

        setPastEvents(sortedPastEvents);
      } catch (error) {
        console.error('Error fetching past events:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPastEvents();
  }, []);

  const totalPages = Math.max(1, Math.ceil(pastEvents.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvents = pastEvents.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    // Keep the page selection valid if the available history changes.
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleItemsPerPageChange = (nextItemsPerPage: number) => {
    setItemsPerPage(nextItemsPerPage);
    setCurrentPage(1);
  };

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 font-body sm:px-6 sm:py-10">
      <Link
        href="/events"
        className="inline-block text-body-sm font-semibold text-msscc-teal underline-offset-4 hover:text-msscc-teal-dark hover:underline"
      >
        {t('backLink')}
      </Link>

      <header className="mb-10 mt-6 border-b border-msscc-gray-light pb-6">
        <h1 className="font-heading text-display text-msscc-teal">{t('heading')}</h1>
      </header>

      {isLoading && <p className="text-body text-msscc-gray-mid">{t('loading')}</p>}

      {!isLoading && hasError && (
        <p role="alert" className="text-body text-msscc-danger">
          {t('error')}
        </p>
      )}

      {!isLoading && !hasError && pastEvents.length === 0 && (
        <p className="text-body text-msscc-gray-mid">{t('empty')}</p>
      )}

      {!isLoading && !hasError && pastEvents.length > 0 && (
        <>
          <div className="flex flex-col gap-6">
            {paginatedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <PostPages
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </>
      )}
    </main>
  );
}