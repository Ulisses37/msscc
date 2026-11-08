# Payment browser test matrix

This is a **manual, test-mode** runbook and an observation log for the existing
membership Payment Element and donation embedded Checkout journeys. Use it from
the repository root on Windows. A green mocked Jest test or a Stripe redirect is
not evidence that a payment completed in a particular browser.

## 1. Safety gate: complete before any browser payment attempt

1. Use an explicitly **non-production** frontend, backend, database and Stripe
   account. Check the frontend publishable key begins with `pk_test_` and the
   backend key begins with `sk_test_` **privately**; do not paste either value or
   a command that prints it into this file, a terminal transcript, a screenshot
   or a PR. Check that the webhook signing configuration matches the test-mode
   webhook route. Stop if any key/object is live, the target is production, or
   the environment cannot be verified. Do not create a session to "find out."
2. Confirm with the team before writing to shared development PostgreSQL,
   Stripe test account, email provider, or any other shared service. Prefer an
   approved isolated local database. Tests run with the repository's isolated
   `backend/config/settings/test.py`, in-memory SQLite, mocked Stripe and dummy
   email backend. **Do not** use `manage.py test` against development settings.
3. Use only synthetic identities (example: `Browser Test`, an approved test
   inbox). Do not put synthetic emails/addresses, card details, credentials,
   client secrets, full return URLs, session/reference IDs, or raw Stripe error
   payloads in committed evidence, screenshots, browser console captures or
   application logs. Avoid mailing-list consent and email side effects. Use
   Stripe's current **test-mode** payment method instructions privately; do not
   copy card numbers into the repository. Record the scenario label only.
4. Check that test webhook delivery works and the backend status changes after
   a test payment. If not, mark the **confirmation** scenario blocked rather
   than calling a redirect successful. Never start another attempt to resolve
   an unknown status: revisit the original result or verify its status first.
   In particular, if the donation status lookup shows "result unavailable" and
   offers "Start new donation attempt," do **not** use that button while the
   original payment outcome is unknown. Record the observed message and block
   further payment attempts until the first attempt is authoritatively checked.

### Repository setup, Windows PowerShell

Start in the root of your msscc clone. All repository commands below assume
that directory; do not copy another developer's local filesystem path.
Use [PROCEDURE.md](PROCEDURE.md) and the
[developer setup guide](../MSSCC_Dev_Setup_Guide.md) for initial Python, Node,
PostgreSQL and dependency setup. Check out the reviewed commit; record its hash
with `git rev-parse --short HEAD` and record `node --version`, `npm --version`,
Windows build (Windows Settings > System > About), and the actual Python version
(`backend\venv\Scripts\python.exe --version`). The repository requests Node
22.14.0 in `frontend/.nvmrc`; record a mismatch rather than silently ignoring
it. For a fresh install after the prerequisites, use `npm --prefix frontend ci`
and the dependency commands in PROCEDURE.md. Do not copy or publish `.env` files.

In separate terminals, run the backend development server from `backend/`
using the approved non-production settings and `venv\Scripts\python.exe
manage.py runserver`; run `npm run dev` from `frontend/`. Open
`http://localhost:3000/en/membership` and `http://localhost:3000/en/support`
before creating a payment session. For browsers on the same PC, `localhost` is
reachable without a VM. Check privately that `NEXT_PUBLIC_API_URL` points to
the reachable backend (normally `http://localhost:8000`), that Django
`DJANGO_ALLOWED_HOSTS` permits it, and `CORS_ALLOWED_ORIGINS` permits the
frontend origin. Check `FRONTEND_URL` resolves to the same frontend: donation
Checkout constructs its return URL on the server from this value. Restart
servers after changing configuration. Do not commit environment files.

If an approved test-mode webhook forwarder is used, configure its destination
as the local `/api/payments/webhook/` endpoint and configure the corresponding
signing secret **privately**. Confirm delivery without storing event payloads
in evidence. If permissions, tooling or webhook delivery are unavailable,
record the affected scenario as `blocked` and why. Do not run a simulated
webhook against a shared database to manufacture a result.

### Browser preparation and environment record

Install the vendor's **Stable/Release Windows desktop** browser, not a beta,
developer channel, Playwright-patched browser, or another Chromium brand:

