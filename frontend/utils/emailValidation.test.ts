import { isValidEmail } from '@/utils/emailValidation'; // proves the @/ alias resolves in Jest

describe(isValidEmail, () => {
  it('returns true for valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last@domain.org')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false when the @ symbol is missing', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('returns false when the domain is missing', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('returns false when the TLD is missing', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('returns false when the value contains whitespace', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});
