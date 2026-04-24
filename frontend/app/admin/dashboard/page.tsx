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
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center gap-10">
      <h1 className="text-3xl font-semibold mb-6">Administrative Dashboard</h1>

      {/** Must have ability to upload images: Debug element */}
      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-xl font-medium">Import Images</h2>
          <p className="text-sm text-slate-600 mt-2">
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
              className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:bg-slate-400"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Image'}
            </button>

            <span className="text-sm text-slate-700">
              {selectedFile ? selectedFile.name : 'No file selected.'}
            </span>
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {uploadedUrl && (
            <p className="text-sm text-green-700">
              Image uploaded successfully: <span className="underline">{uploadedUrl}</span>
            </p>
          )}
        </div>
      </section>

      {/** Must have ability to delete images from storage: Debug Element */}
      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-xl font-medium">Delete Stored Images</h2>
          <p className="text-sm text-slate-600 mt-2">
            Open the image deletion manager to select IDs from storage.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteManager(true)}
          className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700"
        >
          {showDeleteManager ? 'In Progress' : 'Click to Start'}
        </button>
      </section>

      {/** Reduce information for Cleaner UI */}
      {showDeleteManager && (
        <ImageDeletionManager onClose={() => setShowDeleteManager(false)} />
      )}

      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-medium mb-4">Additional Admin Tools</h2>
        <p className="text-sm text-slate-600">
          Placeholder for future administrative functionalities.
        </p>
        <ReplaceImage />
      </section>
    </main>
  );
}
