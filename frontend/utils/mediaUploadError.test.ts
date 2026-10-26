import {
  MediaUploadError,
  parseMediaUploadError,
} from '@/utils/mediaUploadError';

describe(parseMediaUploadError, () => {
  it('returns an unsupported-format message for invalid media', () => {
    const error = parseMediaUploadError(
      { code: 'invalid_media', details: { reasons: ['mime_type_mismatch'] } },
      'Event save failed.',
    );

    expect(error).toBeInstanceOf(MediaUploadError);
    expect(error.message).toContain('Unsupported or invalid image upload.');
  });

  it('returns a size-specific media message', () => {
    const error = parseMediaUploadError(
      { code: 'invalid_media', details: { reasons: ['file_too_large'] } },
      'Event save failed.',
    );

    expect(error).toBeInstanceOf(MediaUploadError);
    expect(error.message).toBe('Image upload is too large.');
  });

  it('returns an image-integrity message', () => {
    const error = parseMediaUploadError(
      { code: 'invalid_media', details: { reasons: ['image_content_invalid'] } },
      'Event save failed.',
    );

    expect(error).toBeInstanceOf(MediaUploadError);
    expect(error.message).toBe('This image could not be verified.');
  });

  it('returns the caller fallback for non-media errors', () => {
    const error = parseMediaUploadError(
      { code: 'media_persistence_failed' },
      'Event save failed.',
    );

    expect(error).not.toBeInstanceOf(MediaUploadError);
    expect(error.message).toBe('Event save failed.');
  });

  it('handles non-object errors with the caller fallback', () => {
    const error = parseMediaUploadError(new Error('network failure'), 'Upload failed.');

    expect(error).not.toBeInstanceOf(MediaUploadError);
    expect(error.message).toBe('Upload failed.');
  });
});
