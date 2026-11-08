/**
 * @jest-environment node
 */
import { verifySession } from './verifySession';

jest.mock('@/services/authService', () => ({
  decodeTokenPayload: jest.fn(() => ({
    userId: '2',
    email: 'dev@test.com',
    isExecutive: true,
    permissionData: {},
  })),
}));

const originalFetch = globalThis.fetch;

function mockToken(value: string | null) {
  const getItem = jest.fn().mockReturnValue(value);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem },
  });
  return getItem;
}

describe('verifySession', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('reads the existing admin JWT storage key', async () => {
    const getItem = mockToken(null);
    await verifySession();
    expect(getItem).toHaveBeenCalledWith('msscc_access_token');
  });

  it('returns missing when there is no token', async () => {
    mockToken(null);
    expect(await verifySession()).toEqual({ ok: false, reason: 'missing' });
  });

  it('returns the decoded user when the server answers 200', async () => {
    mockToken('a.b.c');
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await verifySession();
    expect(result).toMatchObject({ ok: true, user: { userId: '2' } });
  });

  it('returns invalid when the server answers 401', async () => {
    mockToken('a.b.c');
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(await verifySession()).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([404, 500])('treats a %i as network, not invalid', async (status) => {
    mockToken('a.b.c');
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    expect(await verifySession()).toEqual({ ok: false, reason: 'network' });
  });

  it('returns network when fetch throws', async () => {
    mockToken('a.b.c');
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await verifySession()).toEqual({ ok: false, reason: 'network' });
  });
});
