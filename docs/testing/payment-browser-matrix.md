# SCRUM-855 payment browser test matrix

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

Use installed, up-to-date Chrome, Firefox and Edge on Windows; record each
exact version from its About page (Chrome: Help > About Google Chrome;
Firefox: Help > About Firefox; Edge: Help and feedback > About Microsoft Edge).
Open a new clean browser profile or clear only this test site's cookies, local
storage and cache before **each flow/locale run**. Disable extensions that
interfere with checkout; record exceptions. Use a fresh synthetic identity and
the same pre-agreed test amount/option per comparable run. Never reuse a paid
session. Record versions and locale in the tables below, not just in a summary.

WebKit on Windows is a separate, optional A3 pass. **Do not install a new
browser runner or dependency until the team approves its precise tool,
version and scope.** When approved, pin and record the runner package version
and WebKit revision/build, its reproducible install/launch commands, OS build,
and whether the browser runs headed against this local site. Test both flows
manually inside that headed window. A launch/navigation smoke check does not
prove that hosted payment controls or payment completion worked. Label every
row `WebKit on Windows`; do not turn these observations into a branded-browser
result. If tooling is unavailable, mark WebKit scenarios blocked, not passed.

Environment record (fill in before running any scenarios):

| Field | Observed value or reason blocked |
| --- | --- |
| Tester and date/time zone | Not recorded yet |
| Commit / clean tree | Not recorded yet |
| Windows build / Node / Python | Not recorded yet |
| Frontend/backend origins (no query strings) | Not recorded yet |
| Non-production and test-mode verified privately | Not verified yet |
| Shared-write coordination / database isolation | Not verified yet |
| Test webhook route/delivery verified (no payloads) | Not verified yet |
| Chrome / Firefox / Edge exact versions | Not recorded yet |
| WebKit runner version and build, if approved | Not approved or recorded yet |

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

### Defects and retests

| ID | Browser/build, flow/locale | Safe reproduction steps and expected/observed behavior | Severity | Regression test / fix commit | Affected-browser retest | Other-browser smoke |
| --- | --- | --- | --- | --- | --- | --- |
| None recorded yet |  |  |  |  |  |  |

## 5. Automated checks (not browser compatibility evidence)

From the repository root on Windows, with `frontend/node_modules` installed:

```powershell
npm --prefix frontend test -- --runInBand --runTestsByPath components/membership/MembershipPaymentElement.test.tsx components/membership/MembershipPaymentResult.test.tsx components/support/DonationForm.checkout.test.tsx components/support/DonationForm.receipt.test.tsx components/support/StripePaymentElement.test.tsx services/paymentService.test.ts
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

Use the PR template at `.github/PULL_REQUEST_TEMPLATE.md` for the final review
summary, commands, results, blockers and limitations. Keep known pre-existing
failures distinct from failures introduced by this branch.