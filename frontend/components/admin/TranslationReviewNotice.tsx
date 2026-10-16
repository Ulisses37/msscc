interface TranslationReviewNoticeProps {
  onDismiss: () => void;
}

/** Warns an admin that the paired Japanese text may no longer match the English text. */
export function TranslationReviewNotice({ onDismiss }: TranslationReviewNoticeProps) {
  return (
    <div
      role="status"
      className="mb-2 flex flex-col gap-2 rounded-sm border border-msscc-pink/30 bg-msscc-pink-faint px-3 py-2 text-body-sm text-msscc-gray-dark xl:flex-row xl:items-center xl:justify-between xl:gap-3"
    >
      <span>⚠ The English text was changed. Please review the Japanese text.</span>
      <button
        type="button"
        aria-label="Dismiss English text change notice"
        onClick={onDismiss}
        className="self-center rounded-sm px-2 py-1 text-btn text-msscc-pink hover:bg-msscc-pink/10 xl:self-auto"
      >
        Dismiss
      </button>
    </div>
  );
}