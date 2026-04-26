const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns true if the value is a syntactically valid email address. */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}
