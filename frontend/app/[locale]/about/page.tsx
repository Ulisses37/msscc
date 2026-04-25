'use client';

import { useEffect, useState } from "react";
import { OfficerCard, DirectorCard } from "./BoardOfDirectorCards";

interface BoardMember {
  boardMemberName: string;
  boardMemberImageURL: string | null;
  boardMemberRole: string | null;
  boardMemberCaption: string | null;
}

export default function AboutPage() {
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/api/board-members/").then(res => res.json()),
      fetch("http://localhost:8000/api/media/").then(res => res.json()),
    ])
      .then(([members, mediaAssets]: [unknown[], unknown[]]) => {
        const mediaById = new Map(
          (mediaAssets as {media_asset_id: number; file_url: string | null}[])
            .map(m => [m.media_asset_id, m])
        );

        const enriched: BoardMember[] = (members as {
          display_name: string;
          display_order: number;
          media_asset: number | null;
          role: string;
          caption: string;
        }[])
          .sort((a, b) => a.display_order - b.display_order)
          .map(member => ({
            boardMemberName: member.display_name,
            boardMemberRole: member.role,
            boardMemberCaption: member.caption,
            boardMemberImageURL: member.media_asset
              ? mediaById.get(member.media_asset)?.file_url ?? null
              : null,
          }));

        setBoardMembers(enriched);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <main className="p-6">Loading...</main>;
  if (error) return <main className="p-6 text-red-600">{error}</main>;

  return (
    <main>
      <div className="min-h-40">
        <h1 className="text-4xl font-bold text-center mt-6 mb-2">About Us</h1>
      </div>

      <div className="bg-msscc-teal p-0 m-0 min-h-screen">
        <p className="text-6xl text-center font-serif text-white mb-6 pt-8">
          Board of Directors
        </p>

        <p className="text-3xl text-center font-serif text-white mb-4">
          Officers
        </p>

        {/* Officers Section */}
        <div className="grid gap-2 grid-cols-6 justify-center text-center mb-6">
          <div className="col-span-1" /> {/* left spacer */}
            {boardMembers.map((member) => {
            if (member.boardMemberRole !== "Director") {
              return (
                <OfficerCard
                  key={member.boardMemberName}
                  boardMemberName={member.boardMemberName}
                  boardMemberRole={member.boardMemberRole}
                  boardMemberCaption={member.boardMemberCaption ?? ""}
                  boardMemberImageURL={member.boardMemberImageURL}
                />
              );
            }
          })}
          </div>
        <div className="col-span-1" /> {/* right spacer */}

        {/* Directors Section */}
        <div className="text-center mt-12 mb-6">
          <p className="text-3xl text-center font-serif text-white mb-4">
            Directors
          </p>
        </div>
        <div className="flex flex-wrap justify-center align-middle gap-12 mb-6 w-[70%] mx-auto">
          {boardMembers.map((member) => {
          if (member.boardMemberRole == "Director") {
            return (
              <DirectorCard
                key={member.boardMemberName}
                boardMemberName={member.boardMemberName}
                boardMemberImageURL={member.boardMemberImageURL}
                />
              );
            }
          })}
        </div>

      </div>
    </main>
  );
}
