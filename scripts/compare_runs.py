"""Diff two recorded test runs.

Compares a baseline run against a later run and reports what changed. See
``docs/testing/PROCEDURE.md``.

**Only results count as differences.** Compared: test results, per-check status and
exit code, per-check log contents, and tool versions. Recorded but ignored:
timestamps, run directory names, the commit hash, branch name, dirty flag and all
durations. Without that rule a re-run on the same commit would always report
differences, and the "empty diff" check would be useless.

Results are keyed per failure, not per test. A pytest test using ``subTest()``
renders as one ``<testcase>`` per test with one ``<failure>`` child per failing
subtest, so keying per test would hide a subtest that newly broke inside a test
that was already failing. A subtest failure is identified by its parameters when
the message carries them, and by position otherwise; positional keys shift when
subtests are added, removed or reordered, which the procedure documents.

Exit codes: 0 when the two runs match, 1 when differences were found, 2 when a run
directory could not be read. The distinction lets a reviewer or a future CI job
gate on a changed test result.
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
        description="Compare a baseline test run against another run.",
    )
    parser.add_argument("baseline", nargs="?", default=str(BASELINE_DIR), help="Baseline run.")
    parser.add_argument("run", nargs="?", default=None, help="Run to compare. Newest by default.")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    parser.add_argument("--out", default=None, help="Write to a file instead of stdout.")
    return parser.parse_args(argv)


def newest_run(runs_dir: Path) -> Path | None:
    """Return the most recent run directory, or ``None`` when there is none."""
    if not runs_dir.is_dir():
        return None
    runs = sorted((p for p in runs_dir.iterdir() if p.is_dir()), key=lambda p: p.name)
    return runs[-1] if runs else None


def resolve_run(value: str) -> Path:
    """Resolve a run path given on the command line."""
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def read_pytest(run_dir: Path) -> dict | None:
    """Return the test node ids and per-app counts from a pytest.xml.

    Failures are keyed one entry per ``<failure>``/``<error>`` child, matching
    ``summarize.py``. A single test using ``subTest()`` carries one child per
    failing subtest, so keying per testcase would hide a subtest that newly
    started failing inside a test that was already failing.
    """
    path = run_dir / "pytest.xml"
    if not path.is_file():
        return None

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return None

    results: dict[str, str] = {}
    per_app: dict[str, dict] = {}
    subtest_labels = read_subtest_labels(run_dir)

    for testcase in root.iter("testcase"):
        classname = testcase.get("classname", "")
        name = testcase.get("name", "")
        app = classname.split(".")[0] or "unknown"
        node = f"{classname}::{name}"
        bucket = per_app.setdefault(app, {"passed": 0, "failed": 0, "skipped": 0})
        bucket["tests"] = bucket.get("tests", 0) + 1

        failures = testcase.findall("failure") + testcase.findall("error")
        if failures:
            results.update({key: "failed" for key in _failure_keys(node, failures, subtest_labels)})
            bucket["failed"] += len(failures)
        elif testcase.find("skipped") is not None:
            results[node] = "skipped"
            bucket["skipped"] += 1
        else:
            results[node] = "passed"
            bucket["passed"] += 1

    return {"results": results, "per_app": per_app, "total": len(results)}


def read_subtest_labels(run_dir: Path) -> dict[str, list[str]]:
    """Collect subtest identities from pytest's ``SUBFAILED`` report lines.

    Each line looks like ``SUBFAILED(value='plaintext') <path>::<Class>::<test>``.
    The parameters are what a reader recognises and they survive subtests being
    reordered, so they are preferred over a positional label.
    """
    path = run_dir / "pytest-summary.txt"
    if not path.is_file():
        return {}

    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}

    labels: dict[str, list[str]] = {}
    location_pattern = re.compile(r"^SUBFAILED\((.*?)\)\s+(\S+)\s*$", re.MULTILINE)
    for params, location in location_pattern.findall(text):
        normalized = location.replace("\\", "/")
        labels.setdefault(normalized, []).append(f"subTest({params})")
    return labels


def _failure_keys(node: str, failures: list, labels: dict) -> list[str]:
    """Return one key per failure inside a single testcase.

    The subtest parameters reported by pytest are preferred, because they are what
    a reader recognises and they survive subtests being reordered. When they are
    unavailable the failure is keyed by position, which only stays stable while
    the subtests are not added, removed or reordered; that limitation is
    documented in the procedure.
    """
    if len(failures) == 1:
        return [node]

    class_segment = node.split("::")[0].rsplit(".", 1)[-1]
    reported: list[str] = []
    for location, values in labels.items():
        if f"::{class_segment}::" in location:
            reported = values
            break

    keys: list[str] = []
    for index, failure in enumerate(failures, start=1):
        label = reported[index - 1] if index <= len(reported) else None
        if label is None:
            match = re.search(r"subTest\((.*?)\)\s*$", failure.get("message", ""), re.MULTILINE)
            label = f"subTest({match.group(1)})" if match else None
        keys.append(f"{node} [{label or f'subtest {index}/{len(failures)}'}]")
    return keys


def read_jest(run_dir: Path) -> dict | None:
    """Return the test full names and per-suite counts from a jest.json."""
    path = run_dir / "jest.json"
    if not path.is_file():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    results: dict[str, str] = {}
    per_suite: dict[str, dict] = {}

    for suite in data.get("testResults", []):
        name = suite.get("name", "")
        counts = per_suite.setdefault(name, {"passed": 0, "failed": 0, "skipped": 0})

        for assertion in suite.get("assertionResults", []):
            key = f"{name}::{assertion.get('fullName', assertion.get('title', ''))}"
            status = assertion.get("status", "")
            if status == "failed":
                counts["failed"] += 1
            elif status in ("pending", "todo", "skipped"):
                counts["skipped"] += 1
                status = "skipped"
            else:
                counts["passed"] += 1
            results[key] = status

        # A suite that fails to load has no assertion results at all, so the
        # suite status is the only signal that something went wrong.
        if suite.get("status") == "failed" and counts["failed"] == 0:
            counts["failed"] += 1

    return {"results": results, "per_suite": per_suite, "total": len(results)}


def read_versions(run_dir: Path) -> dict:
    """Return the recorded tool versions from a run's meta.json."""
    path = run_dir / "meta.json"
    if not path.is_file():
        return {}
    try:
        meta = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {name: info.get("version", "") for name, info in meta.get("tools", {}).items()}


