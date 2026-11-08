/* eslint-disable @typescript-eslint/no-require-imports */
// Keep this test in Jest's Node environment: no real browser, local site or
// Stripe provider is used while verifying the launcher's safety boundaries.
jest.mock('playwright', () => ({ webkit: { launch: jest.fn() } }));

const { parseOptions, startPath, run } = require('./paymentWebkit.cjs');

describe('WebKit manual payment launcher', () => {
  it.each([
    [['--flow', 'membership', '--locale', 'en'], '/en/membership'],
    [['--flow', 'membership', '--locale', 'ja'], '/ja/membership'],
    [['--flow', 'donation', '--locale', 'en'], '/en/support'],
    [['--flow', 'donation', '--locale', 'ja'], '/ja/support'],
  ])('allows only a fixed local payment start route', (args, path) => {
    expect(startPath(parseOptions(args))).toBe(path);
  });

  it.each([
    ['--flow', 'donation', '--locale', 'en', '--url', 'https://example.test'],
    ['--flow', '../payment-return', '--locale', 'en'],
    ['--flow', 'donation', '--locale', 'en?session_id=sensitive'],
    ['--smoke', '--flow', 'donation', '--locale', 'en'],
    ['--flow', 'donation', '--flow', 'donation', '--locale', 'en'],
    ['--flow', 'donation'],
  ])('rejects unexpected arguments before launching a browser: %j', (...args) => {
    expect(() => parseOptions(args)).toThrow();
  });

  it('smoke-checks only a blank page in a fresh nonpersistent context', async () => {
    const goto = jest.fn().mockResolvedValue(undefined);
    const newPage = jest.fn().mockResolvedValue({ goto });
    const newContext = jest.fn().mockResolvedValue({ newPage });
    const close = jest.fn().mockResolvedValue(undefined);
    const browser = { version: () => '27.2', newContext, isConnected: () => true, close };
    const launch = jest.fn().mockResolvedValue(browser);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await run(['--smoke'], { launch });
      expect(launch).toHaveBeenCalledWith({ headless: false });
      expect(newContext).toHaveBeenCalledWith();
      expect(goto).toHaveBeenCalledWith('about:blank');
      expect(close).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('Launch-only smoke check passed; no payment flow was tested.');
    } finally {
      log.mockRestore();
    }
  });

  it('opens only the fixed localhost start route and closes when its tab closes', async () => {
    const goto = jest.fn().mockResolvedValue(undefined);
    const page = { goto, once: jest.fn((event, callback) => {
      if (event === 'close') callback();
    }) };
    const close = jest.fn().mockResolvedValue(undefined);
    const browser = {
      version: () => '27.2',
      newContext: jest.fn().mockResolvedValue({ newPage: jest.fn().mockResolvedValue(page) }),
      once: jest.fn(),
      isConnected: () => true,
      close,
    };
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await run(['--flow', 'donation', '--locale', 'ja'], {
        launch: jest.fn().mockResolvedValue(browser),
      });
      expect(goto).toHaveBeenCalledWith('http://localhost:3000/ja/support', {
        waitUntil: 'domcontentloaded',
      });
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});