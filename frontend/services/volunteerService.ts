import { Event } from '@/types/event';
import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

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
  comments?: string | null;
  status: string;
  submitted_at: string;
}

export interface VolunteerSlot {
  volunteer_slot_id: number;
  position_name: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  capacity: number;
  filled_count: number;
  event: number;
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

/** Load an event's shifts and each shift's signups for the admin export. */
export async function getVolunteerExportData(eventId: number): Promise<{
  slots: VolunteerSlot[];
  signupsBySlot: VolunteerSignup[][];
}> {
  const headers = getAdminRequestHeaders();

  const slotsRes = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/slots/?event_id=${eventId}`,
    { headers },
  );
  if (!slotsRes.ok) {
    throw new Error(`Failed to fetch shifts for event ${eventId}: ${slotsRes.status}`);
  }
  const slots: VolunteerSlot[] = await slotsRes.json();

  // Any failed request stops the export so a partial list is never downloaded.
  const signupsBySlot = await Promise.all(
    slots.map(async (slot) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/signups/?slot_id=${slot.volunteer_slot_id}`,
        { headers },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch signups for slot ${slot.volunteer_slot_id}: ${res.status}`);
      }
      return (await res.json()) as VolunteerSignup[];
    }),
  );

  return { slots, signupsBySlot };
}
