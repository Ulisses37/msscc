# MSSCC Test Procedure

**SCRUM Lords | CSUS Computer Science Senior Project**

How to run every test and check in this repository the same way on every machine,
so a run can be recorded, compared against a previous run, and traced back to a
commit. The story that adds the recording scripts is SCRUM-786.

Repo: https://github.com/Ulisses37/msscc

## Version

| Field | Value |
|---|---|
| Procedure version | 1.0 |
| Verified against commit | `d110879` |
| Verified on | 2026-10-25 |
| Author | SCRUM Lords |

Changes to this file are traceable through this table. Bump the version and add a
row whenever a step, a version pin, or a command changes.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-25 | First version. Documents the pytest, jest, `tsc` and ruff runners and the recorded run layout. |

Related documents:

- [Developer Setup Guide](../MSSCC_Dev_Setup_Guide.md) covers installing Git,
  Python, Node, the database and the virtual environment. This document assumes
  that setup is already done and starts from a working clone.
- [Coding Style Guide](../coding-style-guide.md) is the source for the testing
  conventions this procedure runs.

## 1. Environment

The repository targets **Python 3.12**, and CI uses 3.12. The local virtual
environment in `backend/venv/` currently reports **Python 3.13.2**, so the three
do not agree today. The mismatch is recorded here on purpose, and this story
changes nothing about it: the virtual environment is not rebuilt, and
`backend/ruff.toml`, `backend/pytest.ini` and `.github/workflows/ci.yml` are
untouched.

| Where | Python | Set by |
|---|---|---|
| Local virtual environment, `backend/venv/` | 3.13.2 (observed) | how the venv was created on each machine |
| Project target | 3.12 | `backend/ruff.toml` (`target-version = "py312"`) and the Developer Setup Guide, section 3 |
| CI | 3.12 | `.github/workflows/ci.yml`, job `lint-backend` (`python-version: '3.12'`) |

Practical consequence: the venv is what runs `pytest` and `ruff` locally, so a
local run executes on 3.13.2 while CI's ruff job executes on 3.12. Ruff is told
to target 3.12, so lint results are comparable, but a Python 3.13-only
interpreter still refuses to import code that uses syntax 3.12 accepts. Treat any
3.13-only behavior in a local run as a local artifact, not a result, and report
it rather than working around it.

Record the interpreter you actually used. `scripts/run_tests.py` writes it into
`meta.json`, which is the point of the recorded run log.

| Tool | Version | Source of the pin |
|---|---|---|
| Python (project target) | 3.12 | `backend/ruff.toml`, Developer Setup Guide section 3 |
| Python (CI) | 3.12 | `.github/workflows/ci.yml` |
| Python (local venv, observed) | 3.13.2 | `backend/venv/` on the machine that captured the baseline |
| Django | 6.0.3 | `backend/requirements.txt` |
| pytest | 9.1.1 | `backend/requirements-dev.txt` |
| pytest-django | 4.14.0 | `backend/requirements-dev.txt` |
| ruff | 0.16.9 | `backend/requirements-dev.txt`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml` |
| Node | 22.14.0 | `frontend/.nvmrc` |
| jest | 29.7.0 | `frontend/package.json` (`^29.7`) |
| TypeScript | 5.9.3 | resolved by `frontend/package-lock.json` |
| ESLint | 8.57.1 | resolved by `frontend/package-lock.json` |

The three ruff pins (`backend/requirements-dev.txt`, the `rev` and
`additional_dependencies` in `.pre-commit-config.yaml`, and the `pip install` in
`.github/workflows/ci.yml`) are bumped together by convention.


## 2. Install

From the repo root. The virtual environment already exists in the repository;
`backend/venv/` is not recreated here, so do not run `python -m venv`.

```powershell
# Windows
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt -r backend\requirements-dev.txt
npm --prefix frontend ci
```

```bash
# macOS or Linux
backend/venv/bin/python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
npm --prefix frontend ci
```

`npm ci` needs `frontend/package-lock.json`, which is committed. Use it rather
than `npm install` so every machine resolves the same tool versions.

Never use bare `python`, `py`, `pip` or `ruff`. On most machines those point at a
system interpreter that does not have the project's packages.

## 3. Run every check

The four runners below are the whole set. Each is read-only and safe to run at
any time.

```powershell
# Windows, from the repo root
backend\venv\Scripts\python.exe -m pytest backend
npm --prefix frontend test
npx --prefix frontend tsc --noEmit -p frontend
backend\venv\Scripts\python.exe -m ruff check backend
```

```bash
# macOS or Linux, from the repo root
backend/venv/bin/python -m pytest backend
npm --prefix frontend test
npx --prefix frontend tsc --noEmit -p frontend
backend/venv/bin/python -m ruff check backend
```

One app, file, class or test also works:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\emails\tests.py
backend\venv\Scripts\python.exe -m pytest backend\emails\tests.py::SubscribeEndpointTests
```

