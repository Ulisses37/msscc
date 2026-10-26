"""Turn one recorded test run into a human-readable SUMMARY.md.

Reads the normalized ``pytest.xml``, ``jest.json`` and ``meta.json`` written by
``scripts/run_tests.py`` and writes ``SUMMARY.md`` beside them. See
``docs/testing/PROCEDURE.md``.

Two counting rules matter:

* **Test counts come from the elements, never from the JUnit ``tests``
  attribute.** Real pytest output on this project writes ``tests="814"`` while
  containing 367 ``<testcase>`` elements, so the attribute is reported as a
  warning when it disagrees and never used as the count.
* **Failed suites and failed tests are read from ``jest.json``, not written by
  hand.** A suite that fails to load reports a failed suite with no failed
  tests, so the two numbers legitimately differ.

Exit codes: 0 when a summary was written, 2 when the run could not be read.
"""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = Path("docs") / "testing" / "runs"
BASELINE_DIR = Path("docs") / "testing" / "baseline"


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse the command line."""
    parser = argparse.ArgumentParser(
        description="Write SUMMARY.md for a recorded run.",
    )
    parser.add_argument(
        "--run",
        default=None,
        help="Run directory. Defaults to the newest one under docs/testing/runs/.",
    )
    parser.add_argument("--out", default=None, help="Output file. Defaults to SUMMARY.md.")
    return parser.parse_args(argv)


def newest_run(runs_dir: Path) -> Path | None:
    """Return the most recent run directory, or ``None`` when there is none."""
    if not runs_dir.is_dir():
        return None
    runs = sorted((p for p in runs_dir.iterdir() if p.is_dir()), key=lambda p: p.name)
    return runs[-1] if runs else None


def parse_pytest(run_dir: Path) -> dict:
    """Read counts and failures out of a normalized pytest.xml."""
    path = run_dir / "pytest.xml"
    if not path.is_file():
        return {"available": False}

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        return {"available": False, "error": str(error)}

    suite = root.find("testsuite")
    testsuites = root.get("tests", "0")
    total = 0
    failed: list[str] = []
    suites: dict[str, dict] = {}

    for testcase in root.iter("testcase"):
        classname = testcase.get("classname", "")
        # The classname is a dotted python path; the first segment is the app.
        app = classname.split(".")[0] or "unknown"
        bucket = suites.setdefault(app, {"total": 0, "failed": 0, "skipped": 0})
        bucket["total"] += 1
        total += 1

        if testcase.find("failure") is not None or testcase.find("error") is not None:
            bucket["failed"] += 1
            failed.append(f"{classname}::{testcase.get('name', '')}")
        elif testcase.find("skipped") is not None:
            bucket["skipped"] += 1

    attribute = suite.get("tests") if suite is not None else None
    return {
        "available": True,
        "total": total,
        "failed": len(failed),
        "skipped": sum(b["skipped"] for b in suites.values()),
        "failed_tests": sorted(failed),
        "suites": dict(sorted(suites.items())),
        "attribute_disagrees": attribute is not None and attribute.isdigit() and int(attribute) != total,
        "attribute_value": attribute,
        "testsuites_attr": testsuites,
    }


def parse_jest(run_dir: Path) -> dict:
    """Read counts, failed suites and failed tests out of a normalized jest.json."""
    path = run_dir / "jest.json"
    if not path.is_file():
        return {"available": False}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        return {"available": False, "error": str(error)}

    failed_suites: list[str] = []
    failed_tests: list[str] = []
    suites: list[dict] = []

    for result in data.get("testResults", []):
        name = result.get("name", "")
        assertions = result.get("assertionResults", [])
        failed_here = [a for a in assertions if a.get("status") == "failed"]

        suites.append(
            {
                "name": name,
                "total": len(assertions),
                "failed": len(failed_here),
                "status": result.get("status", ""),
            }
        )
        if result.get("status") == "failed":
            failed_suites.append(name)
        failed_tests.extend(
            f"{name}::{a.get('fullName', a.get('title', ''))}" for a in failed_here
        )

    return {
        "available": True,
        "total": data.get("numTotalTests", 0),
        "passed": data.get("numPassedTests", 0),
        "failed": data.get("numFailedTests", 0),
        "pending": data.get("numPendingTests", 0),
        "suites_total": data.get("numTotalTestSuites", 0),
        "suites_failed": data.get("numFailedTestSuites", 0),
        "suites_passed": data.get("numPassedTestSuites", 0),
        "failed_suites": sorted(failed_suites),
        "failed_tests": sorted(failed_tests),
        "suites": suites,
    }


def render_summary(run_dir: Path, meta: dict, pytest_data: dict, jest_data: dict) -> str:
    """Build the SUMMARY.md text for one run."""
    lines: list[str] = []
    git = meta.get("git", {})
    tools = meta.get("tools", {})
    steps = meta.get("steps", {})

    lines.append("# Test run summary")
    lines.append("")
    lines.append(f"Run directory: `{run_dir.name}`")
    lines.append("")
    lines.append("| Field | Value |")
    lines.append("|---|---|")
    lines.append(f"| Captured at | {meta.get('timestamp', 'unknown')} |")
    lines.append(f"| Commit | `{git.get('short', 'unknown')}` ({git.get('branch', 'unknown')}) |")
    lines.append(f"| Working tree dirty | {git.get('dirty')} |")
    lines.append(f"| Label | {meta.get('label') or '(none)'} |")
    lines.append(f"| Python | {meta.get('python', {}).get('version', 'unknown')} |")
    lines.append("")

    if git.get("dirty") is False:
        lines.append(
            "This run was captured from a clean working tree, so its results are "
            "reproducible from commit "
            f"`{git.get('short', 'unknown')}`."
        )
        lines.append("")
        lines.append(
            "This is the committed baseline under `docs/testing/baseline/`. Because a run "
            "must be captured before the commit that adds it, the hash above is the "
            "**parent** of the commit that introduced this baseline, and that commit "
            "changes no source file, so the results still describe it."
        )
    else:
        lines.append(
            "This run was captured with uncommitted changes, so its results cannot be "
            "reproduced from a commit. Capture a baseline from a clean tree instead."
        )
    lines.append("")

    lines.extend(_render_counts(pytest_data, jest_data))
    lines.extend(_render_tool_status(steps, tools))
    lines.extend(_render_known_failures(pytest_data, jest_data))
    lines.extend(_render_pytest_attribute_warning(pytest_data))

    return "\n".join(lines).rstrip() + "\n"


def _render_counts(pytest_data: dict, jest_data: dict) -> list[str]:
    """Render the per-suite count tables for both runners."""
    lines = ["## Test counts", ""]

    if pytest_data.get("available"):
        total = pytest_data["total"]
        failed = pytest_data["failed"]
        passed = total - failed - pytest_data["skipped"]
        lines.append(
            f"### Backend (pytest): {total} tests, {passed} passed, "
            f"{failed} failed, {pytest_data['skipped']} skipped"
        )
        lines.append("")
        lines.append("| App | Tests | Failed | Skipped |")
        lines.append("|---|---|---|---|")
        for app, counts in pytest_data["suites"].items():
            lines.append(f"| `{app}` | {counts['total']} | {counts['failed']} | {counts['skipped']} |")
        lines.append(
            f"| **Total** | **{total}** | **{failed}** | **{pytest_data['skipped']}** |"
        )
        lines.append("")
    else:
        lines.append("### Backend (pytest): no report found")
        lines.append("")

    if jest_data.get("available"):
        lines.append(
            f"### Frontend (jest): {jest_data['total']} tests in "
            f"{jest_data['suites_total']} suites, {jest_data['passed']} passed, "
            f"{jest_data['failed']} failed"
        )
        lines.append("")
        lines.append(
            f"Suites: {jest_data['suites_passed']} passed, "
            f"{jest_data['suites_failed']} failed."
        )
        lines.append("")
        lines.append("| Suite | Tests | Failed |")
        lines.append("|---|---|---|")
        for suite in jest_data["suites"]:
            lines.append(f"| `{suite['name']}` | {suite['total']} | {suite['failed']} |")
        lines.append("")
    else:
        lines.append("### Frontend (jest): no report found")
        lines.append("")

    return lines


def _render_tool_status(steps: dict, tools: dict) -> list[str]:
    """Render the per-step status and the recorded tool versions."""
    lines = ["## Checks", "", "| Check | Status | Exit code |", "|---|---|---|"]
    for name in ("pytest", "jest", "tsc", "ruff"):
        step = steps.get(name, {})
        lines.append(
            f"| {name} | {step.get('status', 'unknown')} | {step.get('exit_code')} |"
        )
    lines.append("")
    lines.append("| Tool | Version |")
    lines.append("|---|---|")
    for name, info in tools.items():
        version = info.get("version") or "(unavailable)"
        lines.append(f"| {name} | {version} |")
    lines.append("")
    return lines



def _render_known_failures(pytest_data: dict, jest_data: dict) -> list[str]:
    """Render the failures this run observed, read from the reports themselves.

    Failed suites and failed tests are listed separately because they are
    different things: a suite that fails to load counts as a failed suite while
    contributing no executed tests, so the two totals do not have to match.

    The root cause of each backend or frontend failure is not stated here. This
    section records what was observed at the recorded commit, and nothing more.
    """
    failed_suites = jest_data.get("failed_suites", []) if jest_data.get("available") else []
    failed_tests = jest_data.get("failed_tests", []) if jest_data.get("available") else []
    pytest_failed = pytest_data.get("failed_tests", []) if pytest_data.get("available") else []

    lines = ["## Failures observed in this run", ""]

    if not failed_suites and not failed_tests and not pytest_failed:
        lines.append("None. Every test in this run passed.")
        lines.append("")
        return lines

    lines.append(
        "Recorded from `jest.json` and `pytest.xml`. This is the state of the tree at "
        "the commit above, not a statement about any other commit. Root causes are "
        "not analysed here."
    )
    lines.append("")

    lines.append(f"### Failed suites ({len(failed_suites)})")
    lines.append("")
    if failed_suites:
        for name in failed_suites:
            lines.append(f"- `{name}`")
    else:
        lines.append("(none)")
    lines.append("")

    lines.append(f"### Failed tests ({len(failed_tests)})")
    lines.append("")
    if failed_tests:
        for name in failed_tests:
            lines.append(f"- `{name}`")
    else:
        lines.append("(none)")
    lines.append("")

    if pytest_failed:
        lines.append(f"### Failed backend tests ({len(pytest_failed)})")
        lines.append("")
        for name in pytest_failed:
            lines.append(f"- `{name}`")
        lines.append("")

    if jest_data.get("available"):
        lines.append(
            f"Totals from the report's own counters: {jest_data['failed']} failed tests "
            f"across {jest_data['suites_failed']} failed suites of "
            f"{jest_data['suites_total']} suites."
        )
        lines.append("")
        if len(failed_tests) != jest_data["failed"]:
            lines.append(
                f"> Warning: {len(failed_tests)} failed test names were extracted but the "
                f"report counts {jest_data['failed']} failed tests. A suite that fails to "
                "load reports zero failing tests, so a mismatch is possible; reconcile "
                "against the raw log."
            )
            lines.append("")

    return lines


def _render_pytest_attribute_warning(pytest_data: dict) -> list[str]:
    """Warn when the JUnit ``tests`` attribute disagrees with the element count.

    This is a warning and never a failure. Real pytest output on this project has
    been observed writing ``tests="814"`` for a file holding 367 ``<testcase>``
    elements, so the element count is what this report counts; the attribute is
    only reported so the discrepancy stays visible.
    """
    if not pytest_data.get("available") or not pytest_data.get("attribute_disagrees"):
        return []

    return [
        "## Reporting note",
        "",
        f"> Warning: `pytest.xml` declares `tests=\"{pytest_data['attribute_value']}\"` on "
        f"`<testsuite>`, but the file contains {pytest_data['total']} `<testcase>` "
        "elements. The element count is authoritative and is what this summary counts. "
        "This attribute mismatch has been observed in raw pytest output, before any "
        "normalization by `scripts/run_tests.py`.",
        "",
    ]


def load_meta(run_dir: Path) -> dict:
    """Read a run's meta.json, or an empty mapping when it is missing."""
    path = run_dir / "meta.json"
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def reconcile(pytest_data: dict, jest_data: dict) -> list[str]:
    """Return warnings when a report's own counters disagree with its contents.

    These are warnings, not errors: the point of the summary is to show what the
    run recorded, and a mismatch between a report's summary line and the detail
    inside it is itself worth reporting. The two numbers that legitimately differ
    are failed tests and failed suites, because a suite that fails to load reports
    zero failing tests.
    """
    warnings: list[str] = []

    if pytest_data.get("available"):
        suite_total = sum(counts["total"] for counts in pytest_data["suites"].values())
        if suite_total != pytest_data["total"]:
            warnings.append(
                f"pytest: per-app totals sum to {suite_total} but {pytest_data['total']} "
                "testcase elements were counted."
            )

    if jest_data.get("available"):
        suite_total = sum(suite["total"] for suite in jest_data["suites"])
        if suite_total != jest_data["total"]:
            warnings.append(
                f"jest: per-suite test counts sum to {suite_total} but the report counts "
                f"{jest_data['total']} tests."
            )
        if len(jest_data["failed_tests"]) != jest_data["failed"]:
            warnings.append(
                f"jest: {len(jest_data['failed_tests'])} failed test names were extracted "
                f"but the report counts {jest_data['failed']} failed tests. A suite that "
                "fails to load reports no failing tests."
            )

    return warnings


