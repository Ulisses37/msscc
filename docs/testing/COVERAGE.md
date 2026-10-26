# Test Coverage Notes

**SCRUM Lords | CSUS Computer Science Senior Project**

What the recorded runs actually exercise, and what they deliberately do not. Read
this before treating a green run as proof that a provider integration works.

Related: [PROCEDURE.md](PROCEDURE.md) for how to run and compare a run, and
[baseline/SUMMARY.md](baseline/SUMMARY.md) for the observed failures at the
baseline commit.

## What a recorded run covers

| Check | Scope | Trustworthy as evidence for |
|---|---|---|
| pytest (`367` tests, baseline) | Every Django app under `backend/`, against in-memory SQLite | Serializers, views, models, permissions, migrations, encryption |
| jest (`243` tests, baseline) | Colocated `*.test.ts(x)` files under `frontend/`, in the Node environment | Pure logic, service-layer request shaping, component rendering without a browser |
| `tsc --noEmit` | The whole `frontend/` project | Type correctness at the pinned TypeScript version |
| ruff | All of `backend/` except `migrations/` | Style, imports, dead code, likely bugs, Django model conventions |

The counts above come from the committed baseline and are a snapshot. Read
`SUMMARY.md` in the baseline for the per-app and per-suite detail and the current
numbers.

## What the tests do not cover

### Resend is mocked, and there are no live-Resend tests

**Every email path in the test suite runs with the provider mocked.** No test
sends a real email, and no test calls the live Resend API. The mocks in use are:

| Area | How the provider is replaced |
|---|---|
| Subscribe and contact sync | `patch("emails.subscribers.get_provider")` |
| Subscribe endpoint | `patch("emails.views.get_provider")` |
| Announcement send | `patch("emails.views.get_provider")` |
| Adapter behavior itself | `resend` SDK calls patched per test in `backend/emails/tests.py` |

`backend/config/settings/test.py` also sets `EMAIL_BACKEND` to Django's dummy
backend, so even a path that bypassed the provider abstraction would not deliver
mail.

**Consequences, stated plainly:**

- Contact creation, segment membership, broadcast sending, and unsubscribe-link
  substitution have never been observed against a real provider account from this
  test suite.
- The unsubscribe URL in the announcement template is a provider placeholder
  (`{{{RESEND_UNSUBSCRIBE_URL}}}`) whose substitution is documented in
  `backend/emails/providers/resend.py` as **unverified**, because no verified
  sending domain exists yet. A passing run says nothing about it.
- Sharing a real contact between the local database and the provider mirror is
  not exercised, so drift between the two is not detectable from a run.
- Webhook signature verification is tested against constructed payloads, not
  against a live signed delivery from Resend.

Anyone changing an email path should treat the tests as covering our logic up to
the provider boundary, and verify the boundary by hand. For the end-to-end
procedure, see the `stripe-webhook-testing` and setup-guide material on
provider sandboxes.

### Other mocked or simulated boundaries

- **Frontend network calls are mocked.** `fetch` is stubbed in the frontend tests
  (16 test files), so no frontend test reaches the backend, Stripe, DeepL, or any
  live service. `window.alert` and `window.confirm` are stubbed where the code
  uses them.
- **Stripe is never called live.** The Stripe SDK is patched at the boundary in
  the backend tests (`payments.views.stripe.checkout.Session.retrieve`,
  `payments.views.stripe.Webhook.construct_event`), and the frontend mocks its
  own fetch calls, so no request leaves the test process. Card data never touches
  the code, and no live key is used. Stripe work in this project is test mode
  only.
- **DeepL is never called live.** The translate route and usage meter are tested
  against mocked responses (`global.fetch = jest.fn()`), so quota behavior and the
  real usage endpoint are not covered by a run.
- **The database is in-memory SQLite, not the team PostgreSQL.** `backend/config/settings/test.py`
  overrides `DATABASES` to `:memory:`. A run therefore does not prove that a query
  or migration behaves identically on Postgres, and it never touches the shared
  development database.
- **No browser runs.** jest uses the Node environment rather than a real browser,
  so layout, CSS, and full hydration behavior are not verified by a run.
- **No deployment path is covered.** Nothing here exercises Railway, R2, Netlify,
  or production settings.

## Known failures at the baseline

The committed baseline is **not fully green.** Its frontend run recorded 4 failed
suites and 12 failed tests, with the backend, `tsc` and ruff all passing. The
suites and test names are listed in
[baseline/SUMMARY.md](baseline/SUMMARY.md), which is generated from `jest.json`
and is the single source of truth for that list.

Those failures were observed at the baseline commit recorded in that summary. Root
causes were not investigated as part of the reporting work, and this document does
not restate its conclusions. Use `scripts/compare_runs.py` to see when they clear.

## Reporting caveat: tests, subtests and the `tests` attribute

The backend suite uses Django's `subTest()` for table-driven cases, and a subtest
is **not** a separate test. It runs inside the test that contains it.

pytest reports this as `367 passed, 447 subtests passed`, and the JUnit
`<testsuite tests="...">` attribute adds the two together and declares `814`.
**That is by design, not a defect and not a quirk.** Counting the attribute as a
test count gives 814 for a suite of 367 tests.

For the same reason, a failing subtest does not appear as its own `<testcase>`. It
appears as an extra `<failure>` child on the parent test's element, so a test with
three failing subtests renders as one `<testcase>` with three `<failure>` children.
Both `scripts/summarize.py` and `scripts/compare_runs.py` count failure children
rather than elements, so a subtest failure is neither lost nor merged into a
single count. `SUMMARY.md` reports subtests on their own line and names each
failing subtest by its parameters.

See [PROCEDURE.md](PROCEDURE.md) for how a subtest failure is identified, including
the positional fallback and its reordering caveat.

---

*Last updated October 2026 -- SCRUM Lords*
