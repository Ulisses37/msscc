# Membership CSV import (SCRUM-850)

This guide is tracked in Git for admins and testers. The Memberships admin page
shows the workflow; the backend contract in
`backend/donations/membership_csv_contract.py` generates the actual template and
enforces its format. Neither the template nor the page instructions are stored
as seeded database content.

## Setup for separate test environments

- Run the frontend and backend from a version containing the CSV import commits.
  An older frontend will not show the import controls; an older backend will not
  recognize the template, preview, or confirmation endpoints.
- Apply donations migration `0019_membership_csv_import_batch.py` to **your own**
  test database before confirming. Ask the team first if you use the shared
  development database; do not migrate it independently. Preview does not save
  records, but confirmation creates memberships in the backend database that
  handled the request. Separate databases do not automatically share imported
  memberships or batch receipts.
- Sign in as an active executive admin or an admin with `Finances` access. Use
  fictional people and avoid uploading actual contact details to test systems.

## CSV contract

Download **Membership CSV import template** on Admin > Memberships. It contains
one header row and no sample personal information. Keep these 16 columns in
exactly this order (one membership per following row):

```text
first_name,last_name,membership_type,status,email,phone,address,membership_price,amount_paid,start_date,end_date,renewal_date,payment_status,payment_method,reference_id,notes
```

Required: `first_name`, `last_name`, `membership_type` (free text), `status`.
Optional: all other columns. Leave optional cells blank if the historical fact
is unknown; `0.00` means a *known* zero, not unknown. Do not infer current
prices, dates, payment statuses, or payment methods from older records.

| Field | Allowed input |
| --- | --- |
| `status` | `unknown`, `active`, `inactive`, `pending`, `expired`, `canceled` |
| `payment_status` | Blank, `pending`, `completed`, `failed`, `canceled`, `waived` |
| `payment_method` | Blank, `cash`, `check`, `card`, `bank_transfer`, `other` |
| Dates | Blank, `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`, or `MM-DD-YYYY`; preview normalizes to `YYYY-MM-DD`. Use two-digit month/day and a consistent separator; end date cannot precede a known start date |
| Amounts | Blank or nonnegative decimal, up to two places; no symbols, commas, signs, or exponent notation |

Use UTF-8 CSV, up to **1,048,576 bytes** and **500 data rows**. Character
limits: names, membership type, status, phone, payment status and reference ID
255; email 254; address and notes 500; payment method 20; dates 10; amounts
12. Use the downloaded header rather than constructing it from an export;
record CSV/XLSX exports are a separate feature. These inputs do not process
payments, issue receipts, or record mailing-list consent.

## Review, save, and recover

1. Fill the downloaded template and choose it in **Review membership CSV**.
   Select **Upload and review CSV**. Preview does not create records.
2. Check normalized proposed values and row/field errors. Correct errors in
   the source file and upload it again; there is no inline editing. Repeated
   rows and possible existing-record matches produce warnings, not automatic
   merges. An email match alone does not establish a duplicate.
3. Review and explicitly acknowledge warnings, then select **Confirm membership
   import**. The server checks the file and current warnings again and saves
   all rows or none. The review expires after 15 minutes; if rejected, review
   the CSV again.
4. The result displays a batch ID, count, and buttons to open each saved
   membership, even when the existing table search hides the records. Saved
   records show **CSV import** as their origin.
5. If the confirmation response is lost, it is uncertain whether records were
   saved. Retry the **same reviewed file** while the page remains open; after
   leaving, upload that same CSV again and confirm. An already-imported result
   returns the existing batch instead of creating a second copy. Do not edit
   the file while resolving an uncertain confirmation.

For mobile testing, the file picker and actions should stay within the viewport;
the 16-column proposal table scrolls **inside** the review panel. Cross-browser
testing is deferred to a separate task.