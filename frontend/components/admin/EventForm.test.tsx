/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EventForm from '@/components/admin/EventForm';

const originalFetch = global.fetch;
const NOTICE_TEXT = '⚠ The English text was changed. Please review the Japanese text.';

jest.mock('@/components/admin/ImageBlockInput', () => ({
  __esModule: true,
  default: ({
    contentJa,
    onTranslate,
  }: {
    contentJa: string;
    onTranslate?: () => Promise<void>;
  }) => (
    <div>
      <span data-testid="photo-caption-ja">{contentJa}</span>
      {onTranslate && (
        <button type="button" onClick={() => void onTranslate()}>
          Translate image caption to Japanese
        </button>
      )}
    </div>
  ),
}));

describe('EventForm translation buttons', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('translates the selected event field and event-photo caption separately', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translation: '翻訳されたタイトル' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translation: '翻訳されたキャプション' }),
      } as Response);

    render(
      <EventForm
        initialData={{
          titleEn: 'Autumn Festival',
          titleJa: '',
          descriptionEn: 'Celebrate with us.',
          descriptionJa: '',
          locationEn: 'Community Center',
          locationJa: '',
          startDatetime: '2026-10-20T10:00',
          endDatetime: '2026-10-20T12:00',
          sendVolunteerReminders: false,
        }}
        initialEventPhotos={[
          {
            id: 12,
            eventId: 4,
            mediaAssetId: 8,
            mediaUrl: '/event-photo.jpg',
            captionEn: 'Festival guests',
            captionJa: '',
            displayOrder: 0,
            imageWidth: 100,
            imageAlignment: 'center',
          },
        ]}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Translate title to Japanese' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('イベントタイトル...')).toHaveValue(
        '翻訳されたタイトル',
      );
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Autumn Festival' }),
    });

    await user.click(
      screen.getByRole('button', { name: 'Translate image caption to Japanese' }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('photo-caption-ja')).toHaveTextContent(
        '翻訳されたキャプション',
      );
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Festival guests' }),
    });
    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
  });

  it('shows independent notices for manual English edits and redisplays after dismissal', async () => {
    const user = userEvent.setup();

    render(
      <EventForm
        initialData={{
          titleEn: 'Autumn Festival',
          titleJa: '秋祭り',
          descriptionEn: 'Celebrate with us.',
          descriptionJa: '一緒に祝いましょう。',
          locationEn: 'Community Center',
          locationJa: 'コミュニティセンター',
          startDatetime: '2026-10-20T10:00',
          endDatetime: '2026-10-20T12:00',
          sendVolunteerReminders: false,
        }}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('Event title...');
    const japaneseTitle = screen.getByPlaceholderText('イベントタイトル...');
    await user.type(titleInput, ' updated');

    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(1);

    await user.click(
      screen.getByRole('button', { name: 'Dismiss English text change notice' }),
    );
    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    expect(japaneseTitle).toHaveValue('秋祭り');

    await user.clear(titleInput);
    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(1);

    await user.type(screen.getByPlaceholderText('Event location...'), ' Annex');
    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(2);
  });
});