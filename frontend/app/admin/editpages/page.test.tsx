/**
 * @jest-environment jsdom
 */

/**
 * Page Editor workflow tests for SCRUM-847.
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand app/admin/editpages/page.test.tsx
 *
 * All page, content, media-upload, and translation requests are mocked. These tests never
 * contact the Django API, MinIO, Cloudflare R2, or DeepL.
 */

import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { requestDeepLTranslation } from '@/services/deeplService';

import EditPagesPage from './page';

jest.mock('@/services/deeplService', () => ({
  requestDeepLTranslation: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

import { v4 as uuidv4 } from 'uuid';

const API_URL = 'https://api.test';
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalFetch = global.fetch;

interface MockPage {
  page_id: number;
  page_slug: string;
  page_title_en: string;
  page_title_ja: string;
}

interface MockContentBlock {
  content_id: number;
  page_id: number;
  display_order: number;
  content_type: 'header' | 'subheader' | 'paragraph' | 'image';
  content_en: string;
  content_ja: string;
  media_asset: number | null;
  media_url: string | null;
  image_alignment: 'left' | 'center' | 'right';
  image_width: 25 | 50 | 75 | 100;
}

const PAGES: MockPage[] = [
  {
    page_id: 1,
    page_slug: 'home',
    page_title_en: 'Home',
    page_title_ja: 'ホーム',
  },
  {
    page_id: 2,
    page_slug: 'about',
    page_title_en: 'About',
    page_title_ja: '当団体について',
  },
];

const HOME_BLOCKS: MockContentBlock[] = [
  {
    content_id: 10,
    page_id: 1,
    display_order: 0,
    content_type: 'header',
    content_en: 'Welcome to MSSCC',
    content_ja: 'MSSCCへようこそ',
    media_asset: null,
    media_url: null,
    image_alignment: 'left',
    image_width: 100,
  },
  {
    content_id: 11,
    page_id: 1,
    display_order: 1,
    content_type: 'paragraph',
    content_en: 'English mission text',
    content_ja: '日本語のミッション本文',
    media_asset: null,
    media_url: null,
    image_alignment: 'left',
    image_width: 100,
  },
  {
    content_id: 12,
    page_id: 1,
    display_order: 2,
    content_type: 'image',
    content_en: 'Sister city delegation',
    content_ja: '姉妹都市代表団',
    media_asset: 52,
    media_url: '/media/delegation.jpg',
    image_alignment: 'right',
    image_width: 50,
  },
];

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function getRequestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input.toString();
}

function installDefaultFetchMock(
  contentByPage: Record<number, MockContentBlock[]> = { 1: HOME_BLOCKS, 2: [] },
): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);

    if (url === `${API_URL}/api/page/get-all/`) return jsonResponse(PAGES);

    const pageMatch = url.match(/\/api\/content\/page\/(\d+)\/$/);
    if (pageMatch) return jsonResponse(contentByPage[Number(pageMatch[1])] ?? []);

    const updateMatch = url.match(/\/api\/content\/update\/(\d+)\/$/);
    if (updateMatch && init?.method === 'PATCH') {
      return jsonResponse({ content_id: Number(updateMatch[1]) });
    }

    if (url === `${API_URL}/api/content/create/` && init?.method === 'POST') {
      return jsonResponse({ content_id: 90 }, true, 201);
    }

    if (url.match(/\/api\/content\/delete\/(\d+)\/$/) && init?.method === 'DELETE') {
      return jsonResponse(null, true, 204);
    }

    if (url === `${API_URL}/api/media/upload/` && init?.method === 'POST') {
      return jsonResponse({ media_asset_id: 73 }, true, 201);
    }

    throw new Error(`Unexpected fetch request: ${init?.method ?? 'GET'} ${url}`);
  }) as jest.MockedFunction<typeof fetch>;

  global.fetch = fetchMock;
  return fetchMock;
}

async function selectPage(pageName = 'Home'): Promise<void> {
  await screen.findByRole('option', { name: pageName });
  await userEvent.selectOptions(screen.getByRole('combobox'), pageName);
}

