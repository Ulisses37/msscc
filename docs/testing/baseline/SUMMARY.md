# Test run summary

Run directory: `20261026T055450Z-2261eb5-baseline`

| Field | Value |
|---|---|
| Captured at | 2026-10-26T05:55:22+00:00 |
| Commit | `2261eb5` (feature/SCRUM-786-testing-report) |
| Working tree dirty | False |
| Label | baseline |
| Python | 3.13.2 |

This run was captured from a clean working tree, so its results are reproducible from commit `2261eb5`.

This is the committed baseline under `docs/testing/baseline/`. Because a run must be captured before the commit that adds it, the hash above is the **parent** of the commit that introduced this baseline, and that commit changes no source file, so the results still describe it.

## Test counts

### Backend (pytest): 395 tests, 395 passed, 0 failed, 0 skipped

SubTests: 447 passed, 0 failed. Subtests are not separate tests; they run inside the tests counted above, so they are reported on their own line rather than added to the total.

| App | Tests | Failed | Skipped |
|---|---|---|---|
| `admin_support` | 4 | 0 | 0 |
| `config` | 12 | 0 | 0 |
| `content` | 6 | 0 | 0 |
| `donations` | 171 | 0 | 0 |
| `emails` | 78 | 0 | 0 |
| `events` | 21 | 0 | 0 |
| `media` | 28 | 0 | 0 |
| `page` | 3 | 0 | 0 |
| `payments` | 63 | 0 | 0 |
| `site_analytics` | 9 | 0 | 0 |
| **Total** | **395** | **0** | **0** |

### Frontend (jest): 243 tests in 35 suites, 231 passed, 12 failed

Suites: 31 passed, 4 failed.

| Suite | Tests | Failed |
|---|---|---|
| `frontend/services/deeplService.test.ts` | 5 | 1 |
| `frontend/app/[locale]/about/page.test.tsx` | 5 | 0 |
| `frontend/components/membership/MembershipSummary.test.tsx` | 4 | 0 |
| `frontend/components/payments/PaymentReceipt.test.tsx` | 5 | 0 |
| `frontend/app/[locale]/membership/translations.test.tsx` | 2 | 2 |
| `frontend/components/support/DonationSummary.test.tsx` | 12 | 0 |
| `frontend/components/support/DonationForm.receipt.test.tsx` | 4 | 0 |
| `frontend/components/admin/BilingualInput.test.tsx` | 3 | 0 |
| `frontend/hooks/useDelayedFallback.test.ts` | 5 | 0 |
| `frontend/services/financialRecordSearch.test.ts` | 7 | 0 |
| `frontend/services/paymentReceipt.test.ts` | 17 | 0 |
| `frontend/components/support/StripePaymentElement.test.tsx` | 2 | 0 |
| `frontend/services/paymentService.test.ts` | 37 | 0 |
| `frontend/utils/deeplServer.test.ts` | 4 | 0 |
| `frontend/services/volunteerService.test.ts` | 4 | 0 |
| `frontend/components/membership/MembershipPaymentElement.test.tsx` | 9 | 0 |
| `frontend/app/[locale]/membership/page.test.tsx` | 9 | 9 |
| `frontend/components/admin/DeepLUsageMeter.test.tsx` | 2 | 0 |
| `frontend/components/membership/MembershipOptions.test.tsx` | 4 | 0 |
| `frontend/components/admin/EventForm.test.tsx` | 3 | 0 |
| `frontend/services/adminRequestHeaders.test.ts` | 2 | 0 |
| `frontend/app/admin/donations/page.test.ts` | 2 | 0 |
| `frontend/components/membership/MembershipPaymentResult.test.tsx` | 18 | 0 |
| `frontend/services/emailService.test.ts` | 5 | 0 |
| `frontend/utils/dateLocalization.test.ts` | 3 | 0 |
| `frontend/components/admin/membershipDisplayStatus.test.ts` | 3 | 0 |
| `frontend/utils/emailValidation.test.ts` | 6 | 0 |
| `frontend/utils/tableRevisionPolling.test.ts` | 8 | 0 |
| `frontend/app/admin/board-of-directors/BoardOfDirectorCards.test.tsx` | 3 | 0 |
| `frontend/utils/deeplUsage.test.ts` | 6 | 0 |
| `frontend/utils/mediaUploadError.test.ts` | 5 | 0 |
| `frontend/utils/contentFallbackPolling.test.ts` | 3 | 0 |
| `frontend/components/content/ContentFallBack.test.tsx` | 0 | 0 |
| `frontend/components/support/DonationForm.amountChoices.test.tsx` | 9 | 0 |
| `frontend/components/support/DonationForm.checkout.test.tsx` | 27 | 0 |

## Checks

| Check | Status | Exit code |
|---|---|---|
| pytest | passed | 0 |
| jest | failed | 1 |
| tsc | passed | 0 |
| ruff | passed | 0 |

| Tool | Version |
|---|---|
| python | Python 3.13.2 |
| django | 6.0.3 |
| pytest | pytest 9.1.1 |
| pytest_django | 4.14.0 |
| ruff | ruff 0.16.9 |
| node | v22.14.0 |
| npm | 10.9.2 |
| jest | 29.7.0 |
| tsc | Version 5.9.3 |

## Failures observed in this run

Recorded from `jest.json` and `pytest.xml`. This is the state of the tree at the commit above, not a statement about any other commit. Root causes are not analysed here.

### Failed suites (4)

- `frontend/app/[locale]/membership/page.test.tsx`
- `frontend/app/[locale]/membership/translations.test.tsx`
- `frontend/components/content/ContentFallBack.test.tsx`
- `frontend/services/deeplService.test.ts`

### Failed tests (12)

- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow exposes the optional checkbox description and blocks checkout while its new quote loads`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow ignores a late quote for the previous membership option`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow ignores an old session after selection changes`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow keeps continue disabled until invalid information is corrected`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow keeps matching locale keys and renders the Japanese review flow`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow shares selection state with the summary and enables continue after valid information`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow shows a translated safe error and allows retry when a session fails`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow shows saved checkout amounts instead of a stale preview after session creation`
- `frontend/app/[locale]/membership/page.test.tsx::MembershipPage review flow waits for the new server quote before enabling checkout after opt-in`
- `frontend/app/[locale]/membership/translations.test.tsx::membership page translations with an older layout payload renders en labels when the parent provider has no membership messages`
- `frontend/app/[locale]/membership/translations.test.tsx::membership page translations with an older layout payload renders ja labels when the parent provider has no membership messages`
- `frontend/services/deeplService.test.ts::requestDeepLTranslation blocks visible text that is larger than the remaining quota`

Totals from the report's own counters: 12 failed tests across 4 failed suites of 35 suites.

## Reporting note

`pytest.xml` declares `tests="842"` on `<testsuite>` while containing 395 `<testcase>` elements. The attribute counts subtests as well as tests, which is by design.

That run reported 447 subtests passed and 0 failed, and 395 + 447 = 842, which is the attribute value.

The `<testcase>` element count is what this summary reports as the test count, because it is the count that can be attributed to named tests.
