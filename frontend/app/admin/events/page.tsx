'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImportImage } from '@/components/ui/ImportImage';

type Language = 'en' | 'ja';

export default function EventsPage() {
  const [activeLang, setActiveLang] = useState<Language>('en');
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

  const handleSubmit = async () => {
    setSaveMessage('');
    setSaveError('');

    // Validate required fields
    const missingFields = [];
    if (!formData.titleEn) missingFields.push('Title');
    if (!formData.startDatetime) missingFields.push('Start Date & Time');
    if (!formData.endDatetime) missingFields.push('End Date & Time');

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

  return (
    <div className="flex min-h-screen bg-msscc-white font-body text-msscc-gray-dark">

      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-msscc-gray-light p-6 flex flex-col gap-6">

        {/* Create Event Button */}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors text-left"
        >
          + Create Event
        </button>

        {/* Event List Placeholder */}
        <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body text-body-sm">
          No events added yet. Existing events will appear here.
        </div>

      </aside>

      {/* ── Main Form Area ───────────────────────────────────── */}
      <main className="flex-1 p-10 max-w-content mx-auto">

        <h1 className="font-heading text-display text-msscc-teal border-b border-msscc-gray-light pb-4 mb-10">
          Create Event
        </h1>

        {showForm ? (
          <>
            {/* Language Toggle */}
            <div className="flex gap-2 mb-8">
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-4 py-1 rounded-sm text-btn tracking-btn transition-colors border ${
                  activeLang === 'en'
                    ? 'bg-msscc-teal text-white border-msscc-teal'
                    : 'bg-white text-msscc-teal border-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('ja')}
                className={`px-4 py-1 rounded-sm text-btn tracking-btn transition-colors border ${
                  activeLang === 'ja'
                    ? 'bg-msscc-teal text-white border-msscc-teal'
                    : 'bg-white text-msscc-teal border-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                JA
              </button>
            </div>

           {/* ── Image + Title + Datetimes row ───────────────── */}
            <div className="flex gap-6 mb-6">

              {/* Image Upload Box */}
              <div className="flex-shrink-0 w-72">
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Image
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

                {/* Title */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Title <span className="text-msscc-danger">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder={activeLang === 'en' ? 'Event title...' : 'イベントタイトル...'}
                    value={activeLang === 'en' ? formData.titleEn : formData.titleJa}
                    onChange={(e) =>
                      setFormData(activeLang === 'en'
                        ? { ...formData, titleEn: e.target.value }
                        : { ...formData, titleJa: e.target.value }
                      )
                    }
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

                {/* Location */}
                <div>
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder={activeLang === 'en' ? 'Event location...' : 'イベント会場...'}
                    value={activeLang === 'en' ? formData.locationEn : formData.locationJa}
                    onChange={(e) =>
                      setFormData(activeLang === 'en'
                        ? { ...formData, locationEn: e.target.value }
                        : { ...formData, locationJa: e.target.value }
                      )
                    }
                    className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                  />
                </div>

              </div>
            </div>

              {/* Description */}
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Description
                </label>
                <textarea
                  rows={5}
                  placeholder={activeLang === 'en' ? 'Event description...' : 'イベントの説明...'}
                  value={activeLang === 'en' ? formData.descriptionEn : formData.descriptionJa}
                  onChange={(e) =>
                    setFormData(activeLang === 'en'
                      ? { ...formData, descriptionEn: e.target.value }
                      : { ...formData, descriptionJa: e.target.value }
                    )
                  }
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
                />
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
        ) : (
          <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body">
            Select an event or click "+ Create Event" to get started.
          </div>
        )}
      </main>

    </div>
  );
}
