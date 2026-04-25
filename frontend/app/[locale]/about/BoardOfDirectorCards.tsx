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
          className="mx-auto h-48 w-48 "
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-slate-200 text-sm text-slate-500">
          No photo
        </div>
      )}
      <p className="pb-3 pt-3 mt-2 font-serif text-white text-[clamp(0.75rem,2vw,1.5rem)]">
        <span className="block">{boardMemberName} -</span>
        <span className="block leading-tight">{boardMemberRole}</span>
      </p>
      <p className="text-sm text-white font-serif text-[clamp(0.25rem,2vw,1.0rem)]">{boardMemberCaption}</p>
    </div>
  );
}

export function DirectorCard({
  boardMemberName,
  boardMemberImageURL
}: DirectorCardProps) {
  return (
    <div className="text-center align-middle">
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="mx-auto h-32 w-32 rounded-full object-cover"
        />
      ) : (
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-slate-200 text-sm text-slate-500">
          No photo
        </div>
      )}
      <h1 className="mt-2 font-semibold">
        {boardMemberName}
      </h1>
    </div>
  );
}
