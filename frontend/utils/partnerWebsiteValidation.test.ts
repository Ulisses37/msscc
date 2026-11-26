import { validatePartnerWebsite } from './partnerWebsiteValidation';

describe('partner website validation', () => {
  it.each([
    ['msscc.org', 'https://msscc.org'],
    [' www.msscc.org ', 'https://www.msscc.org'],
    ['https://msscc.org/about', 'https://msscc.org/about'],
    ['http://msscc.co.uk', 'http://msscc.co.uk'],
  ])('normalizes valid website %s', (value, normalizedWebsite) => {
    expect(validatePartnerWebsite(value, true)).toEqual({ normalizedWebsite, error: null });
  });

  it('allows an omitted optional website and requires a partner website', () => {
    expect(validatePartnerWebsite('   ', false)).toEqual({ normalizedWebsite: null, error: null });
    expect(validatePartnerWebsite('', true)).toEqual({
      normalizedWebsite: null,
      error: 'Website is required for partners.',
    });
  });

  it.each([
    'www',
    'www.',
    'msscc',
    'localhost',
    '127.0.0.1',
    'ftp://msscc.org',
    'https://msscc',
    'https://-msscc.org',
  ])('rejects incomplete or unsupported website %s', (value) => {
    const result = validatePartnerWebsite(value, false);

    expect(result.normalizedWebsite).toBeNull();
    expect(result.error).toBe('Enter a valid website URL with a domain and top-level domain.');
  });
});