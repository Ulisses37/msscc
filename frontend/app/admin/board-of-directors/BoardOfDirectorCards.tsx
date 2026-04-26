'use client';

interface DirectorCardProps {
  boardMemberName: string;
  boardMemberImageURL: string | null;
}

interface OfficerCardProps extends DirectorCardProps{
  boardMemberRole: string | null;
  boardMemberCaption: string | null;
}

export function OfficerCardPreview({
  boardMemberName,
  boardMemberImageURL,
  boardMemberRole,
  boardMemberCaption
}: OfficerCardProps & { onClick?: () => void }) {
  return (
    <div className="text-left align-middle basis-1/6 pt-2 w-full ml-1 mr-1 md:w-auto cursor-pointer hover:bg-gray-500 rounded transition-colors">
      <h2 className="text-2xl font-serif mb-2 pl-3 text-black">{boardMemberRole}</h2>
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="mx-auto h-24 w-24 sm:h-16 sm:w-16 lg:h-48 lg:w-48"
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-slate-200 text-sm text-white">
          No photo
        </div>
      )}
      <p className="text-center pb-3 mt-2 font-serif text-black text-[clamp(0.75rem,2vw,1.5rem)]">
        <span className="block">{boardMemberName}</span>
      </p>
    </div>
  );
}

export function DirectorCardPreview({
  boardMemberName,
  boardMemberImageURL
}: DirectorCardProps & { onClick?: () => void }) {
  return (
    <div className="flex items-center gap-3 justify-left ml-3 pl-1 py-1 w-48 cursor-pointer hover:bg-gray-500 rounded transition-colors">
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="h-16 w-16 flex-shrink-0"
        />
      ) : (
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm text-white">
          No photo
        </div>
      )}
      <p className="font-serif text-black">{boardMemberName}</p>
    </div>
  );
}
