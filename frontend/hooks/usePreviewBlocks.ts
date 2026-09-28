'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DbContentBlock } from '@/types/content';

type PreviewMessage = {
  type?: string;
  isPreview?: boolean;
  blocks?: DbContentBlock[];
};

export function usePreviewBlocks(
  setContentBlocks: Dispatch<SetStateAction<DbContentBlock[]>>,
) {
  const previewReceivedRef = useRef(false);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent<PreviewMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'MSSCC_PREVIEW_BLOCKS') return;
      if (event.data.isPreview !== true) return;
      if (!Array.isArray(event.data.blocks)) return;

      previewReceivedRef.current = true;
      setContentBlocks(event.data.blocks);
    };

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [setContentBlocks]);

  return previewReceivedRef;
}
