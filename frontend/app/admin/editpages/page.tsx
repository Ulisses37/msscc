'use client';

// React
import React, { useState } from 'react';

// uuid
import { v4 as uuidv4 } from 'uuid';

// Types
import { ContentBlock, BlockType } from '@/types/content';

// Components
import BilingualInput from '@/components/admin/BilingualInput';

/**
 * Admin page for allowing client to dynamically add/edit content on their website
 * Content is managed as a list of ContentBlocks
 */

export default function EditPagesPage() {
  // Block array
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  // ContentBlock creation
  const addBlock = (type: BlockType) =>{
    const newBlock: ContentBlock = {
      id: uuidv4(),
      type: type,
      contentEn: '',
      contentJa: '',
    };
    setBlocks([...blocks, newBlock]);
  };

  // Updating blocks
  const updateBlock = (updatedBlock: ContentBlock) => {
        setBlocks(blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));
    };

  // Deepl translate button handling
  const handleTranslate = async (id: string, textToTranslate: string) => {
    try {
        // Send the text to be converted as a package
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToTranslate }),
        });

        const data = await response.json();

        // Ensure that the newly translated text is placed in the correct content block
        if (data.translation) {
            setBlocks((prevBlocks) => // Search the array in its current state
                prevBlocks.map((block) =>
                    block.id === id ? { ...block, contentJa: data.translation } : block // Search based on block id
                )
            );
        }
    } catch (error) {
        console.error("Translation failed:", error);
    }
};

  return (
    <div className="p-10 max-w-content mx-auto font-body bg-msscc-white min-h-screen text-msscc-gray-dark">
        <h1 className="font-heading text-display mb-10 text-msscc-teal border-b border-msscc-gray-light pb-4">
            Edit Pages Page
        </h1>

        <div className="flex flex-col md:flex-row gap-10">
            {/* The 3 Buttons used to generate the textbox containers */}
            <div className="md:w-48 flex flex-col space-y-3">
                <h2 className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid">
                    Add Content
                </h2>
                <button
                    onClick={() => addBlock('header')}
                    className="bg-msscc-pink hover:bg-msscc-pink-dark text-white text-btn tracking-btn px-4 py-2 rounded-sm transition-colors text-left"
                >
                    + Header
                </button>
                <button
                    onClick={() => addBlock('paragraph')}
                    className="bg-msscc-pink hover:bg-msscc-pink-dark text-white text-btn tracking-btn px-4 py-2 rounded-sm transition-colors text-left"
                >
                    + Paragraph
                </button>
                <button
                    onClick={() => addBlock('caption')}
                    className="bg-msscc-pink hover:bg-msscc-pink-dark text-white text-btn tracking-btn px-4 py-2 rounded-sm transition-colors text-left"
                >
                    + Caption
                </button>
            </div>

            {/* Loop through blocks array to show each created block */}
            <div className="flex-1 space-y-6">
                {blocks.map((block) => (
                    <BilingualInput
                        key={block.id}
                        title={block.type}
                        labelEn="English Text"
                        labelJa="Japanese Text"
                        valueEn={block.contentEn}
                        valueJa={block.contentJa}
                        onUpdateEn={(val) => updateBlock({ ...block, contentEn: val })}
                        onUpdateJa={(val) => updateBlock({ ...block, contentJa: val })}
                        onTranslate={() => handleTranslate(block.id, block.contentEn)}
                    />
                ))}

                {blocks.length === 0 && (
                    <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body">
                        No blocks added yet. Use the sidebar buttons to start building your page.
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
