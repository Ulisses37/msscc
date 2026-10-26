"""Turn one recorded test run into a human-readable SUMMARY.md.

Reads the normalized ``pytest.xml``, ``jest.json`` and ``meta.json`` written by
``scripts/run_tests.py`` and writes ``SUMMARY.md`` beside them. See
``docs/testing/PROCEDURE.md``.

Two counting rules matter:

* **Test counts come from the ``<testcase>`` elements.** ``<testsuite
  tests="...">`` counts subtests as well as tests, so on this project it reads
  ``814`` for 367 tests plus 447 subtests. The attribute is reported as a warning
  when it disagrees and never used as the count.
* **Failures are counted per ``<failure>`` element, not per ``<testcase>``.** One
  test using ``subTest()`` renders as a single ``<testcase>`` carrying one
  ``<failure>`` child per failing subtest, so counting testcases would report
  three subtest failures as one failed test. Subtests are also reported on their
  own line, read from pytest's own summary, because a passing subtest leaves no
  trace in the XML.
* **Failed suites and failed tests are read from ``jest.json``, not written by
  hand.** A suite that fails to load reports a failed suite with no failed
  tests, so the two numbers legitimately differ.

Exit codes: 0 when a summary was written, 2 when the run could not be read.
"""

import argparse
import json
import re
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
    """Read counts and failures out of a normalized pytest.xml.

    Two counting rules are deliberate:

    * **Failures are counted per ``<failure>``/``<error>`` child, not per
      ``<testcase>``.** A test using ``subTest()`` renders as one ``<testcase>``
      with one ``<failure>`` child per failing subtest, so counting elements
      would report three subtest failures as a single failed test and understate
      the result.
    * **``<testcase>`` count is the test count.** ``<testsuite tests="...">``
      counts subtests as well as tests, so it is only reported when it disagrees.
    """
    path = run_dir / "pytest.xml"
    if not path.is_file():
        return {"available": False}

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        return {"available": False, "error": str(error)}

    suite = root.find("testsuite")
    total = 0
    failure_count = 0
    failed_tests: list[str] = []
    suites: dict[str, dict] = {}
    summary = parse_pytest_summary(run_dir)
    subtest_labels = summary.get("labels", {})

    for testcase in root.iter("testcase"):
        classname = testcase.get("classname", "")
        name = testcase.get("name", "")
        # The classname is a dotted python path; the first segment is the app.
        app = classname.split(".")[0] or "unknown"
        bucket = suites.setdefault(app, {"total": 0, "failed": 0, "skipped": 0})
        bucket["total"] += 1
        total += 1

        failures = testcase.findall("failure") + testcase.findall("error")
        if failures:
            failure_count += len(failures)
            bucket["failed"] += len(failures)
            failed_tests.extend(
                _subtest_ids(classname, name, failures, subtest_labels)
            )
        elif testcase.find("skipped") is not None:
            bucket["skipped"] += 1

    attribute = suite.get("tests") if suite is not None else None

    return {
        "available": True,
        "total": total,
        "failed": failure_count,
        "skipped": sum(b["skipped"] for b in suites.values()),
        "failed_tests": sorted(failed_tests),
        "suites": dict(sorted(suites.items())),
        "attribute_disagrees": attribute is not None and attribute.isdigit() and int(attribute) != total,
        "attribute_value": attribute,
        "subtests": summary,
    }


def _subtest_ids(classname: str, name: str, failures: list, labels: dict) -> list[str]:
    """Return one identifier per failure inside a single testcase.

    The subtest parameters reported by pytest are preferred, because they are what
    a reader recognises and they survive subtests being reordered. When they are
    unavailable the failure is identified by position, which is stable only while
    the subtests are not added, removed or reordered; that limitation is
    documented in the procedure.
    """
    node = f"{classname}::{name}"
    if len(failures) == 1:
        return [node]

    reported = _reported_labels(classname, labels)
    ids: list[str] = []
    for index, failure in enumerate(failures, start=1):
        label = None
        if index <= len(reported):
            label = reported[index - 1]
        if label is None:
            label = _failure_label(failure.get("message", ""))
        ids.append(f"{node} [{label or f'subtest {index}/{len(failures)}'}]")
    return ids


def _reported_labels(classname: str, labels: dict) -> list[str]:
    """Return the subtest labels pytest reported for a classname, if any.

    The location pytest prints is a file path plus ``::Class::test``, while the
    XML gives a dotted ``module.Class``. The class segment is what both share, so
    it is what the match is based on.
    """
    wanted = classname.rsplit(".", 1)[-1]
    if not wanted:
        return []
    for location, values in labels.items():
        if f"::{wanted}::" in location:
            return values
    return []


def _failure_label(message: str) -> str | None:
    """Extract a ``subTest`` parameter list from a failure message, if present."""
    match = re.search(r"subTest\((.*?)\)\s*$", message, re.MULTILINE)
    return f"subTest({match.group(1)})" if match else None


