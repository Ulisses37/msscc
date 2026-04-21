import type { Event } from '@/types/event';
import { sampleEvents } from '@/app/[locale]/events/sampleData';

// TODO: Replace mock delay and sample data with real fetch to /api/events/ once backend is connected
const MOCK_DELAY_MS = 300;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function getEvents(): Promise<Event[]> {
  await delay(MOCK_DELAY_MS);
  return sampleEvents.filter((event) => event.isPublished);
}

export async function getEventById(id: number): Promise<Event | undefined> {
  await delay(MOCK_DELAY_MS);
  return sampleEvents.find((event) => event.id === id);
}