def read_steps(run_dir: Path) -> dict:
    """Return each check's status and exit code from a run's meta.json.

    Both fields are read because both are results. A status change alone and an
    exit-code change alone are each a difference, so keeping only the status here
    would hide half of what a reviewer needs to see.
    """
    path = run_dir / "meta.json"
    if not path.is_file():
        return {}
    try:
        meta = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {
        name: {"status": info.get("status", ""), "exit_code": info.get("exit_code")}
        for name, info in meta.get("steps", {}).items()
    }


def read_logs(run_dir: Path) -> dict:
    """Return the contents of each check's log file, path-normalized.

    ``ruff.log`` and ``tsc.log`` hold the output of a check, so a change in them
    is a change in what that check reported even when the exit code stays 0. Only
    line endings and trailing whitespace are normalized, so a real one-character
    change in a message is still visible.
    """
    logs: dict[str, str] = {}
    for name in ("ruff.log", "tsc.log"):
        path = run_dir / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        logs[name] = "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n"))
    return logs


def diff_logs(baseline: dict, current: dict) -> list[dict]:
    """List log files whose contents differ between two runs."""
    rows: list[dict] = []
    for name in sorted(baseline.keys() | current.keys()):
        before = baseline.get(name)
        after = current.get(name)
        if before == after:
            continue
        rows.append(
            {
                "file": name,
                "present_in_baseline": before is not None,
                "present_in_current": after is not None,
                "baseline_lines": len(before.split("\n")) if before is not None else None,
                "current_lines": len(after.split("\n")) if after is not None else None,
            }
        )
    return rows


def diff_results(baseline: dict | None, current: dict | None) -> dict:
    """Compare two runs' test results, matched by test name."""
    if baseline is None or current is None:
        return {"available": False}

    base = baseline["results"]
    now = current["results"]

    newly_failing = sorted(name for name, status in now.items() if status == "failed" and base.get(name) != "failed")
    newly_passing = sorted(
        name for name, status in now.items() if status == "passed" and base.get(name) == "failed"
    )
    only_in_baseline = sorted(base.keys() - now.keys())
    only_in_current = sorted(now.keys() - base.keys())

    return {
        "available": True,
        "baseline_total": len(base),
        "current_total": len(now),
        "newly_failing": newly_failing,
        "newly_passing": newly_passing,
        "only_in_baseline": only_in_baseline,
        "only_in_current": only_in_current,
    }


def diff_counts(baseline: dict, current: dict, key: str) -> list[dict]:
    """Compare per-group counts between two runs, matched by group name."""
    left = baseline.get(key, {})
    right = current.get(key, {})
    rows: list[dict] = []

    for group in sorted(left.keys() | right.keys()):
        before = left.get(group, {"passed": 0, "failed": 0, "skipped": 0})
        after = right.get(group, {"passed": 0, "failed": 0, "skipped": 0})
        changes = {
            field: after.get(field, 0) - before.get(field, 0)
            for field in ("passed", "failed", "skipped")
        }
        if any(changes.values()):
            rows.append(
                {
                    "group": group,
                    "before": sum(before.values()),
                    "after": sum(after.values()),
                    **changes,
                }
            )
    return rows


