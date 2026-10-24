'use client';

// React and Next Imports
import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { OfficerCard, DirectorCard } from "./BoardOfDirectorCards";

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent, getCachedPageContent, } from '@/utils/content';
import { usePreviewBlocks } from '@/hooks/usePreviewBlocks';
import { useDelayedFallback } from '@/hooks/useDelayedFallback';
import { ContentStateTransition } from '@/components/content/ContentFallBack';

interface BoardMember {
  boardMemberName: string;
  boardMemberImageURL: string | null;
  boardMemberRole: string;
  boardMemberCaption: string | null;
  isDirector: boolean;
}

export default function AboutPage() {
  const t = useTranslations('AboutPage');
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>(getCachedPageContent('about'),);
  const previewReceivedRef = usePreviewBlocks(setContentBlocks);
  const contentDisplayState = useDelayedFallback(contentBlocks.length);
  const params = useParams();
  const locale = params?.locale;
  const isJapanese = locale === 'ja';

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('about');
        if (previewReceivedRef.current) return;
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const loadBoardData = async () => {
      try {
        const [membersResponse, mediaResponse] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/board-members/`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`),
        ]);

        if (!membersResponse.ok) {
          throw new Error(`Failed to load board members: ${membersResponse.status}`);
        }

        if (!mediaResponse.ok) {
          throw new Error(`Failed to load media: ${mediaResponse.status}`);
        }

        const [members, mediaAssets] = await Promise.all([
          membersResponse.json() as Promise<unknown>,
          mediaResponse.json() as Promise<unknown>,
        ]);

        if (!Array.isArray(members) || !Array.isArray(mediaAssets)) {
          throw new Error('Board member data has an unexpected format');
        }

        const mediaById = new Map(
          (mediaAssets as {media_asset_id: number; file_url: string | null}[])
            .map(m => [m.media_asset_id, m])
        );

        const enriched: BoardMember[] = (members as {
          display_name_en: string;
          display_name_ja: string;
          display_order: number;
          media_asset: number | null;
          role_en: string;
          role_ja: string;
          caption_en: string;
          caption_ja: string;
        }[])
          .sort((a, b) => a.display_order - b.display_order)
          .map(member => ({
            boardMemberName: isJapanese && member.display_name_ja ? member.display_name_ja : member.display_name_en,
            boardMemberRole: isJapanese && member.role_ja ? member.role_ja : member.role_en,
            boardMemberCaption: isJapanese && member.caption_ja ? member.caption_ja : member.caption_en,
            isDirector: member.role_en === "Director",
            boardMemberImageURL: member.media_asset
              ? mediaById.get(member.media_asset)?.file_url ?? null
              : null,
          }));

        if (cancelled) return;

        setBoardMembers(enriched);

      } catch (err) {
        if (cancelled) return;

        setBoardMembers([]);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadBoardData();

    return () => {
      cancelled = true;
    };
  }, [isJapanese]);

  return (
    <main className="min-w-0 max-w-full">

      {/* Display Staff-Editable Content Blocks */}
      {/* Responsive editable headings and emergency wrapping keep long English content in view. */}
      <section
        className="mx-auto w-full min-w-0 max-w-content px-6 py-10 [overflow-wrap:anywhere] [&_h2]:text-[clamp(2rem,10vw,4rem)]"
      >
        <ContentStateTransition state={contentDisplayState} source="about">
          {contentBlocks.map((block) => (
            <ContentBlockRenderer
              key={block.content_id}
              block={block}
              locale={String(locale)}
            />
          ))}
        </ContentStateTransition>
      </section>

      <section
        aria-labelledby="about-board-heading"
        className="min-h-screen w-full min-w-0 max-w-full bg-msscc-teal p-0 m-0"
        data-testid="board-section"
      >
        {/* Smaller mobile headings and side padding prevent the title from overflowing at 320px. */}
        <h2 id="about-board-heading" className="px-4 pt-8 text-center font-serif text-4xl leading-tight text-white sm:text-5xl lg:px-0 lg:text-6xl">
          {t('boardOfDirectors')}
        </h2>

        <p className="mb-6 px-4 pt-2 text-center font-serif text-2xl leading-snug text-white sm:text-3xl lg:px-0">
          {t('officers')}
        </p>

        {isLoading ? (
          <p role="status" className="p-6 text-center text-white">
            {t('loading')}
          </p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-white">
            {t('error')}
          </p>
        ) : (
          <>
            {/* Officers Section */}
            {/* Full-width mobile cards need shared gutters and extra vertical separation for readable bios. */}
            <div className="grid grid-cols-1 gap-y-8 px-4 text-center md:grid-cols-2 md:gap-x-6 md:gap-y-10 md:px-6 lg:grid-cols-6 lg:gap-2 lg:px-2">
              <div className="hidden lg:col-span-1 lg:block" /> {/* left spacer */}
              {boardMembers.map((member) => {
                if (!member.isDirector) {
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
              <div className="hidden lg:col-span-1 lg:block" /> {/* right spacer */}
            </div>

            {/* Directors Section */}
            <div className="text-center mt-12 mb-6">
              <p className="text-3xl text-center font-serif text-white mb-4">
                {t('directors')}
              </p>
            </div>
            {/* Narrow gutters remain visible while keeping four Director frames inside a 768px viewport. */}
            <div
              className="mx-auto mb-6 grid max-w-content grid-cols-2 gap-x-2 gap-y-8 px-4 sm:gap-x-3 md:grid-cols-4 md:gap-y-10 md:px-6 lg:gap-x-4"
            >
              {boardMembers.map((member) => {
                if (member.isDirector) {
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
          </>
        )}
      </section>
    </main>
  );
}
