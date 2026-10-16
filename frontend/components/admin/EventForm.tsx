'use client';

// React and next
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// Components
import ImageBlockInput from '@/components/admin/ImageBlockInput';
import { TranslationReviewNotice } from '@/components/admin/TranslationReviewNotice';
import { ImportImage } from '@/components/ui/ImportImage';
import { useTranslationReviewNotice } from '@/components/admin/useTranslationReviewNotice';

// Types
import type { ImageAlignment, ImageWidth } from '@/types/content';
import type { EventImage } from '@/types/event';

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

export interface EventPhotoFormData {
  localId: string;
  eventImageId: number | null;
  mediaAssetId: number | null;
  mediaUrl: string | null;
  file: File | null;
  captionEn: string;
  captionJa: string;
  imageAlignment: ImageAlignment;
  imageWidth: ImageWidth;
}

type EventTranslationField = 'title' | 'location' | 'description';

const EVENT_TRANSLATION_FIELDS: Record<
  EventTranslationField,
  {
    source: 'titleEn' | 'locationEn' | 'descriptionEn';
    target: 'titleJa' | 'locationJa' | 'descriptionJa';
  }
> = {
  title: { source: 'titleEn', target: 'titleJa' },
  location: { source: 'locationEn', target: 'locationJa' },
  description: { source: 'descriptionEn', target: 'descriptionJa' },
};

