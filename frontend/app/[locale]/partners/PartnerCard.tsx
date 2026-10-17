interface PartnerCardProps {
  name: string;
  imageUrl?: string;
  description?: string;
  websiteUrl?: string;
  visitWebsiteLabel: string;
}

export function PartnerCard({
  name,
  imageUrl,
  description,
  websiteUrl,
  visitWebsiteLabel,
}: PartnerCardProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 rounded-md border border-msscc-gray-light bg-msscc-white p-4">
      <div className="inline-flex min-w-0 max-w-full items-center gap-1">
        <p className="min-w-0 break-words font-body text-body-sm font-bold text-msscc-gray-dark">
          {name}
        </p>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="size-8 shrink-0 rounded-sm object-contain"
          />
        )}
      </div>

      {/* Optional description */}
      {description && (
        <p className="break-words font-body text-caption leading-relaxed text-msscc-gray-mid">
          {description}
        </p>
      )}

      {/* Optional website link */}
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto break-words font-body text-caption text-msscc-teal underline underline-offset-[3px]"
        >
          {visitWebsiteLabel}
        </a>
      )}

    </div>
  );
}
