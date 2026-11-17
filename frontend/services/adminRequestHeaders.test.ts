import { getAdminRequestHeaders } from './adminRequestHeaders';
import { clearAccessToken, setAccessToken } from './accessTokenStore';

describe('getAdminRequestHeaders', () => {
  afterEach(() => {
    clearAccessToken();
  });

  it('uses the in-memory admin JWT', () => {
    setAccessToken('test-admin-token');

    expect(getAdminRequestHeaders()).toEqual({ Authorization: 'Bearer test-admin-token' });
  });

  it('fails before a private request can be sent without a token', () => {
    expect(() => getAdminRequestHeaders()).toThrow('Please sign in to access admin records.');
  });
});