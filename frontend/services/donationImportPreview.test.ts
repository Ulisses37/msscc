import { previewDonationCsv } from './donationImportPreview';

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