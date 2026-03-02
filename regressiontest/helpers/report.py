"""
report.py — Aggregates pytest JSON report files into a styled HTML summary.
"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from jinja2 import Template

_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BusinessManager Regression Report</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fa; margin: 0; padding: 20px; color: #222; }
  h1 { color: #1a237e; }
  .meta { color: #555; margin-bottom: 20px; }
  .stage { background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px;
           box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
  .stage h2 { margin-top: 0; }
  .summary-bar { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .pill { padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 0.9em; }
  .pill-pass { background: #c8e6c9; color: #1b5e20; }
  .pill-fail { background: #ffcdd2; color: #b71c1c; }
  .pill-skip { background: #fff9c4; color: #f57f17; }
  .pill-error { background: #ffe0b2; color: #e65100; }
  .pill-total { background: #e3f2fd; color: #0d47a1; }
  .pill-skipped-stage { background: #eeeeee; color: #616161; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
  th { background: #e8eaf6; text-align: left; padding: 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .pass { color: #2e7d32; font-weight: 600; }
  .fail { color: #c62828; font-weight: 600; }
  .error { color: #e65100; font-weight: 600; }
  .skip { color: #827717; }
  .overall { background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px;
             box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
  .grand-pass { color: #1b5e20; font-size: 1.4em; font-weight: bold; }
  .grand-fail { color: #b71c1c; font-size: 1.4em; font-weight: bold; }
  details summary { cursor: pointer; user-select: none; }
  pre { background: #fafafa; border: 1px solid #ddd; border-radius: 4px;
        padding: 10px; overflow-x: auto; font-size: 0.82em; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>BusinessManager Regression Report</h1>
<div class="meta">Generated: {{ generated_at }} &nbsp;|&nbsp; Duration: {{ total_duration }}s</div>

<div class="overall">
  <strong>Overall Result:</strong>
  {% if grand_ok %}
  <span class="grand-pass">PASSED ✓</span>
  {% else %}
  <span class="grand-fail">FAILED ✗</span>
  {% endif %}
  &nbsp;
  <span class="pill pill-total">{{ grand_total }} total</span>
  <span class="pill pill-pass">{{ grand_passed }} passed</span>
  {% if grand_failed %}<span class="pill pill-fail">{{ grand_failed }} failed</span>{% endif %}
  {% if grand_errors %}<span class="pill pill-error">{{ grand_errors }} errors</span>{% endif %}
  {% if grand_skipped %}<span class="pill pill-skip">{{ grand_skipped }} skipped</span>{% endif %}
</div>

{% for stage in stages %}
<div class="stage">
  <h2>{{ stage.name }}</h2>
  {% if stage.skipped_reason %}
    <span class="pill pill-skipped-stage">SKIPPED — {{ stage.skipped_reason }}</span>
  {% else %}
  <div class="summary-bar">
    <span class="pill pill-total">{{ stage.total }} tests</span>
    <span class="pill pill-pass">{{ stage.passed }} passed</span>
    {% if stage.failed %}<span class="pill pill-fail">{{ stage.failed }} failed</span>{% endif %}
    {% if stage.errors %}<span class="pill pill-error">{{ stage.errors }} errors</span>{% endif %}
    {% if stage.skipped %}<span class="pill pill-skip">{{ stage.skipped }} skipped</span>{% endif %}
    <span class="pill" style="background:#f5f5f5;color:#555;">{{ "%.2f"|format(stage.duration) }}s</span>
  </div>
  {% if stage.failures %}
  <details open>
    <summary><strong>Failures / Errors ({{ stage.failures|length }})</strong></summary>
    <table>
      <tr><th>Test</th><th>Outcome</th><th>Message</th></tr>
      {% for f in stage.failures %}
      <tr>
        <td>{{ f.nodeid }}</td>
        <td class="{{ f.outcome }}">{{ f.outcome }}</td>
        <td><pre>{{ f.message }}</pre></td>
      </tr>
      {% endfor %}
    </table>
  </details>
  {% endif %}
  {% endif %}
</div>
{% endfor %}
</body>
</html>
"""


def _parse_json_report(path: Path) -> dict:
    """Parse a pytest-json-report output file."""
    with open(path) as f:
        data = json.load(f)
    summary = data.get("summary", {})
    tests = data.get("tests", [])
    failures = []
    for t in tests:
        if t.get("outcome") in ("failed", "error"):
            # Extract the longrepr / crash message
            call = t.get("call") or t.get("setup") or {}
            crash = call.get("crash", {})
            msg = crash.get("message") or call.get("longrepr") or ""
            failures.append({
                "nodeid": t.get("nodeid", ""),
                "outcome": t.get("outcome", ""),
                "message": str(msg)[:800],
            })
    return {
        "total": summary.get("total", 0),
        "passed": summary.get("passed", 0),
        "failed": summary.get("failed", 0),
        "errors": summary.get("error", 0),
        "skipped": summary.get("skipped", 0),
        "duration": data.get("duration", 0.0),
        "failures": failures,
    }


def generate_report(
    stage_results: List[dict],
    output_path: Path,
) -> None:
    """
    Generate an HTML report from stage results.

    stage_results: list of dicts with keys:
        name, report_file (Path or None), skipped_reason (str or None)
    """
    stages = []
    grand_total = grand_passed = grand_failed = grand_errors = grand_skipped = 0
    total_duration = 0.0

    for sr in stage_results:
        name = sr["name"]
        report_file: Optional[Path] = sr.get("report_file")
        skipped_reason: Optional[str] = sr.get("skipped_reason")

        if skipped_reason or not report_file or not report_file.exists():
            stages.append({"name": name, "skipped_reason": skipped_reason or "no report file"})
            continue

        parsed = _parse_json_report(report_file)
        stages.append({
            "name": name,
            "skipped_reason": None,
            **parsed,
        })
        grand_total += parsed["total"]
        grand_passed += parsed["passed"]
        grand_failed += parsed["failed"]
        grand_errors += parsed["errors"]
        grand_skipped += parsed["skipped"]
        total_duration += parsed["duration"]

    grand_ok = grand_failed == 0 and grand_errors == 0

    tmpl = Template(_HTML_TEMPLATE)
    html = tmpl.render(
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_duration=f"{total_duration:.1f}",
        grand_ok=grand_ok,
        grand_total=grand_total,
        grand_passed=grand_passed,
        grand_failed=grand_failed,
        grand_errors=grand_errors,
        grand_skipped=grand_skipped,
        stages=stages,
    )

    output_path.write_text(html, encoding="utf-8")
    print(f"\nHTML report written to: {output_path}")
