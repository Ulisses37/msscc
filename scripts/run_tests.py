"""Capture one recorded test run into a portable, machine-readable log.

Runs pytest (JUnit XML), jest (JSON), ``tsc --noEmit`` and ``ruff check backend``
and writes each result, plus ``meta.json``, into
``docs/testing/runs/<timestamp>-<short-hash>/`` so a change in results can be
traced to a commit and a tool version. See ``docs/testing/PROCEDURE.md``.

Two properties matter more than anything else here:

* **Paths are normalized before anything is written.** jest's JSON reporter and
  pytest's JUnit XML both emit absolute file paths, and the JUnit XML also
  carries a hostname, so a raw log differs between two machines on the same
  commit. Both files are rewritten with repository-relative paths and no
  hostname.
* **Nothing volatile is a result.** Timestamps, durations and the commit hash
  are recorded for information only; ``scripts/compare_runs.py`` ignores them.

Exit codes: 0 when every check ran and passed, 1 when a check ran and failed,
2 when the run could not be produced at all (bad arguments, no interpreter, no
frontend dependencies).
"""

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

META_SCHEMA = "msscc-test-run/1"
RUNS_DIR = Path("docs") / "testing" / "runs"
DEFAULT_TIMEOUT_SECONDS = 1800
LOG_TAIL_CHARACTERS = 20000
STEP_NAMES = ("pytest", "jest", "tsc", "ruff")

REPO_ROOT = Path(__file__).resolve().parent.parent

# Node's launchers are shell scripts on POSIX and .cmd files on Windows, and
# subprocess with shell=False does not resolve an extension for you, so the
# launcher is picked per platform instead of relying on PATH lookup.
NODE_LAUNCHERS = ("npm.cmd", "npx.cmd", "node.exe") if os.name == "nt" else ("npm", "npx", "node")


def node_command(name: str, *arguments: str) -> list[str]:
    """Return a runnable command for a Node launcher."""
    launcher = f"{name}.cmd" if os.name == "nt" else name
    return [launcher, *arguments]


def node_available() -> bool:
    """Report whether the Node launchers can be found on PATH."""
    return all(shutil.which(launcher) for launcher in NODE_LAUNCHERS)



def parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse the command line."""
    parser = argparse.ArgumentParser(
        description="Run every check and record the results in docs/testing/runs/.",
    )
    parser.add_argument("--label", default="", help="Tag added to the run directory name.")
    parser.add_argument("--python", default=None, help="Interpreter to use for pytest and ruff.")
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        choices=STEP_NAMES,
        help="Skip a check. Repeatable.",
    )
    parser.add_argument("--runs-dir", default=str(RUNS_DIR), help="Where runs are written.")
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Per-check timeout in seconds.",
    )
    return parser.parse_args(argv)


def run_command(argv: list[str], cwd: Path, timeout: int) -> dict:
    """Run one command and return its exit code, output, and duration."""
    started = time.monotonic()
    try:
        completed = subprocess.run(
            argv,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
            check=False,
        )
        code = completed.returncode
        output = (completed.stdout or "") + (completed.stderr or "")
    except FileNotFoundError:
        code = None
        output = f"Command not found: {argv[0]}"
    except OSError as error:
        code = None
        output = f"Could not run {argv[0]}: {error}"
    except subprocess.TimeoutExpired:
        code = None
        output = f"Timed out after {timeout} seconds: {' '.join(argv)}"

    return {
        "code": code,
        "output": output,
        "duration_seconds": round(time.monotonic() - started, 3),
    }


def probe(argv: list[str], timeout: int = 60) -> str | None:
    """Return a version string from a command, or ``None``.

    The last output line is used rather than the first: the npm launchers on
    Windows print a banner before the version, and the version is what comes
    last.
    """
    result = run_command(argv, REPO_ROOT, timeout)
    if result["code"] != 0:
        return None
    lines = [line.strip() for line in (result["output"] or "").splitlines() if line.strip()]
    return lines[-1] if lines else ""



def resolve_python(explicit: str | None) -> tuple[str, str]:
    """Return the interpreter to use and a short description of where it came from.

    Tried in order: an explicit ``--python``, the interpreter running this
    script when it can already import pytest and Django, then the repository
    virtual environment. The venv path differs by platform, and on POSIX the
    file must also be executable, so both are checked rather than assumed.
    """
    if explicit:
        return explicit, "explicit --python"

    if _imports_test_packages(sys.executable):
        return sys.executable, "script interpreter"

    venv_python = _venv_python_path()
    if venv_python is not None:
        return str(venv_python.relative_to(REPO_ROOT)), "repository virtual environment"

    raise RuntimeError(
        "No interpreter with pytest and Django found. Run this script through "
        "backend/venv (backend\\venv\\Scripts\\python.exe on Windows, "
        "backend/venv/bin/python on macOS and Linux), or pass --python. See "
        "docs/MSSCC_Dev_Setup_Guide.md."
    )


def _imports_test_packages(interpreter: str) -> bool:
    """Report whether an interpreter can import pytest and Django."""
    try:
        probe_result = subprocess.run(
            [interpreter, "-c", "import pytest, django"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=120,
            shell=False,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return probe_result.returncode == 0


def _venv_python_path() -> Path | None:
    """Return the virtual environment interpreter for this platform, if usable."""
    candidates = (
        ("Scripts", "python.exe"),
        ("bin", "python"),
    )
    for directory, executable in candidates:
        candidate = REPO_ROOT / "backend" / "venv" / directory / executable
        if not candidate.is_file():
            continue
        # On POSIX a file can arrive without the executable bit set, and the
        # exec call would then fail with a confusing OSError.
        if os.name != "nt" and not os.access(candidate, os.X_OK):
            continue
        return candidate
    return None


def git_metadata() -> dict:
    """Return the commit and working-tree state this run was captured from."""
    return {
        "commit": probe(["git", "rev-parse", "HEAD"]) or "",
        "short": probe(["git", "rev-parse", "--short", "HEAD"]) or "",
        "branch": probe(["git", "rev-parse", "--abbrev-ref", "HEAD"]) or "",
        "dirty": bool(probe(["git", "status", "--porcelain"]) or ""),
    }


def collect_versions(python: str, timeout: int) -> dict:
    """Read the version of each tool the run depends on.

    A tool that cannot report a version records ``status: unavailable`` with an
    empty version instead of aborting the run, so a missing tool produces a run
    with a visible gap rather than no run at all.
    """
    commands = {
        "python": [python, "--version"],
        "django": [python, "-c", "import django; print(django.get_version())"],
        "pytest": [python, "-m", "pytest", "--version"],
        "pytest_django": [
            python,
            "-c",
            "import pytest_django; print(pytest_django.__version__)",
        ],
        "ruff": [python, "-m", "ruff", "--version"],
        "node": ["node", "--version"],
        "npm": node_command("npm", "--version"),
        # jest is reached through node with its entry script rather than the
        # frontend/node_modules/.bin shim, which is not directly executable on
        # Windows.
        "jest": [
            "node",
            str(REPO_ROOT / "frontend" / "node_modules" / "jest" / "bin" / "jest.js"),
            "--version",
        ],
        "tsc": node_command("npx", "--prefix", "frontend", "tsc", "--version"),
    }

    versions: dict[str, dict] = {}
    for name, argv in commands.items():
        version = probe(argv, timeout)
        versions[name] = {
            "version": "" if version is None else version,
            "status": "unavailable" if version is None else "ok",
        }

    return versions


def to_repo_relative(raw: str) -> str:
    """Rewrite an absolute path inside the repo as a repository-relative one.

    Both jest and pytest report absolute paths, which differ per machine and per
    drive letter. Anything the repository does not contain is left alone rather
    than rewritten into a misleading relative path.
    """
    if not raw:
        return raw

    cleaned = raw.replace("\\", "/").strip()
    root = str(REPO_ROOT).replace("\\", "/")
    if cleaned.lower().startswith(root.lower() + "/"):
        return cleaned[len(root) + 1 :]
    if cleaned.startswith("./"):
        return cleaned[2:]
    return cleaned


def normalize_junit_xml(path: Path) -> None:
    """Rewrite a JUnit XML report in place so it carries no machine-specific data.

    ``file`` attributes become repository-relative, and the ``hostname`` pytest
    stamps onto ``testsuite`` is dropped because it says nothing about the result
    and everything about who captured it. Class and test names are left exactly
    as pytest wrote them, since they are how a later comparison matches a test.
    """
    try:
        tree = ET.parse(path)
    except ET.ParseError:
        return

    for testsuite in tree.iter("testsuite"):
        testsuite.attrib.pop("hostname", None)
        testsuite.attrib.pop("timestamp", None)

    for testcase in tree.iter("testcase"):
        if testcase.get("file"):
            testcase.set("file", to_repo_relative(testcase.get("file", "")))

    tree.write(path, encoding="utf-8", xml_declaration=True)


def normalize_jest_json(path: Path, raw: dict) -> dict:
    """Return jest's JSON report with volatile and machine-specific parts removed.

    Kept: which test ran, which file it came from, its status, and the counts.
    Dropped: file paths outside the repo, failure messages (they embed absolute
    paths and stack traces, and the full detail is in ``jest.log``), timings, and
    start times, none of which are results and all of which change between two
    runs of the same commit.
    """
    normalized = {
        "numTotalTests": raw.get("numTotalTests", 0),
        "numPassedTests": raw.get("numPassedTests", 0),
        "numFailedTests": raw.get("numFailedTests", 0),
        "numPendingTests": raw.get("numPendingTests", 0),
        "numTodoTests": raw.get("numTodoTests", 0),
        "numTotalTestSuites": raw.get("numTotalTestSuites", 0),
        "numFailedTestSuites": raw.get("numFailedTestSuites", 0),
        "numPassedTestSuites": raw.get("numPassedTestSuites", 0),
        "success": bool(raw.get("success", False)),
        "testResults": [],
    }

    for suite in raw.get("testResults", []):
        name = to_repo_relative(suite.get("name", ""))
        normalized["testResults"].append(
            {
                "name": name,
                "status": "failed" if suite.get("status") == "failed" else "passed",
                "assertionResults": [
                    {
                        "ancestorTitles": [
                            to_repo_relative(title) for title in assertion.get("ancestorTitles", [])
                        ],
                        "fullName": assertion.get("fullName", ""),
                        "status": assertion.get("status", ""),
                        "title": assertion.get("title", ""),
                    }
                    for assertion in suite.get("assertionResults", [])
                ],
            }
        )

    del path
    return normalized


def strip_absolute_paths(text: str) -> str:
    """Replace the machine's repository path in log output with ``<repo>``.

    ``tsc`` and ruff print absolute paths when they have something to report, and
    this keeps a recorded log readable on another machine.
    """
    root = str(REPO_ROOT)
    for variant in {root, root.replace("\\", "/"), str(REPO_ROOT.parent)}:
        if variant:
            text = re.sub(re.escape(variant) + r"[\\/]?", "<repo>/", text)
    return text

    return versions



def run_pytest(run_dir: Path, python: str, timeout: int) -> dict:
    """Run the backend suite and write a normalized JUnit XML report."""
    report = (run_dir / "pytest.xml").resolve()
    result = run_command(
        [python, "-m", "pytest", "backend", f"--junitxml={report}"],
        REPO_ROOT,
        timeout,
    )
    if report.is_file():
        normalize_junit_xml(report)
    return result


def run_jest(run_dir: Path, timeout: int) -> dict:
    """Run the frontend suite, writing a normalized JSON report and a plain log.

    The output file is written by jest itself, so ``--json`` and ``--outputFile``
    are passed from here rather than configured in ``frontend/package.json``:
    a plain ``npm test`` stays free of file side effects.
    """
    report = (run_dir / "jest.json").resolve()
    json_result = run_command(
        node_command(
            "npm",
            "--prefix",
            "frontend",
            "test",
            "--",
            "--json",
            f"--outputFile={report}",
        ),
        REPO_ROOT,
        timeout,
    )
    if report.is_file():
        try:
            raw = json.loads(report.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raw = None
        if raw is not None:
            report.write_text(
                json.dumps(normalize_jest_json(report, raw), indent=2) + "\n",
                encoding="utf-8",
            )

    # jest prints the human-readable report to stderr, and run_command captured
    # both streams, so a --json run does not need a second jest invocation.
    (run_dir / "jest.log").write_text(
        strip_absolute_paths(json_result["output"]),
        encoding="utf-8",
    )
    return json_result


def run_tsc(run_dir: Path, timeout: int) -> dict:
    """Type-check the frontend and write the output as a log."""
    result = run_command(
        node_command("npx", "--prefix", "frontend", "tsc", "--noEmit", "-p", "frontend"),
        REPO_ROOT,
        timeout,
    )
    (run_dir / "tsc.log").write_text(strip_absolute_paths(result["output"]), encoding="utf-8")
    return result


def run_ruff(run_dir: Path, python: str, timeout: int) -> dict:
    """Lint the backend and write the output as a log."""
    result = run_command([python, "-m", "ruff", "check", "backend"], REPO_ROOT, timeout)
    (run_dir / "ruff.log").write_text(strip_absolute_paths(result["output"]), encoding="utf-8")
    return result


def build_run_dir(runs_dir: Path, label: str, short_hash: str, dirty: bool) -> Path:
    """Return the directory for this run, uniquified if that name is taken."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    parts = [stamp, short_hash or "nogit"]
    if dirty:
        parts.append("dirty")
    if label:
        parts.append(label)

    run_dir = runs_dir / "-".join(parts)
    counter = 2
    while run_dir.exists():
        run_dir = runs_dir / f"{'-'.join(parts)}-{counter}"
        counter += 1
    run_dir.mkdir(parents=True)
    return run_dir


