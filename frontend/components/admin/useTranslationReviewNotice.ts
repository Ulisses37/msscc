import { useState } from 'react';

interface TranslationReviewNoticeState {
  showNotice: boolean;
  dismissNotice: () => void;
  markEnglishChanged: () => void;
}

/** Tracks review notice visibility for one English and Japanese field pair. */
export function useTranslationReviewNotice(): TranslationReviewNoticeState {
  const [showNotice, setShowNotice] = useState(false);

  // User-originated English handlers call this, while automatic value updates do not.
  const markEnglishChanged = () => setShowNotice(true);
  const dismissNotice = () => setShowNotice(false);

  return { showNotice, dismissNotice, markEnglishChanged };
}