import type { Event } from '@/types/event';


// TODO: Replace this mock data with a real fetch from /api/events/ once backend is connected
export const sampleEvents: Event[] = [
  {
    id: 1,
    title: 'MSSCC Summer Luncheon',
    description: '',
    location: 'TBD',
    startDatetime: '2026-06-13T12:00:00Z',
    endDatetime: '2026-06-13T13:00:00Z',
    volunteerSlots: 0,
    isPublished: true,
    calendarLink: 'http://www.google.com/calendar/event?action=TEMPLATE&text=MSSCC%20Summer%20Luncheon',
    media: {
      fileUrl: '/images/cherry-blossom.jpg',
      altText: 'Cherry blossoms at Capitol Park'
    } ,
    createdAt: '2026-04-19T01:38:50.355787Z',
    updatedAt: '2026-04-19T01:38:50.355787Z',
  },
  {
    id: 2,
    title: 'Cherry Blossom Festival',
    description: 'Annual celebration of Japanese culture and the cherry blossom season.',
    location: 'Capitol Park, Sacramento',
    startDatetime: '2026-03-28T10:00:00Z',
    endDatetime: '2026-03-28T16:00:00Z',
    volunteerSlots: 10,
    isPublished: true,
    media: undefined,
    createdAt: '2026-04-19T01:38:50.355787Z',
    updatedAt: '2026-04-19T01:38:50.355787Z',
  },
  {
    id: 3,
    title: 'Japanese Language Workshop',
    description: 'Introductory Japanese language and culture workshop for all ages.',
    location: 'Sacramento Public Library',
    startDatetime: '2026-04-15T14:00:00Z',
    endDatetime: '2026-04-15T16:00:00Z',
    volunteerSlots: 5,
    isPublished: true,
    media: undefined,
    createdAt: '2026-04-19T01:38:50.355787Z',
    updatedAt: '2026-04-19T01:38:50.355787Z',
  },
  {
    id: 4,
    title: 'Sister City Delegation Visit',
    description: 'Welcome reception for the Matsuyama delegation visiting Sacramento.',
    location: 'Sacramento City Hall',
    startDatetime: '2026-08-01T18:00:00Z',
    endDatetime: '2026-08-01T20:00:00Z',
    volunteerSlots: 8,
    isPublished: false,
    media: undefined,
    createdAt: '2026-04-19T01:38:50.355787Z',
    updatedAt: '2026-04-19T01:38:50.355787Z',
  },
];
