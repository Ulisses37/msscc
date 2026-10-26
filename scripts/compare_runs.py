"""Diff two recorded test runs.

Compares a baseline run against a later run and reports what changed. See
``docs/testing/PROCEDURE.md``.

**Only test results and tool versions count as differences.** Timestamps, run
directory names, the commit hash, branch, dirty flag and all durations are
recorded for information and ignored here. Without that rule a re-run on the same
commit would always report differences, and the "empty diff" check would be
useless.

Exit codes: 0 when the two runs match, 1 when differences were found, 2 when a run
directory could not be read. The distinction lets a reviewer or a future CI job
gate on a changed test result.
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
    """Return the test node ids and per-app counts from a pytest.xml."""
    path = run_dir / "pytest.xml"
    if not path.is_file():
        return None

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return None

    results: dict[str, str] = {}
    per_app: dict[str, dict] = {}

    for testcase in root.iter("testcase"):
        classname = testcase.get("classname", "")
        app = classname.split(".")[0] or "unknown"
        node = f"{classname}::{testcase.get('name', '')}"

        if testcase.find("failure") is not None or testcase.find("error") is not None:
            status = "failed"
        elif testcase.find("skipped") is not None:
            status = "skipped"
        else:
            status = "passed"

        results[node] = status
        bucket = per_app.setdefault(app, {"passed": 0, "failed": 0, "skipped": 0})
        bucket[status] += 1

    return {"results": results, "per_app": per_app, "total": len(results)}


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
    """Return each check's status from a run's meta.json."""
    path = run_dir / "meta.json"
    if not path.is_file():
        return {}
    try:
        meta = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {name: info.get("status", "") for name, info in meta.get("steps", {}).items()}


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


def has_differences(report: dict) -> bool:
    """Report whether anything counts as a difference between the two runs."""
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

    return any(
        left != right
        for left, right in zip(report["steps"]["baseline"], report["steps"]["current"])
    )



def build_report(baseline_dir: Path, current_dir: Path) -> dict:
    """Build the comparison report for two run directories."""
    base_pytest = read_pytest(baseline_dir)
    base_jest = read_jest(baseline_dir)
    now_pytest = read_pytest(current_dir)
    now_jest = read_jest(current_dir)

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
        "steps": {
            "baseline": read_steps(baseline_dir),
            "current": read_steps(current_dir),
        },
    }


def render_markdown(report: dict) -> str:
    """Render a comparison report as Markdown."""
    lines: list[str] = [
        "# Test run comparison",
        "",
        f"Baseline: `{report['baseline_dir']}`",
        f"Compared against: `{report['current_dir']}`",
        "",
        "Only test results and tool versions are compared. Timestamps, run directory "
        "names, commit hashes, branch names, dirty flags and durations are informational "
        "and are ignored on purpose.",
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
            f"{results['current_total']} now."
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

    lines.append("## Check status")
    lines.append("")
    lines.append("| Check | Baseline | Current |")
    lines.append("|---|---|---|")
    for name in sorted(report["steps"]["baseline"] | report["steps"]["current"]):
        before = report["steps"]["baseline"].get(name, "unknown")
        after = report["steps"]["current"].get(name, "unknown")
        lines.append(f"| {name} | {before} | {after} |")
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

    return 1 if has_differences(report) else 0


if __name__ == "__main__":
    raise SystemExit(main())