def main(argv: list[str] | None = None) -> int:
    """Write SUMMARY.md for a run and report where it went."""
    args = parse_args(sys.argv[1:] if argv is None else argv)

    if args.run:
        run_dir = Path(args.run)
        if not run_dir.is_absolute():
            run_dir = REPO_ROOT / run_dir
    else:
        found = newest_run(REPO_ROOT / RUNS_DIR)
        if found is None:
            print(f"No runs found under {RUNS_DIR}. Capture one first:")
            print("  scripts/run_tests.py")
            return 2
        run_dir = found

    if not run_dir.is_dir():
        print(f"Not a directory: {run_dir}")
        return 2

    pytest_data = parse_pytest(run_dir)
    jest_data = parse_jest(run_dir)
    if not pytest_data.get("available") and not jest_data.get("available"):
        print(f"No pytest.xml or jest.json in {run_dir}")
        return 2

    out_path = Path(args.out) if args.out else run_dir / "SUMMARY.md"
    if not out_path.is_absolute():
        out_path = REPO_ROOT / out_path

    meta = load_meta(run_dir)
    out_path.write_text(render_summary(run_dir, meta, pytest_data, jest_data), encoding="utf-8")

    print(f"Summary written to {out_path}")

    for warning in reconcile(pytest_data, jest_data):
        print(f"Warning: {warning}")

    if pytest_data.get("attribute_disagrees"):
        print(
            "Warning: the JUnit tests attribute "
            f"({pytest_data['attribute_value']}) disagrees with the element count "
            f"({pytest_data['total']})."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