* Chrome Stable: open [Google's Chrome download](https://www.google.com/chrome/)
  on `google.com`. Select the Windows installer, follow its prompts and open
  Chrome. Use the three-dot menu > Help > About Google Chrome to complete any
  offered update; relaunch and record the **full version** shown there.
* Firefox Release: open [Mozilla's Windows Firefox download](https://www.mozilla.org/firefox/windows/)
  on `mozilla.org`. Select the regular Firefox desktop installer, not
  Developer Edition or ESR; open Firefox. Use menu > Help > About Firefox to
  complete updates; relaunch and record the **full version** shown there.
* Edge Stable: use the Windows-installed Stable Edge or open
  [Microsoft's Edge download](https://www.microsoft.com/edge/download) on
  `microsoft.com`. Select the Windows Stable installer, follow its prompts and
  open Edge. Use the three-dot menu > Help and feedback > About Microsoft Edge
  to complete updates; relaunch and record the **full version** shown there.

Do not install an old browser build to make a screenshot match these results.
After installing/updating, close and relaunch each browser. From the repo root,
the following optional **read-only** preflight reports Windows build and
versions of executables in usual install locations without reading settings,
profiles, keys, or payment data:

```powershell
& .\scripts\payment_browser_versions.ps1
```

If PowerShell blocks execution, use the About pages manually rather than
changing machine execution policy. Multiple candidates, `not found`, or a
candidate version different from the running browser are **not** a test
failure; the in-browser About page is authoritative for the version actually
tested. Record the exact Windows build and architecture via Windows Settings
> System > About, plus browser channel and full version, immediately before
each flow/locale run. If a browser updates midway, **stop and start a new
version-labeled run** rather than combining before/after rows. A future reviewer
may install the then-current Stable/Release version with these steps and
compare results against the recorded build; an exact-version reproduction is
not guaranteed or required by this story.

Open a new clean browser profile or clear only this test site's cookies, local
storage and cache before **each flow/locale run**. Disable extensions that
interfere with checkout; record exceptions. Use a fresh synthetic identity and
the same pre-agreed test amount/option per comparable run. Never reuse a paid
session. Record versions and locale in the tables below, not just in a summary.

### WebKit on Windows: first-time installation and manual launch

This project pins the **Playwright library `1.65.0`** as a frontend development
dependency; it expects **WebKit `27.2`, Playwright revision `2388`** on Windows.
The library supplies a headed, temporary WebKit window, not a full automated
payment-test framework. Its WebKit build is **not branded Safari**. Do not use
`npm init playwright` (which generates a separate test project), install an
unversioned `@latest`, or download an old browser from a third-party site.

1. On a Windows 11+ PC, install the repository's requested Node `22.14.0`
   (see `frontend/.nvmrc` and the developer setup guide), then open **Windows
   PowerShell** and change directory to the root of your clone. Check the
   version with `node --version` and `npm --version`. Record any mismatch and
   verify that npm can access its package registry. The npm lockfile specifies
   the exact dependency versions; the binary is downloaded separately.
2. From the **repository root**, enter each command below separately. `npm ci`
   installs frontend dependencies from the committed lockfile. The second
   command downloads **only WebKit and its required support binaries** to
   Playwright's per-user browser cache; it does not install Chromium, Firefox,
   Safari, or a system-wide browser. A successful install prints `WebKit 27.2
   (playwright webkit v2388) downloaded` (or exits successfully if cached).

   ```powershell
   npm --prefix frontend ci
   & .\frontend\node_modules\.bin\playwright.cmd install webkit
   & .\frontend\node_modules\.bin\playwright.cmd --version
   & .\frontend\node_modules\.bin\playwright.cmd install --dry-run webkit
   ```

   The version command should print `Version 1.65.0`; the dry run should list
   `WebKit 27.2 (playwright webkit v2388)` and the *local* installation location.
   The dry run **does not** check that a working binary exists: run the smoke
   command below to verify that. Do not paste local cache paths into the matrix.
3. From the root, run this **non-payment launch-only** check. It opens a
   temporary headed window on `about:blank` and closes automatically. Expect
   `WebKit on Windows browser version: 27.2` and `Launch-only smoke check
   passed; no payment flow was tested.` Nothing contacts the app or Stripe.

   ```powershell
   node frontend/scripts/paymentWebkit.cjs --smoke
   ```

4. Complete the safety gate above and start the local frontend and backend as
   described under Repository setup. Confirm their **starting pages** load in
   a normal browser. There is no VM: WebKit runs on the same Windows machine,
   so its `localhost:3000` reaches the same frontend. Keep both servers open.
5. Run **one** command below from the root for the flow/locale you will check;
   wait for the window to open. It prints the browser-reported WebKit version
   and the fixed local starting path. If the starting page fails to load, stop
   and fix the local setup before any payment. Otherwise follow sections 2–4
   manually **inside the WebKit window**. The command waits until you close
   that window; closing it returns control to PowerShell. Run the next command
   only after closing it, for a fresh isolated browser context. No card entry,
   payment confirmation, screenshots or session traces are automated.

   ```powershell
   node frontend/scripts/paymentWebkit.cjs --flow membership --locale en
   node frontend/scripts/paymentWebkit.cjs --flow membership --locale ja
   node frontend/scripts/paymentWebkit.cjs --flow donation --locale en
   node frontend/scripts/paymentWebkit.cjs --flow donation --locale ja
   ```

   **Run these individually, not as a batch:** a command waits for the window
   to close. Use the existing scenario IDs and only test-mode Stripe methods.
   Record Windows build/architecture, date/time zone, package version,
   revision `2388`, the version printed by the launcher, and each attempted
   scenario's result in a `WebKit on Windows` row. A blank-page smoke pass or
   starting-page navigation is **not** payment compatibility evidence.

**If something goes wrong:** `node`/`npm` not recognized: install the required
Node version and reopen PowerShell; `playwright.cmd` missing: rerun `npm
--prefix frontend ci` from the clone root; download failure: check network or
team proxy access and retry `install webkit` (do not use a third-party binary);
missing browser executable at launch: rerun `install webkit` with this same
locked package version. If `--smoke` cannot start a window, record the error
category only (not raw logs), Windows version and WebKit build; do not claim a
browser result. If the page cannot be reached, check that `npm run dev` is
running in `frontend/`, port 3000 is reachable, and the backend is running;
verify API origin, non-production keys and webhook privately before proceeding.
Do not change execution policy, bypass certificate or browser safeguards, or
expose development ports publicly. If an attempt remains unavailable, record
its precise `blocked` reason in the results table. Deleting the user cache is
**not necessary**: each launcher run creates a new nonpersistent context.

Environment record (fill in before running any scenarios):

| Field | Observed value or reason blocked |
| --- | --- |
| Tester and date/time zone | Not recorded yet |
| Commit / clean tree | Not recorded yet |
| Windows build / architecture / Node / Python | Not recorded yet |
| Frontend/backend origins (no query strings) | Not recorded yet |
| Non-production and test-mode verified privately | Not verified yet |
| Shared-write coordination / database isolation | Not verified yet |
| Test webhook route/delivery verified (no payloads) | Not verified yet |
| Chrome Stable / Firefox Release / Edge Stable exact in-browser versions | Not recorded yet; executable preflight is not browser evidence |
| WebKit library/binary and reported browser version | Pinned Playwright `1.65.0`, WebKit revision `2388`; tester reports launcher printed `27.2` during manual payment runs. Exact run date and Windows build at run time not recorded. |

## 2. Flows and authority

**M: Membership**: start at `http://localhost:3000/{locale}/membership`,
select one existing option, enter synthetic required member details, wait for
the quote, then Continue to payment. Stripe's hosted Payment Element must load
before confirmation can be enabled. Stripe may redirect to
`/{locale}/membership/payment-result`; the result page reads
`GET /api/payments/membership/status/` using an opaque reference. Only the
backend's `complete` result proves membership payment completion. Pending,
failed, canceled and unavailable are distinct states. Never infer completion
from a Stripe response, a receipt-shaped screen during loading, or the URL.

**D: Donation**: start at `http://localhost:3000/{locale}/support`, choose
an existing amount and fill synthetic donor details (leave mailing-list opt-in
off). Continue to payment creates a donation and a separate embedded Stripe
Checkout session. Stripe-hosted fields and its `canConfirm` state control
confirmation. `/{locale}/support/payment-return` says **submitted/processing**,
not paid. Current Checkout configuration returns to `/en/support?session_id=...`
and that form reads `GET /api/payments/status/` (database/webhook-backed)
before showing `completed`, `pending`, `failed`, or `canceled`. Observe and
record the Japanese flow's actual return locale, do not pre-label it a defect.
Only `completed` from the backend (and a safe receipt when available) is a
confirmed donation; URL, HTTP 200 and Checkout callback alone are not.
Never copy full URLs or reference/session IDs into evidence.

## 3. Guided scenarios (run independently for M and D, en and ja)

Start with a fresh site state per flow/locale. Record one row per browser,
flow, locale and scenario below. After a successful test payment, start the
next scenario in a **new**, safely verified attempt; never reuse a completed
session. Leave browser observation cells as `not attempted` until actually run.

| ID | Starting point and manual actions | Expected result and safe pass condition |
| --- | --- | --- |
| 01 Load | Open `/{locale}/membership` (M) or `/{locale}/support` (D). Fill synthetic required fields; select an existing option/amount and wait for its quote. Choose Continue to payment **once**. | Hosted controls load, current quote/total is displayed, no internal errors or account secrets appear. A missing backend/Stripe/webhook prerequisite is `blocked`, not a pass. |
| 02 Incomplete | With hosted payment controls displayed, leave required hosted inputs incomplete. Attempt to use Confirm once; do **not** bypass a disabled button. | No confirmation starts; missing information is indicated by Stripe, and form remains usable. Do not record card field values. |
| 03 Success | In a **new test-mode attempt**, use a Stripe-approved success scenario, confirm once and wait for status (allow the bounded poll). Inspect the same attempt's result/return. | M: `complete` must come from membership backend status. D: a submitted/processing return is not success; `completed` requires the backend donation status lookup. If webhook/status cannot be verified, mark completion `blocked`. |
| 04 Decline/error | In a **new test-mode attempt**, use a Stripe-approved decline scenario or a safely reproducible non-sensitive error. Observe the form and backend result if available. | Generic, actionable error without raw provider details; no false completion or forced blind retry. If provider behavior is method-dependent or cannot be reproduced safely, `blocked` with reason. |
| 05 Delayed/pending | Observe a naturally delayed status or use an **approved isolated** test setup for a delayed response; never tamper with shared data or simulate a real charge. | M: pending guidance and bounded polling/recheck, not complete. D: pending/submitted guidance, not complete. If delay cannot safely be produced, `blocked`; a mocked unit test is separate evidence. |
| 06 Return/refresh | On the original attempt's result/return, refresh once; observe any backend recheck and the displayed status. | No false completion, no automatic new payment. For D, reloading a plain payment-return page alone is only submitted/processing; verify the support page's status separately. |
| 07 Back/forward | From the result/return, navigate back then forward **without** pressing Confirm again. If an old checkout appears, do not start another attempt. | No false success, no automatic confirmation, clear recovery route/status. Record any stale checkout or ambiguous state verbatim (sanitized). |
| 08 Repeated submission | On a fresh **incomplete** form, click its disabled Confirm button twice (do not bypass disabled controls). Only if the team approves a dedicated test-mode attempt, double-click Continue to payment on a fully completed application form, then **stop before confirmation** and inspect whether one checkout session appeared. Never double-click a valid Confirm button just to test the guard. | Incomplete input does not confirm; preparing a checkout should not display two sessions. Browser observation cannot alone prove duplicate-charge prevention: record that claim as `blocked` unless authoritative evidence exists. |

For every row distinguish **observed UI**, **observed backend status** (if
available), and **inference/limitation**. Do not manufacture a pending state
using browser devtools against shared payment infrastructure. The first pass
is a safe checklist; only document defects after reproducible observation.

## 4. Results (append one row per attempted scenario)

Status vocabulary: `pass` (expected behavior observed with required authority),
`fail` (reproducible mismatch), `blocked` (cannot safely establish outcome;
include why). `Not attempted` is a planning placeholder, **never** a pass.
Copy the appropriate template row for *every* scenario ID 01-08 and locale
`en`/`ja` in each tested browser. If a scenario does not apply, record `blocked`
with the precise reason instead of deleting it.

| Browser and exact version/build | Windows build | Flow | Locale | ID | Expected | Observed UI / backend status (sanitized) | Status | Block reason or defect ID | Tester/date | Safe evidence ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome (pending version) | pending | M/D | en/ja | 01-08 | See section 3 | Not attempted | Not attempted |  |  |  |
| Firefox (pending version) | pending | M/D | en/ja | 01-08 | See section 3 | Not attempted | Not attempted |  |  |  |
| Edge (pending version) | pending | M/D | en/ja | 01-08 | See section 3 | Not attempted | Not attempted |  |  |  |
| WebKit on Windows (approval/build pending) | pending | M/D | en/ja | 01-08 | See section 3 | Not attempted | Not attempted |  |  |  |

#### Reported English donations in Chrome, Firefox and Edge

The tester reports that an anonymous donation using an email address was
completed in each of Chrome, Firefox and Edge, and that `/en/support` displayed
the completed donation state afterwards. The payment-entry interface appeared
and was usable. These are **tester-reported UI observations**: no separate API
response, webhook delivery, quote/total check or screenshot was captured for
this run. The application displays `completed` only after reading the donation
status endpoint, but that underlying response was not independently inspected.
The reported payments used Stripe test mode; the complete safety-gate setup,
including shared-write coordination, has not yet been recorded. Test date is
**not recorded**; the machine clock was checked later on November 8, 2026 at
09:02 PST. The machine later reported Windows 11 Home 64-bit, build 26300.
Versions below are executable candidates from a **post-run** preflight, not
About-page-confirmed versions of the running browsers. Confirm those versions
before further checks; do not treat this limited evidence as a fully verified
version-specific pass.

| Browser (post-run executable candidate; About unconfirmed) | Windows build (checked later) | Flow | Locale | ID | Expected | Observed UI / backend status (sanitized) | Status | Block reason or limitation | Tester/date | Safe evidence ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome Stable candidate `156.0.8078.81` | 26300 | D | en | 01 | Hosted checkout and quote/total load safely | Tester reports payment-entry interface loaded and worked; quote, total and error display were not separately checked. | blocked | Only checkout loading observed; remaining 01 checks unverified. | Tester report; date not recorded | Verbal report only |
| Chrome Stable candidate `156.0.8078.81` | 26300 | D | en | 03 | Backend-confirmed `completed`, not redirect alone | Tester reports test-mode donation completed and `/en/support` displayed completed. Status endpoint response not separately inspected. | pass | Reported completed UI is backed by status lookup in current code; exact tested browser version and webhook evidence not independently verified. | Tester report; date not recorded | Verbal report only |
| Firefox Release candidate `159.0.1` | 26300 | D | en | 01 | Hosted checkout and quote/total load safely | Tester reports payment-entry interface loaded and worked; quote, total and error display were not separately checked. | blocked | Only checkout loading observed; remaining 01 checks unverified. | Tester report; date not recorded | Verbal report only |
| Firefox Release candidate `159.0.1` | 26300 | D | en | 03 | Backend-confirmed `completed`, not redirect alone | Tester reports test-mode donation completed and `/en/support` displayed completed. Status endpoint response not separately inspected. | pass | Reported completed UI is backed by status lookup in current code; exact tested browser version and webhook evidence not independently verified. | Tester report; date not recorded | Verbal report only |
| Edge Stable candidate `157.0.4341.42` | 26300 | D | en | 01 | Hosted checkout and quote/total load safely | Tester reports payment-entry interface loaded and worked; quote, total and error display were not separately checked. | blocked | Only checkout loading observed; remaining 01 checks unverified. | Tester report; date not recorded | Verbal report only |
| Edge Stable candidate `157.0.4341.42` | 26300 | D | en | 03 | Backend-confirmed `completed`, not redirect alone | Tester reports test-mode donation completed and `/en/support` displayed completed. Status endpoint response not separately inspected. | pass | Reported completed UI is backed by status lookup in current code; exact tested browser version and webhook evidence not independently verified. | Tester report; date not recorded | Verbal report only |

Other donation scenarios, Japanese donation checks and **all membership
scenarios** have not been attempted or reported. Do not convert them to passes
or call them blocked until an actual attempt or prerequisite assessment is
recorded. The template rows above remain planning placeholders only.

#### Reported WebKit on Windows payment observations

Tester reports two test-mode payments through the headed WebKit launcher, which
printed browser version `27.2`. The first was a **support donation in English**:
the public site displayed a green confirmation after payment, and the tester
independently found a matching donation in the admin dashboard. The second was
a **membership payment in Japanese**: the tester completed the payment and
independently found a matching membership in the admin dashboard. The tester
did **not** report the public membership result's exact status, an independently
inspected status API response, or an admin payment-status value. Finding a
membership record alone is not proof of backend-confirmed `complete`. The
donation's green public confirmation is treated as a reported completed UI;
the underlying status response was not independently inspected. No payment
identifiers or private data were collected. Exact payment date/time, Windows
build during the run, and full safety-gate verification were not recorded;
the revision is inferred from the pinned installed binary, not separately
read from the headed window. These observations do **not** cover both locales
for each flow, nor the other scenario IDs.

| Browser and reported version (pinned revision) | Windows build at run | Flow | Locale | ID | Expected | Observed UI / backend status (sanitized) | Status | Block reason or limitation | Tester/date | Safe evidence ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WebKit on Windows `27.2` (expected revision `2388`) | Not recorded | D | en | 01 | Hosted checkout, quote/total and safe error display checked | Tester completed a payment using the donation interface; quote/total and error display were not separately checked. | blocked | Only payment interface usability observed; remaining 01 checks unverified. | Tester report; date not recorded | Verbal report only |
| WebKit on Windows `27.2` (expected revision `2388`) | Not recorded | D | en | 03 | Backend-confirmed `completed`, not redirect alone | Tester reports green confirmation on the public support page and independently found the donation in the admin dashboard. No separate status response captured. | pass | Reported completed UI follows backend status lookup in current code; exact backend response and webhook not independently inspected. | Tester report; date not recorded | Verbal report only |
| WebKit on Windows `27.2` (expected revision `2388`) | Not recorded | M | ja | 01 | Hosted Payment Element, quote/total and safe error display checked | Tester reports completing membership payment and finding the membership in the admin dashboard; quote/total and error display were not separately checked. | blocked | Only payment-interface usability observed; remaining 01 checks unverified. | Tester report; date not recorded | Verbal report only |
| WebKit on Windows `27.2` (expected revision `2388`) | Not recorded | M | ja | 03 | Backend-confirmed `complete` on membership result page | Tester reports completing membership payment and independently finding a matching membership in the admin dashboard. Public result status and dashboard payment status not reported. | blocked | Membership record does not establish payment `complete`; result/status verification still needed. | Tester report; date not recorded | Verbal report only |

The other WebKit scenario IDs, Japanese donation and English membership were
not reported as attempted. Their template rows remain `Not attempted`, not
passes or inferred failures. In particular, no decline, incomplete-input,
pending, navigation or repeat-click behavior was verified in these runs.

### Defects and retests

| ID | Browser/build, flow/locale | Safe reproduction steps and expected/observed behavior | Severity | Regression test / fix commit | Affected-browser retest | Other-browser smoke |
| --- | --- | --- | --- | --- | --- | --- |
| None recorded yet |  |  |  |  |  |  |

No reproducible browser defect has been reported in the attempted scenarios
so far. A code-review finding was separately confirmed by a failing mocked
test: an **unavailable donation status** formerly offered a fresh donation
attempt while the original outcome was unknown. The return page now offers
only a repeat lookup of the **same session**, with rapid clicks guarded; a
backend-confirmed failed or canceled payment still offers a fresh attempt.
This is not a claim that the behavior was reproduced in a real browser. It is
not a claim that all required scenarios passed: membership in Chrome, Firefox
and Edge and most recovery/error checks remain unattempted. Focused mocked
tests now cover donation status-lookup failure, malformed status, and the
Stripe Checkout in-flight confirmation guard and error retry without claiming
these cases were reproduced in a real browser. Record any later
reproduced failure with browser/version, flow/locale, steps, expected versus
observed behavior and severity here before changing payment application code.

### Collecting Chrome, Firefox and Edge observations

The tester runs the guided scenarios in **Chrome, Firefox and Edge**, for both
flows and both supported locales. Record each browser's **in-app About page**
version, Windows build, architecture and time zone before the run. Candidate
versions reported by the script are not tested versions. Each
browser/flow/locale combination has scenario IDs 01-08. Reuse a single safe
attempt for compatible checks, but create a new verified test-mode attempt for
success versus decline. Do not initiate 96 separate payments to fill 96 slots.
Copy a row for each attempted ID; a prerequisite failure can block all affected
IDs with the same explicit reason. Do not treat blank template rows as results.

After each run, share the following **sanitized** fields with the person
recording results; do not transmit an unredacted screenshot, query string,
Stripe error, key, card data, or test identity:

```text
Browser and exact version; Windows build; date/time zone; flow; locale:
Scenario ID; observed application message/state; backend-backed status, if visible:
Pass, fail or blocked; reason; reproducible steps if failed:
Safe evidence label (optional; no sensitive URLs or form/Stripe inputs):
```

For the donation flow, note separately whether the return shows
submitted/processing, whether `/support` displays a backend-backed payment
status, and which locale the return actually uses. For membership, distinguish
Payment Element submission from `complete` on the result page. If a pending
state, decline, or webhook confirmation cannot safely be observed, mark the
specific scenario blocked; the mocked regression tests below are **not** a
substitute for this browser observation. Confirm recorded rows with the tester
before reporting the results for review.

## 5. Automated checks (not browser compatibility evidence)

From the repository root on Windows, with `frontend/node_modules` installed:

```powershell
npm --prefix frontend test -- --runInBand --runTestsByPath components/membership/MembershipPaymentElement.test.tsx components/membership/MembershipPaymentResult.test.tsx components/support/DonationForm.amountChoices.test.tsx components/support/DonationForm.checkout.test.tsx components/support/DonationForm.receipt.test.tsx components/support/StripePaymentElement.test.tsx components/payments/PaymentReceipt.test.tsx services/paymentService.test.ts services/paymentService.donation.test.ts scripts/paymentWebkit.test.ts
npm --prefix frontend run lint
npx --prefix frontend tsc --noEmit -p frontend
```

The Jest path arguments above are relative to Jest's `frontend/` root; if the
runner cannot find them, pass absolute file paths instead. No live provider,
email, or shared PostgreSQL calls are made by these focused mocked tests.
Backend tests (only if server code changes) use these commands from the repo
root; never use `manage.py test` with development settings:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\payments
backend\venv\Scripts\python.exe -m ruff check backend
```

| Stage | Command set | Observed outcome | Interpretation |
| --- | --- | --- | --- |
| A1 before edit | Six absolute-path Jest suites, frontend lint, TypeScript | 6 suites, 109 tests passed; lint passed; TypeScript passed. Local Node `v24.14.0` differs from `.nvmrc` `22.14.0`. | Mocked frontend baseline only; not browser observations. |
| A1 after edit | Same six suites, frontend lint, TypeScript, `git diff --check` | 6 suites, 110 tests passed (one new test); TypeScript passed; lint exited 0 with warnings in unchanged files; diff whitespace check passed. | Mocked frontend checks only; browser observations still unattempted. |
| A2 preparation (before browser observations) | Six focused Jest suites, frontend lint, TypeScript, `git diff --check` | 6 suites, 111 tests passed (one new mocked pending-to-completed donation test); TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | Application behavior only; browser results still unattempted. Recheck after adding actual observations and before commit. |
| A2 browser version preflight | `& .\scripts\payment_browser_versions.ps1`; PowerShell parser | Script syntax valid; discovered candidate Chrome `156.0.8078.81`, Firefox `159.0.1`, Edge `157.0.4341.42` on Windows process-view build `10.0.26300.0`. | Discovery only, not in-browser version confirmation or payment observations. Versions may update before the manual run. |
| A2 after limited English donation reports | Six focused Jest suites, frontend lint, TypeScript, `git diff --check` | 6 suites, 111 tests passed; TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | Mocked checks only. Three tester-reported donation completions appear above; membership, other scenarios and exact in-browser versions remain unverified. Rerun after further observations before commit. |
| A3 installation/preflight, before manual WebKit payments | `npm --prefix frontend install --save-dev --save-exact playwright@1.65.0`; project-local CLI `install webkit`, `--version`, `install --dry-run webkit`; `node frontend/scripts/paymentWebkit.cjs --smoke`; seven focused Jest suites, lint, TypeScript, `git diff --check` | Playwright `1.65.0` installed; WebKit `27.2` revision `2388` and support binaries downloaded; headed `about:blank` launch passed; final seven suites/123 tests passed, TypeScript and diff check passed, lint exited 0 with warnings in unchanged files. npm install reported 28 vulnerabilities across the current dependency tree; no audit fix was run. The documented fresh `npm ci` procedure and payment starting-page launch have not yet been tested on a clean machine. | Launch-only and mocked checks; **no WebKit payment scenario has been observed**. Node on this machine `v24.14.0` differs from requested `22.14.0`. |
| A3 tester-reported WebKit runs | Headed WebKit manual payment checks; flow-level observations above | English donation public confirmation and matching admin record reported; Japanese membership payment and matching admin record reported. Browser version `27.2` reported. No other scenario result or exact run date reported. | These are limited manual observations; a membership record alone does not establish payment status `complete`. Automated checks are recorded separately. |
| Donation return failure coverage | `npm --prefix frontend test -- --runInBand --silent --runTestsByPath components/support/DonationForm.receipt.test.tsx` | 1 suite, 7 tests passed, including two new cases for rejected and malformed status lookups. | Mocked return safety checks, not a browser failure or browser-compatibility result. |
| Donation return safety after test-only change | Seven focused Jest suites including WebKit launcher tests, frontend lint, TypeScript, `git diff --check` | 7 suites, 125 tests passed; TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | Mocked application/launcher checks only. No production payment code changed, and missing Chrome/Firefox/Edge membership and recovery checks remain open. |
| Donation Checkout confirmation coverage | `npm --prefix frontend test -- --runInBand --silent --runTestsByPath components/support/StripePaymentElement.test.tsx` | 1 suite, 6 tests passed, including an in-flight guard and safe retry after returned/thrown errors. | Mocked Stripe Checkout only; manual browser findings and full focused rerun tracked separately. |
| Donation Checkout and return coverage after edits | Seven focused Jest suites including WebKit launcher tests; frontend lint, TypeScript; `git diff --check` | Initial seven-suite Jest run had 1 failure in the existing donation checkout suite and 127 passes; a separate checkout-suite rerun reported 39 passes, though the command wrapper did not confirm its exit. A fresh seven-suite run with `CI=true` passed: 7 suites, 128 tests. TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | The initial failure was not diagnosed from the truncated console output; do not claim it is resolved solely because the rerun passed. All are mocked checks, not payment-browser observations. No production code changed. |
| Payment service and return edge-case baseline | `CI=true` with focused Jest coverage for donation form, Stripe Checkout element, receipt and service (six suites) | 6 suites, 103 tests passed. For the selected four production files: 84.65% statements, 74.67% branches, 86.59% lines; `paymentService.ts` 67.59% statements. | Coverage describes only the selected files and mocked suites, not all frontend code or browser compatibility. |
| Payment service and return edge cases after test additions | Same focused Jest coverage plus `services/paymentService.donation.test.ts` (seven suites); lint, TypeScript | 7 suites, 127 tests passed; selected four production files: 92.07% statements, 91.11% branches, 93.57% lines; `paymentService.ts` 93.51% statements. TypeScript and lint exited 0; lint reported warnings in unchanged files. | Added mocked session/receipt validation, return refresh, late-response, and bounded pending-poll coverage. No production code, backend, shared infrastructure or payment-browser result changed. Full payment-suite rerun is recorded separately. |
| Payment regression suite after edge-case additions | `CI=true` with the ten focused Jest suite paths listed above, TypeScript, lint and `git diff --check` | 10 suites, 166 tests passed; TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | Mocked application/launcher tests only. Browser evidence and the missing required Windows membership scenarios must be reviewed separately. |
| Uncertain-outcome recovery regression before fix | `CI=true` focused donation receipt suite with a new retry-original-session assertion | 1 suite failed as expected: the status-error UI offered `Start a New Donation Attempt`; 10 existing tests passed. | Code-review finding reproduced with a mock, not observed in a browser. The failed test was rerun after the code change. |
| Payment safety checks after review fix | `CI=true` with the ten focused Jest suites listed above; frontend TypeScript and lint; `git diff --check` | 10 suites, 171 tests passed; TypeScript and diff check passed; lint exited 0 with warnings in unchanged files. | Covers same-session retry on uncertain donation status, rapid retry clicks, stale membership status after reference change, and email-sync errors in addition to earlier receipt/service tests. These are mocked checks, not browser observations. A manual retest is still required before committing. |

### Recovery behavior and locale follow-up

If a returned donation's status cannot be read, the action labeled **Check
Payment Status Again** retries the same session rather than starting a second
payment. Test this by simulating a temporary unavailable status endpoint in an
isolated environment; leave its returned session URL intact. A successful
status check should then show the appropriate backend-confirmed result. Do not
start another donation while the first outcome remains unknown. The automated
test reproduces the old unsafe action before the fix; it does not substitute
for an observed browser retest.

The backend currently builds donation returns at `/en/support` regardless of
the locale used to begin Checkout. A Japanese payment's locale on return has
not been independently recorded. Verify and record it separately before
planning a localized return-URL contract change; this PR does not claim that
Japanese locale is preserved after donation Checkout.

Use the PR template at `.github/PULL_REQUEST_TEMPLATE.md` for the final review
summary, commands, results, blockers and limitations. Keep known pre-existing
failures distinct from failures introduced by this branch.