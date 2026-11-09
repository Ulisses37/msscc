// WebKit on Windows manual payment-check launcher. Never automate Stripe input,
// record the browser session, or accept arbitrary URLs containing payment IDs.
const { webkit } = require('playwright');

const ROUTES = Object.freeze({ membership: 'membership', donation: 'support' });

function parseOptions(args) {
  if (args.includes('--help')) return { help: true };
  let flow;
  let locale;
  let smoke = false;
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (argument === '--smoke') {
      if (smoke) throw new Error('Duplicate --smoke flag.');
      smoke = true;
    } else if (argument === '--flow' || argument === '--locale') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error(`Missing value for ${argument}.`);
      }
      if (argument === '--flow') {
        if (flow) throw new Error('Duplicate --flow flag.');
        flow = args[++i];
      } else {
        if (locale) throw new Error('Duplicate --locale flag.');
        locale = args[++i];
      }
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (smoke && (flow || locale)) throw new Error('--smoke takes no flow or locale.');
  if (!smoke && (!Object.hasOwn(ROUTES, flow) || !['en', 'ja'].includes(locale))) {
    throw new Error('Choose --flow membership|donation and --locale en|ja.');
  }
  return { smoke, flow, locale };
}

function startPath({ flow, locale }) {
  if (!Object.hasOwn(ROUTES, flow) || !['en', 'ja'].includes(locale)) {
    throw new Error('Invalid payment start route.');
  }
  return `/${locale}/${ROUTES[flow]}`;
}

async function run(args, browserEngine = webkit) {
  const options = parseOptions(args);
  if (options.help) {
    console.log('Usage: node frontend/scripts/paymentWebkit.cjs --smoke');
    console.log('   or: node frontend/scripts/paymentWebkit.cjs --flow membership|donation --locale en|ja');
    return;
  }

  // A new nonpersistent context for every run avoids carrying prior payment
  // state across flows. Only the starting route is constructed here.
  const browser = await browserEngine.launch({ headless: false });
  try {
    console.log(`WebKit on Windows browser version: ${browser.version()}`);
    const context = await browser.newContext();
    const page = await context.newPage();
    if (options.smoke) {
      // about:blank proves the downloaded engine launches without touching an
      // application, provider, database, or hosted payment iframe.
      await page.goto('about:blank');
      console.log('Launch-only smoke check passed; no payment flow was tested.');
      return;
    }
    const path = startPath(options);
    // A local-only origin and fixed routes prevent sharing a sensitive session
    // reference via CLI arguments or console output.
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded' });
    console.log(`Opened ${path} on the local site. Check it visually before testing.`);
    console.log('Close the WebKit window when finished. No payments are automated.');
    // Closing the last tab need not terminate Playwright's browser process.
    // Accept either the tester closing that tab or the whole browser window.
    await Promise.race([
      new Promise((resolve) => page.once('close', resolve)),
      new Promise((resolve) => browser.once('disconnected', resolve)),
    ]);
  } finally {
    if (browser.isConnected()) await browser.close();
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch(() => {
    // Exceptions from navigation/Stripe can contain URLs or other sensitive
    // context. Print a fixed message, not the exception or a stack trace.
    console.error('WebKit could not launch or reach the local starting page. Check setup and retry.');
    process.exitCode = 1;
  });
}

module.exports = { parseOptions, startPath, run };