def main(argv: list[str] | None = None) -> int:
    """Run every check, record the run, and report the outcome."""
    args = parse_args(sys.argv[1:] if argv is None else argv)

    if shutil.which("git") is None:
        print("git is not on PATH, so the run cannot be traced to a commit.")
        return 2

    runs_dir = (REPO_ROOT / args.runs_dir).resolve() if not Path(args.runs_dir).is_absolute() else Path(args.runs_dir)

    if not node_available():
        print("node, npm or npx is not on PATH. Install Node 22 (frontend/.nvmrc).")
        return 2

    if ("jest" not in args.skip or "tsc" not in args.skip) and not (
        REPO_ROOT / "frontend" / "node_modules"
    ).is_dir():
        print("frontend/node_modules is missing. Run: npm --prefix frontend ci")
        return 2

    try:
        python, python_source = resolve_python(args.python)
    except RuntimeError as error:
        print(str(error))
        return 2

    git = git_metadata()
    run_dir = build_run_dir(runs_dir, args.label, git["short"], git["dirty"])
    print(f"Capturing run into {run_dir}")
    if git["dirty"]:
        print("Warning: the working tree is dirty, so this run cannot be reproduced from a commit.")

    steps = {
        "pytest": lambda: run_pytest(run_dir, python, args.timeout),
        "jest": lambda: run_jest(run_dir, args.timeout),
        "tsc": lambda: run_tsc(run_dir, args.timeout),
        "ruff": lambda: run_ruff(run_dir, python, args.timeout),
    }

    results: dict[str, dict] = {}
    for name in STEP_NAMES:
        if name in args.skip:
            print(f"{name}: skipped")
            results[name] = {"status": "skipped", "exit_code": None, "duration_seconds": None}
            continue

        print(f"{name}: running")
        step = steps[name]()
        results[name] = {
            "status": "passed" if step["code"] == 0 else "failed",
            "exit_code": step["code"],
            "duration_seconds": step["duration_seconds"],
        }
        print(f"{name}: {results[name]['status']} ({step['duration_seconds']}s)")

    meta = {
        "schema": META_SCHEMA,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "label": args.label,
        "git": git,
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
        },
        "python": {
            "version": platform.python_version(),
            "interpreter": to_repo_relative(python),
            "source": python_source,
        },
        "tools": collect_versions(python, args.timeout),
        "steps": results,
    }
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    failed = [name for name, outcome in results.items() if outcome["status"] == "failed"]
    print(f"Run written to {run_dir}")
    if failed:
        print(f"Checks that failed: {', '.join(failed)}")
        return 1

    print("Every check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
