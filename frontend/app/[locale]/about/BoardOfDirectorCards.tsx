'use client';

interface DirectorCardProps {
  boardMemberName: string;
  boardMemberImageURL: string | null;
}

interface OfficerCardProps extends DirectorCardProps{
  boardMemberRole: string | null;
  boardMemberCaption: string | null;
}

export function OfficerCard({
  boardMemberName,
  boardMemberRole,
  boardMemberCaption,
  boardMemberImageURL,
}: OfficerCardProps) {
  // Long bilingual content must shrink and wrap inside its grid cell instead of overflowing.
  // A shared media area keeps details aligned when source portraits have different aspect ratios.
  return (
    <div className="min-w-0 w-full p-2 text-left align-middle">
      <div className="mx-auto flex aspect-square w-full max-w-[17.5rem] items-end justify-center lg:max-w-64">
        {boardMemberImageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={boardMemberImageURL}
            alt={`${boardMemberName} portrait`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-slate-200 text-sm text-white">
            No photo
          </div>
        )}
      </div>
      {/* Separate blocks avoid awkward wraps while preserving the established white serif treatment. */}
      <div className="mt-3 break-words pb-3">
        <p className="font-serif text-base leading-snug text-white sm:text-lg lg:text-[clamp(1rem,2vw,1.75rem)]">
          {boardMemberName}
        </p>
        <p className="mt-1 font-serif text-sm leading-snug text-white sm:text-base lg:text-[clamp(0.875rem,1.5vw,1.25rem)]">
          {boardMemberRole}
        </p>
      </div>
      {/* Relaxed leading keeps multi-line officer descriptions scannable on narrow screens. */}
      <p className="break-words font-serif text-sm leading-relaxed text-white lg:text-[clamp(0.875rem,1.5vw,1rem)]">
        {boardMemberCaption}
      </p>
    </div>
  );
}

export function DirectorCard({
  boardMemberName,
  boardMemberImageURL
}: DirectorCardProps) {
  return (
    <div className="text-center w-24 sm:w-32 md:w-40 lg:w-48">
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="mx-auto h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 lg:h-48 lg:w-48"
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-slate-200 text-sm text-white">
          No photo
        </div>
      )}
      <p className="mt-2 font-serif text-white text-[clamp(0.5rem,1.5vw,1.25rem)]">
        {boardMemberName}
      </p>
    </div>
  );
}
