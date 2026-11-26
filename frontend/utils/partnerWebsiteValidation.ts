export interface PartnerWebsiteValidation {
  normalizedWebsite: string | null;
  error: string | null;
}

const INVALID_WEBSITE_ERROR = 'Enter a valid website URL with a domain and top-level domain.';
const REQUIRED_WEBSITE_ERROR = 'Website is required for partners.';
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;
const EXPLICIT_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const DOMAIN_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;
const TOP_LEVEL_DOMAIN_PATTERN = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

function hasDomainAndTopLevelDomain(hostname: string): boolean {
  const labels = hostname.split('.');
  const topLevelDomain = labels.at(-1);

  return labels.length >= 2
    && labels.every((label) => DOMAIN_LABEL_PATTERN.test(label))
    && topLevelDomain !== undefined
    && TOP_LEVEL_DOMAIN_PATTERN.test(topLevelDomain);
}

/** Validate and normalize an optional website URL without performing a network lookup. */
export function validatePartnerWebsite(
  value: string | null | undefined,
  isRequired: boolean,
): PartnerWebsiteValidation {
  const trimmedValue = value?.trim() ?? '';

  if (!trimmedValue) {
    return {
      normalizedWebsite: null,
      error: isRequired ? REQUIRED_WEBSITE_ERROR : null,
    };
  }

  if (EXPLICIT_PROTOCOL_PATTERN.test(trimmedValue) && !HTTP_PROTOCOL_PATTERN.test(trimmedValue)) {
    return { normalizedWebsite: null, error: INVALID_WEBSITE_ERROR };
  }

  const normalizedWebsite = HTTP_PROTOCOL_PATTERN.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsedWebsite = new URL(normalizedWebsite);

    if (
      (parsedWebsite.protocol !== 'http:' && parsedWebsite.protocol !== 'https:')
      || !hasDomainAndTopLevelDomain(parsedWebsite.hostname)
    ) {
      return { normalizedWebsite: null, error: INVALID_WEBSITE_ERROR };
    }
  } catch {
    return { normalizedWebsite: null, error: INVALID_WEBSITE_ERROR };
  }

  return { normalizedWebsite, error: null };
}