Notes:

- `npm --prefix frontend run test:watch` re-runs on every save and never exits,
  so do not put it in a script.
- Backend tests run against in-memory SQLite through
  `backend/config/settings/test.py`. They never touch the shared development
  Postgres, and `backend/manage.py test` is not used because it would.
- `pytest` is the runner, not `manage.py test`. The pytest configuration lives in
  `backend/pytest.ini`.

## 4. Run everything as one recorded run

One command runs all four checks and writes a machine-readable log:

```powershell
# Windows
backend\venv\Scripts\python.exe scripts\run_tests.py
```

```bash
# macOS or Linux
backend/venv/bin/python scripts/run_tests.py
```

It writes to `docs/testing/runs/<timestamp>-<short-hash>/`:

| File | Produced by |
|---|---|
| `pytest.xml` | pytest, JUnit XML, paths normalized |
| `pytest-summary.txt` | pytest's own summary line, path-stripped |
| `jest.json` | jest, JSON reporter, paths normalized |
| `jest.log` | jest, human-readable output |
| `tsc.log` | `tsc --noEmit` |
| `ruff.log` | `ruff check backend` |
| `meta.json` | the script: timestamp, git commit, interpreter and tool versions |

Useful options: `--label <name>` to tag a run, `--skip pytest` (repeatable) to
skip a runner, `--python <path>` to point at a different interpreter, and
`--runs-dir <dir>`. Exit code 0 means every check passed, 1 means a check failed,
and 2 means the command could not run at all.

`docs/testing/runs/` is gitignored. Only `docs/testing/baseline/` is committed.

Two things the script does on purpose, both to keep a recorded run portable:

- **Paths are normalized before the files are written.** jest's JSON reporter and
  pytest's JUnit XML both emit absolute file paths, and the JUnit XML also
  carries a hostname. They are rewritten as repository-relative paths and the
  hostname is dropped, so two machines on different drive layouts produce the
  same file contents.
- **Nothing volatile is treated as a result.** Timestamps, durations and the
  commit hash are recorded as information, not as differences. See section 6.

JSON output flags are passed by the script, not baked into `backend/pytest.ini` or
`frontend/package.json`, so a plain `pytest` or `npm test` stays side-effect free.
This is a deliberate deviation from the file list in the SCRUM-786 story.

### Tests and subtests

The backend suite uses `subTest()` for table-driven cases, and those subtests are
**not separate tests**. They run inside the test that contains them, which has two
consequences worth knowing before reading any count:

- pytest's summary reads `367 passed, 447 subtests passed`. The JUnit
  `<testsuite tests="...">` attribute adds the two together and declares `814`,
  which is **by design, not a defect**. A test count read from that attribute is
  wrong; read `SUMMARY.md`, which counts `<testcase>` elements and reports subtests
  on their own line.
