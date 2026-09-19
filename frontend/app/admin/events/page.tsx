'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImportImage } from '@/components/ui/ImportImage';
import type { Event } from '@/types/event';
import { getEvents, getMediaAssetById } from '@/services/eventService';
import EventForm from '@/components/admin/EventForm';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [formData, setFormData] = useState({
    titleEn: '',
    titleJa: '',
    descriptionEn: '',
    descriptionJa: '',
    locationEn: '',
    locationJa: '',
    startDatetime: '',
    endDatetime: '',
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const handleTranslate = async (fieldEn: keyof typeof formData, fieldJa: keyof typeof formData) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData[fieldEn] }),
      });
      const data = await response.json();
      if (data.translation) {
        setFormData((prev) => ({ ...prev, [fieldJa]: data.translation }));
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  };

  const handleSubmit = async () => {
    setSaveMessage('');
    setSaveError('');

    // Validate required fields
    const missingFields = [];
    if (!formData.titleEn) missingFields.push('Title');
    if (!formData.startDatetime) missingFields.push('Start Date & Time');
    if (!formData.endDatetime) missingFields.push('End Date & Time');
    if (!selectedFile) missingFields.push('Image');

    if (missingFields.length > 0) {
      setSaveError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate that end datetime is not before start datetime
    if (formData.startDatetime && formData.endDatetime) {
      if (new Date(formData.endDatetime) < new Date(formData.startDatetime)) {
        setSaveError('End date and time cannot be before start date and time.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Upload image first if one was selected
      let mediaAssetId = null;
      if (selectedFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', selectedFile);
        const imageRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
          { method: 'POST', body: imageFormData },
        );
        if (!imageRes.ok) throw new Error('Image upload failed.');
        const imageData = await imageRes.json();
        mediaAssetId = imageData.media_asset_id;
      }

      // Submit event data to backend
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title_en: formData.titleEn,
            title_ja: formData.titleJa,
            description_en: formData.descriptionEn,
            description_ja: formData.descriptionJa,
            location_en: formData.locationEn,
            location_ja: formData.locationJa,
            start_datetime: formData.startDatetime,
            end_datetime: formData.endDatetime,
            media_asset: mediaAssetId,
            is_published: true,
          }),
        },
      );

      if (!res.ok) throw new Error('Failed to create event.');

      setSaveMessage('Event created successfully.');

    } catch (error) {
      console.error('Event creation failed:', error);
      setSaveError('Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSaveMessage('');
        setSaveError('');
      }, 5000);
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

                {/*Edit Button*/}
                <button
                  type="button"
                  onClick={() => handleEditEvent(event)}
                  className="text-body-sm text-msscc-teal underline"
                >
                  Edit
                </button>
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
              onSubmit={async () => {
                // PATCH logic will go here later.
              }}
              submitLabel="Save Changes"
            />
          ) : (
            <>
            {/* Translate Button */}
            <div className="flex justify-end mb-8">
              <button
                type="button"
                onClick={() => {
                  handleTranslate('titleEn', 'titleJa');
                  handleTranslate('locationEn', 'locationJa');
                  handleTranslate('descriptionEn', 'descriptionJa');
                }}
                className="rounded-sm border border-msscc-teal px-5 py-2 text-msscc-teal text-btn tracking-btn hover:bg-msscc-teal hover:text-white transition-colors"
              >
                Translate to Japanese
              </button>
            </div>

           {/* ── Image + Title + Datetimes row ───────────────── */}
            <div className="flex gap-6 mb-6">

              {/* Image Upload Box */}
              <div className="flex-shrink-0 w-72">
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Image <span className="text-msscc-danger">*</span>
                </label>
                <div className="w-72 h-72 border border-msscc-gray-light rounded-sm flex flex-col items-center justify-center overflow-hidden bg-msscc-gray-faint">
                  {selectedFile ? (
                    <Image
                      src={URL.createObjectURL(selectedFile)}
                      alt="Event image preview"
                      width={288}
                      height={288}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-msscc-gray-mid text-body-sm text-center px-2">
                      No image selected
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <ImportImage
                    onChange={(file) => setSelectedFile(file)}
                    id="event-image"
                  />
                </div>
              </div>

              {/* Title + Datetimes */}
              <div className="flex flex-col gap-4 flex-1">

                {/* Title EN */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Title <span className="text-msscc-danger">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Event title..."
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

                {/* Title JA  */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Title (Japanese)
                  </label>
                  <input
                    type="text"
                    placeholder="イベントタイトル..."
                    value={formData.titleJa}
                    onChange={(e) => setFormData({ ...formData, titleJa: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

                {/* Start Datetime */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Start Date & Time <span className="text-msscc-danger">*</span>
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.startDatetime}
                    onChange={(e) => setFormData({ ...formData, startDatetime: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

                {/* End Datetime */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    End Date & Time <span className="text-msscc-danger">*</span>
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.endDatetime}
                    onChange={(e) => setFormData({ ...formData, endDatetime: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

                {/* Location EN + JA */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="Event location..."
                    value={formData.locationEn}
                    onChange={(e) => setFormData({ ...formData, locationEn: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Location (Japanese)
                  </label>
                  <input
                    type="text"
                    placeholder="イベント会場..."
                    value={formData.locationJa}
                    onChange={(e) => setFormData({ ...formData, locationJa: e.target.value })}
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

              </div>
            </div>

              {/* Description EN + JA */}
              <div className="flex flex-col gap-4">
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Description
                </label>
                <textarea
                  rows={5}
                  placeholder="Event description..."
                  value={formData.descriptionEn}
                  onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Description (Japanese)
                </label>
                <textarea
                  rows={5}
                  placeholder="イベントの説明..."
                  value={formData.descriptionJa}
                  onChange={(e) => setFormData({ ...formData, descriptionJa: e.target.value })}
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
                />
              </div>
            </div>

              {/* Save Button */}
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="rounded-sm bg-msscc-pink px-5 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Feedback messages */}
              <div className="h-6 mt-2 text-right">
                {saveMessage && (
                  <p className="text-body-sm text-msscc-teal">
                    {saveMessage}
                  </p>
                )}
                {saveError && (
                  <p className="text-body-sm text-msscc-danger">
                    {saveError}
                  </p>
                )}
              </div>
          </>
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
