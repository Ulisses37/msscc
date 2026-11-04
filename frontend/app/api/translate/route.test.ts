/**
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand app/api/translate/route.test.ts
 *
 * The DeepL request is mocked. This test never sends text or credentials to the live service.
 */

import { POST } from './route';

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const TEST_API_KEY = 'non-production-test-key';
const originalApiKey = process.env.DEEPL_API_KEY;
const originalFetch = global.fetch;

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deepLResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function getDeepLRequest(): RequestInit {
  const fetchMock = jest.mocked(global.fetch);
  const call = fetchMock.mock.calls.find(([input]) => input === DEEPL_URL);
  if (!call) throw new Error('The mocked DeepL endpoint was not called');
  return call[1] ?? {};
}

describe('POST /api/translate', () => {
  beforeEach(() => {
    process.env.DEEPL_API_KEY = TEST_API_KEY;
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.DEEPL_API_KEY;
    } else {
      process.env.DEEPL_API_KEY = originalApiKey;
    }
  });

  it.each([
    ['missing text', {}],
    ['an empty string', { text: '' }],
    ['a whitespace-only string', { text: '   \n\t' }],
  ])('rejects %s before contacting DeepL', async (_description, requestBody) => {
    // Tests: invalid translation input validation before any external service work begins.
    // Expected output: status 400, a safe No text provided error, and zero DeepL fetch calls.
    const response = await POST(jsonRequest(requestBody));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ error: 'No text provided' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a safe error without calling DeepL when the API key is unavailable', async () => {
    // Tests: server configuration failure and secret-safe error handling.
    // Expected output: status 500, Translation is unavailable, no fetch, and no key in the body.
    delete process.env.DEEPL_API_KEY;

    const response = await POST(jsonRequest({ text: 'Hello' }));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Translation is unavailable' });
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends a sanitized HTML translation request with Japanese as the default target', async () => {
    // Tests: DeepL URL, method, authorization, form encoding, default JA target, tag handling,
    // sanitization before sending, and sanitization of the translated response.
    // Expected output: status 200; supported formatting remains, unsupported tags and attributes
    // are removed, and the response exposes only the sanitized translation property.
    jest.mocked(global.fetch).mockResolvedValue(
      deepLResponse({
        translations: [{ text: '<b>こんにちは</b><img src="bad" onerror="bad">' }],
      }),
    );

    const response = await POST(
      jsonRequest({
        text: '<strong>Hello</strong><span class="bad"> unsafe</span><a href="/"> link</a>',
      }),
    );

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      translation: '<strong>こんにちは</strong>',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(DEEPL_URL, expect.any(Object));

    const request = getDeepLRequest();
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({
      'Authorization': `DeepL-Auth-Key ${TEST_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(request.body).toBeInstanceOf(URLSearchParams);

    const form = request.body as URLSearchParams;
    expect(form.get('text')).toBe('<strong>Hello</strong> unsafe link');
    expect(form.get('target_lang')).toBe('JA');
    expect(form.get('tag_handling')).toBe('html');
  });

  it('passes a supplied string target language to DeepL unchanged', async () => {
    // Tests: callers can explicitly select a target language supported by DeepL.
    // Expected output: the exact supplied EN-US value appears in the target_lang form field.
    jest.mocked(global.fetch).mockResolvedValue(
      deepLResponse({ translations: [{ text: 'Hello' }] }),
    );

    const response = await POST(jsonRequest({ text: 'こんにちは', targetLang: 'EN-US' }));

    expect(response.status).toBe(200);
    const form = getDeepLRequest().body as URLSearchParams;
    expect(form.get('target_lang')).toBe('EN-US');
  });

  it('defaults a non-string target language to Japanese', async () => {
    // Tests: runtime validation when targetLang is supplied with an unsupported data type.
    // Expected output: the request still succeeds and sends JA instead of the invalid value.
    jest.mocked(global.fetch).mockResolvedValue(
      deepLResponse({ translations: [{ text: 'こんにちは' }] }),
    );

    const response = await POST(jsonRequest({ text: 'Hello', targetLang: 42 }));

    expect(response.status).toBe(200);
    const form = getDeepLRequest().body as URLSearchParams;
    expect(form.get('target_lang')).toBe('JA');
  });

  it('converts a non-OK DeepL response into a safe 502 response', async () => {
    // Tests: provider HTTP failures do not expose provider details or the configured API key.
    // Expected output: status 502 with only the safe Translation failed message.
    jest.mocked(global.fetch).mockResolvedValue(
      deepLResponse({ providerError: `private-${TEST_API_KEY}` }, false, 429),
    );

    const response = await POST(jsonRequest({ text: 'Hello' }));
    const body = await responseBody(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: 'Translation failed' });
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
  });

  it.each([
    ['missing translations', {}],
    ['an empty translations list', { translations: [] }],
    ['a non-string translated value', { translations: [{ text: 123 }] }],
  ])('rejects a successful DeepL response with %s', async (_description, providerBody) => {
    // Tests: provider responses that are HTTP-successful but do not contain translations[0].text.
    // Expected output: status 502 with the same safe Translation failed application response.
    jest.mocked(global.fetch).mockResolvedValue(deepLResponse(providerBody));

    const response = await POST(jsonRequest({ text: 'Hello' }));

    expect(response.status).toBe(502);
    expect(await responseBody(response)).toEqual({ error: 'Translation failed' });
  });

  it('returns a safe 500 response for a malformed JSON request body', async () => {
    // Tests: req.json throwing while the route parses malformed input.
    // Expected output: status 500 with Failed to translate and no DeepL request.
    const malformedRequest = new Request('http://localhost/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-valid-json',
    });

    const response = await POST(malformedRequest);

    expect(response.status).toBe(500);
    expect(await responseBody(response)).toEqual({ error: 'Failed to translate' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a safe 500 response when the DeepL request throws unexpectedly', async () => {
    // Tests: unexpected network/runtime failures from the mocked external service.
    // Expected output: status 500, no internal exception text, and no API key in the response.
    jest.mocked(global.fetch).mockRejectedValue(
      new Error(`private provider failure using ${TEST_API_KEY}`),
    );

    const response = await POST(jsonRequest({ text: 'Hello' }));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to translate' });
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
  });
});