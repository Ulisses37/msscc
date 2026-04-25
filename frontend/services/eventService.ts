import type { Event } from '@/types/event';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
interface RawEvent {
  event_id: number;
  title: string;
  description: string;
  location: string;
  start_datetime: string;
  end_datetime: string;
  volunteer_slots: number;
  is_published: boolean;
  calendar_link: string | null;
  media_asset: { fileUrl: string; altText: string } | null;
  created_at: string;
  updated_at: string;
}

function mapEvent(raw: RawEvent): Event {
  return {
    id:             raw.event_id,
    title:          raw.title,
    description:    raw.description,
    location:       raw.location,
    startDatetime:  raw.start_datetime,
    endDatetime:    raw.end_datetime,
    volunteerSlots: raw.volunteer_slots,
    isPublished:    raw.is_published,
    calendarLink:   raw.calendar_link ?? undefined,
    media:          raw.media_asset ?? undefined,
    createdAt:      raw.created_at,
    updatedAt:      raw.updated_at,
  };
}

export async function getEvents(): Promise<Event[]> {
  const res = await fetch(`${API_BASE_URL}/api/events/`);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`);
  }
  const data: RawEvent[] = await res.json();
  return data.map(mapEvent);
}

export async function getEventById(id: number): Promise<Event | undefined> {
  const res = await fetch(`${API_BASE_URL}/api/events/${id}/`);
  if (!res.ok) {
    if (res.status === 404) return undefined;
    throw new Error(`Failed to fetch event ${id}: ${res.status}`);
  }
  const raw: RawEvent = await res.json();
  return mapEvent(raw);
}
