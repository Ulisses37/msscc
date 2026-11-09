# Test run summary

Run directory: `20261108T222427Z-9ecc02c-baseline`

| Field | Value |
|---|---|
| Captured at | 2026-11-08T22:25:11+00:00 |
| Commit | `9ecc02c` (feature/SCRUM-897-ci-test-automation) |
| Working tree dirty | False |
| Label | baseline |
| Python | 3.13.2 |

This run was captured from a clean working tree, so its results are reproducible from commit `9ecc02c`.

This is the committed baseline under `docs/testing/baseline/`. Because a run must be captured before the commit that adds it, the hash above is the **parent** of the commit that introduced this baseline, and that commit changes no source file, so the results still describe it.

## Test counts

### Backend (pytest): 710 tests, 710 passed, 0 failed, 0 skipped

SubTests: 746 passed, 0 failed. Subtests are not separate tests; they run inside the tests counted above, so they are reported on their own line rather than added to the total.

| App | Tests | Failed | Skipped |
|---|---|---|---|
| `accounts` | 3 | 0 | 0 |
| `admin_support` | 4 | 0 | 0 |
| `board_members` | 8 | 0 | 0 |
| `config` | 12 | 0 | 0 |
| `content` | 15 | 0 | 0 |
| `donations` | 322 | 0 | 0 |
| `emails` | 117 | 0 | 0 |
| `events` | 85 | 0 | 0 |
| `media` | 56 | 0 | 0 |
| `page` | 13 | 0 | 0 |
| `payments` | 66 | 0 | 0 |
| `site_analytics` | 9 | 0 | 0 |
| **Total** | **710** | **0** | **0** |

### Frontend (jest): 686 tests in 67 suites, 686 passed, 0 failed

Suites: 67 passed, 0 failed.

