'use client';

import { useState, useEffect } from 'react';

import { TranslationReviewNotice } from '@/components/admin/TranslationReviewNotice';
import { useTranslationReviewNotice } from '@/components/admin/useTranslationReviewNotice';
import { requestDeepLTranslation } from '@/services/deeplService';

import type { BoardMember } from './page';

// text-base keeps iOS Safari from zooming in when an input is focused
const inputClass =
  "mt-1 w-full rounded-md border border-msscc-gray-light bg-msscc-white px-3 py-2 text-base font-normal text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin";

const labelClass = "text-label tracking-label text-msscc-gray-mid";


type BoardMemberTranslationField = 'name' | 'role' | 'caption';

const BOARD_MEMBER_TRANSLATION_FIELDS: Record<
  BoardMemberTranslationField,
  {
    source: 'boardMemberNameEn' | 'boardMemberRoleEn' | 'boardMemberCaptionEn';
    target: 'boardMemberNameJa' | 'boardMemberRoleJa' | 'boardMemberCaptionJa';
  }
> = {
  name: { source: 'boardMemberNameEn', target: 'boardMemberNameJa' },
  role: { source: 'boardMemberRoleEn', target: 'boardMemberRoleJa' },
  caption: { source: 'boardMemberCaptionEn', target: 'boardMemberCaptionJa' },
};

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  boardMemberCaption,
  onClick
}: OfficerCardProps & { onClick?: () => void }) {
  return (
    <div onClick={onClick}
    className="min-w-0 w-full text-left pt-2 cursor-pointer border-2 border-msscc-gray-light bg-msscc-white hover:bg-msscc-pink-faint rounded">
      <h2 className="text-xl sm:text-xl mb-2 px-4 sm:pl-6 text-msscc-gray-dark break-words">{boardMemberRole}</h2>
      {boardMemberImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardMemberImageURL}
          alt={`${boardMemberName} portrait`}
          className="mx-auto h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48"
        />
      ) : (
        <div className="mx-auto flex h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48 items-center justify-center rounded-full bg-slate-200 text-sm text-white">
          No photo
        </div>
      )}
      <p className="text-center px-2 pb-3 mt-2 font-serif text-black text-lg lg:text-xl break-words">
        <span className="block">{boardMemberName}</span>
      </p>
    </div>
  );
}

export function DirectorCardPreview({
  boardMemberName,
  boardMemberImageURL,
  onClick
}: DirectorCardProps & { onClick?: () => void }) {
  return (
    <div onClick={onClick}
    className="min-w-0 w-full flex items-center gap-3 pl-1 pr-2 py-1 cursor-pointer border-2 border-msscc-gray-light bg-msscc-white hover:bg-msscc-pink-faint rounded">
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
      <p className="min-w-0 font-serif text-black break-words">{boardMemberName}</p>
    </div>
  );
}

