import { downloadMembershipImportTemplate } from './membershipImportTemplate';

const originalFetch = global.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalUrl = Object.getOwnPropertyDescriptor(globalThis, 'URL');

describe('authorized membership CSV template download', () => {
  const click = jest.fn();
  const remove = jest.fn();
  const appendChild = jest.fn();
  const createObjectURL = jest.fn().mockReturnValue('blob:membership-template');
  const revokeObjectURL = jest.fn();
  const link = { href: '', download: '', click, remove };
  const csv = new Blob(['first_name,last_name\r\n']);

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, value: { getItem: jest.fn().mockReturnValue('test-admin-token') },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true, value: { createElement: jest.fn().mockReturnValue(link), body: { appendChild } },
    });
    Object.defineProperty(globalThis, 'URL', {
      configurable: true, value: { createObjectURL, revokeObjectURL },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => csv });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [name, descriptor] of [
      ['localStorage', originalStorage], ['document', originalDocument], ['URL', originalUrl],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    jest.restoreAllMocks();
  });

  it('downloads only the authenticated membership template and revokes the URL', async () => {
    await downloadMembershipImportTemplate();
    expect(fetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/template/`,
      { headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store' },
    );
    expect(createObjectURL).toHaveBeenCalledWith(csv);
    expect(link.download).toBe('membership-import-template.csv');
    expect(link.href).toBe('blob:membership-template');
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:membership-template');
  });

  it.each(['missing token', 'denied', 'network'])('does not download on %s', async (failure) => {
    if (failure === 'missing token') jest.mocked(localStorage.getItem).mockReturnValue(null);
    if (failure === 'denied') jest.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    if (failure === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private'));
    await expect(downloadMembershipImportTemplate()).rejects.toThrow('Check your finance access');
    if (failure === 'missing token') expect(fetch).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Unable to download the membership import template.',
    );
  });
});
