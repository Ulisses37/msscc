'use client';

// React and next
import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';

// Components
import { ImportImage } from '@/components/ui/ImportImage';

export interface EventFormData {
  titleEn: string;
  titleJa: string;
  descriptionEn: string;
  descriptionJa: string;
  locationEn: string;
  locationJa: string;
  startDatetime: string;
  endDatetime: string;
  sendVolunteerReminders: boolean;
}

interface EventFormProps {
  initialData?: EventFormData;
  initialImageUrl?: string | null;
  volunteerSlots?: number;
  onSubmit: (
    data: EventFormData,
    imageFile: File | null,
  ) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  requireImage?: boolean;
  eventId?: number;
}

/**
 * The Event Form containing all the input fields related to creating an event.
 * Purpose is to be used for both creating events and editting events.
 */

export default function EventForm({
  initialData = {
    titleEn: '',
    titleJa: '',
    descriptionEn: '',
    descriptionJa: '',
    locationEn: '',
    locationJa: '',
    startDatetime: '',
    endDatetime: '',
    sendVolunteerReminders: false,
  },
  initialImageUrl = null,
  volunteerSlots = 0,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
  successMessage = '',
  errorMessage = '',
  requireImage = false,
  eventId,
}: EventFormProps) {
  const [formData, setFormData] = useState<EventFormData>(initialData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState('');

  const handleTranslate = async (
    fieldEn: keyof EventFormData,
    fieldJa: keyof EventFormData,
  ) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData[fieldEn] }),
      });

      const data = await response.json();

      if (data.translation) {
        setFormData((prev) => ({
          ...prev,
          [fieldJa]: data.translation,
        }));
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  };

  const handleSubmit = async () => {
    setSaveError('');

    // Validate required fields
    const missingFields: string[] = [];

    if (!formData.titleEn) missingFields.push('Title');
    if (!formData.startDatetime) {
      missingFields.push('Start Date & Time');
    }
    if (!formData.endDatetime) {
      missingFields.push('End Date & Time');
    }
    if (requireImage && !selectedFile && !initialImageUrl) {
      missingFields.push('Image');
    }

    if (missingFields.length > 0) {
      setSaveError(
        `Please fill in the following required fields: ${missingFields.join(', ')}`,
      );
      return;
    }

    // Validate datetime order
    if (
      formData.startDatetime &&
      formData.endDatetime &&
      new Date(formData.endDatetime) < new Date(formData.startDatetime)
    ) {
      setSaveError('End date and time cannot be before start date and time.');
      return;
    }

    try {
      await onSubmit(formData, selectedFile);
    } catch (error) {
      console.error('Event form submission failed:', error);
      setSaveError('Failed to save event. Please try again.');
    }
  };

  return (
    <div>
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

      {/* Image + Title + Datetimes row */}
      <div className="flex gap-6 mb-6">
        {/* Image Upload Box */}
        <div className="flex-shrink-0 w-72">
          <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
            Image {requireImage && <span className="text-msscc-danger">*</span>}
          </label>

          <div className="w-72 h-72 border border-msscc-gray-light rounded-sm flex flex-col items-center justify-center overflow-hidden bg-msscc-gray-faint">
            {selectedFile ? (
              <Image
                src={URL.createObjectURL(selectedFile)}
                alt="Selected event image preview"
                width={288}
                height={288}
                className="object-cover w-full h-full"
              />
            ) : initialImageUrl ? (
              <Image
                src={initialImageUrl}
                alt="Current event image"
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

          {/* Volunteer Shifts Button */}
          <div className="mt-4">
            {eventId ? (
              <Link
                href={`/admin/volunteer/${eventId}`}
                className="block text-center rounded-sm bg-msscc-pink px-4 py-2 text-white no-underline text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors"
                style={{ color: '#FFFFFF' }}
              >
                Add Volunteer Shifts
              </Link>
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-sm bg-msscc-gray-light px-4 py-2 text-msscc-gray-mid text-btn tracking-btn cursor-not-allowed"
                >
                  Add Volunteer Shifts
                </button>
                <p className="text-caption text-msscc-gray-mid mt-1">
                  Save the event first to add volunteer shifts.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Title + Datetimes + Location */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Title EN */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Title <span className="text-msscc-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="Event title..."
              value={formData.titleEn}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  titleEn: e.target.value,
                }))
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Title JA */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Title (Japanese)
            </label>
            <input
              type="text"
              placeholder="イベントタイトル..."
              value={formData.titleJa}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  titleJa: e.target.value,
                }))
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
              type="datetime-local"
              value={formData.startDatetime}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  startDatetime: e.target.value,
                }))
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* End Datetime */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              End Date & Time <span className="text-msscc-danger">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.endDatetime}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  endDatetime: e.target.value,
                }))
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Location EN */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Location
            </label>
            <input
              type="text"
              placeholder="Event location..."
              value={formData.locationEn}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  locationEn: e.target.value,
                }))
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Location JA */}
          <div>
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
              Location (Japanese)
            </label>
            <input
              type="text"
              placeholder="イベント会場..."
              value={formData.locationJa}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  locationJa: e.target.value,
                }))
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>
        </div>
      </div>

      {/* Description EN + JA */}
      <div className="flex flex-col gap-4">
        {/* Description EN */}
        <div>
          <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
            Description
          </label>

          <textarea
            rows={5}
            placeholder="Event description..."
            value={formData.descriptionEn}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                descriptionEn: e.target.value,
              }))
            }
            className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
          />
        </div>

        {/* Description JA */}
        <div>
          <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
            Description (Japanese)
          </label>

          <textarea
            rows={5}
            placeholder="イベントの説明..."
            value={formData.descriptionJa}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                descriptionJa: e.target.value,
              }))
            }
            className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
          />
        </div>
      </div>

      {/* Send Volunteer Reminders Checkbox (hidden when there are no volunteer slots) */}
      {volunteerSlots > 0 && (
        <div className="mt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.sendVolunteerReminders}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sendVolunteerReminders: e.target.checked,
                }))
              }
              className="w-4 h-4 accent-msscc-teal"
            />
            <span className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid">
              Send volunteer reminder emails
            </span>
          </label>
          <p className="text-caption text-msscc-gray-mid mt-1 ml-7">
            Volunteers will receive a reminder email before the event starts.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-sm bg-msscc-pink px-5 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>

      {/* Feedback messages */}
      <div className="h-6 mt-2 text-right">
        {successMessage && (
          <p className="text-body-sm text-msscc-teal">
            {successMessage}
          </p>
        )}

        {errorMessage && (
          <p className="text-body-sm text-msscc-danger">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Validation / Submission Error */}
      {saveError && (
        <div className="h-6 mt-2 text-right">
          <p className="text-body-sm text-msscc-danger">
            {saveError}
          </p>
        </div>
      )}
    </div>
  );
}
