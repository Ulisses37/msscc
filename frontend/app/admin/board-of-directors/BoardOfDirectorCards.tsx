'use client';

import {BoardMember} from "./page"
import { useState } from "react";
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
  boardMemberCaption,
  onClick
}: OfficerCardProps & { onClick?: () => void }) {
  return (
    <div onClick={onClick}
    className="text-left align-middle basis-1/6 pt-2 w-full ml-1 mr-1 md:w-auto cursor-pointer hover:bg-gray-500 rounded">
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
  boardMemberImageURL,
  onClick
}: DirectorCardProps & { onClick?: () => void }) {
  return (
    <div onClick={onClick}
    className="flex items-center gap-3 justify-left ml-3 pl-1 py-1 w-48 cursor-pointer hover:bg-gray-500 rounded">
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

export function MemberPopUp({ member, type, onUpdate, onClose, onDelete }:
  {
    member: BoardMember | null,
    type: "officer" | "director",
    onUpdate: (member: BoardMember | null) => void,
    onClose: (value: null) => void,
    onDelete: (member: BoardMember | null) => void
  }
) {
  const [edited, setEdited] = useState<BoardMember | null>(member);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-96">
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
                className="h-32 w-32 hover:opacity-70 transition-opacity"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-slate-200 flex items-center justify-center text-sm text-gray-500 hover:opacity-70 transition-opacity">
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
                  setEdited(prev => prev ? { ...prev, boardMemberImageURL: url } : prev);
                }
              }}
            />
          </label>
        </div>

        {/* Editable fields */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold">Name
            <input
              type="text"
              value={edited?.boardMemberName ?? ""}
              onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberName: e.target.value } : prev)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
          </label>

          {/* Officer*/}
          {type === "officer" && (
            <>
              <label className="text-sm font-semibold">Role
                <input
                  type="text"
                  value={edited?.boardMemberRole ?? ""}
                  onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberRole: e.target.value } : prev)}
                  className="w-full border rounded px-2 py-1 mt-1 font-normal"
                />
              </label>
              <label className="text-sm font-semibold">Caption
                <input
                  type="text"
                  value={edited?.boardMemberCaption ?? ""}
                  onChange={(e) => setEdited(prev => prev ? { ...prev, boardMemberCaption: e.target.value } : prev)}
                  className="w-full border rounded px-2 py-1 mt-1 font-normal"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={() => onClose(null)} className="px-4 py-2 bg-gray-500 text-white rounded">
            Close
          </button>
          <button onClick={() => { onDelete(member); onClose(null); }} className="px-4 py-2 bg-red-500 text-white rounded">
            Delete
          </button>
          <button
            onClick={() => {
              if (!edited?.boardMemberName?.trim()) {
                alert("Name cannot be empty");
                return;
              }
              onUpdate(edited);
              onClose(null);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