| Suite | Tests | Failed |
|---|---|---|
| `frontend/app/admin/board-of-directors/BoardOfDirectorCards.test.tsx` | 4 | 0 |
| `frontend/components/admin/DonationCsvReview.test.tsx` | 13 | 0 |
| `frontend/components/admin/MembershipCsvReview.test.tsx` | 13 | 0 |
| `frontend/components/layout/PublicNavbar.test.tsx` | 21 | 0 |
| `frontend/components/admin/DonationDetailDrawer.test.tsx` | 25 | 0 |
| `frontend/components/admin/ManualDonationForm.test.tsx` | 22 | 0 |
| `frontend/components/membership/MembershipForm.test.tsx` | 10 | 0 |
| `frontend/components/admin/MembershipDetailDrawer.test.tsx` | 41 | 0 |
| `frontend/components/admin/ManualMembershipForm.test.tsx` | 18 | 0 |
| `frontend/components/admin/ImageBlockInput.test.tsx` | 4 | 0 |
| `frontend/components/admin/BilingualInput.test.tsx` | 6 | 0 |
| `frontend/components/membership/MembershipPaymentElement.test.tsx` | 9 | 0 |
| `frontend/components/membership/MembershipPaymentResult.test.tsx` | 18 | 0 |
| `frontend/components/admin/EventForm.test.tsx` | 3 | 0 |
| `frontend/components/membership/MembershipOptions.test.tsx` | 4 | 0 |
| `frontend/app/admin/dashboard/layout.test.tsx` | 5 | 0 |
| `frontend/components/ui/LanguageToggle.test.tsx` | 6 | 0 |
| `frontend/components/support/DonationSummary.test.tsx` | 12 | 0 |
| `frontend/app/admin/board-of-directors/page.test.tsx` | 1 | 0 |
| `frontend/app/[locale]/membership/translations.test.tsx` | 2 | 0 |
| `frontend/components/membership/MembershipSummary.test.tsx` | 4 | 0 |
| `frontend/components/content/ContentFallBack.test.tsx` | 15 | 0 |
| `frontend/app/[locale]/about/page.test.tsx` | 6 | 0 |
| `frontend/components/admin/MailingListStatus.test.tsx` | 8 | 0 |
| `frontend/components/payments/PaymentReceipt.test.tsx` | 5 | 0 |
| `frontend/utils/manualMembershipValidation.test.ts` | 17 | 0 |
| `frontend/app/admin/documentation/pageDocumentation.test.ts` | 2 | 0 |
| `frontend/components/support/DonationForm.receipt.test.tsx` | 4 | 0 |
| `frontend/components/support/StripePaymentElement.test.tsx` | 2 | 0 |
| `frontend/app/admin/dashboard/imageStorage.test.tsx` | 3 | 0 |
| `frontend/hooks/useDelayedFallback.test.ts` | 5 | 0 |
| `frontend/components/admin/DeepLUsageMeter.test.tsx` | 2 | 0 |
| `frontend/app/api/translate/route.test.ts` | 13 | 0 |
| `frontend/utils/manualDonationValidation.test.ts` | 14 | 0 |
| `frontend/services/donationImportPreview.test.ts` | 15 | 0 |
| `frontend/services/paymentService.test.ts` | 37 | 0 |
| `frontend/services/subscriptionStatusService.test.ts` | 7 | 0 |
| `frontend/app/api/deepl-usage/route.test.ts` | 2 | 0 |
| `frontend/services/paymentReceipt.test.ts` | 17 | 0 |
| `frontend/utils/membershipValues.test.ts` | 27 | 0 |
| `frontend/utils/deeplServer.test.ts` | 9 | 0 |
| `frontend/services/membershipImportPreview.test.ts` | 14 | 0 |
| `frontend/services/manualDonation.test.ts` | 16 | 0 |
| `frontend/utils/mediaUploadError.test.ts` | 6 | 0 |
| `frontend/utils/tableRevisionPolling.test.ts` | 12 | 0 |
| `frontend/services/membershipImportTemplate.test.ts` | 4 | 0 |
| `frontend/services/donationImportTemplate.test.ts` | 4 | 0 |
| `frontend/services/financialRecordSearch.test.ts` | 7 | 0 |
| `frontend/components/support/DonationForm.amountChoices.test.tsx` | 9 | 0 |
| `frontend/services/deeplService.test.ts` | 5 | 0 |
| `frontend/services/volunteerService.test.ts` | 4 | 0 |
| `frontend/utils/membershipExport.test.ts` | 11 | 0 |
| `frontend/services/emailService.test.ts` | 5 | 0 |
| `frontend/components/admin/membershipDisplayStatus.test.ts` | 13 | 0 |
| `frontend/utils/dateLocalization.test.ts` | 3 | 0 |
| `frontend/utils/contentFallbackPolling.test.ts` | 3 | 0 |
| `frontend/services/adminRequestHeaders.test.ts` | 2 | 0 |
| `frontend/utils/deeplUsage.test.ts` | 10 | 0 |
| `frontend/utils/googleCalendar.test.ts` | 3 | 0 |
| `frontend/context/verifySession.test.ts` | 7 | 0 |
| `frontend/utils/emailValidation.test.ts` | 6 | 0 |
| `frontend/app/admin/donations/page.test.ts` | 8 | 0 |
| `frontend/app/[locale]/membership/page.test.tsx` | 9 | 0 |
| `frontend/app/admin/editpages/page.test.tsx` | 10 | 0 |
| `frontend/app/admin/donations/page.test.tsx` | 11 | 0 |
| `frontend/components/support/DonationForm.checkout.test.tsx` | 39 | 0 |
| `frontend/app/admin/memberships/page.test.tsx` | 14 | 0 |

## Checks

| Check | Status | Exit code |
|---|---|---|
| pytest | passed | 0 |
| jest | passed | 0 |
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

None. Every test in this run passed.

## Reporting note

`pytest.xml` declares `tests="1456"` on `<testsuite>` while containing 710 `<testcase>` elements. The attribute counts subtests as well as tests, which is by design.

That run reported 746 subtests passed and 0 failed, and 710 + 746 = 1456, which is the attribute value.

The `<testcase>` element count is what this summary reports as the test count, because it is the count that can be attributed to named tests.