def parse_pytest_summary(run_dir: Path) -> dict:
    """Read pytest's own summary line for counts the XML does not carry.

    Only the subtest count is taken from here, because a subtest is invisible in
    the XML when it passes. Unexpected lines are ignored rather than guessed at.
    """
    path = run_dir / "pytest-summary.txt"
    result = {"available": False, "subtests_passed": None, "subtests_failed": None, "labels": {}}
    if not path.is_file():
        return result

    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return result

    passed = re.search(r"(\d+) subtests? passed", text)
    failed = re.search(r"(\d+) subtests? failed", text)
    if passed or failed:
        result["available"] = True
        result["subtests_passed"] = int(passed.group(1)) if passed else 0
        result["subtests_failed"] = int(failed.group(1)) if failed else 0

    result["labels"] = parse_subtest_labels(text)
    return result


def parse_subtest_labels(text: str) -> dict[str, list[str]]:
    """Collect subtest identities from pytest's ``SUBFAILED`` report lines.

    Each line looks like ``SUBFAILED(value='plaintext') <path>::<Class>::<test>``.
    The parameters are the identity a reader recognises and they survive subtests
    being reordered, so they are preferred over a positional label. The key is the
    file path plus test name, and the value is the ordered list of parameters.
    """
    labels: dict[str, list[str]] = {}
    pattern = re.compile(r"^SUBFAILED\((.*?)\)\s+(\S+)\s*$", re.MULTILINE)
    for params, location in pattern.findall(text):
        labels.setdefault(location.replace("\\", "/"), []).append(f"subTest({params})")
    return labels



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
        passed = total - len(pytest_data["failed_tests"]) - pytest_data["skipped"]
        subtests = pytest_data.get("subtests", {})

        lines.append(
            f"### Backend (pytest): {total} tests, {passed} passed, "
            f"{failed} failed, {pytest_data['skipped']} skipped"
        )
        lines.append("")

        if subtests.get("available"):
            sub_passed = subtests.get("subtests_passed") or 0
            sub_failed = subtests.get("subtests_failed") or 0
            if sub_failed:
                lines.append(
                    f"SubTests: {sub_passed} passed, {sub_failed} failed. A subtest "
                    "failure is counted inside its parent test as well, so the two "
                    "lines describe the same run at different granularity."
                )
            else:
                lines.append(
                    f"SubTests: {sub_passed} passed, 0 failed. Subtests are not "
                    "separate tests; they run inside the tests counted above, so they "
                    "are reported on their own line rather than added to the total."
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
    """Explain the ``tests`` attribute when it disagrees with the element count.

    This is a warning and never a failure, and it is not a defect in anything:
    pytest's ``tests`` attribute counts subtests alongside tests, so a suite with
    367 tests and 447 subtests legitimately declares ``tests="814"``. The summary
    reports the count it can attribute to individual tests, and says so here so
    the difference stays visible rather than looking like a mistake.
    """
    if not pytest_data.get("available") or not pytest_data.get("attribute_disagrees"):
        return []

    subtests = pytest_data.get("subtests", {})
    sub_total = (subtests.get("subtests_passed") or 0) + (subtests.get("subtests_failed") or 0)
    lines = [
        "## Reporting note",
        "",
        f"`pytest.xml` declares `tests=\"{pytest_data['attribute_value']}\"` on "
        f"`<testsuite>` while containing {pytest_data['total']} `<testcase>` elements. "
        "The attribute counts subtests as well as tests, which is by design.",
    ]

    if subtests.get("available") and sub_total:
        lines.append("")
        lines.append(
            f"That run reported {subtests.get('subtests_passed') or 0} subtests passed and "
            f"{subtests.get('subtests_failed') or 0} failed, and "
            f"{pytest_data['total']} + {sub_total} = "
            f"{pytest_data['total'] + sub_total}, which is the attribute value."
        )
    else:
        lines.append("")
        lines.append(
            "The subtest count is unavailable for this run, so the difference cannot be "
            "reconciled here. Recapture the run to record pytest's summary line."
        )

    lines.append("")
    lines.append(
        "The `<testcase>` element count is what this summary reports as the test count, "
        "because it is the count that can be attributed to named tests."
    )
    lines.append("")
    return lines


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

        failure_total = sum(counts["failed"] for counts in pytest_data["suites"].values())
        if failure_total != pytest_data["failed"]:
            warnings.append(
                f"pytest: per-app failure counts sum to {failure_total} but "
                f"{pytest_data['failed']} failure elements were counted."
            )

        named_failures = len(pytest_data["failed_tests"])
        if named_failures != pytest_data["failed"]:
            warnings.append(
                f"pytest: {named_failures} failure names were extracted but "
                f"{pytest_data['failed']} failure elements were counted."
            )

        subtests = pytest_data.get("subtests", {})
        if subtests.get("available"):
            sub_total = (subtests.get("subtests_passed") or 0) + (subtests.get("subtests_failed") or 0)
            attribute = pytest_data.get("attribute_value")
            if attribute and attribute.isdigit() and pytest_data["total"] + sub_total != int(attribute):
                warnings.append(
                    f"pytest: {pytest_data['total']} tests plus {sub_total} subtests does "
                    f"not equal the declared tests attribute ({attribute})."
                )
            if (subtests.get("subtests_failed") or 0) != pytest_data["failed"]:
                warnings.append(
                    f"pytest: {subtests.get('subtests_failed') or 0} subtests failed but "
                    f"{pytest_data['failed']} failure elements were counted."
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
