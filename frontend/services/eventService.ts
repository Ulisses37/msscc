import type { Event } from '@/types/event';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
interface RawEvent {
  event_id: number;
  title_en: string;
  title_ja: string;
  description_en: string;
  description_ja: string;
  location_en: string;
  location_ja: string;
  start_datetime: string;
  end_datetime: string;
  volunteer_slots: number;
  is_published: boolean;
  calendar_link: string | null;
  media_asset: number | null;
  created_at: string;
  updated_at: string;
}

interface RawMediaAsset {
  media_asset_id: number;
  file_url: string | null;
  alt_text_en: string;
  alt_text_ja: string;
}

/**
 * Used for pulling event images from the database
 */
export async function getMediaAssetById(
  id: number,
): Promise<RawMediaAsset | undefined> {
  const res = await fetch(`${API_BASE_URL}/api/media/${id}/`);

  if (!res.ok) {
    if (res.status === 404) return undefined;
    throw new Error(`Failed to fetch media asset ${id}: ${res.status}`);
  }

  return res.json();
}

function mapEvent(raw: RawEvent): Event {
  return {
    id:             raw.event_id,
    titleEn:        raw.title_en,
    titleJa:        raw.title_ja,
    descriptionEn:  raw.description_en,
    descriptionJa:  raw.description_ja,
    locationEn:     raw.location_en,
    locationJa:     raw.location_ja,
    startDatetime:  raw.start_datetime,
    endDatetime:    raw.end_datetime,
    volunteerSlots: raw.volunteer_slots,
    isPublished:    raw.is_published,
    calendarLink:   raw.calendar_link ?? undefined,
    mediaAssetId: raw.media_asset,
    createdAt:      raw.created_at,
    updatedAt:      raw.updated_at,
  };
}

export async function getEvents(): Promise<Event[]> {
  const [eventsResponse, mediaResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/events/`),
    fetch(`${API_BASE_URL}/api/media/`),
  ]);

  if (!eventsResponse.ok) {
    throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
  }

  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch media: ${mediaResponse.status}`);
  }

  const events: RawEvent[] = await eventsResponse.json();
  const mediaAssets: RawMediaAsset[] = await mediaResponse.json();

  const mediaMap = new Map(
    mediaAssets.map((media) => [media.media_asset_id, media]),
  );

  return events.map((event) => {
    const mappedEvent = mapEvent(event);
    const media = event.media_asset
      ? mediaMap.get(event.media_asset)
      : undefined;

    return {
      ...mappedEvent,
      media: media
        ? mapMediaAsset(media)
        : undefined,
    };
  });
}

export async function getEventById(id: number): Promise<Event | undefined> {
  const res = await fetch(`${API_BASE_URL}/api/events/${id}/`);

  if (!res.ok) {
    if (res.status === 404) return undefined;
    throw new Error(`Failed to fetch event ${id}: ${res.status}`);
  }

  const raw: RawEvent = await res.json();
  const event = mapEvent(raw);

  if (raw.media_asset) {
    const media = await getMediaAssetById(raw.media_asset);

    if (media?.file_url) {
      event.media = {
        fileUrl: media.file_url,
        altText: media.alt_text_en,
      };
    }
  }

  return event;
}

function mapMediaAsset(raw: RawMediaAsset): {
  fileUrl: string;
  altText: string;
} {
  return {
    fileUrl: raw.file_url ?? '',
    altText: raw.alt_text_en,
  };
}