def diff_versions(baseline: dict, current: dict) -> list[dict]:
    """List tool versions that differ between two runs."""
    rows: list[dict] = []
    for tool in sorted(baseline.keys() | current.keys()):
        before = baseline.get(tool, "")
        after = current.get(tool, "")
        if before != after:
            rows.append({"tool": tool, "baseline": before, "current": after})
    return rows


def diff_steps(baseline: dict, current: dict) -> list[dict]:
    """Compare each check's status and exit code between two runs.

    Every step is compared by name rather than by position, and both fields count.
    A step that changed only its exit code, or only its status, is a difference.
    """
    rows: list[dict] = []
    for name in sorted(baseline.keys() | current.keys()):
        before = baseline.get(name, {})
        after = current.get(name, {})
        changes = [
            field
            for field in ("status", "exit_code")
            if before.get(field) != after.get(field)
        ]
        if changes:
            rows.append(
                {
                    "step": name,
                    "fields": changes,
                    "baseline_status": before.get("status"),
                    "current_status": after.get("status"),
                    "baseline_exit_code": before.get("exit_code"),
                    "current_exit_code": after.get("exit_code"),
                }
            )
    return rows


def inconsistent_steps(steps: dict) -> list[str]:
    """List steps whose own status and exit code disagree within one run.

    A run should never record ``passed`` with a non-zero exit code, or ``failed``
    with a zero one. When it does, the recorded run is self-contradictory, which is
    reported as a warning rather than silently trusted.
    """
    problems: list[str] = []
    for name, step in sorted(steps.items()):
        status = step.get("status")
        code = step.get("exit_code")
        if status == "skipped" or code is None:
            continue
        if status == "passed" and code != 0:
            problems.append(f"{name}: status 'passed' but exit code {code}")
        elif status == "failed" and code == 0:
            problems.append(f"{name}: status 'failed' but exit code 0")
    return problems


def has_differences(report: dict) -> bool:
    """Report whether anything counts as a difference between the two runs.

    Every category the report carries is consulted, step status included. What is
    deliberately left out is what ``build_report`` never collects: timestamps, run
    directory names, commit hashes, branch names, dirty flags and durations.
    """
    for section in ("pytest", "jest"):
        results = report[section]["results"]
        if not results.get("available", False):
            return True
        if any(
            results[field]
            for field in ("newly_failing", "newly_passing", "only_in_baseline", "only_in_current")
        ):
            return True
        if results["baseline_total"] != results["current_total"]:
            return True
        if report[section]["counts"]:
            return True

    if report["versions"]:
        return True
    if report["steps"]:
        return True
    if report["logs"]:
        return True

    return False



def build_report(baseline_dir: Path, current_dir: Path) -> dict:
    """Build the comparison report for two run directories."""
    base_pytest = read_pytest(baseline_dir)
    base_jest = read_jest(baseline_dir)
    now_pytest = read_pytest(current_dir)
    now_jest = read_jest(current_dir)
    base_steps = read_steps(baseline_dir)
    now_steps = read_steps(current_dir)

    return {
        "baseline_dir": baseline_dir.name,
        "current_dir": current_dir.name,
        "pytest": {
            "counts": diff_counts(base_pytest or {}, now_pytest or {}, "per_app"),
            "results": diff_results(base_pytest, now_pytest),
        },
        "jest": {
            "counts": diff_counts(base_jest or {}, now_jest or {}, "per_suite"),
            "results": diff_results(base_jest, now_jest),
        },
        "versions": diff_versions(read_versions(baseline_dir), read_versions(current_dir)),
        "steps": diff_steps(base_steps, now_steps),
        "logs": diff_logs(read_logs(baseline_dir), read_logs(current_dir)),
        "step_table": {"baseline": base_steps, "current": now_steps},
        "warnings": inconsistent_steps(base_steps) + [
            f"compared run: {problem}" for problem in inconsistent_steps(now_steps)
        ],
    }


