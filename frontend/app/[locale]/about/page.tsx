'use client';

// React and Next Imports
import { useEffect, useState } from "react";
import { useParams } from 'next/navigation';

// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { OfficerCard, DirectorCard } from "./BoardOfDirectorCards";

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent } from '@/utils/content';

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
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const params = useParams();
  const locale = params?.locale;

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('about');
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

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

      {/* Display Staff-Editable Content Blocks */}
      <section className="mx-auto max-w-content px-6 py-10">
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={String(locale)}
          />
        ))}
      </section>

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
