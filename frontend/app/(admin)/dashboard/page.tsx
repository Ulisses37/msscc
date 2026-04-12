'use client';

import React, { useState } from "react";
import { ImportImage } from "@/components/ui/ImportImage";

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/upload-image/`,
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

  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center">
      <h1 className="text-3xl font-semibold mb-6">Administrative Dashboard</h1>

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

      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-xl font-medium">Import Images</h2>
          <p className="text-sm text-slate-600 mt-2">
            Delete an image from storage
          </p>
        </div>
        {/*  placeholder for delete image functionality
        <button
              type="button"
              onClick={handleRetrieve}
              disabled={!selectedFile || isSubmitting}
              className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:bg-slate-400"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Image'}
        </button>
        */}


      </section>
    </main>
  );
}
