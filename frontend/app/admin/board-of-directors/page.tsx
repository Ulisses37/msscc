'use client';

import React, { useEffect, useState } from "react";
import {DirectorCardPreview, OfficerCardPreview, MemberPopUp} from "./BoardOfDirectorCards";


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


export default function BoardOfDirectors() {
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);
  const [isOpen, setIsOpen] = useState<"director" | "officer" | null>(null);


    useEffect(() => {
      Promise.all([
        fetch("http://localhost:8000/api/board-members/").then(res => res.json()),
        fetch("http://localhost:8000/api/media/").then(res => res.json()),
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
    <div className="container w-[80%] mx-auto">
      <h1 className="text-4xl text-center font-bold mb-10">Board of Directors</h1>

      <div className="border border-gray-300 my-6 py-4">
        <h2 className="text-2xl font-serif pl-2">Officers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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


      <div className="border border-gray-300 my-8 py-4">
        <span className="flex justify-between items-center px-2 pb-2">
          <h2 className="text-2xl font-serif">Directors</h2>
          <button
            onClick={() => {
            setSelectedMember({
              boardMemberId: -1,
              boardMemberNameEn: "",
              boardMemberNameJa: "",
              boardMemberImageURL: null,
              boardMemberRoleEn: "Director",
              boardMemberRoleJa: "",
              boardMemberCaptionEn: "",
              boardMemberCaptionJa: "",
            });
            setIsOpen("director");
            }}
            className="w-8 h-8 mx-4 bg-green-500 text-white font-bold rounded hover:bg-green-600">
            +
          </button>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

    const mediaRes = await fetch("http://localhost:8000/api/media/upload/", {
      method: "POST",
      body: formData,
    });

    if (!mediaRes.ok) {
      alert("Image upload failed");
      return;
    }

    const mediaData = await mediaRes.json();
    mediaAssetId = mediaData.media_asset_id;
  }

  fetch(
    isNew
      ? `http://localhost:8000/api/board-members/create/`
      : `http://localhost:8000/api/board-members/${member.boardMemberId}/update/`,
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
  fetch(`http://localhost:8000/api/board-members/${member.boardMemberId}/delete/`, {
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
