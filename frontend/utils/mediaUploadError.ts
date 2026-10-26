export class MediaUploadError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isMediaUploadError = (value: unknown): boolean => (
  isRecord(value) && value.code === 'invalid_media'
);

const getReasons = (value: unknown): string[] => {
  if (!isRecord(value) || !isRecord(value.details) || !Array.isArray(value.details.reasons)) {
    return [];
  }

  return value.details.reasons.filter(
    (reason): reason is string => typeof reason === 'string',
  );
};

const getMediaUploadMessage = (reasons: string[]): string => {
  if (reasons.includes('file_too_large')) {
    return 'Image upload is too large.';
  }

  if (reasons.includes('image_dimensions_too_large')) {
    return 'Image dimensions are too large.';
  }

  if (reasons.includes('image_content_invalid')) {
    return 'This image could not be verified.';
  }

  return (
    'Unsupported or invalid image upload. Please use common image formats.'
  );
};

/** Convert an API response payload into a media-specific or fallback Error. */
export function parseMediaUploadError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (!isMediaUploadError(error)) {
    return new Error(fallbackMessage);
  }

  return new MediaUploadError(getMediaUploadMessage(getReasons(error)));
}
