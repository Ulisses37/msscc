/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';

import GalleryBackground from './GalleryBackground';

type TestImage = {
  media_asset_id: number;
  file_url: string;
  file_name: string;
  alt_text_en: string;
};

const galleryImages: TestImage[] = [
  {
    media_asset_id: 1,
    file_url: 'https://example.com/one.jpg',
    file_name: 'one.jpg',
    alt_text_en: 'First gallery image',
  },
  {
    media_asset_id: 2,
    file_url: 'https://example.com/two.jpg',
    file_name: 'two.jpg',
    alt_text_en: 'Second gallery image',
  },
];

const mockFetch = jest.fn();
let reduceMotion = false;

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    fill,
    priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    void fill;
    void priority;
    return <img alt={props.alt ?? ''} {...props} />;
  },
}));

function resolveGallery(images: TestImage[] = galleryImages) {
  return {
    ok: true,
    json: async () => images,
  } as Response;
}

describe('GalleryBackground', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion = false;
    mockFetch.mockReset().mockResolvedValue(resolveGallery());
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: mockFetch,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: reduceMotion,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    mockFetch.mockReset();
  });

  async function renderGallery(images: TestImage[] = galleryImages) {
    mockFetch.mockResolvedValue(resolveGallery(images));
    render(<GalleryBackground />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Expand gallery controls' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand gallery controls' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  }

  it('starts with the pill collapsed', async () => {
    mockFetch.mockResolvedValue(resolveGallery());
    render(<GalleryBackground />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand gallery controls' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('group', { name: 'Gallery controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View current gallery image' })).not.toBeInTheDocument();
  });

  it('cycles automatically after eight seconds', async () => {
    await renderGallery();

    act(() => jest.advanceTimersByTime(7999));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('restarts manual cycling with a ten-second grace period', async () => {
    await renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'Show next gallery image' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(9999));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('collapses and expands the pill without changing the active image', async () => {
    await renderGallery();

    const collapseButton = screen.getByRole('button', { name: 'Collapse gallery controls' });
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'View current gallery image' })).toBeInTheDocument();

    fireEvent.click(collapseButton);

    expect(screen.getByRole('button', { name: 'Expand gallery controls' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('group', { name: 'Gallery controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View current gallery image' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand gallery controls' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View current gallery image' })).toBeInTheDocument();
  });

  it('opens the active image in an accessible viewer and pauses cycling', async () => {
    await renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'View current gallery image' }));

    const dialog = screen.getByRole('dialog', { name: 'First gallery image' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close gallery image viewer' })).toHaveFocus();

    act(() => jest.advanceTimersByTime(20000));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('closes through the close button, Escape, and backdrop click', async () => {
    await renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'View current gallery image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close gallery image viewer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View current gallery image' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View current gallery image' }));
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus and starts a fresh eight-second timer after closing', async () => {
    await renderGallery();

    const previewButton = screen.getByRole('button', { name: 'View current gallery image' });
    fireEvent.click(previewButton);
    fireEvent.click(screen.getByRole('button', { name: 'Close gallery image viewer' }));

    expect(previewButton).toHaveFocus();
    act(() => jest.advanceTimersByTime(7999));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('keeps automatic cycling disabled when reduced motion is preferred', async () => {
    reduceMotion = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    });

    await renderGallery();
    act(() => jest.advanceTimersByTime(20000));

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('does not render when the gallery has no images', async () => {
    mockFetch.mockResolvedValue(resolveGallery([]));
    render(<GalleryBackground />);

    await act(async () => undefined);
    expect(screen.queryByRole('group', { name: 'Gallery controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