def render_markdown(report: dict) -> str:
    """Render a comparison report as Markdown."""
    lines: list[str] = [
        "# Test run comparison",
        "",
        f"Baseline: `{report['baseline_dir']}`",
        f"Compared against: `{report['current_dir']}`",
        "",
        "Only test results, check status and exit codes, tool versions and check log "
        "contents are compared. Timestamps, run directory names, commit hashes, branch "
        "names, dirty flags and durations are informational and are ignored on purpose.",
        "",
    ]

    for key, label in (("pytest", "Backend (pytest)"), ("jest", "Frontend (jest)")):
        section = report[key]
        lines.append(f"## {label}")
        lines.append("")

        results = section["results"]
        if not results.get("available", False):
            lines.append("A report is missing on one side, so this suite was not compared.")
            lines.append("")
            continue

        lines.append(
            f"Tests: {results['baseline_total']} in the baseline, "
            f"{results['current_total']} now. Counts include one entry per failure, so a "
            "test with several failing subtests contributes several entries."
        )
        lines.append("")

        for field, heading in (
            ("newly_failing", "Newly failing"),
            ("newly_passing", "Newly passing"),
            ("only_in_baseline", "Only in the baseline"),
            ("only_in_current", "Only in the current run"),
        ):
            lines.append(f"### {heading} ({len(results[field])})")
            lines.append("")
            if results[field]:
                for name in results[field]:
                    lines.append(f"- `{name}`")
            else:
                lines.append("(none)")
            lines.append("")

        lines.append(f"### Count changes by group ({len(section['counts'])})")
        lines.append("")
        if section["counts"]:
            lines.append("| Group | Before | After | Passed | Failed | Skipped |")
            lines.append("|---|---|---|---|---|---|")
            for row in section["counts"]:
                lines.append(
                    f"| `{row['group']}` | {row['before']} | {row['after']} | "
                    f"{row['passed']:+d} | {row['failed']:+d} | {row['skipped']:+d} |"
                )
        else:
            lines.append("(none)")
        lines.append("")

    lines.append(f"## Tool version changes ({len(report['versions'])})")
    lines.append("")
    if report["versions"]:
        lines.append("| Tool | Baseline | Current |")
        lines.append("|---|---|---|")
        for row in report["versions"]:
            lines.append(f"| {row['tool']} | {row['baseline']} | {row['current']} |")
    else:
        lines.append("(none)")
    lines.append("")

    lines.append(f"## Check status changes ({len(report['steps'])})")
    lines.append("")
    if report["steps"]:
        lines.append("| Check | Changed | Baseline | Current | Baseline exit | Current exit |")
        lines.append("|---|---|---|---|---|---|")
        for row in report["steps"]:
            lines.append(
                f"| {row['step']} | {', '.join(row['fields'])} | "
                f"{row['baseline_status']} | {row['current_status']} | "
                f"{row['baseline_exit_code']} | {row['current_exit_code']} |"
            )
    else:
        lines.append("(none)")
    lines.append("")

    lines.append(f"## Check log changes ({len(report['logs'])})")
    lines.append("")
    if report["logs"]:
        lines.append("| File | In baseline | In current | Baseline lines | Current lines |")
        lines.append("|---|---|---|---|---|")
        for row in report["logs"]:
            lines.append(
                f"| `{row['file']}` | {row['present_in_baseline']} | "
                f"{row['present_in_current']} | {row['baseline_lines']} | "
                f"{row['current_lines']} |"
            )
    else:
        lines.append("(none)")
    lines.append("")

    if report["warnings"]:
        lines.append(f"## Warnings ({len(report['warnings'])})")
        lines.append("")
        for warning in report["warnings"]:
            lines.append(f"- {warning}")
        lines.append("")

    if not has_differences(report):
        lines.append("**No differences.** The two runs match.")
    else:
        lines.append("**Differences were found.** See the sections above.")
    lines.append("")

    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    """Compare two runs and report the differences."""
    args = parse_args(sys.argv[1:] if argv is None else argv)

    baseline_dir = resolve_run(args.baseline)
    if not baseline_dir.is_dir():
        print(f"Baseline run not found: {baseline_dir}")
        return 2

    if args.run:
        current_dir = resolve_run(args.run)
    else:
        found = newest_run(REPO_ROOT / RUNS_DIR)
        if found is None:
            print(f"No runs found under {RUNS_DIR}. Capture one first:")
            print("  scripts/run_tests.py")
            return 2
        current_dir = found

    if not current_dir.is_dir():
        print(f"Run not found: {current_dir}")
        return 2

    report = build_report(baseline_dir, current_dir)

    if args.format == "json":
        text = json.dumps(report, indent=2) + "\n"
    else:
        text = render_markdown(report)

    if args.out:
        out_path = Path(args.out)
        if not out_path.is_absolute():
            out_path = REPO_ROOT / out_path
        out_path.write_text(text, encoding="utf-8")
        print(f"Comparison written to {out_path}")
    else:
        print(text)

    for warning in report["warnings"]:
        print(f"Warning: {warning}")

    return 1 if has_differences(report) else 0


if __name__ == "__main__":
    raise SystemExit(main())

