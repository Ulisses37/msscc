# Donation CSV import (SCRUM-843)

This guide is tracked in Git for admins and testers. The donation admin page
provides a template download and a summary of the rules. The ordered contract
in `backend/donations/donation_csv_contract.py` generates the actual CSV; neither
the download nor the page instructions are seeded database content. The
existing configurable CSV/XLSX donation exports are **not** import templates.

## Availability and safe testing

- SCRUM-881 provides the template download only; it has no upload or save path.
  The later SCRUM-882 endpoint adds backend-only validation without changing
  what was delivered at that first checkpoint.
- **SCRUM-882 added a read-only preview endpoint** at
  `POST /api/donations/import/preview/`. Send one multipart `file` containing
  the fixed CSV. The authorized response reports validated proposed rows and
  safe row/field errors. **SCRUM-883 adds** the admin upload/review controls and
  possible-duplicate warnings. Preview creates no donations; confirmation and
  batch results remain for later subtasks. The existing Add donation form
  creates one record, not a CSV batch.
- Run a frontend and backend version that both include the donation template
  and preview endpoints. Sign in as an active executive admin or an active
  admin with `Finances` access. Both endpoints independently check permission;
  anonymous, inactive, and unprivileged accounts cannot use them.
- The template has no donor details. Use only fictional data in test systems.
  Downloading it does not write financial records or require a new migration.
  Do not use production data or apply migrations to a shared development
  database without coordinating with the team.

## Fixed donation CSV contract

Choose **Download donation CSV template** on Admin > Donations. The downloaded
`donation-import-template.csv` contains **one header row and no example donors**.
Keep these ten columns in this exact order; each subsequent data row represents
one already-received offline or historical donation:

```text
amount,donation_date,is_anonymous,payment_method,donor_first_name,donor_last_name,donor_email,address,external_reference,message
```

| Field | Required | Allowed input and meaning |
| --- | --- | --- |
| `amount` | Yes | Known, positive USD decimal from `0.01` through `99999999.99`, with at most two decimal places. No currency symbol, thousands separator, sign, or exponent. Blank and zero are invalid. |
| `donation_date` | Yes | Known calendar date in `YYYY-MM-DD` or US month-first `MM-DD-YYYY` or `MM/DD/YYYY` format, no later than the date of recording. The review normalizes all three to `YYYY-MM-DD`. Mixed separators, shortened dates, and year-first dates with slashes are not accepted. Never substitute today's date for an unknown historical date. |
| `is_anonymous` | Yes | `true` or `false` in any letter case; surrounding spaces are ignored. Blank, `yes`, `no`, and `unknown` remain invalid. |
| `payment_method` | No | `cash`, `check`, or blank if the historical method is unknown. Do not guess from an external reference. |
| `donor_first_name`, `donor_last_name` | No | Historical names, or blank if unknown. Both must be blank when `is_anonymous` is `true`. |
| `donor_email` | No | A valid email, or blank if unknown. An anonymous donation may retain an optional email internally. |
| `address` | No | Historical address, or blank if unknown. Must be blank when `is_anonymous` is `true`. |
| `external_reference`, `message` | No | Historical reference/note, or blank. Neither controls the generated database reference. |

Blank optional contact fields mean **unknown**, not anonymous; a
non-anonymous donation can have no known contact details. Anonymous records
retain no donor names or address. Do not place identifying names or address in
anonymous rows, including in free-text notes.

These are **received** donations. Their status is server-set to `completed`,
and currency is USD. Neither is a CSV column. The importer does not charge a
card, calculate current online processing fees, send a receipt, or enroll a
donor in a mailing list. The template also excludes database IDs, record
origin, Stripe/checkout identifiers, and mailing-list consent.

Use UTF-8 CSV with the downloaded header, at most **1,048,576 bytes** and
**500 data rows**. Cell character limits: `amount` 11; `donation_date` 10;
`is_anonymous` 32 before normalization; `payment_method` 20; each donor name 255; `donor_email`
254; `address` 500; `external_reference` 255; `message` 500. Preserve all
columns, even when optional cells are blank. The backend preview enforces
these limits before showing proposed records in the admin upload interface.
If you edit the CSV in a spreadsheet, check that required date cells did not
become blank. The parser accepts `TRUE`, `False`, and surrounding spaces in
the `is_anonymous` column, but not a blank or an unknown value. If Excel
rewrites a known date as `MM-DD-YYYY` or `MM/DD/YYYY`, the importer accepts it
as month-first and shows the normalized ISO date in review. A missing historical date must be looked up in
the source records, not replaced with today's date. Re-export as UTF-8 CSV
before uploading the corrected file.

## Review-only upload (SCRUM-883)

On Admin > Donations, choose the filled CSV under **Review donation CSV**, then
select **Upload and review CSV**. This is a read-only step: even a valid review
does not create donations. The preview displays backend-normalized amounts,
dates, anonymity and payment methods, with unknown optional contacts left
unknown. Correct row/field errors in the original CSV and re-upload it; there
is no inline editor or column mapping. Close the review with **Cancel review**
without saving anything.

Warnings are possible matches for a human to assess, not automatic duplicate
decisions. A later row with identical validated facts is flagged as repeated.
An existing donation may be flagged when its amount and date match **and**
either a supplied nonblank external ledger reference or a known non-anonymous
first and last name also match. Email alone is never sufficient. Warnings do
not merge, discard or edit donations. Check **I have reviewed these donation
warnings** after examining them. Selecting a different file or re-uploading
starts a fresh review and clears that acknowledgment. **There is no Confirm
button or server-bound acknowledgment in SCRUM-883; reviewing warnings does
not authorize a save.**

## Planned workflow after later subtasks

Once the remaining donation-import subtasks are delivered, the intended flow
is: fill the fixed template, upload it for backend-validated read-only review,
correct any errors in the source CSV and re-upload, review possible duplicate
warnings and acknowledge them explicitly, then confirm the whole batch or
none. A matching email alone will not prove that two donations are duplicates.
Results will identify the batch and offer access to its saved donations, even
if the current list search hides them. A lost confirmation response must be
resolved by a safe retry or authorized batch lookup, not by assuming no rows
were saved. **The SCRUM-883 review cannot save; confirmation and result controls
do not exist yet.**