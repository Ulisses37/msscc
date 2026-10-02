import type { ImageAlignment, ImageWidth } from '@/types/content';

export interface MediaAsset {
  fileUrl: string;
  altText: string;
}

export interface EventImage {
  id: number;
  eventId: number;
  mediaAssetId: number | null;
  mediaUrl: string | null;
  captionEn: string;
  captionJa: string;
  displayOrder: number;
  imageWidth: ImageWidth;
  imageAlignment: ImageAlignment;
}

export interface Event {
  id: number;
  titleEn: string;
  titleJa: string;
  descriptionEn: string;
  descriptionJa: string;
  locationEn: string;
  locationJa: string;
  startDatetime: string;
  endDatetime: string;
  volunteerSlots: number;
  isPublished: boolean;
  sendVolunteerReminders: boolean;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  calendarLink?: string;
  media?: MediaAsset;
  mediaAssetId: number | null;
}