function getBlock(contentId: string): HTMLElement {
  const block = document.getElementById(`content-block-${contentId}`);
  if (!block) throw new Error(`Content block ${contentId} was not rendered`);
  return block;
}

function editRichText(block: HTMLElement, label: string, value: string): void {
  const editor = within(block).getByRole('textbox', { name: label });
  fireEvent.input(editor, { target: { innerHTML: value } });
}

function requestBody(fetchMock: jest.MockedFunction<typeof fetch>, url: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([input]) => getRequestUrl(input) === url,
  );

  if (!call) throw new Error(`No request was made to ${url}`);
  const body = call[1]?.body;
  if (typeof body !== 'string') throw new Error(`Request to ${url} did not contain JSON`);
  return JSON.parse(body) as unknown;
}

describe('Page Editor workflow', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
    jest.mocked(uuidv4)
      .mockReset()
      .mockReturnValueOnce('new-header')
      .mockReturnValueOnce('new-subheader')
      .mockReturnValueOnce('new-paragraph')
      .mockReturnValueOnce('new-image');
    jest.mocked(requestDeepLTranslation).mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:test-image-preview'),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(document, 'queryCommandState', {
      configurable: true,
      value: jest.fn(() => false),
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn(() => true),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('loads pages and displays the selected page content in the correct bilingual fields', async () => {
    // Tests: the initial page-list request, disabled Save state, page selection, content request,
    // existing text blocks, and an existing image block.
    // Expected output: Home and About are available, Save activates after selection, English and
    // Japanese values appear independently, and the saved image layout and preview are rendered.
    const fetchMock = installDefaultFetchMock();

    render(<EditPagesPage />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(await screen.findByRole('option', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'About' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/page/get-all/`);

    await selectPage();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/content/page/1/`);
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    expect(within(getBlock('10')).getByRole('textbox', { name: 'English Text' }))
      .toHaveTextContent('Welcome to MSSCC');
    expect(within(getBlock('10')).getByRole('textbox', { name: 'Japanese Text' }))
      .toHaveTextContent('MSSCCへようこそ');
    expect(within(getBlock('11')).getByRole('textbox', { name: 'English Text' }))
      .toHaveTextContent('English mission text');
    expect(within(getBlock('11')).getByRole('textbox', { name: 'Japanese Text' }))
      .toHaveTextContent('日本語のミッション本文');

    const imageBlock = getBlock('12');
    expect(within(imageBlock).getByAltText('Selected image preview')).toHaveAttribute(
      'src',
      '/media/delegation.jpg',
    );
    expect(within(imageBlock).getByRole('button', { name: 'right' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(imageBlock).getByRole('button', { name: '50%' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(imageBlock).getByRole('textbox', { name: 'English Caption' }))
      .toHaveTextContent('Sister city delegation');
    expect(within(imageBlock).getByRole('textbox', { name: 'Japanese Caption' }))
      .toHaveTextContent('姉妹都市代表団');
  });

  it('adds every supported block type with empty bilingual values', async () => {
    // Tests: addBlock for Header, Subheader, Paragraph, and Image.
    // Expected output: four client-side blocks are appended, each text field starts empty, and a
    // new image uses the default left alignment and 100 percent width.
    installDefaultFetchMock({ 1: [], 2: [] });
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();

    await user.click(screen.getByRole('button', { name: '+ Header' }));
    await user.click(screen.getByRole('button', { name: '+ Subheader' }));
    await user.click(screen.getByRole('button', { name: '+ Paragraph' }));
    await user.click(screen.getByRole('button', { name: '+ Image' }));

    for (const blockId of ['new-header', 'new-subheader', 'new-paragraph']) {
      const block = getBlock(blockId);
      expect(within(block).getByRole('textbox', { name: 'English Text' })).toBeEmptyDOMElement();
      expect(within(block).getByRole('textbox', { name: 'Japanese Text' })).toBeEmptyDOMElement();
    }

    const imageBlock = getBlock('new-image');
    expect(within(imageBlock).getByRole('textbox', { name: 'English Caption' }))
      .toBeEmptyDOMElement();
    expect(within(imageBlock).getByRole('textbox', { name: 'Japanese Caption' }))
      .toBeEmptyDOMElement();
    expect(within(imageBlock).getByRole('button', { name: 'left' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(imageBlock).getByRole('button', { name: '100%' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('moves blocks in both directions while keeping boundary controls disabled', async () => {
    // Tests: moveBlock, the first-block upward boundary, the last-block downward boundary, and
    // the rendered order after each state change.
    // Expected output: the first block cannot move up, the last cannot move down, and valid moves
    // swap the same block order later used for display_order during saving.
    installDefaultFetchMock();
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await screen.findByText('Welcome to MSSCC');

    expect(within(getBlock('10')).getByRole('button', { name: /Move Up/ })).toBeDisabled();
    expect(within(getBlock('12')).getByRole('button', { name: /Move Down/ })).toBeDisabled();

    await user.click(within(getBlock('11')).getByRole('button', { name: /Move Up/ }));
    expect(getBlock('11').compareDocumentPosition(getBlock('10')))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(within(getBlock('11')).getByRole('button', { name: /Move Down/ }));
    expect(getBlock('10').compareDocumentPosition(getBlock('11')))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('requires confirmation and deletes only confirmed persisted blocks when saved', async () => {
    // Tests: handleDeleteBlock cancellation and confirmation, retention of a persisted numeric ID,
    // and the deferred DELETE request made by handleSave.
    // Expected output: cancelling keeps the block and sends no DELETE; confirming removes it from
    // the editor, and Save sends DELETE /api/content/delete/11/ followed by a success message.
    const fetchMock = installDefaultFetchMock();
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await screen.findByText('English mission text');

    jest.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(within(getBlock('11')).getByTitle('Remove Block'));
    expect(getBlock('11')).toBeInTheDocument();

    jest.mocked(window.confirm).mockReturnValueOnce(true);
    await user.click(within(getBlock('11')).getByTitle('Remove Block'));
    expect(document.getElementById('content-block-11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Changes saved successfully.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/content/delete/11/`, {
      method: 'DELETE',
    });
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        getRequestUrl(input).includes('/api/content/delete/11/'),
      ),
    ).toHaveLength(1);
  });

  it('preserves bilingual edits and saves existing and new text blocks with current order', async () => {
    // Tests: independent English/Japanese editing, PATCH for persisted content, POST for new content,
    // payload fields, display_order, and replacement of a temporary UUID with the returned ID.
    // Expected output: edits remain in their paired fields, existing blocks use PATCH, the new block
    // uses POST with display_order 3, and a second Save updates returned content ID 90 with PATCH.
    const fetchMock = installDefaultFetchMock();
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await screen.findByText('Welcome to MSSCC');

    editRichText(getBlock('10'), 'English Text', 'Updated English heading');
    editRichText(getBlock('10'), 'Japanese Text', '更新された日本語見出し');
    expect(within(getBlock('10')).getByRole('textbox', { name: 'English Text' }))
      .toHaveTextContent('Updated English heading');
    expect(within(getBlock('10')).getByRole('textbox', { name: 'Japanese Text' }))
      .toHaveTextContent('更新された日本語見出し');

    await user.click(screen.getByRole('button', { name: '+ Paragraph' }));
    editRichText(getBlock('new-header'), 'English Text', 'New English paragraph');
    editRichText(getBlock('new-header'), 'Japanese Text', '新しい日本語段落');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Changes saved successfully.')).toBeInTheDocument();

    expect(requestBody(fetchMock, `${API_URL}/api/content/update/10/`)).toEqual({
      page_id: 1,
      display_order: 0,
      content_type: 'header',
      content_en: 'Updated English heading',
      content_ja: '更新された日本語見出し',
      media_asset: null,
      image_alignment: 'left',
      image_width: 100,
    });
    expect(requestBody(fetchMock, `${API_URL}/api/content/create/`)).toEqual({
      page_id: 1,
      display_order: 3,
      content_type: 'paragraph',
      content_en: 'New English paragraph',
      content_ja: '新しい日本語段落',
      media_asset: null,
      image_alignment: 'left',
      image_width: 100,
    });

    fetchMock.mockClear();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_URL}/api/content/update/90/`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('uploads and saves a new image block with preview, captions, alignment, and width', async () => {
    // Tests: new image creation, in-memory file selection, URL.createObjectURL preview, caption
    // editing and translation, alignment/width controls, media upload, and content creation.
    // Expected output: the selected file is previewed, translation updates only the Japanese caption,
    // media uploads before content creation, and the POST payload uses returned media asset ID 73.
    const fetchMock = installDefaultFetchMock({ 1: [], 2: [] });
    jest.mocked(requestDeepLTranslation).mockResolvedValue('翻訳された画像キャプション');
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await user.click(screen.getByRole('button', { name: '+ Image' }));

    const imageBlock = getBlock('new-header');
    const imageFile = new File(['fake-image-data'], 'delegation.png', {
      type: 'image/png',
    });
    const fileInput = imageBlock.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('The new image block did not render a file input');
    await user.upload(fileInput, imageFile);

    const createObjectUrlMock = URL.createObjectURL as jest.MockedFunction<
      typeof URL.createObjectURL
    >;
    expect(createObjectUrlMock.mock.calls).toHaveLength(1);
    expect(createObjectUrlMock.mock.calls[0][0]).toBe(imageFile);
    expect(within(imageBlock).getByAltText('Selected image preview')).toHaveAttribute(
      'src',
      'blob:test-image-preview',
    );

    editRichText(imageBlock, 'English Caption', 'Delegation visit');
    await user.click(within(imageBlock).getByRole('button', { name: 'right' }));
    await user.click(within(imageBlock).getByRole('button', { name: '75%' }));
    await user.click(
      within(imageBlock).getByRole('button', {
        name: 'Translate image caption to Japanese',
      }),
    );

    await waitFor(() => {
      expect(within(imageBlock).getByRole('textbox', { name: 'Japanese Caption' }))
        .toHaveTextContent('翻訳された画像キャプション');
    });
    expect(requestDeepLTranslation).toHaveBeenCalledWith('Delegation visit');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Changes saved successfully.')).toBeInTheDocument();

    const uploadCallIndex = fetchMock.mock.calls.findIndex(
      ([input]) => getRequestUrl(input) === `${API_URL}/api/media/upload/`,
    );
    const createCallIndex = fetchMock.mock.calls.findIndex(
      ([input]) => getRequestUrl(input) === `${API_URL}/api/content/create/`,
    );
    expect(uploadCallIndex).toBeGreaterThan(-1);
    expect(createCallIndex).toBeGreaterThan(uploadCallIndex);

    const uploadOptions = fetchMock.mock.calls[uploadCallIndex][1];
    expect(uploadOptions?.method).toBe('POST');
    expect(uploadOptions?.body).toBeInstanceOf(FormData);
    const uploadedImage = (uploadOptions?.body as FormData).get('image');
    expect(uploadedImage).toBeInstanceOf(File);
    expect((uploadedImage as File).name).toBe('delegation.png');
    expect((uploadedImage as File).type).toBe('image/png');
    expect(requestBody(fetchMock, `${API_URL}/api/content/create/`)).toEqual({
      page_id: 1,
      display_order: 0,
      content_type: 'image',
      content_en: 'Delegation visit',
      content_ja: '翻訳された画像キャプション',
      media_asset: 73,
      image_alignment: 'right',
      image_width: 75,
    });
  });

  it('updates an existing image block without uploading a replacement file', async () => {
    // Tests: editing and saving an image already associated with a backend media asset.
    // Expected output: captions and layout are PATCHed with media asset 52, and no media upload is
    // attempted because the administrator did not choose a replacement file.
    const fetchMock = installDefaultFetchMock();
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await screen.findByAltText('Selected image preview');

    const imageBlock = getBlock('12');
    editRichText(imageBlock, 'English Caption', 'Updated delegation caption');
    editRichText(imageBlock, 'Japanese Caption', '更新された代表団キャプション');
    await user.click(within(imageBlock).getByRole('button', { name: 'center' }));
    await user.click(within(imageBlock).getByRole('button', { name: '25%' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Changes saved successfully.')).toBeInTheDocument();
    expect(requestBody(fetchMock, `${API_URL}/api/content/update/12/`)).toEqual({
      page_id: 1,
      display_order: 2,
      content_type: 'image',
      content_en: 'Updated delegation caption',
      content_ja: '更新された代表団キャプション',
      media_asset: 52,
      image_alignment: 'center',
      image_width: 25,
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      `${API_URL}/api/media/upload/`,
      expect.anything(),
    );
  });

  it('shows the saving state and restores Save after a failed request', async () => {
    // Tests: the asynchronous saving state, failed-response handling, and finally cleanup.
    // Expected output: Save changes to Saving... and is disabled while pending; after a failed PATCH,
    // the editor shows Failed to save changes. and enables Save for another attempt.
    let resolvePatch: ((response: Response) => void) | undefined;
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    const fetchMock = installDefaultFetchMock();
    fetchMock.mockImplementation(async (input, init) => {
      const url = getRequestUrl(input);
      if (url === `${API_URL}/api/page/get-all/`) return jsonResponse(PAGES);
      if (url === `${API_URL}/api/content/page/1/`) return jsonResponse([HOME_BLOCKS[0]]);
      if (url === `${API_URL}/api/content/update/10/` && init?.method === 'PATCH') {
        return pendingPatch;
      }
      throw new Error(`Unexpected fetch request: ${init?.method ?? 'GET'} ${url}`);
    });
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();
    await screen.findByText('Welcome to MSSCC');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    resolvePatch?.(jsonResponse({ error: 'safe test failure' }, false, 500));

    expect(await screen.findByText('Failed to save changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('clears the previous blocks before a newly selected page finishes loading', async () => {
    // Tests: changing the selected page resets blocks immediately instead of showing stale content.
    // Expected output: Home content disappears and the empty-editor message is visible while the
    // delayed About request is pending; About content appears only after that request resolves.
    let resolveAbout: ((response: Response) => void) | undefined;
    const aboutResponse = new Promise<Response>((resolve) => {
      resolveAbout = resolve;
    });
    const aboutBlock: MockContentBlock = {
      ...HOME_BLOCKS[0],
      content_id: 20,
      page_id: 2,
      content_en: 'About MSSCC',
      content_ja: 'MSSCCについて',
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === `${API_URL}/api/page/get-all/`) return jsonResponse(PAGES);
      if (url === `${API_URL}/api/content/page/1/`) return jsonResponse([HOME_BLOCKS[0]]);
      if (url === `${API_URL}/api/content/page/2/`) return aboutResponse;
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EditPagesPage />);
    await selectPage();
    expect(await screen.findByText('Welcome to MSSCC')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'About');
    expect(screen.queryByText('Welcome to MSSCC')).not.toBeInTheDocument();
    expect(screen.getByText(/No blocks added yet/)).toBeInTheDocument();

    resolveAbout?.(jsonResponse([aboutBlock]));
    expect(await screen.findByText('About MSSCC')).toBeInTheDocument();
    expect(screen.getByText('MSSCCについて')).toBeInTheDocument();
  });

  it('opens a localized page preview and closes it without navigating the editor', async () => {
    // Tests: handlePreviewInitialization, localized preview paths, and preview dialog dismissal.
    // Expected output: Home previews at /en?preview=1, switching localization previews at
    // /ja?preview=1, and closing the dialog returns to the unchanged editor.
    installDefaultFetchMock({ 1: [], 2: [] });
    const user = userEvent.setup();

    render(<EditPagesPage />);
    await selectPage();

    await user.click(screen.getByRole('button', { name: 'Preview Page' }));
    expect(screen.getByTitle('Selected page preview')).toHaveAttribute('src', '/en?preview=1');
    await user.click(screen.getByRole('button', { name: 'Close page preview' }));
    expect(screen.queryByRole('dialog', { name: 'Page preview' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));
    await user.click(screen.getByRole('button', { name: 'Preview Page' }));
    expect(screen.getByTitle('Selected page preview')).toHaveAttribute('src', '/ja?preview=1');
  });
});