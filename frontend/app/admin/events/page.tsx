'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

import EventForm, {
  type EventFormData,
  type EventPhotoFormData,
} from '@/components/admin/EventForm';
import {
  createEventImage,
  deleteEventImage,
  getEventImages,
  getEvents,
  getMediaAssetById,
  updateEventImage,
} from '@/services/eventService';
import type { Event, EventImage } from '@/types/event';

type EventFilter = 'upcoming' | 'past';

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
  // Additional photos use separate EventImage records rather than the event's primary image.
  const [selectedEventImages, setSelectedEventImages] = useState<EventImage[]>([]);
  // Remount the form after saving so local photo IDs are replaced with database IDs.
  const [formVersion, setFormVersion] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);

  // Use the event end time to decide whether an event is still upcoming or has passed.
  const currentTime = Date.now();
  const dateFilteredEvents = events.filter((event) => {
    const endTime = new Date(event.endDatetime).getTime();

    return eventFilter === 'upcoming'
      ? endTime >= currentTime
      : endTime < currentTime;
  });

  // Normalize the query so English searches ignore case and surrounding spaces.
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();

  // Search both bilingual titles while keeping results inside the active date filter.
  const filteredEvents = dateFilteredEvents
    .filter((event) => {
      if (!normalizedSearchQuery) return true;

      return (
        event.titleEn.toLocaleLowerCase().includes(normalizedSearchQuery)
        || event.titleJa.toLocaleLowerCase().includes(normalizedSearchQuery)
      );
    })
    .sort((firstEvent, secondEvent) => {
      // Show the next upcoming event first so admins can find it quickly.
      if (eventFilter === 'upcoming') {
        return (
          new Date(firstEvent.startDatetime).getTime()
          - new Date(secondEvent.startDatetime).getTime()
        );
      }

      // Show the most recently completed event first in the past-events list.
      return (
        new Date(secondEvent.endDatetime).getTime()
        - new Date(firstEvent.endDatetime).getTime()
      );
    });

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

  // Auto-scroll to the event form whenever Create Event or Edit is clicked on
  useEffect(() => {
    if (showForm && mainRef.current) {
      mainRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm, selectedEvent]);

  // Both primary images and additional photos must become media assets before association.
  const uploadMediaAsset = async (file: File): Promise<number> => {
    const imageFormData = new FormData();
    imageFormData.append('image', file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
      { method: 'POST', body: imageFormData },
    );

    if (!response.ok) {
      throw new Error(`Image upload failed: ${response.status}`);
    }

    const imageData = await response.json();
    return imageData.media_asset_id;
  };

  const saveEventPhotos = async (
    eventId: number,
    eventPhotos: EventPhotoFormData[],
    deletedEventPhotoIds: number[],
  ): Promise<void> => {
    // Remove deleted associations first so the remaining records define the final photo set.
    for (const eventImageId of deletedEventPhotoIds) {
      await deleteEventImage(eventImageId);
    }

    for (let index = 0; index < eventPhotos.length; index += 1) {
      const photo = eventPhotos[index];
      // Existing photos reuse their media asset unless the admin selected a replacement.
      const mediaAssetId = photo.file
        ? await uploadMediaAsset(photo.file)
        : photo.mediaAssetId;

      const payload = {
        event: eventId,
        media_asset: mediaAssetId,
        caption_en: photo.captionEn,
        caption_ja: photo.captionJa,
        // Array order mirrors the Move Up and Move Down controls in EventForm.
        display_order: index,
        image_width: photo.imageWidth,
        image_alignment: photo.imageAlignment,
      };

      if (photo.eventImageId === null) {
        // Unsaved form entries do not receive an EventImage ID until this POST succeeds.
        await createEventImage(payload);
      } else {
        await updateEventImage(photo.eventImageId, payload);
      }
    }
  };

  const handleSubmit = async (
    data: EventFormData,
    imageFile: File | null,
    eventPhotos: EventPhotoFormData[],
    deletedEventPhotoIds: number[],
  ) => {
    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      let mediaAssetId = null;
      if (imageFile) {
        mediaAssetId = await uploadMediaAsset(imageFile);
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
            send_volunteer_reminders: data.sendVolunteerReminders,
          }),
        },
      );

      if (!res.ok) {
        const errorBody = await res.json();
        console.error('Backend error:', errorBody);
        throw new Error('Failed to create event.');
      }

      const createdEvent = await res.json();
      // The event must exist before additional photos can reference its database ID.
      await saveEventPhotos(
        createdEvent.event_id,
        eventPhotos,
        deletedEventPhotoIds,
      );

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
    eventPhotos: EventPhotoFormData[],
    deletedEventPhotoIds: number[],
  ) => {
    if (!selectedEvent) return;

    setIsSubmitting(true);
    setSaveMessage('');
    setSaveError('');

    try {
      let mediaAssetId = selectedEvent.mediaAssetId;

      // Upload a replacement image only if the admin selected one.
      if (imageFile) {
        mediaAssetId = await uploadMediaAsset(imageFile);
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
            send_volunteer_reminders: data.sendVolunteerReminders,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.status}`);
      }

      await saveEventPhotos(
        selectedEvent.id,
        eventPhotos,
        deletedEventPhotoIds,
      );

      // Refetch to capture IDs and media URLs assigned to newly created photo records.
      const refreshedEventImages = await getEventImages(selectedEvent.id);
      setSelectedEventImages(refreshedEventImages);

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
                sendVolunteerReminders: data.sendVolunteerReminders,
              }
            : event,
        ),
      );

      setSelectedEvent((currentEvent) =>
        currentEvent
          ? {
              ...currentEvent,
              titleEn: data.titleEn,
              titleJa: data.titleJa,
              descriptionEn: data.descriptionEn,
              descriptionJa: data.descriptionJa,
              locationEn: data.locationEn,
              locationJa: data.locationJa,
              startDatetime: data.startDatetime,
              endDatetime: data.endDatetime,
              mediaAssetId,
              sendVolunteerReminders: data.sendVolunteerReminders,
            }
          : currentEvent,
      );
      // Reinitialize EventForm from the authoritative records returned after the save.
      setFormVersion((currentVersion) => currentVersion + 1);

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
    // Load both image collections together, but allow either one to fail independently.
    const [media, eventImages] = await Promise.all([
      event.mediaAssetId
        ? getMediaAssetById(event.mediaAssetId).catch((error) => {
            console.error('Failed to load primary event image:', error);
            return undefined;
          })
        : Promise.resolve(undefined),
      getEventImages(event.id).catch((error) => {
        console.error('Failed to load additional event photos:', error);
        return [];
      }),
    ]);

    setSelectedEventImages(eventImages);
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
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-msscc-white font-body text-msscc-gray-dark">

      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="w-full lg:w-64 flex-shrink-0 border-r border-msscc-gray-light p-6 flex flex-col gap-6">

        {/* Create Event Button */}
        <button
          type="button"
          onClick={() => {
            setSelectedEvent(null);
            // Prevent photos from the previously edited event appearing in the create form.
            setSelectedEventImages([]);
            setIsEditing(false);
            setShowForm(true);
          }}
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors text-left"
        >
          + Create Event
        </button>

        {/* Event List Filters, Search, and Results */}
        <section className="flex flex-col gap-5 rounded-md border border-msscc-gray-light p-4">
          <h2 className="border-b border-msscc-gray-light pb-3 font-heading text-heading-2 text-msscc-teal">
            Event List
          </h2>

          {/* Event Title Search */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="event-search"
              className="text-label tracking-label text-msscc-gray-mid"
            >
              Search by title
            </label>
            <input
              id="event-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search events..."
              className="w-full rounded-md border border-msscc-gray-light bg-msscc-white px-3 py-2 text-body-sm text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin"
            />
          </div>

          {/* Upcoming and Past Event Filter Buttons */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label tracking-label text-msscc-gray-mid">
              Filter events
            </legend>

            <div className="flex flex-row gap-2">
              {(['upcoming', 'past'] as const).map((filter) => {
                const isActive = eventFilter === filter;
                const label = filter === 'upcoming' ? 'Upcoming' : 'Past';

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setEventFilter(filter)}
                    aria-pressed={isActive}
                    className={`w-full rounded-sm border px-3 py-2 text-btn tracking-btn transition-colors ${
                      isActive
                        ? 'border-msscc-pink bg-msscc-pink text-white'
                        : 'border-msscc-gray-light bg-msscc-white text-msscc-gray-dark hover:border-msscc-pink hover:text-msscc-pink'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {isLoadingEvents ? (
            <p className="text-msscc-gray-mid text-body-sm">
              Loading events...
            </p>
          ) : eventError ? (
            <p className="text-msscc-danger text-body-sm">
              {eventError}
            </p>
          ) : dateFilteredEvents.length === 0 ? (
            <p className="text-msscc-gray-mid text-body-sm">
              No {eventFilter} events.
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-msscc-gray-mid text-body-sm">
              No events match your search.
            </p>
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-sm border border-msscc-gray-light p-3"
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
                  <div className="mt-2 flex gap-3">
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
        </section>

      </aside>

      {/* ── Main Form Area ───────────────────────────────────── */}
      <main ref={mainRef} className="flex-1 p-4 sm:p-10 max-w-content mx-auto w-full">

        <h1 className="font-heading text-display text-msscc-teal border-b border-msscc-gray-light pb-4 mb-10">
          {isEditing ? 'Edit Event' : 'Create Event'}
        </h1>

        {showForm ? (
          isEditing && selectedEvent ? (
            <EventForm
              key={`${selectedEvent.id}-${formVersion}`}
              eventId={selectedEvent.id}
              volunteerSlots={selectedEvent.volunteerSlots}
              initialData={{
                titleEn: selectedEvent.titleEn,
                titleJa: selectedEvent.titleJa,
                descriptionEn: selectedEvent.descriptionEn,
                descriptionJa: selectedEvent.descriptionJa,
                locationEn: selectedEvent.locationEn,
                locationJa: selectedEvent.locationJa,
                startDatetime: formatDatetimeLocal(selectedEvent.startDatetime),
                endDatetime: formatDatetimeLocal(selectedEvent.endDatetime),
                sendVolunteerReminders: selectedEvent.sendVolunteerReminders,
              }}
              initialImageUrl={selectedEvent.media?.fileUrl ?? null}
              initialEventPhotos={selectedEventImages}
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
