import { Event } from '@/types/event';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Fetch all events that have available volunteer slots
export const getVolunteerEvents = async (): Promise<Event[]> => {
  const response = await fetch(`${API_BASE_URL}/api/events/volunteer-needed/`);
  return response.json();
};

// Fetch specific slots for an event based on your ERD
export const getSlotsByEventId = async (eventId: number) => {
  const response = await fetch(`${API_BASE_URL}/api/events/slots/?event_id=${eventId}`);
  if (!response.ok) return [];
  return response.json();
};

// Submit the signup form
export const submitVolunteerSignup = async (data: any) => {
  return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
  });
};

// Fetch all volunteer signups for a specific shift
// Fetch all volunteer signups for a specific shift
export interface VolunteerSignup {
  volunteer_signup_id: number;
  slot: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  submitted_at: string;
}

export interface VolunteerCancellationDetails {
  first_name: string;
  last_name: string;
  event_title_en: string;
  event_title_ja: string;
  slot_start_datetime: string;
  slot_end_datetime: string;
  role: string;
}

export async function getSignupsBySlotId(slotId: number): Promise<VolunteerSignup[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/?slot_id=${slotId}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch signups for slot ${slotId}: ${res.status}`);
  }

  return res.json();
}

/** Fetch public confirmation details for a volunteer cancellation link. */
export async function getVolunteerCancellationDetails(
  token: string,
): Promise<VolunteerCancellationDetails> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/cancel/${token}/`,
  );

  if (!response.ok) {
    throw new Error('Unable to load volunteer cancellation details.');
  }

  return response.json() as Promise<VolunteerCancellationDetails>;
}

/** Cancel a volunteer signup through its unique cancellation token. */
export async function cancelVolunteerSignup(token: string): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/cancel/${token}/`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    throw new Error('Unable to cancel volunteer signup.');
  }
}
