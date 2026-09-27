'use client';

import React, { useState } from "react";
import { ImportImage } from "@/components/ui/ImportImage";
import { ImageDeletionManager } from "@/components/ui/ImageDeletionManager";
import ReplaceImage from "@/components/admin/ReplaceImage";


export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [showDeleteManager, setShowDeleteManager] = useState(false);

  {/** Expect an image for transfer to storage */}
  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Upload failed');
    }

    return response.json();
  };

  {/* Response to an image being submitted */}
  const handleSubmit = async () => {
    if (!selectedFile) {
      setSubmitError('Please select an image before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setUploadedUrl(null);

    try {
      const data = await uploadImage(selectedFile);
      setUploadedUrl(data.url);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  {/* Control for admins*/}
  return (
    <main className="min-h-screen space-y-10 bg-msscc-white p-10 font-body text-msscc-gray-dark flex flex-col items-center">
      <h1 className="mb-6 font-heading text-3xl font-semibold text-msscc-teal">Administrative Dashboard</h1>

      {/** Must have ability to upload images: Debug element */}
      <section className="w-full max-w-2xl rounded-xl border border-msscc-gray-light bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-heading text-xl font-medium text-msscc-teal">Import Images</h2>
          <p className="mt-2 text-sm text-msscc-gray-mid">
            Select an image and submit it to upload to the backend.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <ImportImage
              onChange={(file) => setSelectedFile(file)}
              label="Upload an image"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || isSubmitting}
              className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:bg-msscc-gray-light"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Image'}
            </button>

            <span className="text-sm text-msscc-gray-mid">
              {selectedFile ? selectedFile.name : 'No file selected.'}
            </span>
          </div>

          {submitError && <p className="text-sm text-msscc-danger">{submitError}</p>}
          {uploadedUrl && (
            <p className="text-sm text-msscc-teal">
              Image uploaded successfully: <span className="underline">{uploadedUrl}</span>
            </p>
          )}
        </div>
      </section>

      {/** Must have ability to delete images from storage: Debug Element */}
      <section className="w-full max-w-2xl rounded-xl border border-msscc-gray-light bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-heading text-xl font-medium text-msscc-teal">Delete Stored Images</h2>
          <p className="mt-2 text-sm text-msscc-gray-mid">
            Select Media and Images from storage to delete.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteManager(true)}
          className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
        >
          {showDeleteManager ? 'In Progress' : 'Click to Start'}
        </button>
      </section>

      {/** Reduce information for Cleaner UI */}
      {showDeleteManager && (
        <ImageDeletionManager onClose={() => setShowDeleteManager(false)} />
      )}

      <section className="w-full max-w-2xl bg-white border border-msscc-gray-light rounded-xl shadow-sm p-6">
        <ReplaceImage />
      </section>
    </main>
  );
}
