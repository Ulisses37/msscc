'use client';

import { useEffect, useState } from 'react';

import { getCalendarEvents } from '@/services/eventService';
import type { Event } from '@/types/event';

interface CalendarEventsState {
  events: Event[];
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Load all published events (upcoming and past) for the events calendar.
 */
export function useCalendarEvents(): CalendarEventsState {
  const [state, setState] = useState<CalendarEventsState>({
    events: [],
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    // Ignore the result if the page is left before the request finishes.
    let isCancelled = false;

    getCalendarEvents()
      .then((events) => {
        if (!isCancelled) setState({ events, isLoading: false, hasError: false });
      })
      .catch((error) => {
        console.error('Failed to load calendar events:', error);
        if (!isCancelled) setState({ events: [], isLoading: false, hasError: true });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
