'use client';

import React, { useEffect, useState } from "react";
import {DirectorCardPreview, OfficerCardPreview, MemberPopUp} from "./BoardOfDirectorCards";
import { parseMediaUploadError } from '@/utils/mediaUploadError';


export interface BoardMember {
  boardMemberId: number;
  boardMemberNameEn: string;
  boardMemberNameJa: string;
  boardMemberImageURL: string | null;
  boardMemberRoleEn: string;
  boardMemberRoleJa: string;
  boardMemberCaptionEn: string;
  boardMemberCaptionJa: string;
}


function createBoardMemberDraft(type: 'officer' | 'director'): BoardMember {
  // A negative ID lets the shared save flow distinguish unsaved records from existing members.
  return {
    boardMemberId: -1,
    boardMemberNameEn: '',
    boardMemberNameJa: '',
    boardMemberImageURL: null,
    boardMemberRoleEn: type === 'director' ? 'Director' : '',
    boardMemberRoleJa: '',
    boardMemberCaptionEn: '',
    boardMemberCaptionJa: '',
  };
}


export default function BoardOfDirectors() {
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);
  const [isOpen, setIsOpen] = useState<"director" | "officer" | null>(null);


    useEffect(() => {
      Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/board-members/`).then(res => res.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`).then(res => res.json()),
      ])
        .then(([members, mediaAssets]: [unknown[], unknown[]]) => {
          console.log("raw members:", members);
          const mediaById = new Map(
            (mediaAssets as {media_asset_id: number; file_url: string | null}[])
              .map(m => [m.media_asset_id, m])
          );

          const enriched: BoardMember[] = (members as {
            board_member_id: number;
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
              boardMemberId: member.board_member_id,
              boardMemberNameEn: member.display_name_en,
              boardMemberNameJa: member.display_name_ja,
              boardMemberRoleEn: member.role_en,
              boardMemberRoleJa: member.role_ja,
              boardMemberCaptionEn: member.caption_en,
              boardMemberCaptionJa: member.caption_ja,
              boardMemberImageURL: member.media_asset
                ? mediaById.get(member.media_asset)?.file_url ?? null
                : null,
            }));

          setBoardMembers(enriched);
        })
    }, []);

  return (
   <div className="min-h-dvh bg-msscc-white px-2 py-4 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-2xl text-msscc-teal sm:text-display">Board of Directors</h1>
      </header>

      <div className="border border-gray-300 my-6 pb-3 bg-msscc-gray-faint">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="font-serif text-2xl">Officers</h2>
          <button
            type="button"
            aria-label="Add officer"
            onClick={() => {
              setSelectedMember(createBoardMemberDraft('officer'));
              setIsOpen('officer');
            }}
            className={
              'flex h-10 w-10 items-center justify-center rounded bg-green-400 font-bold ' +
              'text-white hover:bg-green-600 sm:h-8 sm:w-8'
            }
          >
            +
          </button>
        </div>
        {/* CSS Grid automatically creates additional rows as new officers are added. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-3">
          {boardMembers
          .filter((member) => member.boardMemberRoleEn !== "Director")
          .map((member) => (
            <OfficerCardPreview
              key={member.boardMemberId}
              boardMemberName={member.boardMemberNameEn}
              boardMemberImageURL={member.boardMemberImageURL}
              boardMemberRole={member.boardMemberRoleEn}
              boardMemberCaption={member.boardMemberCaptionEn}
              onClick={() => {setIsOpen("officer"); setSelectedMember(member);}}
            />
          ))}
        </div>
      </div>


      <div className="border border-gray-300 py-2 pb-3 bg-msscc-gray-faint">
        <div className="flex justify-between items-center px-3 pb-2">
          <h2 className="text-2xl font-serif">Directors</h2>
          <button
            type="button"
            aria-label="Add director"
            onClick={() => {
              setSelectedMember(createBoardMemberDraft('director'));
              setIsOpen('director');
            }}
            className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center bg-green-400 text-white font-bold rounded hover:bg-green-600">
            +
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-3">
          {boardMembers
          .filter((member) => member.boardMemberRoleEn === "Director")
          .map((member) => (
            <DirectorCardPreview
              key={member.boardMemberId}
              boardMemberName={member.boardMemberNameEn}
              boardMemberImageURL={member.boardMemberImageURL}
              onClick={() => {setIsOpen("director"); setSelectedMember(member);}}
            />
          ))}
        </div>
      </div>

      {isOpen === "officer" && <MemberPopUp
        member={selectedMember}
        type="officer"
        onUpdate={async (m, file) => await updateMember(m, file)}
        onClose={setIsOpen}
        onDelete={(m) => deleteMember(m)}
      />}

      {isOpen === "director" && <MemberPopUp
        member={selectedMember}
        type="director"
        onUpdate={async (m, file) => await updateMember(m, file)}
        onClose={setIsOpen}
        onDelete={(m) => deleteMember(m)}
      />}
    </div>
  )
}

async function updateMember(member: BoardMember | null, file?: File | null) {
  if (!member) return;
  const isNew = member.boardMemberId === -1;

  let mediaAssetId: number | null = null;

  if (file) {
    const formData = new FormData();
    formData.append("image", file, file.name);  // use original filename

    const mediaRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`, {
      method: "POST",
      body: formData,
    });

    if (!mediaRes.ok) {
      const errorBody: unknown = await mediaRes.json().catch(() => null);
      const uploadError = parseMediaUploadError(
        errorBody,
        `Image upload failed: ${mediaRes.status}`,
      );
      alert(uploadError.message);
      return;
    }

    const mediaData = await mediaRes.json();
    mediaAssetId = mediaData.media_asset_id;
  }

  fetch(
    isNew
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/board-members/create/`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/board-members/${member.boardMemberId}/update/`,
    {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name_en: member.boardMemberNameEn,
        display_name_ja: member.boardMemberNameJa,
        role_en: member.boardMemberRoleEn,
        role_ja: member.boardMemberRoleJa,
        caption_en: member.boardMemberCaptionEn,
        caption_ja: member.boardMemberCaptionJa,
        display_order: 0,
        start_date: new Date().toISOString().split("T")[0],
        ...(mediaAssetId !== null && { media_asset: mediaAssetId }),
      }),
    }
  )
  .then(res => {
    if (!res.ok) return res.json().then(err => { alert(`Failed to save: ${JSON.stringify(err)}`); });
    window.location.reload();
  })
  .catch(err => {
    alert("Network error, please try again.");
    console.error(err);
  });
}

function deleteMember(member: BoardMember | null) {
  if (!member) return;
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/board-members/${member.boardMemberId}/delete/`, {
    method: "DELETE",
  })
  .then(res => {
    if (!res.ok) return res.json().then(err => { alert(`Failed to delete: ${JSON.stringify(err)}`); });
    window.location.reload();
  })
  .catch(err => {
    alert("Network error, please try again.");
    console.error(err);
  });
}
