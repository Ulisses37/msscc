/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';

import AboutPage from '@/app/[locale]/about/page';

type ContentState = 'loading' | 'fallback' | 'content';

let mockLocale = 'en';
let mockContentState: ContentState = 'content';
const mockFetchPageContent = jest.fn();
const mockFetch = jest.fn();

const mockContentBlocks = [
  {
    content_id: 1,
    page_id: 1,
    display_order: 0,
    content_type: 'header',
    content_en: 'CMS history content',
    content_ja: 'CMSの沿革',
    media_asset: null,
    media_url: null,
    image_alignment: 'left',
    image_width: 100,
  },
] as const;

const translations = {
  en: {
    boardOfDirectors: 'Board of Directors',
    officers: 'Officers',
    directors: 'Directors',
    loading: 'Loading...',
    error: 'Unable to load the board of directors.',
    noPhoto: 'No photo',
    portraitAlt: ({ name }: { name: string }) => `${name} portrait`,
  },
  ja: {
    boardOfDirectors: '理事会',
    officers: '役員',
    directors: '理事',
    loading: '読み込み中...',
    error: '理事会を読み込めませんでした。',
    noPhoto: '写真なし',
    portraitAlt: ({ name }: { name: string }) => `${name}の肖像`,
  },
} as const;

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function boardMembers() {
  return [
    {
      display_name_en: 'Alice Director',
      display_name_ja: 'アリス理事',
      display_order: 0,
      media_asset: null,
      role_en: 'Director',
      role_ja: '理事',
      caption_en: '',
      caption_ja: '',
    },
  ];
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: { name: string }) => {
    if (namespace !== 'AboutPage') return `${namespace}.${key}`;

    const value = translations[mockLocale as keyof typeof translations][
      key as keyof (typeof translations)['en']
    ];

    return typeof value === 'function' ? value(values ?? { name: '' }) : value;
  },
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ locale: mockLocale }),
}));

jest.mock('@/hooks/usePreviewBlocks', () => ({
  usePreviewBlocks: () => ({ current: false }),
}));

jest.mock('@/hooks/useDelayedFallback', () => ({
  useDelayedFallback: () => mockContentState,
}));

jest.mock('@/utils/content', () => ({
  getCachedPageContent: () => mockContentBlocks,
  fetchPageContent: (...args: unknown[]) => mockFetchPageContent(...args),
}));

jest.mock('@/components/content/ContentBlockRenderer', () => ({
  ContentBlockRenderer: ({ block }: { block: typeof mockContentBlocks[number] }) => (
    <div data-testid="cms-block">
      {mockLocale === 'ja' ? block.content_ja : block.content_en}
    </div>
  ),
}));

jest.mock('@/components/content/ContentFallBack', () => ({
  ContentStateTransition: ({
    state,
    children,
  }: {
    state: ContentState;
    children: React.ReactNode;
  }) => (
    <div data-testid={`cms-${state}`}>
      {state === 'loading' ? 'CMS loading' : state === 'fallback' ? 'CMS fallback' : children}
    </div>
  ),
}));

describe('AboutPage CMS and board sections', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockContentState = 'content';
    mockFetchPageContent.mockResolvedValue(mockContentBlocks);
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('keeps CMS content visible while board requests are unresolved', () => {
    mockFetch.mockImplementation(() => new Promise<Response>(() => undefined));

    render(<AboutPage />);

    expect(screen.getByTestId('cms-block')).toHaveTextContent('CMS history content');
    expect(screen.getByTestId('board-section')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  it('keeps the CMS fallback visible while board requests are unresolved', () => {
    mockContentState = 'fallback';
    mockFetch.mockImplementation(() => new Promise<Response>(() => undefined));

    render(<AboutPage />);

    expect(screen.getByTestId('cms-fallback')).toHaveTextContent('CMS fallback');
    expect(screen.getByTestId('board-section')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  it('keeps CMS content visible when board loading fails', async () => {
    mockFetch.mockResolvedValue(response({ detail: 'Unavailable' }, false, 503));

    render(<AboutPage />);

    expect(screen.getByTestId('cms-block')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to load the board of directors.',
      );
    });
    expect(screen.getByTestId('cms-block')).toBeInTheDocument();
  });

  it.each([
    ['en', 'Alice Director', 'Board of Directors'],
    ['ja', 'アリス理事', '理事会'],
  ] as const)('renders the board below CMS content for %s', async (locale, memberName, heading) => {
    mockLocale = locale;
    mockFetch
      .mockResolvedValueOnce(response(boardMembers()))
      .mockResolvedValueOnce(response([]));

    render(<AboutPage />);

    await waitFor(() => expect(screen.getByText(memberName)).toBeInTheDocument());

    const cmsBlock = screen.getByTestId('cms-block');
    const boardSection = screen.getByTestId('board-section');

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(cmsBlock.compareDocumentPosition(boardSection)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
