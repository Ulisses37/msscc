import {
  cancelVolunteerSignup,
  getVolunteerCancellationDetails,
} from '@/services/volunteerService';

describe('getVolunteerCancellationDetails', () => {
  const token = '4c551df5-ec8f-4cda-965a-3f48128c63df';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the public cancellation lookup endpoint', async () => {
    const cancellationDetails = {
      first_name: 'Aiko',
      last_name: 'Tanaka',
      event_title_en: 'Cultural Exchange',
      event_title_ja: '文化交流',
      slot_start_datetime: '2026-12-25T10:00:00Z',
      slot_end_datetime: '2026-12-25T12:00:00Z',
      role: 'Greeter',
    };
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(cancellationDetails),
    } as unknown as Response);

    await expect(getVolunteerCancellationDetails(token)).resolves.toEqual(cancellationDetails);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.example.test/api/events/signups/cancel/${token}/`,
    );
  });

  it('rejects an invalid or expired cancellation link', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);

    await expect(getVolunteerCancellationDetails(token)).rejects.toThrow(
      'Unable to load volunteer cancellation details.',
    );
  });

  it('sends a delete request to cancel the volunteer signup', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    await expect(cancelVolunteerSignup(token)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.example.test/api/events/signups/cancel/${token}/`,
      { method: 'DELETE' },
    );
  });

  it('rejects when the volunteer signup cannot be cancelled', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);

    await expect(cancelVolunteerSignup(token)).rejects.toThrow(
      'Unable to cancel volunteer signup.',
    );
  });
});