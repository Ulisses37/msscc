'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('AboutPage');
  // Long bilingual content must shrink and wrap inside its grid cell instead of overflowing.
  // A shared media area keeps details aligned when source portraits have different aspect ratios.
  return (
    <div className="min-w-0 w-full p-2 text-left align-middle">
      <div
        className="relative mx-auto flex aspect-square w-full max-w-[17.5rem] items-end justify-center lg:max-w-64"
      >
        {boardMemberImageURL ? (
          <Image
            src={boardMemberImageURL}
            alt={t('portraitAlt', { name: boardMemberName })}
            fill
            sizes={
              '(min-width: 1024px) 16rem, (min-width: 768px) 17.5rem, calc(100vw - 3rem)'
            }
            className="size-full object-contain object-bottom"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-slate-200 text-sm text-white">
            {t('noPhoto')}
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
  const t = useTranslations('AboutPage');
  return (
    <div className="min-w-0 w-full text-center">
      {/* Matching square frames crop varied uploads consistently and preserve the teal grid gutters. */}
      <div
        className="relative mx-auto aspect-square w-full max-w-32 overflow-hidden sm:max-w-40 lg:max-w-48"
      >
        {boardMemberImageURL ? (
          <Image
            src={boardMemberImageURL}
            alt={t('portraitAlt', { name: boardMemberName })}
            fill
            sizes="(min-width: 1024px) 12rem, (min-width: 640px) 10rem, 8rem"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-slate-200 text-sm text-white">
            {t('noPhoto')}
          </div>
        )}
      </div>
      <p className="mt-2 break-words font-serif text-white text-[clamp(0.75rem,1.5vw,1.25rem)]">
        {boardMemberName}
      </p>
    </div>
  );
}