interface EventFormProps {
  initialData?: EventFormData;
  initialImageUrl?: string | null;
  initialEventPhotos?: EventImage[];
  volunteerSlots?: number;
  onSubmit: (
    data: EventFormData,
    imageFile: File | null,
    eventPhotos: EventPhotoFormData[],
    deletedEventPhotoIds: number[],
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
  initialEventPhotos = [],
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
  const [eventPhotos, setEventPhotos] = useState<EventPhotoFormData[]>(
    initialEventPhotos.map((photo) => ({
      localId: `saved-${photo.id}`,
      eventImageId: photo.id,
      mediaAssetId: photo.mediaAssetId,
      mediaUrl: photo.mediaUrl,
      file: null,
      captionEn: photo.captionEn,
      captionJa: photo.captionJa,
      imageAlignment: photo.imageAlignment,
      imageWidth: photo.imageWidth,
    })),
  );
  const [deletedEventPhotoIds, setDeletedEventPhotoIds] = useState<number[]>([]);
  const [saveError, setSaveError] = useState('');
  const [newEventPhotoId, setNewEventPhotoId] = useState<string | null>(null);
  // Track each translation separately so one field does not block the others.
  const [translatingFields, setTranslatingFields] = useState<EventTranslationField[]>([]);
  const titleReviewNotice = useTranslationReviewNotice();
  const locationReviewNotice = useTranslationReviewNotice();
  const descriptionReviewNotice = useTranslationReviewNotice();
  const previewUrlsRef = useRef(new Set<string>());

  const updateEnglishField = (
    field: 'titleEn' | 'locationEn' | 'descriptionEn',
    value: string,
    markEnglishChanged: () => void,
  ) => {
    // Only input events use this helper, so initial and automatic values stay silent.
    markEnglishChanged();
    setFormData((currentData) => ({ ...currentData, [field]: value }));
  };

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addEventPhoto = () => {
    const newPhotoId = crypto.randomUUID();

    setEventPhotos((currentPhotos) => [
      ...currentPhotos,
      {
        localId: newPhotoId,
        eventImageId: null,
        mediaAssetId: null,
        mediaUrl: null,
        file: null,
        captionEn: '',
        captionJa: '',
        imageAlignment: 'left',
        imageWidth: 100,
      },
    ]);

    // Track the new photo so the form can scroll to it after rendering.
    setNewEventPhotoId(newPhotoId);
  };

  useEffect(() => {
    if (!newEventPhotoId) return;

    // Scroll only after the new photo exists on the page.
    const newPhoto = document.getElementById(`event-photo-${newEventPhotoId}`);
    newPhoto?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNewEventPhotoId(null);
  }, [newEventPhotoId]);

  const updateEventPhoto = (
    localId: string,
    updates: Partial<EventPhotoFormData>,
  ) => {
    setEventPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.localId === localId ? { ...photo, ...updates } : photo,
      ),
    );
  };

  const selectEventPhotoFile = (photo: EventPhotoFormData, file: File) => {
    if (photo.mediaUrl && previewUrlsRef.current.has(photo.mediaUrl)) {
      URL.revokeObjectURL(photo.mediaUrl);
      previewUrlsRef.current.delete(photo.mediaUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    updateEventPhoto(photo.localId, { file, mediaUrl: previewUrl });
  };

  const deleteEventPhoto = (photo: EventPhotoFormData) => {
    const isConfirmed = window.confirm(
      'Are you sure you want to remove this event photo?',
    );

    if (!isConfirmed) return;

    if (photo.mediaUrl && previewUrlsRef.current.has(photo.mediaUrl)) {
      URL.revokeObjectURL(photo.mediaUrl);
      previewUrlsRef.current.delete(photo.mediaUrl);
    }

    const eventImageId = photo.eventImageId;

    if (eventImageId !== null) {
      setDeletedEventPhotoIds((currentIds) => [
        ...currentIds,
        eventImageId,
      ]);
    }

    setEventPhotos((currentPhotos) =>
      currentPhotos.filter((currentPhoto) => currentPhoto.localId !== photo.localId),
    );
  };

  const moveEventPhoto = (index: number, direction: 'up' | 'down') => {
    setEventPhotos((currentPhotos) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= currentPhotos.length) {
        return currentPhotos;
      }

      const reorderedPhotos = [...currentPhotos];
      [reorderedPhotos[index], reorderedPhotos[targetIndex]] = [
        reorderedPhotos[targetIndex],
        reorderedPhotos[index],
      ];

      return reorderedPhotos;
    });
  };

  const requestTranslation = async (text: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error(`Translation failed with status ${response.status}.`);
        return null;
      }

      const data = (await response.json()) as { translation?: unknown };

      return typeof data.translation === 'string' ? data.translation : null;
    } catch (error) {
      console.error('Translation failed:', error);
      return null;
    }
  };

  const handleEventFieldTranslation = async (field: EventTranslationField) => {
    const { source, target } = EVENT_TRANSLATION_FIELDS[field];
    setTranslatingFields((currentFields) => [...currentFields, field]);

    try {
      const translation = await requestTranslation(formData[source]);

      if (translation) {
        setFormData((prev) => ({
          ...prev,
          [target]: translation,
        }));
      }
    } finally {
      setTranslatingFields((currentFields) =>
        currentFields.filter((currentField) => currentField !== field),
      );
    }
  };

  const handleEventPhotoTranslation = async (photo: EventPhotoFormData) => {
    const translation = await requestTranslation(photo.captionEn);

    if (translation) {
      updateEventPhoto(photo.localId, { captionJa: translation });
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
    if (eventPhotos.some((photo) => !photo.file && !photo.mediaAssetId)) {
      missingFields.push('an image for each Event Photo');
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
      await onSubmit(
        formData,
        selectedFile,
        eventPhotos,
        deletedEventPhotoIds,
      );
    } catch (error) {
      console.error('Event form submission failed:', error);
      setSaveError('Failed to save event. Please try again.');
    }
  };

  return (
    <div>
      {/* Image + Title + Datetimes row */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Image Upload Box */}
        <div className="flex-shrink-0 w-full lg:w-72">
          <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
            Image {requireImage && <span className="text-msscc-danger">*</span>}
          </label>
          {/* Image Preview Box */}
          <div className="w-full lg:w-72 h-72 border border-msscc-gray-light rounded-sm flex flex-col items-center justify-center overflow-hidden bg-msscc-gray-faint">
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
                Manage Volunteer Shifts
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
              onChange={(event) =>
                updateEnglishField(
                  'titleEn',
                  event.target.value,
                  titleReviewNotice.markEnglishChanged,
                )
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Title JA */}
          <div>
            {titleReviewNotice.showNotice && (
              <TranslationReviewNotice onDismiss={titleReviewNotice.dismissNotice} />
            )}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid">
                Title (Japanese)
              </label>
              <TranslationButton
                fieldLabel="title"
                isTranslating={translatingFields.includes('title')}
                disabled={!formData.titleEn.trim()}
                onClick={() => handleEventFieldTranslation('title')}
              />
            </div>
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
              onChange={(event) =>
                updateEnglishField(
                  'locationEn',
                  event.target.value,
                  locationReviewNotice.markEnglishChanged,
                )
              }
              className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
            />
          </div>

          {/* Location JA */}
          <div>
            {locationReviewNotice.showNotice && (
              <TranslationReviewNotice onDismiss={locationReviewNotice.dismissNotice} />
            )}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid">
                Location (Japanese)
              </label>
              <TranslationButton
                fieldLabel="location"
                isTranslating={translatingFields.includes('location')}
                disabled={!formData.locationEn.trim()}
                onClick={() => handleEventFieldTranslation('location')}
              />
            </div>
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
            onChange={(event) =>
              updateEnglishField(
                'descriptionEn',
                event.target.value,
                descriptionReviewNotice.markEnglishChanged,
              )
            }
            className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
          />
        </div>

        {/* Description JA */}
        <div>
          {descriptionReviewNotice.showNotice && (
            <TranslationReviewNotice onDismiss={descriptionReviewNotice.dismissNotice} />
          )}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid">
              Description (Japanese)
            </label>
            <TranslationButton
              fieldLabel="description"
              isTranslating={translatingFields.includes('description')}
              disabled={!formData.descriptionEn.trim()}
              onClick={() => handleEventFieldTranslation('description')}
            />
          </div>

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

      {/* Additional Event Photos */}
      <section className="mt-8 border-t border-msscc-gray-light pt-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-heading-2 text-msscc-teal">
              Event Photos
            </h2>
            <p className="mt-1 text-body-sm text-msscc-gray-mid">
              Add ordered photos and bilingual captions to the event.
            </p>
          </div>

          <button
            type="button"
            onClick={addEventPhoto}
            className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-left text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark sm:w-auto"
          >
            +Image
          </button>
        </div>

        <div className="space-y-6">
          {eventPhotos.map((photo, index) => (
            <div
              key={photo.localId}
              id={`event-photo-${photo.localId}`}
              className="space-y-2"
            >
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => moveEventPhoto(index, 'up')}
                  disabled={index === 0}
                  className="rounded-sm border border-msscc-gray-light px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ↑ Move Up
                </button>
                <button
                  type="button"
                  onClick={() => moveEventPhoto(index, 'down')}
                  disabled={index === eventPhotos.length - 1}
                  className="rounded-sm border border-msscc-gray-light px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ↓ Move Down
                </button>
              </div>

              <ImageBlockInput
                contentEn={photo.captionEn}
                contentJa={photo.captionJa}
                imageUrl={photo.mediaUrl}
                imageAlignment={photo.imageAlignment}
                imageWidth={photo.imageWidth}
                onUpdateEn={(captionEn) =>
                  updateEventPhoto(photo.localId, { captionEn })
                }
                onUpdateJa={(captionJa) =>
                  updateEventPhoto(photo.localId, { captionJa })
                }
                onUpdateAlignment={(imageAlignment) =>
                  updateEventPhoto(photo.localId, { imageAlignment })
                }
                onUpdateWidth={(imageWidth) =>
                  updateEventPhoto(photo.localId, { imageWidth })
                }
                onSelectFile={(file) => selectEventPhotoFile(photo, file)}
                onDelete={() => deleteEventPhoto(photo)}
                onTranslate={() => handleEventPhotoTranslation(photo)}
              />
            </div>
          ))}

          {eventPhotos.length === 0 && (
            <div className="rounded-md border border-dashed border-msscc-gray-light px-4 py-10 text-center text-body-sm text-msscc-gray-mid">
              No additional event photos have been added.
            </div>
          )}
        </div>
      </section>

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

interface TranslationButtonProps {
  fieldLabel: string;
  isTranslating: boolean;
  disabled: boolean;
  onClick: () => Promise<void>;
}

function TranslationButton({
  fieldLabel,
  isTranslating,
  disabled,
  onClick,
}: TranslationButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Translate ${fieldLabel} to Japanese`}
      onClick={() => void onClick()}
      disabled={disabled || isTranslating}
      className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest
        transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isTranslating
            ? 'border-msscc-gray-light bg-gray-100 text-msscc-gray-mid'
            : 'border-msscc-teal/30 bg-msscc-teal/10 text-msscc-teal hover:bg-msscc-teal hover:text-white active:scale-95 active:transform'
        }`}
    >
      {isTranslating ? 'Translating...' : 'Translate to Japanese'}
    </button>
  );
}
