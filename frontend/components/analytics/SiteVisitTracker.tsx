'use client';

import { useTrackVisit } from '@/utils/siteAnalytics';

/** Track the first public-page visit for the current browser tab. */
export function SiteVisitTracker() {
  useTrackVisit();

  return null;
}