'use client';

import { useState } from 'react';

import type { BoardMember } from './page';

// text-base keeps iOS Safari from zooming in when an input is focused
const inputClass = "w-full border rounded px-2 py-1 mt-1 font-normal text-base";

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
  // Keep each board-member translation independent so one field does not block the others.
  const [translatingFields, setTranslatingFields] = useState<BoardMemberTranslationField[]>([]);

  const handleTranslation = async (field: BoardMemberTranslationField) => {
    if (!edited) return;

    const { source, target } = BOARD_MEMBER_TRANSLATION_FIELDS[field];
    setTranslatingFields((currentFields) => [...currentFields, field]);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: edited[source] }),
      });

      if (!response.ok) {
        console.error(`Translation failed with status ${response.status}.`);
        return;
      }

      const data = (await response.json()) as { translation?: unknown };
      if (typeof data.translation !== 'string') return;

      // Keep the translated value in the popup draft until the admin saves it.
      setEdited((currentMember) =>
        currentMember ? { ...currentMember, [target]: data.translation } : currentMember,
      );
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setTranslatingFields((currentFields) =>
        currentFields.filter((currentField) => currentField !== field),
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded p-4 sm:p-6 w-full max-w-sm max-h-[90dvh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {type === "officer" ? "Edit Officer" : "Edit Director"}
        </h2>

        <div className="flex justify-center mb-4">
          <label className="cursor-pointer">
            {edited?.boardMemberImageURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={edited.boardMemberImageURL}
                alt="portrait"
                className="h-32 w-32 sm:h-48 sm:w-48 hover:opacity-70 transition-opacity"
              />
            ) : (
              <div className="h-24 w-24 bg-slate-200 flex items-center justify-center text-sm text-gray-500 hover:opacity-70 transition-opacity">
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
          <label className="text-sm font-semibold">Name (English)
            <input
              type="text"
              value={edited?.boardMemberNameEn ?? ""}
              onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberNameEn: e.target.value } : prev)}
              className={inputClass}
            />
          </label>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="board-member-name-ja" className="text-sm font-semibold">
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
              <label className="text-sm font-semibold">Role (English)
                <input
                  type="text"
                  value={edited?.boardMemberRoleEn ?? ""}
                  onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberRoleEn: e.target.value } : prev)}
                  className={inputClass}
                />
              </label>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="board-member-role-ja" className="text-sm font-semibold">
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
              <label className="text-sm font-semibold">Caption (English)
                <textarea
                value={edited?.boardMemberCaptionEn ?? ""}
                onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberCaptionEn: e.target.value } : prev)}
                className={`${inputClass} resize-none`}
                rows={4}
                />
              </label>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="board-member-caption-ja" className="text-sm font-semibold">
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

        <div className="flex gap-2 mt-4">
          <button onClick={() => onClose(null)} className="flex-1 px-2 sm:px-4 py-2 bg-gray-500 text-white rounded">
            Close
          </button>
          <button onClick={() => { onDelete(member); onClose(null); }} className="flex-1 px-2 sm:px-4 py-2 bg-red-500 text-white rounded">
            Delete
          </button>
          <button
            onClick={() => {
              if (!edited?.boardMemberNameEn?.trim()) {
                alert("English name cannot be empty");
                return;
              }
              onUpdate(edited, editedFile);
              onClose(null);
            }}
            className="flex-1 px-2 sm:px-4 py-2 bg-green-500 text-white rounded"
          >
            {member?.boardMemberNameEn ? "Update" : "Add"}
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
