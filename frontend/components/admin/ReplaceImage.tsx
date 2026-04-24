//query Selected model >> Get {ID, media_asset_id, file_url, file_name}
//Display file_url as image, for reference
//insert new selected media_asset_id into Selected model
//or import new image, which creates new media_asset_id, then insert that ID into Selected model
//save Selected model to database
//Display success message to user

'use client';

import React, { useState, useEffect } from "react";
import { ImportImage } from "@/components/ui/ImportImage";
import PostImage from "@/components/ui/PostImage";
import { RetrieveImageList } from "@/components/ui/RetrieveImageList";
import Image from "next/image";

type ModelType = "media" | "events" | "board-members" | "partners";

export default function ReplaceImage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<number | null>(null);

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


  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center gap-10">
      <h3 className="text-1xl mb-6">Replace Image</h3>

      <div className="flex flex-col items-center gap-6">
        Select where you would like to replace an image:
        <div className="flex gap-4">
          {(selectedModel === "media" || selectedModel === null) && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setSelectedModel(prev =>prev === "media" ? null : "media")}>
              {selectedModel === null ? "Media" : "Cancel"}
            </button>
          )}
          {(selectedModel === "events" || selectedModel === null) && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setSelectedModel(prev =>prev === "events" ? null : "events")}>
              {selectedModel === null ? "Events" : "Cancel"}
            </button>
          )}
          {(selectedModel === "board-members" || selectedModel === null) && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setSelectedModel(prev =>prev === "board-members" ? null : "board-members")}>
              {selectedModel === null ? "Board Members" : "Cancel"}
            </button>
          )}
          {(selectedModel === "partners" || selectedModel === null) && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setSelectedModel(prev =>prev === "partners" ? null : "partners")}>
              {selectedModel === null ? "Partners" : "Cancel"}
            </button>
          )}
        </div>
        <div className="text-sm text-slate-600">
          {selectedModel ? `Pick an image` : "No category selected."}
          <RetrieveImageList modelType={selectedModel} onSelect={(mediaAssetId) => setSelectedMediaAssetId(mediaAssetId)} />
        </div>
        {/* Image upload component */}
        <ImportImage
             onChange={(file) => setSelectedFile(file)}
             label="Upload a replacement image"
        />

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

        {/* Display selected image for reference */}
        {selectedFile && (
           <div className="mt-6">
             <h4 className="text-lg font-medium mb-2">Selected Image:</h4>
             <Image
               src={URL.createObjectURL(selectedFile)}
               alt="Selected for replacement"
               className="max-w-sm border rounded"
               width={400}
               height={300}
              />
           </div>
        )}

      </div>

    </main>
  );
}