- **A subtest failure is not a separate `<testcase>`.** It is an extra `<failure>`
  child on the parent test's one element. Three failing subtests in one test
  produce one `<testcase>`, one element-level failure flag, and three `<failure>`
  children. `scripts/summarize.py` and `scripts/compare_runs.py` both count
  failure children, so three failing subtests are reported as three failures
  rather than one.

`SUMMARY.md` names a failing subtest by its parameters, read from pytest's
`SUBFAILED(...)` line, for example
`...::test_name [subTest(value='plaintext')]`. When the parameters cannot be
recovered, the failure is identified by position instead, as `[subtest 2/3]`.
**Positional identifiers shift when a subtest is added, removed or reordered**, so
they can show up in `compare_runs.py` as a run of "newly failing" and "newly
passing" entries that is really just a reordering. Treat a positional pair like
that as a reordering until the underlying report says otherwise, and prefer a
run captured with `pytest-summary.txt` present so the parameter form is used.


## 5. Summarize a run

```powershell
backend\venv\Scripts\python.exe scripts\summarize.py --run docs\testing\runs\<run-dir>
```

With no `--run`, the newest run is used. It writes `SUMMARY.md` next to the raw
logs with passed, failed, skipped and error counts per suite, the status of the
`tsc` and ruff checks, the recorded tool versions, and a difference line against
the baseline when one exists. The counts come from the same `pytest.xml` and
`jest.json` the raw log holds, so the two can be checked against each other by
hand.

## 6. Compare two runs

```powershell
backend\venv\Scripts\python.exe scripts\compare_runs.py docs\testing\baseline docs\testing\runs\<run-dir>
```

Both arguments are optional: the baseline directory and the newest run are the
defaults. The comparison reports per-suite and total count changes, newly failing
tests, newly passing tests, tests present on only one side, tool version changes,
per-check status and exit code changes, and per-check log content changes. Exit
code 0 means no differences, 1 means differences were found, and 2 means a run
directory could not be read.

What counts as a difference, and what does not:

| Counted | Ignored (recorded for information only) |
|---|---|
| Test results, per suite and overall | The run timestamp and run directory name |
| Each check's `status` and `exit_code` | The commit hash, branch name and dirty flag |
| `ruff.log` and `tsc.log` contents | Every duration, including per-step seconds |
| Recorded tool versions | The platform and interpreter version |

Ignoring the second column is what makes a re-run on the same commit come back as
"No differences". Counting every item in the first column is what makes the
verdict meaningful: a check that flipped from `passed` to `failed`, or a log that
gained an error line, is reported even though no test changed.

A check's status and exit code are expected to agree. When a single run records
`passed` with a non-zero exit code, or `failed` with zero, the run is
self-contradictory and the comparison prints a warning. Warnings never change the
exit code; a difference does.

## 7. What the tests do not cover

**Resend is mocked in the backend tests.** No test calls the live Resend API, and
no test sends a real email. Shipping behavior against a real provider account is
therefore not covered by any run recorded here.

[COVERAGE.md](COVERAGE.md) lists the mocked boundaries and what a green run does
and does not prove. Read it before treating a passing run as evidence that a
provider integration works.

## 8. Adding a run to the baseline

The baseline is one complete run, captured from a **clean tree**, on the branch's
final code state. Never commit a run captured with uncommitted changes: it cannot
be reproduced from a commit.

```powershell
git status                       # must be clean before capturing
backend\venv\Scripts\python.exe scripts\run_tests.py --label baseline
backend\venv\Scripts\python.exe scripts\summarize.py
# copy the new run directory over docs/testing/baseline/
backend\venv\Scripts\python.exe scripts\compare_runs.py docs\testing\baseline docs\testing\runs\<new-run-dir>
```

Because the run has to be captured before the commit that adds it, the baseline's
`meta.json` carries the hash of its parent commit, and its `SUMMARY.md` says so.
That is expected, not a mistake. The baseline records the last committed state
the run was taken from, and the commit that adds it changes no source file.

---

*Last updated October 2026 -- SCRUM Lords*
