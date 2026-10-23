import { getAdminRequestHeaders } from './adminRequestHeaders';

describe('getAdminRequestHeaders', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('uses the existing admin JWT storage key', () => {
    const getItem = jest.fn().mockReturnValue('test-admin-token');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem },
    });
    expect(getAdminRequestHeaders()).toEqual({ Authorization: 'Bearer test-admin-token' });
    expect(getItem).toHaveBeenCalledWith('msscc_access_token');
  });

  it('fails before a private request can be sent without a token', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: jest.fn().mockReturnValue(null) },
    });
    expect(() => getAdminRequestHeaders()).toThrow('Please sign in to access admin records.');
  });
});