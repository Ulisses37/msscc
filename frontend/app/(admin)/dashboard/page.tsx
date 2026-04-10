'use client';

import React,{ useState } from "react";
import { ImportImage } from "@/components/ui/ImportImage";

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return(
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center">
      <h1>Administrative Dashboard</h1>
      <section>
        <h2>
          Import Images
        </h2>
        <span>
          This is where you can import images for the website.
          <ImportImage onChange={(file) => setSelectedFile(file)} label="Upload an image" />
        </span>
      </section>
    </main>
  )
}
