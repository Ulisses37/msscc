export interface MediaAsset {
  fileUrl: string;
  altText: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  startDatetime: string;
  endDatetime: string;
  volunteerSlots: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  calendarLink?: string;
  media?: MediaAsset;
}
