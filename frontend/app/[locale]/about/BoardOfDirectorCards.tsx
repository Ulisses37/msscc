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
      <p className="mt-2 break-words pb-3 pt-3 font-serif text-white text-[clamp(0.75rem,2vw,1.75rem)]">
        <span className="block">{boardMemberName} -</span>
        <span className="block leading-tight">{boardMemberRole}</span>
      </p>
      <p className="break-words font-serif text-white text-[clamp(0.25rem,1.5vw,1.0rem)]">
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
