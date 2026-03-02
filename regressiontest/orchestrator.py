#!/usr/bin/env python3
"""
orchestrator.py — Central runner for the BusinessManager regression test suite.

Executes all 4 stages in order via pytest subprocesses, generates an HTML
report, and exits with code 0 (all passed) or 1 (any failures).

Usage:
    cd regressiontest
    python orchestrator.py [--stages 1 2 3 4] [--failfast] [--no-report]

Stages:
    1 — Pre-push connectivity + OpenAPI spec
    2 — Full backend API coverage
    3 — Browser E2E (requires frontend dev server)
    4 — Database integrity
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

# Ensure regressiontest/ is on the path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from config import validate_config, BASE_URL, FRONTEND_URL
    validate_config()
except ValueError as e:
    print(f"\n[ORCHESTRATOR] Configuration error: {e}\n")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
REPORT_DIR = SCRIPT_DIR / "reports"
REPORT_DIR.mkdir(exist_ok=True)

STAGE_CONFIG = {
    1: {
        "name": "Stage 1 — Pre-check (Connectivity + OpenAPI)",
        "dir": "stage1_precheck",
        "marker": "stage1",
        "critical": True,   # If this fails, skip stages 2–4
    },
    2: {
        "name": "Stage 2 — Backend API Coverage",
        "dir": "stage2_api",
        "marker": "stage2",
        "critical": False,
    },
    3: {
        "name": "Stage 3 — E2E Browser (Playwright)",
        "dir": "stage3_e2e",
        "marker": "stage3",
        "critical": False,
    },
    4: {
        "name": "Stage 4 — Database Integrity",
        "dir": "stage4_database",
        "marker": "stage4",
        "critical": False,
    },
}


def run_stage(stage_num: int) -> dict:
    """
    Run a single stage and return result dict:
    {
        name, stage_num, report_file, exit_code, duration,
        passed, failed, errors, skipped, skipped_reason
    }
    """
    cfg = STAGE_CONFIG[stage_num]
    report_file = REPORT_DIR / f"stage{stage_num}.json"
    stage_dir = SCRIPT_DIR / cfg["dir"]

    cmd = [
        sys.executable, "-m", "pytest",
        str(stage_dir),
        f"-m", cfg["marker"],
        "--tb=long",
        "-v",
        f"--json-report",
        f"--json-report-file={report_file}",
        "--json-report-indent=2",
        "--no-header",
        "-x",           # always stop on first failure within a stage
    ]

    print(f"\n{'='*60}")
    print(f"  {cfg['name']}")
    print(f"  Target: {BASE_URL}")
    print(f"{'='*60}")

    start = time.time()
    result = subprocess.run(
        cmd,
        cwd=str(SCRIPT_DIR),
        capture_output=False,
    )
    duration = time.time() - start

    # Parse JSON report
    passed = failed = errors = skipped = total = 0
    if report_file.exists():
        try:
            with open(report_file) as f:
                data = json.load(f)
            summary = data.get("summary", {})
            passed = summary.get("passed", 0)
            failed = summary.get("failed", 0)
            errors = summary.get("error", 0)
            skipped = summary.get("skipped", 0)
            total = summary.get("total", 0)
        except Exception:
            pass

    ok = result.returncode == 0
    print(f"\n  Result: {'PASSED' if ok else 'FAILED'} — "
          f"{passed}/{total} passed, {failed} failed, {errors} errors, {skipped} skipped "
          f"({duration:.1f}s)")

    return {
        "name": cfg["name"],
        "stage_num": stage_num,
        "report_file": report_file,
        "exit_code": result.returncode,
        "duration": duration,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
        "total": total,
        "ok": ok,
        "critical": cfg["critical"],
        "skipped_reason": None,
    }


def main():
    parser = argparse.ArgumentParser(
        description="BusinessManager Regression Test Orchestrator"
    )
    parser.add_argument(
        "--stages", nargs="+", type=int, default=[1, 2, 3, 4],
        help="Stages to run (default: 1 2 3 4)",
    )
    parser.add_argument(
        "--no-report", action="store_true",
        help="Skip HTML report generation",
    )
    args = parser.parse_args()

    print(f"\nBusinessManager Regression Test Suite")
    print(f"Target API:  {BASE_URL}")
    print(f"Frontend:    {FRONTEND_URL}")
    print(f"Stages:      {args.stages}")
    print(f"Mode:        fail-fast (stops on first failure in each stage)")
    print(f"Reports dir: {REPORT_DIR}\n")

    stage_results = []
    abort_remaining = False

    failed_stage = None
    for stage_num in sorted(args.stages):
        if abort_remaining:
            cfg = STAGE_CONFIG.get(stage_num, {})
            stage_results.append({
                "name": cfg.get("name", f"Stage {stage_num}"),
                "report_file": None,
                "skipped_reason": f"Stage {failed_stage} failed",
            })
            continue

        result = run_stage(stage_num)
        stage_results.append(result)

        if not result["ok"]:
            abort_remaining = True
            failed_stage = stage_num
            print(f"\n[ORCHESTRATOR] Stage {stage_num} FAILED — stopping.")
            print(f"[ORCHESTRATOR] Fix failures before running remaining stages.")

    # Summary
    print(f"\n{'='*60}")
    print("  FINAL SUMMARY")
    print(f"{'='*60}")
    grand_total = grand_passed = grand_failed = 0
    all_failed_tests: list = []

    for r in stage_results:
        if "ok" in r:
            status = "PASSED" if r["ok"] else "FAILED"
            print(f"  {r['name']}: {status} "
                  f"({r.get('passed',0)}/{r.get('total',0)} passed, "
                  f"{r.get('failed',0)} failed)")
            grand_total += r.get("total", 0)
            grand_passed += r.get("passed", 0)
            grand_failed += r.get("failed", 0) + r.get("errors", 0)
            # Collect failed test node IDs from JSON report
            rf = r.get("report_file")
            if rf and Path(rf).exists() and not r["ok"]:
                try:
                    with open(rf) as f:
                        data = json.load(f)
                    for t in data.get("tests", []):
                        if t.get("outcome") in ("failed", "error"):
                            all_failed_tests.append(t.get("nodeid", "?"))
                except Exception:
                    pass
        else:
            print(f"  {r['name']}: SKIPPED — {r.get('skipped_reason', '')}")

    overall_ok = grand_failed == 0 and not abort_remaining
    print(f"\n  OVERALL: {'PASSED' if overall_ok else 'FAILED'}")
    print(f"  Total: {grand_total} tests | {grand_passed} passed | {grand_failed} failed")

    if all_failed_tests:
        print(f"\n{'='*60}")
        print("  FAILED TESTS")
        print(f"{'='*60}")
        for t in all_failed_tests:
            print(f"  FAILED  {t}")
        print(f"{'='*60}")

    # HTML Report
    if not args.no_report:
        try:
            from helpers.report import generate_report
            html_path = REPORT_DIR / "regression_report.html"
            generate_report(stage_results, html_path)
        except Exception as e:
            print(f"\n[WARNING] Could not generate HTML report: {e}")

    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
