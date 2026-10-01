'use client';

// React
import React, { useCallback, useEffect, useRef, useState } from 'react';

// uuid
import { v4 as uuidv4 } from 'uuid';

// Types
import type {
  BlockType,
  ContentBlock,
  ImageAlignment,
  ImageWidth,
} from '@/types/content';

// Components
import BilingualInput from '@/components/admin/BilingualInput';
import ImageBlockInput from '@/components/admin/ImageBlockInput';

/**
 * Admin page for allowing client to dynamically add/edit content on their website
 * Content is managed as a list of ContentBlocks
 */


// Page type
type Page = {
  page_id: number;
  page_slug: string;
  page_title_en: string;
  page_title_ja: string;
}

type dbContentBlock = {
  content_id: number;
  content_type: BlockType;
  content_en: string;
  content_ja: string;
  media_asset: number | null;
  media_url: string | null;
  image_alignment: ImageAlignment;
  image_width: ImageWidth;
};

//Costants for Snippet preview
const snippetBlockRenderers: Record<BlockType, () => React.ReactNode> = {
  header: () => <div className="h-4 w-3/5 rounded-sm bg-[#D72638]" />,
  subheader: () => <div className="h-2 w-2/5 rounded-sm bg-[#D72638] opacity-70" />,
  paragraph: () => <div className="mx-3 h-8 w-4/5 rounded-sm bg-[#000000] text-center right-2" />,
  caption: () => <div className="h-2 w-1/4 p-0 m-0 rounded-sm bg-msscc-gray-mid" />,
  image: () => <div className="h-20 w-2/3 rounded-sm bg-msscc-teal-sky" />,
};

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
      // New image blocks begin with the same layout as existing content.
      ...(type === 'image'
        ? { imageAlignment: 'left' as const, imageWidth: 100 as const }
        : {}),
    };
    setBlocks([...blocks, newBlock]);
  };

  // Removing ContentBlock from array.
  const handleDeleteBlock = (id: string) => {
    const isConfirmed = window.confirm("Are you sure you want to remove this block? This cannot be undone.");

    // Use filter() to create a new array without the block chosen for deletion
    if (isConfirmed) {
      const contentId = Number(id);

      // Store the selected block's id so that it can be deleted from the database later
      if (!Number.isNaN(contentId)) {
        setDeletedBlockIds((prevIds) => [...prevIds, contentId]);
      }

      // Remove the block from the page UI
      setBlocks((prevBlocks) =>
        prevBlocks.filter((block) => block.id !== id)
      );
    }
  };

  // Move ContentBlocks up or down
  const moveBlock = (index: number, direction: 'up' | 'down') => {
  const newBlocks = [...blocks];

  // Change target block's index based on inputted direction
  const targetIndex =
    direction === 'up'
      ? index - 1
      : index + 1;

  // Prevent content blocks from being placed out of bounds
  if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

  // Perform the swapping of indexes
  [newBlocks[index], newBlocks[targetIndex]] = [
    newBlocks[targetIndex],
    newBlocks[index],
  ];

  setBlocks(newBlocks);
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

  // Page state and list
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [deletedBlockIds, setDeletedBlockIds] = useState<number[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  // Outgoing edits for Preview Render
  const sendPreviewBlocks = useCallback(() => {
    if (!previewFrameRef.current?.contentWindow || selectedPageId === null) return;

    const previewBlocks = blocks.map((block, index) => ({
      content_id: Number(block.id) || index,
      page_id: selectedPageId,
      display_order: index,
      content_type: block.type,
      content_en: block.contentEn,
      content_ja: block.contentJa,
      media_asset: block.mediaAssetId ?? null,
      media_url: block.mediaUrl ?? null,
      // Preview unsaved alignment changes before writing them to the database.
      image_alignment: block.imageAlignment ?? 'left',
      // Preview unsaved width changes before writing them to the database.
      image_width: block.imageWidth ?? 100,
    }));

    previewFrameRef.current.contentWindow.postMessage(
      { type: 'MSSCC_PREVIEW_BLOCKS', isPreview: true, blocks: previewBlocks },
      window.location.origin,
    );
  }, [blocks, selectedPageId]);

  useEffect(() => {
    if (isPreviewOpen) sendPreviewBlocks();
  }, [isPreviewOpen, sendPreviewBlocks]);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', closeWithEscape, true);
    return () => window.removeEventListener('keydown', closeWithEscape, true);
  }, [isPreviewOpen]);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/page/get-all/');
        const data = await response.json();
        setPages(data);
      } catch (error) {
        console.error("Failed to fetch pages:", error);
      }
    };
    fetchPages();
  }, []);

  useEffect(() => {
    if (selectedPageId === null) return;
    const fetchContent = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/content/page/${selectedPageId}/`);
        const data = await response.json();
        const loadedBlocks: ContentBlock[] = data.map((item: dbContentBlock) => ({
          id: item.content_id.toString(),
          type: item.content_type as BlockType,
          contentEn: item.content_en,
          contentJa: item.content_ja,
          mediaAssetId: item.media_asset,
          mediaUrl: item.media_url,
          // Support records created before the alignment field was available.
          imageAlignment: item.image_alignment ?? 'left',
          // Support records created before the width field was available.
          imageWidth: item.image_width ?? 100,
        }));
        setBlocks(loadedBlocks);
      } catch (error) {
        console.error("Failed to fetch content:", error);
      }
    };
    fetchContent();
  }, [selectedPageId]);

  //Renders Preview Render
  const handlePreviewLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    const previewDocument = event.currentTarget.contentDocument;

    if (!previewDocument) return;

    const preventInteraction = (interactionEvent: Event) => {
      if (
        interactionEvent.type === 'keydown' &&
        (interactionEvent as KeyboardEvent).key === 'Escape'
      ) {
        setIsPreviewOpen(false);
      }

      interactionEvent.preventDefault();
      interactionEvent.stopPropagation();
    };

    ['click', 'dblclick', 'submit','keydown'].forEach((eventName) => {
      previewDocument.addEventListener(eventName, preventInteraction, true);
    });

    sendPreviewBlocks();
    window.setTimeout(sendPreviewBlocks, 250);
  };

  const handleSave = async () => {
    // Prevent saving if no page is selected
    if (selectedPageId === null) return;

    // Show the saving process visually
    setIsSaving(true);
    setSaveMessage('');

    try {
      const updatedBlocks = [...blocks];

      for (let index = 0; index < updatedBlocks.length; index += 1) {
        // Convert each block's id into a number
        const block = updatedBlocks[index];
        const contentId = Number(block.id);
        let mediaAssetId = block.mediaAssetId ?? null;

        // Handle newly added images by POSTing them to the database
        if (block.type === 'image' && block.file) {
          const formData = new FormData();
          formData.append('image', block.file, block.file.name);

          const mediaResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
            {
              method: 'POST',
              body: formData,
            },
          );

        if (!mediaResponse.ok) {
          throw new Error(`Failed to upload image: ${mediaResponse.status}`);
        }
        // Retrieve the media record information after the POST is done
        const mediaData = await mediaResponse.json();
        mediaAssetId = mediaData.media_asset_id;
      }

        const requestData = {
          page_id: selectedPageId,
          display_order: index,
          content_type: block.type,
          content_en: block.contentEn,
          content_ja: block.contentJa,
          media_asset: mediaAssetId,
          // Persist image layout selections for both new and existing content blocks.
          image_alignment: block.imageAlignment ?? 'left',
          image_width: block.imageWidth ?? 100,
        };

        // Perform POST to backend
        if (Number.isNaN(contentId)) {
          const response = await fetch(
            'http://127.0.0.1:8000/api/content/create/',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData),
            },
          );

          if (!response.ok) {
            throw new Error(`Failed to create content: ${response.status}`);
          }

          const createdContent = await response.json();

          updatedBlocks[index] = {
            ...block,
            id: createdContent.content_id.toString(),
            mediaAssetId,
          };
        }

        // Perform PATCH to backend
        else {
          const response = await fetch(
            `http://127.0.0.1:8000/api/content/update/${contentId}/`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData),
            },
          );

          if (!response.ok) {
            throw new Error(`Failed to update content: ${response.status}`);
          }
        }
      }

      // Perform DELETE to backend
      for (const contentId of deletedBlockIds) {
        const response = await fetch(
          `http://127.0.0.1:8000/api/content/delete/${contentId}/`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to delete content: ${response.status}`);
        }
      }

      // Sync currently active block ids
      setBlocks(updatedBlocks);
      setDeletedBlockIds([]);
      setSaveMessage('Changes saved successfully.');
    }

    catch (error) {
      console.error('Failed to save page content:', error);
      setSaveMessage('Failed to save changes.');
    }

    // End saving process and proceed to show popup
    finally {
      setIsSaving(false);

      setTimeout(() => {
        setSaveMessage('');
      }, 5000);
    }
  };

  const handlePreviewInitialization = () => {
    if (selectedPageId === null) return;

    const selectedPage = pages.find(
      (page) => page.page_id === selectedPageId,
    );

    if (!selectedPage) return;

    const pagePath =
      selectedPage.page_slug === 'home'
        ? `/${selectedLanguage}`
        : `/${selectedLanguage}/${selectedPage.page_slug}`;

    setPreviewPath(`${pagePath}?preview=1`);
    setIsPreviewOpen(true);
  };

  return (
    <div className="p-10 max-w-content mx-auto font-body bg-msscc-white min-h-screen text-msscc-gray-dark">
        {/* Save Status Toast */}
        {saveMessage && (
          <div className="mb-6 rounded-md border border-msscc-gray-light bg-gray-100 px-5 py-3 text-center text-label font-semibold text-msscc-gray-dark shadow-md">
            {saveMessage}
          </div>
        )}
         {isPreviewOpen && previewPath && (
           <div
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
               onClick={() => setIsPreviewOpen(false)}
             role="dialog"
             aria-modal="true"
             aria-label="Page preview"
           >
             <div
               className="relative aspect-video max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl"
               onClick={(event) => event.stopPropagation()}
             >
               <button
                 type="button"
                 onClick={() => setIsPreviewOpen(false)}
                 className="absolute right-6 top-2 z-10 rounded-full bg-white px-2 text-msscc-gray-dark shadow hover:bg-gray-100 opacity-75"
                 aria-label="Close page preview"
               >
                 ×
               </button>
               <iframe
                  ref={previewFrameRef}
                 src={previewPath}
                 title="Selected page preview"
                  tabIndex={-1}
                  onLoad={handlePreviewLoad}
                  className="h-full w-full border-0"
               />
             </div>
           </div>
         )}
        <h1 className="font-heading text-display mb-10 text-msscc-teal border-b border-msscc-gray-light pb-4">
            Edit Pages Page
        </h1>

        <div className="flex flex-col md:flex-row gap-10">
            {/* The 3 Buttons used to generate the textbox containers */}
            <div className="md:w-48 flex flex-col space-y-3">
              {/* Save and Preview Buttons */}
              <div className="mb-0 flex flex-row items-end gap-1.5">
                <button
                  type="button"
                  onClick={handlePreviewInitialization}
                  disabled={selectedPageId === null}
                  className="whitespace-nowrap rounded-sm border border-msscc-teal px-2.5 py-2 text-msscc-teal text-btn transition-colors hover:bg-msscc-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Preview Page
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || selectedPageId === null}
                  className="rounded-sm bg-msscc-pink px-2 py-2 left-6 w-20 text-white text-btn transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>

              </div>
              <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-0">
                Switch Localization
              </label>
              <button type="button"
                className="whitespace-nowrap rounded-sm border border-msscc-pink px-2.5 py-2 text-msscc-white bg-msscc-pink text-btn transition-colors hover:bg-msscc-pink-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setSelectedLanguage(selectedLanguage === 'en' ? 'ja' : 'en')}
              >
                {selectedLanguage === 'en' ? 'EN' : '日本語'}
              </button>

                {/* Dropdown to select page to edit */}
                <div className="mb-8">
                  <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                    Select Page
                  </label>
                  <select
                  className="border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white w-48"
                  value={selectedPageId ?? ''}
                  onChange={(e) => {
                  setBlocks([]);
                  setDeletedBlockIds([]);
                  setSelectedPageId(Number(e.target.value));
                }}
                >
              <option value="" disabled>Select a page...</option>
              {pages.map((page) => (
                <option key={page.page_id} value={page.page_id}>
                  {page.page_title_en}
                  {/*selectedLanguage === 'en' ? page.page_title_en : page.page_title_ja*/}
                </option>
              ))}
              </select>
              </div>

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
                    onClick={() => addBlock('subheader')}
                    className="bg-msscc-pink hover:bg-msscc-pink-dark text-white text-btn tracking-btn px-4 py-2 rounded-sm transition-colors text-left"
                >
                    + Subheader
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
                <button
                  onClick={() => addBlock('image')}
                  className="bg-msscc-pink hover:bg-msscc-pink-dark text-white text-btn tracking-btn px-4 py-2 rounded-sm transition-colors text-left"
                >
                  + Image
                </button>

                {/* Snippet Preview */}
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Snippet Preview
                </label>
                <div className="mt-4 w-full overflow-visible rounded-md border border-msscc-gray-light bg-white shadow-sm">

                  <div className="border-b border-msscc-gray-light bg-msscc-teal px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white">
                    {selectedLanguage === 'en' ? "Navigation Bar" : "ナビゲーションバー"}
                  </div>
                  <div className="space-y-2.5 bg-msscc-gray-faint p-2">
                    {blocks.map((block) => (
                      <div key={block.id}>
                        {snippetBlockRenderers[block.type]()}
                      </div>
                    ))}
                    <hr className="h-0.5 border-0 bg-msscc-gray-dark"/>
                    <div className="flex items-center justify-center h-20 bg-msscc-teal-light text-white">
                      {selectedLanguage === 'en' ? "Page Contents" : "ページの内容"}
                    </div>
                  </div>
                  <div className="h-2 bg-msscc-teal-dark" />
                </div>


            </div>

            {/* Loop through blocks array to show each created block */}
            <div className="flex-1 space-y-6">
                {blocks.map((block, index) => (
                  <div key={block.id} className="space-y-2">
                    <div className="flex justify-end gap-2">
                      {/* Up and Down Control Buttons */}
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 'up')}
                        // Disable Up button if it is the first content block
                        disabled={index === 0}
                        className="rounded-sm border border-msscc-gray-light px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ↑ Move Up
                      </button>

                      <button
                        type="button"
                        onClick={() => moveBlock(index, 'down')}
                        // Disable Down button if it is the last content block
                        disabled={index === blocks.length - 1}
                        className="rounded-sm border border-msscc-gray-light px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ↓ Move Down
                      </button>
                    </div>
                    {block.type === 'image' ? (
                      <ImageBlockInput
                        contentEn={block.contentEn}
                        contentJa={block.contentJa}
                        imageUrl={block.mediaUrl ?? null}
                        imageAlignment={block.imageAlignment ?? 'left'}
                        imageWidth={block.imageWidth ?? 100}
                        onUpdateEn={(val) =>
                          updateBlock({ ...block, contentEn: val })
                        }
                        onUpdateJa={(val) =>
                          updateBlock({ ...block, contentJa: val })
                        }
                        onUpdateAlignment={(value) =>
                          updateBlock({ ...block, imageAlignment: value })
                        }
                        onUpdateWidth={(value) =>
                          updateBlock({ ...block, imageWidth: value })
                        }
                        onSelectFile={(file) => {
                          const previewUrl = URL.createObjectURL(file);

                          updateBlock({
                            ...block,
                            file,
                            mediaUrl: previewUrl,
                          });
                        }}
                        onDelete={() => handleDeleteBlock(block.id)}
                      />
                    ) : (
                      <BilingualInput
                        title={block.type}
                        labelEn="English Text"
                        labelJa="Japanese Text"
                        valueEn={block.contentEn}
                        valueJa={block.contentJa}
                        onUpdateEn={(val) =>
                          updateBlock({ ...block, contentEn: val })
                        }
                        onUpdateJa={(val) =>
                          updateBlock({ ...block, contentJa: val })
                        }
                        onTranslate={() => handleTranslate(block.id, block.contentEn)}
                        onDelete={() => handleDeleteBlock(block.id)}
                      />
                    )}
                  </div>
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
