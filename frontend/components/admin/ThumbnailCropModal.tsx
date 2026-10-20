'use client';

import { useEffect, useRef, useState } from 'react';

import ThumbnailPicker from '@/components/admin/ThumbnailPicker';
import type { ThumbnailCrop } from '@/utils/thumbnailCrop';

interface ThumbnailCropModalProps {
  imageUrl: string;
  crop: ThumbnailCrop;
  onSave: (crop: ThumbnailCrop) => void;
  onCancel: () => void;
}

/**
 * Modal for choosing the event card thumbnail crop. The parent mounts it only
 * while it is open, so each opening starts from the saved crop.
 */
export default function ThumbnailCropModal({
  imageUrl,
  crop,
  onSave,
  onCancel,
}: ThumbnailCropModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // True when the current click began on the dark backdrop, not inside the modal
  const pressStartedOnBackdropRef = useRef(false);
  // Edit a copy so Cancel leaves the saved crop untouched.
  const [draftCrop, setDraftCrop] = useState<ThumbnailCrop>(crop);

  useEffect(() => {
    const dialog = dialogRef.current;

    // A native modal dialog provides the backdrop, focus trapping and Esc key.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="thumbnail-crop-title"
      // Fires when Esc closes the dialog
      onClose={onCancel}
      onPointerDown={(event) => {
        pressStartedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Only close if the press also started on the backdrop, so letting go
        // of a drag outside the modal doesn't throw the crop away.
        if (pressStartedOnBackdropRef.current && event.target === event.currentTarget) {
          onCancel();
        }
      }}
      className="m-auto max-h-[90vh] w-[min(92vw,920px)] overflow-y-auto rounded-md border border-msscc-gray-light bg-msscc-white p-0 text-msscc-gray-dark backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2
            id="thumbnail-crop-title"
            className="font-heading text-heading-2 text-msscc-teal"
          >
            Card thumbnail
          </h2>
          <p className="mt-1 text-body-sm text-msscc-gray-mid">
            Choose which part of the image shows on the event card.
          </p>
        </div>

        <ThumbnailPicker imageUrl={imageUrl} crop={draftCrop} onChange={setDraftCrop} />

        <div className="flex justify-end gap-3 border-t border-msscc-gray-light pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-msscc-gray-light px-5 py-2 text-btn tracking-btn text-msscc-gray-dark transition-colors hover:border-msscc-teal"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draftCrop)}
            className="rounded-sm bg-msscc-pink px-5 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
          >
            Save crop
          </button>
        </div>
      </div>
    </dialog>
  );
}
