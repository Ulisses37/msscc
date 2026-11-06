import { confirmMembershipCsv, previewMembershipCsv } from './membershipImportPreview';

const originalFetch = global.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const file = new File(['test'], 'membership.csv', { type: 'text/csv' });
const preview = {
  record_type: 'membership', row_count: 1, proposed_records: [], errors: [], warnings: [],
};

describe('membership CSV preview request', () => {
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

  it('posts only the selected file with admin authorization and no JSON content type', async () => {
    await expect(previewMembershipCsv(file)).resolves.toEqual(preview);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/preview/`);
    expect(options).toMatchObject({
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, cache: 'no-store',
    });
    // Multipart encoding must retain the actual File, not serialize it as JSON.
    expect((options?.body as FormData).get('file')).toBe(file);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['unauthorized', 'network', 'invalid response', 'no token'])(
    'does not expose upload or server contents after %s', async (failure) => {
      if (failure === 'unauthorized') jest.mocked(fetch).mockResolvedValue({ ok: false });
      if (failure === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private'));
      if (failure === 'invalid response') jest.mocked(fetch).mockResolvedValue({
        ok: true, json: async () => ({ record_type: 'donation' }),
      });
      if (failure === 'no token') jest.mocked(localStorage.getItem).mockReturnValue(null);
      await expect(previewMembershipCsv(file)).rejects.toThrow('Check your finance access');
      // Never log the uploaded data or private response when preview fails.
      expect(console.error).toHaveBeenCalledWith('Unable to preview membership CSV.');
      if (failure === 'no token') expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('sends the original file and signed review, not browser-supplied proposals', async () => {
    const result = { record_type: 'membership', batch_id: 'batch-1', created_count: 1,
      membership_ids: [7], already_imported: false };
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result });
    await expect(confirmMembershipCsv(file, 'signed-review', true)).resolves.toEqual(result);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/confirm/`);
    expect(options).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer test-token' } });
    const body = options?.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('review_token')).toBe('signed-review');
    expect(body.get('acknowledge_warnings')).toBe('true');
    expect([...body.keys()]).toEqual(['file', 'review_token', 'acknowledge_warnings']);
  });

  it('keeps errors private and permits a retry after uncertain confirmation', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('private upload data'));
    await expect(confirmMembershipCsv(file, 'signed-review', false)).rejects.toThrow('uncertain');
    expect(console.error).not.toHaveBeenCalled();
  });
});
