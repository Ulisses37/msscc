export interface MediaAsset {
  fileUrl: string;
  altText: string;
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
  createdAt: string;
  updatedAt: string;
  calendarLink?: string;
  media?: MediaAsset;
}
