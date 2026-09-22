'use client';

import { useEffect, useState } from 'react';
import type { Event } from '@/types/event';
import { getEvents, getMediaAssetById } from '@/services/eventService';
import EventForm, { EventFormData } from '@/components/admin/EventForm';
import { useSearchParams } from 'next/navigation';

/**
 * Helper function for formatting time to string format for EventForm.tsx
 */
function formatDatetimeLocal(datetime: string): string {
  const date = new Date(datetime);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function EventsPage() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const searchParams = useSearchParams();

  // Fetch existing events on load
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await getEvents();
        setEvents(data);
      } catch (error) {
        console.error('Failed to fetch events:', error);
        setEventError('Failed to load events.');
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  // Auto-open the edit form for an event when returning from the volunteer shifts page
  useEffect(() => {
  const editId = searchParams.get('edit');
  if (editId && events.length > 0) {
    const eventToEdit = events.find((e) => e.id === Number(editId));
    if (eventToEdit) {
      handleEditEvent(eventToEdit);
    }
  }
}, [events, searchParams]);

  const handleSubmit = async (data: EventFormData, imageFile: File | null) => {
    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      let mediaAssetId = null;
      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', imageFile);
        const imageRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
          { method: 'POST', body: imageFormData },
        );
        if (!imageRes.ok) throw new Error('Image upload failed.');
        const imageData = await imageRes.json();
        mediaAssetId = imageData.media_asset_id;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title_en: data.titleEn,
            title_ja: data.titleJa,
            description_en: data.descriptionEn,
            description_ja: data.descriptionJa,
            location_en: data.locationEn,
            location_ja: data.locationJa,
            start_datetime: new Date(data.startDatetime).toISOString(),
            end_datetime: new Date(data.endDatetime).toISOString(),
            media_asset: mediaAssetId,
            is_published: true,
          }),
        },
      );

      // if (!res.ok) throw new Error('Failed to create event.');
      if (!res.ok) {
        const errorBody = await res.json();
        console.error('Backend error:', errorBody);
        throw new Error('Failed to create event.');
      }

      setSaveMessage('Event created successfully.');
    } catch (error) {
      console.error('Event creation failed:', error);
      setSaveError('Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async (
    data: EventFormData,
    imageFile: File | null,
  ) => {
    if (!selectedEvent) return;

    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      let mediaAssetId = selectedEvent.mediaAssetId;

      // Upload a replacement image only if the admin selected one.
      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', imageFile);

        const imageResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
          {
            method: 'POST',
            body: imageFormData,
          },
        );

        if (!imageResponse.ok) {
          throw new Error(`Image upload failed: ${imageResponse.status}`);
        }

        const imageData = await imageResponse.json();
        mediaAssetId = imageData.media_asset_id;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${selectedEvent.id}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title_en: data.titleEn,
            title_ja: data.titleJa,
            description_en: data.descriptionEn,
            description_ja: data.descriptionJa,
            location_en: data.locationEn,
            location_ja: data.locationJa,
            start_datetime: data.startDatetime,
            end_datetime: data.endDatetime,
            media_asset: mediaAssetId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.status}`);
      }

      // Update the list of events in the display after a save occurs
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                titleEn: data.titleEn,
                titleJa: data.titleJa,
                descriptionEn: data.descriptionEn,
                descriptionJa: data.descriptionJa,
                locationEn: data.locationEn,
                locationJa: data.locationJa,
                startDatetime: data.startDatetime,
                endDatetime: data.endDatetime,
                mediaAssetId,
              }
            : event,
        ),
      );

      setSaveMessage('Event updated successfully.');
    } catch (error) {
      console.error('Event update failed:', error);
      setSaveError('Failed to update event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event.titleEn}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${event.id}/`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }

      // Remove the deleted event from the displayed event list
      setEvents((prevEvents) =>
        prevEvents.filter(
          (existingEvent) => existingEvent.id !== event.id,
        ),
      );

      window.alert('Event deleted successfully.');

      // Clear the form if the deleted event was currently being edited
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
        setIsEditing(false);
        setShowForm(false);
      }
    } catch (error) {
      console.error('Event deletion failed:', error);
      window.alert('Failed to delete event. Please try again.');
    }
  };

  const handleEditEvent = async (event: Event) => {
    try {
      let media = undefined;

      if (event.mediaAssetId) {
        media = await getMediaAssetById(event.mediaAssetId);
      }

      setSelectedEvent({
        ...event,
        media: media?.file_url
          ? {
              fileUrl: media.file_url,
              altText: media.alt_text_en,
            }
          : undefined,
      });

      setIsEditing(true);
      setShowForm(true);
    } catch (error) {
      console.error('Failed to load event media:', error);

      // Still open the event form even if its image fails to load.
      setSelectedEvent(event);
      setIsEditing(true);
      setShowForm(true);
    }
  };

  return (
    <div className="flex min-h-screen bg-msscc-white font-body text-msscc-gray-dark">

      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-msscc-gray-light p-6 flex flex-col gap-6">

        {/* Create Event Button */}
        <button
          type="button"
          onClick={() => {
            setSelectedEvent(null);
            setIsEditing(false);
            setShowForm(true);
          }}
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors text-left"
        >
          + Create Event
        </button>

        {/* Event List Placeholder */}
        {isLoadingEvents ? (
          <p className="text-msscc-gray-mid text-body-sm">
            Loading events...
          </p>
        ) : eventError ? (
          <p className="text-msscc-danger text-body-sm">
            {eventError}
          </p>
        ) : events.length === 0 ? (
          <p className="text-msscc-gray-mid text-body-sm">
            No events exist.
          </p>
        ) : (
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="border border-msscc-gray-light rounded-sm p-3"
              >
                <p className="font-heading text-msscc-teal">
                  {event.titleEn}
                </p>

                <p className="text-body-sm text-msscc-gray-mid">
                  {new Date(event.startDatetime).toLocaleString()}
                </p>

                <p className="text-body-sm">
                  {event.isPublished ? 'Published' : 'Unpublished'}
                </p>

                {/* Edit and Delete Buttons */}
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => handleEditEvent(event)}
                    className="text-body-sm text-msscc-teal underline"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event)}
                    className="text-body-sm text-msscc-danger underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </aside>

      {/* ── Main Form Area ───────────────────────────────────── */}
      <main className="flex-1 p-10 max-w-content mx-auto">

        <h1 className="font-heading text-display text-msscc-teal border-b border-msscc-gray-light pb-4 mb-10">
          {isEditing ? 'Edit Event' : 'Create Event'}
        </h1>

        {showForm ? (
          isEditing && selectedEvent ? (
            <EventForm
              key={selectedEvent.id}
              eventId={selectedEvent.id}
              initialData={{
                titleEn: selectedEvent.titleEn,
                titleJa: selectedEvent.titleJa,
                descriptionEn: selectedEvent.descriptionEn,
                descriptionJa: selectedEvent.descriptionJa,
                locationEn: selectedEvent.locationEn,
                locationJa: selectedEvent.locationJa,
                startDatetime: formatDatetimeLocal(selectedEvent.startDatetime),
                endDatetime: formatDatetimeLocal(selectedEvent.endDatetime),
              }}
              initialImageUrl={selectedEvent.media?.fileUrl ?? null}
              onSubmit={handleUpdateEvent}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
              successMessage={saveMessage}
              errorMessage={saveError}
            />
          ) : (
            <EventForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitLabel="Save"
              successMessage={saveMessage}
              errorMessage={saveError}
              requireImage
            />
          )
        ) : (
          <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body">
            Select an event or click + Create Event to get started.
          </div>
        )}
      </main>

    </div>
  );
}