export function MemberPopUp({ member, type, onUpdate, onClose, onDelete }:
  {
    member: BoardMember | null,
    type: "officer" | "director",
    onUpdate: (member: BoardMember | null, file?: File | null) => void,
    onClose: (value: null) => void,
    onDelete: (member: BoardMember | null) => void
  }
) {
  const [edited, setEdited] = useState<BoardMember | null>(member);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const isNewMember = member?.boardMemberId === -1;
  // Keep each board-member translation independent so one field does not block the others.
  const [translatingFields, setTranslatingFields] = useState<BoardMemberTranslationField[]>([]);
  const nameReviewNotice = useTranslationReviewNotice();
  const roleReviewNotice = useTranslationReviewNotice();
  const captionReviewNotice = useTranslationReviewNotice();

  const updateEnglishField = (
    field: 'boardMemberNameEn' | 'boardMemberRoleEn' | 'boardMemberCaptionEn',
    value: string,
    markEnglishChanged: () => void,
  ) => {
    // Ignore focus changes that report the current value without an actual edit.
    if (edited?.[field] === value) return;

    markEnglishChanged();
    setEdited((currentMember) =>
      currentMember ? { ...currentMember, [field]: value } : currentMember,
    );
  };

  const handleTranslation = async (field: BoardMemberTranslationField) => {
    if (!edited) return;

    const { source, target } = BOARD_MEMBER_TRANSLATION_FIELDS[field];
    setTranslatingFields((currentFields) => [...currentFields, field]);

    try {
      const translation = await requestDeepLTranslation(edited[source]);
      if (!translation) return;

      // Keep the translated value in the popup draft until the admin saves it.
      setEdited((currentMember) =>
        currentMember ? { ...currentMember, [target]: translation } : currentMember,
      );
    } finally {
      setTranslatingFields((currentFields) =>
        currentFields.filter((currentField) => currentField !== field),
      );
    }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(null);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onClose(null)}
    >
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-md bg-msscc-white p-4 font-body text-msscc-gray-dark sm:p-6"
        onClick={(e) => e.stopPropagation()}
    >
      <h2 className="mb-4 border-b border-msscc-gray-light pb-3 font-heading text-heading-2 text-msscc-teal">
        {type === "officer" ? "Edit Officer" : "Edit Director"}
      </h2>

      <div className="mb-4 flex justify-center">
        <label className="cursor-pointer">
          {edited?.boardMemberImageURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={edited.boardMemberImageURL}
              alt="portrait"
              className="h-32 w-32 transition-opacity hover:opacity-70 sm:h-48 sm:w-48"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center bg-msscc-gray-light text-sm text-msscc-gray-mid transition-opacity hover:opacity-70">
              Add photo
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                setEditedFile(file);
                setEdited(prev => prev ? { ...prev, boardMemberImageURL: url } : prev);
              }
            }}
          />
        </label>
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-3">
        {nameReviewNotice.showNotice && (
          <TranslationReviewNotice onDismiss={nameReviewNotice.dismissNotice} />
        )}
        <label className={labelClass}>Name (English)
          <input
            type="text"
            value={edited?.boardMemberNameEn ?? ""}
            onChange={(event) =>
              updateEnglishField(
                'boardMemberNameEn',
                event.target.value,
                nameReviewNotice.markEnglishChanged,
              )
            }
            className={inputClass}
          />
        </label>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="board-member-name-ja" className={labelClass}>
              Name (Japanese)
            </label>
            <BoardMemberTranslationButton
              fieldLabel="board member name"
              isTranslating={translatingFields.includes('name')}
              disabled={!edited?.boardMemberNameEn.trim()}
              onClick={() => handleTranslation('name')}
            />
          </div>
          <input
            id="board-member-name-ja"
            type="text"
            value={edited?.boardMemberNameJa ?? ""}
            onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberNameJa: e.target.value } : prev)}
            className={inputClass}
          />
        </div>

        {/* Officer*/}
        {type === "officer" && (
          <>
            {roleReviewNotice.showNotice && (
              <TranslationReviewNotice onDismiss={roleReviewNotice.dismissNotice} />
            )}
            <label className={labelClass}>Role (English)
              <input
                type="text"
                value={edited?.boardMemberRoleEn ?? ""}
                onChange={(event) =>
                  updateEnglishField(
                    'boardMemberRoleEn',
                    event.target.value,
                    roleReviewNotice.markEnglishChanged,
                  )
                }
                className={inputClass}
              />
            </label>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="board-member-role-ja" className={labelClass}>
                  Role (Japanese)
                </label>
                <BoardMemberTranslationButton
                  fieldLabel="board member role"
                  isTranslating={translatingFields.includes('role')}
                  disabled={!edited?.boardMemberRoleEn.trim()}
                  onClick={() => handleTranslation('role')}
                />
              </div>
              <input
                id="board-member-role-ja"
                type="text"
                value={edited?.boardMemberRoleJa ?? ""}
                onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberRoleJa: e.target.value } : prev)}
                className={inputClass}
              />
            </div>
            {captionReviewNotice.showNotice && (
              <TranslationReviewNotice onDismiss={captionReviewNotice.dismissNotice} />
            )}
            <label className={labelClass}>Caption (English)
              <textarea
                value={edited?.boardMemberCaptionEn ?? ""}
                onChange={(event) =>
                  updateEnglishField(
                    'boardMemberCaptionEn',
                    event.target.value,
                    captionReviewNotice.markEnglishChanged,
                  )
                }
                className={`${inputClass} resize-none`}
                rows={4}
              />
            </label>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="board-member-caption-ja" className={labelClass}>
                  Caption (Japanese)
                </label>
                <BoardMemberTranslationButton
                  fieldLabel="board member caption"
                  isTranslating={translatingFields.includes('caption')}
                  disabled={!edited?.boardMemberCaptionEn.trim()}
                  onClick={() => handleTranslation('caption')}
                />
              </div>
              <textarea
                id="board-member-caption-ja"
                value={edited?.boardMemberCaptionJa ?? ""}
                onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberCaptionJa: e.target.value } : prev)}
                className={`${inputClass} resize-none`}
                rows={4}
              />
            </div>
          </>
        )}
      </div>

      {/* Actions: stacked on phones, a row from sm up */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button
          onClick={() => onClose(null)}
          className="w-full rounded-sm border border-msscc-gray-light bg-msscc-white px-4 py-2 text-btn tracking-btn text-msscc-gray-dark transition-colors hover:border-msscc-pink hover:text-msscc-pink"
        >
          Close
        </button>
        {/* An unsaved draft has no database record to delete. */}
        {!isNewMember && (
          <button
            onClick={() => {
              onDelete(member);
              onClose(null);
            }}
            className="w-full rounded-sm bg-msscc-danger px-4 py-2 text-btn tracking-btn text-white transition-colors hover:opacity-90"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => {
            if (!edited?.boardMemberNameEn?.trim()) {
              alert("English name cannot be empty");
              return;
            }
            onUpdate(edited, editedFile);
            onClose(null);
          }}
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:bg-msscc-gray-light disabled:text-msscc-gray-mid"
        >
          {isNewMember ? "Add" : "Update"}
        </button>
      </div>
      </div>
    </div>
  );
}

interface BoardMemberTranslationButtonProps {
  fieldLabel: string;
  isTranslating: boolean;
  disabled: boolean;
  onClick: () => Promise<void>;
}

function BoardMemberTranslationButton({
  fieldLabel,
  isTranslating,
  disabled,
  onClick,
}: BoardMemberTranslationButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Translate ${fieldLabel} to Japanese`}
      onClick={() => void onClick()}
      disabled={disabled || isTranslating}
      className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest
        transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isTranslating
            ? 'border-msscc-gray-light bg-gray-100 text-msscc-gray-mid'
            : 'border-msscc-teal/30 bg-msscc-teal/10 text-msscc-teal hover:bg-msscc-teal hover:text-white active:scale-95 active:transform'
        }`}
    >
      {isTranslating ? 'Translating...' : 'Translate to Japanese'}
    </button>
  );
}
