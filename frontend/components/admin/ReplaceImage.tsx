'use client';

import React, { useState } from "react";
import { ImportImage } from "@/components/ui/ImportImage";
import { RetrieveImageList } from "@/components/ui/RetrieveImageList";
import PostImage from "@/components/ui/PostImage";
import Image from "next/image";

type ModelType = "media" | "events" | "board-members" | "partners" | "static-images";

const MODEL_UPDATE_ENDPOINTS: Record<ModelType, string> = {
  "events": "events",
  "board-members": "board-members",
  "partners": "partners",
  "media": "media",
  "static-images": "media/static-images",
};

export default function ReplaceImage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null);
  const [imageMode, setImageMode] = useState<"upload" | "select" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<number | null>(null);
  const [selectedReplacementId, setSelectedReplacementId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectUploadMode = () => {
    if (imageMode === "upload") {
      setImageMode(null);
      return;
    }

    setImageMode("upload");
    setSelectedReplacementId(null);
  };

  const selectExistingImageMode = () => {
    if (imageMode === "select") {
      setImageMode(null);
      return;
    }

    setImageMode("select");
    setSelectedFile(null);
  };

  const handleModelSelection = (model: ModelType) => {
    if (selectedModel === model) {
      setSelectedModel(null);
      setSelectedMediaAssetId(null);
      setSelectedModelId(null);
      setSelectedFile(null);
      setSelectedReplacementId(null);
      setImageMode(null);
      setUploadedUrl(null);
      setSubmitError(null);
      return;
    }

    setSelectedModel(model);
  };

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

  {/* Expect mediaId and modelId for changing old mediaIds*/}
  const handleSubmit = async () => {
    if (!selectedModel || selectedModelId === null) {
      setSubmitError('Please select an image record before submitting.');
      return;
    }

    if (!selectedFile && !selectedReplacementId) {
      setSubmitError('Please select an image before submitting.');
      return;
    }

    let replacementId = selectedReplacementId;

    setIsSubmitting(true);
    setSubmitError(null);
    setUploadedUrl(null);

    if (selectedFile && imageMode === "upload") {
      try {
        const data = await uploadImage(selectedFile);
        setUploadedUrl(data.url);
        replacementId = data.media_asset_id;
        setSelectedReplacementId(replacementId); // Use the new media_asset_id for replacement
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Upload failed.');
        setIsSubmitting(false);
        return;
      }
    }

    // Tightly coupled to API structure, but allows for flexibility in models and media replacement
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/${MODEL_UPDATE_ENDPOINTS[selectedModel]}/${selectedModelId}/`, //New Models needs APIK changes for PATCH method
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ media_asset: replacementId }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to update record.');
      }
      setSelectedMediaAssetId(replacementId ?? null);
      setRefreshKey((currentKey) => currentKey + 1);
      setSubmitError(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update record.');
    } finally {
      setIsSubmitting(false);
    }

  };


  return (
    <main className="w-full bg-msscc-white font-body text-msscc-gray-dark">
      <h2 className="mb-2 font-heading text-xl font-medium text-msscc-teal">Replace Image</h2>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-msscc-gray-mid">Select a catagory and the image you would like to replace:</p>
        <div className="flex flex-wrap gap-3">
          {(selectedModel === "events" || selectedModel === null) && (
            <button className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
            onClick={() => handleModelSelection("events")}>
              {selectedModel === null ? "Events" : "Cancel"}
            </button>
          )}
          {(selectedModel === "board-members" || selectedModel === null) && (
            <button className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
            onClick={() => handleModelSelection("board-members")}>
              {selectedModel === null ? "Board Members" : "Cancel"}
            </button>
          )}
          {(selectedModel === "partners" || selectedModel === null) && (
            <button className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
            onClick={() => handleModelSelection("partners")}>
              {selectedModel === null ? "Partners" : "Cancel"}
            </button>
          )}
          {(selectedModel === "static-images" || selectedModel === null) && (
            <button className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
            onClick={() => handleModelSelection("static-images")}>
              {selectedModel === null ? "Icons" : "Cancel"}
            </button>
          )}
        </div>

        {selectedModelId === null ? (
          <RetrieveImageList
            modelType={selectedModel}
            onSelect={(mediaAssetId, modelId) => {
              setSelectedMediaAssetId(mediaAssetId);
              setSelectedModelId(modelId);
            }}
            selectedId={selectedMediaAssetId}
            selectedModelId={selectedModelId}
            refreshKey={refreshKey}
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-msscc-teal-light bg-white p-4 sm:flex-row sm:items-center">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-100">
              {selectedMediaAssetId ? (
                <PostImage
                  mediaID={selectedMediaAssetId}
                  configVariant="thumbnail"
                  refreshKey={refreshKey}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-3 text-center text-sm text-slate-500">No image available</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">Selected image</p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedMediaAssetId ? `Media asset ${selectedMediaAssetId}` : "This record has no image."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedMediaAssetId(null);
                  setSelectedModelId(null);
                }}
                className="mt-3 rounded-sm border border-msscc-teal px-3 py-2 text-sm text-msscc-teal transition-colors hover:bg-msscc-gray-faint"
              >
                Reselect Image to be replaced
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-msscc-gray-mid">
          {selectedModel ? `Pick an image` : "No category selected."}
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-msscc-gray-mid sm:grid-cols-2 sm:divide-x sm:divide-msscc-gray-light sm:overflow-hidden sm:rounded-md sm:border sm:border-msscc-gray-light">
            <button
              type="button"
              onClick={selectUploadMode}
              disabled={!(selectedModel)}
              className={`flex items-center justify-center p-3 text-btn transition ${
                imageMode === "upload" ? "bg-msscc-teal text-white" : "bg-white hover:bg-msscc-gray-faint"
              } ${selectedModel ? "sm:rounded-l-md" : "opacity-50"}`}
            >
              Import New Image
            </button>
            <button
              type="button"
              onClick={selectExistingImageMode}
              disabled={!(selectedModel)}
              className={`flex items-center justify-center p-3 text-btn transition ${
                imageMode === "select" ? "bg-msscc-teal text-white" : "bg-white hover:bg-msscc-gray-faint"
              } ${selectedModel ? "sm:rounded-r-md" : "opacity-50"}`}
            >
              Select Existing Image
            </button>
          </div>
        </div>

        {imageMode === "upload" && (
          <ImportImage
            onChange={(file) => setSelectedFile(file)}
            label="Upload a replacement image"
          />
        )}

        {imageMode === "select" && (
          selectedReplacementId === null ? (
            <RetrieveImageList
              modelType={"media"}
              onSelect={(mediaAssetId) => setSelectedReplacementId(mediaAssetId)}
              selectedId={selectedReplacementId}
              refreshKey={refreshKey}
            />
          ) : (
            <div className="flex flex-col gap-4 rounded-lg border border-msscc-teal-light bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-100">
                <PostImage
                  mediaID={selectedReplacementId}
                  configVariant="thumbnail"
                  refreshKey={refreshKey}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">Selected replacement</p>
                <p className="mt-1 text-sm text-slate-500">Media asset {selectedReplacementId}</p>
                <button
                  type="button"
                  onClick={() => setSelectedReplacementId(null)}
                  className="mt-3 rounded-sm border border-msscc-teal px-3 py-2 text-sm text-msscc-teal transition-colors hover:bg-msscc-gray-faint"
                >
                  Reselect Replacement Image
                </button>
              </div>
            </div>
          )
        )}

        {/* Inactive will reduce UI clutter */}
        {selectedFile && imageMode === "upload" && (
           <div className="mt-6">
             <Image
               src={URL.createObjectURL(selectedFile)}
               alt="Selected for replacement"
               className="w-full max-w-sm rounded border"
               width={400}
               height={300}
              />
           </div>
        )}

        {/* Inactive will reduce UI clutter */}
        {imageMode !== null && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (imageMode === "upload" && !selectedFile) ||
                (imageMode === "select" && !selectedReplacementId)
              }
              className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:bg-msscc-gray-light sm:w-auto"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Image'}
            </button>
            <span className="break-all text-sm text-msscc-gray-mid">
              {imageMode === "upload" ? selectedFile ? selectedFile.name : 'No file selected.' : ''}
              {selectedReplacementId && imageMode === "select" && (
                <span className="ml-2">Selected: {selectedReplacementId}</span>
              )}
            </span>
          </div>
        )}

        {submitError && <p className="text-sm text-msscc-danger">{submitError}</p>}
        {uploadedUrl && (
          <p className="break-all text-sm text-msscc-teal">
            Image uploaded successfully: <span className="underline">{uploadedUrl}</span>
          </p>
        )}
      </div>

    </main>
  );
}
