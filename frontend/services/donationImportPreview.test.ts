import { confirmDonationCsv, DonationCsvReviewRejected, previewDonationCsv } from './donationImportPreview';

const originalFetch = global.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const file = new File(['fictional donation'], 'donations.csv', { type: 'text/csv' });
const preview = {
  record_type: 'donation', row_count: 1, proposed_records: [], errors: [], warnings: [],
};

describe('donation CSV read-only preview request', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, value: { getItem: jest.fn().mockReturnValue('test-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => preview });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    jest.restoreAllMocks();
  });

  it('sends only the selected file with admin authorization, not browser proposals', async () => {
    await expect(previewDonationCsv(file)).resolves.toEqual(preview);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/import/preview/`);
    expect(options).toMatchObject({
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, cache: 'no-store',
    });
    expect([...((options?.body as FormData).keys())]).toEqual(['file']);
    expect((options?.body as FormData).get('file')).toBe(file);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['unauthorized', 'network', 'wrong record type', 'missing warnings', 'no token'])(
    'keeps upload and response details private after %s', async (failure) => {
      if (failure === 'unauthorized') jest.mocked(fetch).mockResolvedValue({ ok: false });
      if (failure === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private'));
      if (failure === 'wrong record type') jest.mocked(fetch).mockResolvedValue({
        ok: true, json: async () => ({ ...preview, record_type: 'membership' }),
      });
      if (failure === 'missing warnings') jest.mocked(fetch).mockResolvedValue({
        ok: true, json: async () => ({ record_type: 'donation', errors: [], proposed_records: [] }),
      });
      if (failure === 'no token') jest.mocked(localStorage.getItem).mockReturnValue(null);
      await expect(previewDonationCsv(file)).rejects.toThrow('Check your finance access');
      expect(console.error).toHaveBeenCalledWith('Unable to preview donation CSV.');
      if (failure === 'no token') expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('donation CSV signed confirmation request', () => {
  const receipt = {
    record_type: 'donation', batch_id: 'test-batch', created_count: 2,
    donation_ids: [7, 8], already_imported: false,
  };
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, value: { getItem: jest.fn().mockReturnValue('test-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => receipt });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    jest.restoreAllMocks();
  });

  it('sends only original file, server review token and explicit acknowledgment', async () => {
    await expect(confirmDonationCsv(file, 'signed-review', true)).resolves.toEqual(receipt);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/import/confirm/`);
    expect(options).toMatchObject({
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, cache: 'no-store',
    });
    const body = options?.body as FormData;
    expect([...body.keys()]).toEqual(['file', 'review_token', 'acknowledge_warnings']);
    expect(body.get('file')).toBe(file);
    expect(body.get('review_token')).toBe('signed-review');
    expect(body.get('acknowledge_warnings')).toBe('true');
  });

  it.each([400, 409, 401, 403])('treats a definite %s rejection as a fresh review', async (status) => {
    jest.mocked(fetch).mockResolvedValue({ ok: false, status });
    await expect(confirmDonationCsv(file, 'signed-review', false)).rejects.toMatchObject({
      reason: status === 401 || status === 403 ? 'access' : 'review',
    });
  });

  it('does not send a request without an admin token', async () => {
    jest.mocked(localStorage.getItem).mockReturnValue(null);
    await expect(confirmDonationCsv(file, 'signed-review', false))
      .rejects.toBeInstanceOf(DonationCsvReviewRejected);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['network', 'server error', 'invalid receipt'])(
    'never claims a safe fresh import after %s', async (failure) => {
      if (failure === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private'));
      if (failure === 'server error') jest.mocked(fetch).mockResolvedValue({ ok: false, status: 503 });
      if (failure === 'invalid receipt') jest.mocked(fetch).mockResolvedValue({
        ok: true, status: 201, json: async () => ({ record_type: 'donation' }),
      });
      await expect(confirmDonationCsv(file, 'signed-review', false)).rejects.toThrow('uncertain');
    },
  );
});