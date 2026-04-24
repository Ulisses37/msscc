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
        {boardMemberName} - {boardMemberRole}
      </h1>
      <p className="text-sm text-slate-600">{boardMemberCaption}</p>
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
