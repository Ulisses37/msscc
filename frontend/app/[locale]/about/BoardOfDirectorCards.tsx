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
  return (
    <div className="text-left align-middle p-2 basis-1/6 w-full md:w-auto">
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="mx-auto h-24 w-24 sm:h-32 sm:w-32 md:h-48 md:w-48 lg:h-64 lg:w-64"
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-slate-200 text-sm text-white">
          No photo
        </div>
      )}
      <p className="pb-3 pt-3 mt-2 font-serif text-white text-[clamp(0.75rem,2vw,1.75rem)]">
        <span className="block">{boardMemberName} -</span>
        <span className="block leading-tight">{boardMemberRole}</span>
      </p>
      <p className="font-serif text-white text-[clamp(0.25rem,1.5vw,1.0rem)]">
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
