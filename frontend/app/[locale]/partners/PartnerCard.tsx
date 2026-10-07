interface PartnerCardProps {
  name: string;
  imageUrl?: string;
  description?: string;
  websiteUrl?: string;
}

export function PartnerCard({ name, imageUrl, description, websiteUrl }: PartnerCardProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 rounded-md border border-msscc-gray-light bg-msscc-white p-4">

      {/* Dynamic media hosts can vary by deployment, so native images avoid rejecting valid partner logos. */}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="h-20 w-full max-w-full object-contain"
        />
      )}

      {/* Name */}
      <p className="break-words font-body text-body-sm font-bold text-msscc-gray-dark">
        {name}
      </p>

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
          Visit website →
        </a>
      )}

    </div>
  );
}
