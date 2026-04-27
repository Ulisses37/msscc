import { Event } from '@/types/event';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Fetch all events that have available volunteer slots
export const getVolunteerEvents = async (): Promise<Event[]> => {
  const response = await fetch(`${API_BASE_URL}/api/events/volunteer-needed/`);
  return response.json();
};

// NEW: Fetch specific slots for an event based on your ERD
export const getSlotsByEventId = async (eventId: number) => {
  const response = await fetch(`${API_BASE_URL}/api/volunteer_slots/?event_id=${eventId}`);
  if (!response.ok) return [];
  return response.json();
};

// Submit the signup form
export const submitVolunteerSignup = async (data: any) => {
  return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/volunteer_signup/`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(data),
  });
};