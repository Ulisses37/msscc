'use client';

import React, { useEffect, useState } from "react";
import {DirectorCardPreview, OfficerCardPreview, MemberPopUp} from "./BoardOfDirectorCards";


export interface BoardMember {
  boardMemberName: string;
  boardMemberImageURL: string | null;
  boardMemberRole: string | null;
  boardMemberCaption: string | null;
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
    }, []);

  return (
    <div className="container w-[80%] mx-auto">
      <h1 className="text-4xl text-center font-bold mb-10">Board of Directors</h1>

      <div className="border border-gray-300 my-6 py-4">
        <h2 className="text-2xl font-serif pl-2">Officers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {boardMembers
          .filter((member) => member.boardMemberRole !== "Director")
          .map((member) => (
            <OfficerCardPreview
              key={member.boardMemberName}
              boardMemberName={member.boardMemberName}
              boardMemberImageURL={member.boardMemberImageURL}
              boardMemberRole={member.boardMemberRole}
              boardMemberCaption={member.boardMemberCaption}
              onClick={() => {setIsOpen("officer"); setSelectedMember(member);}}
            />
          ))}
        </div>
      </div>


      <div className="border border-gray-300 my-8 py-4">
        <span className="text-center flex">
          <h2 className="text-2xl font-serif pl-2 pb-2">Directors</h2>
          <button onClick={(() => console.log("Add clicked"))}
          className="text-center w-8 h-8 mx-4 bg-green-500 text-white font-bold text-serif rounded hover:bg-green-600">
              +
          </button>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {boardMembers
          .filter((member) => member.boardMemberRole === "Director")
          .map((member) => (
            <DirectorCardPreview
              key={member.boardMemberName}
              boardMemberName={member.boardMemberName}
              boardMemberImageURL={member.boardMemberImageURL}
              onClick={() => {setIsOpen("director"); setSelectedMember(member);}}
            />
          ))}
        </div>
      </div>

      {isOpen === "officer" && <MemberPopUp
        member={selectedMember}
        type="officer"
        onUpdate={() => updateMember}
        onClose={setIsOpen}
        onDelete={() => deleteMember}
      />}

      {isOpen === "director" && <MemberPopUp
        member={selectedMember}
        type="director"
        onUpdate={() => updateMember}
        onClose={setIsOpen}
        onDelete={() => deleteMember}
      />}
    </div>
  )
}

function updateMember(member: BoardMember | null){
  console.log("updated " + member)
}

function deleteMember(member: BoardMember | null){
  console.log("deleted " + member)
}
