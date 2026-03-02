#!/usr/bin/env python3
"""
runner_gui.py — Web-based GUI for the BusinessManager regression test suite.

Opens a browser at http://localhost:7771 showing real-time test progress with
color-coded results, per-stage summaries, and a final pass/fail verdict.

Usage:
    cd regressiontest
    python runner_gui.py
    python runner_gui.py --port 8080
    python runner_gui.py --no-browser     # headless / CI use
"""

import argparse
import http.server
import json
import os
import queue
import re
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Optional

# ── Constants ─────────────────────────────────────────────────────────────────
PORT = 7771
SCRIPT_DIR = Path(__file__).parent
REPORTS_DIR = SCRIPT_DIR / "reports"

STAGE_NAMES = {
    1: "Pre-check",
    2: "API Tests",
    3: "E2E Browser",
    4: "DB Integrity",
}
STAGE_DESCRIPTIONS = {
    1: "Connectivity + OpenAPI spec",
    2: "All backend endpoints & auth",
    3: "Browser UI (needs npm run dev)",
    4: "Cascade deletes + constraints",
}
STAGE_DIRS = {
    1: "stage1_precheck",
    2: "stage2_api",
    3: "stage3_e2e",
    4: "stage4_database",
}
STAGE_MARKERS = {1: "stage1", 2: "stage2", 3: "stage3", 4: "stage4"}

# ── Global State ──────────────────────────────────────────────────────────────
_clients_lock = threading.Lock()
_clients: list = []               # list of queue.Queue, one per SSE connection
_run_lock = threading.Lock()
_current_proc: Optional[subprocess.Popen] = None
_is_running = False
_stop_requested = False


def broadcast(event_type: str, **data) -> None:
    """Push a structured SSE event to every connected browser tab."""
    payload = json.dumps({"type": event_type, **data})
    msg = f"data: {payload}\n\n"
    with _clients_lock:
        dead = []
        for q in _clients:
            try:
                q.put_nowait(msg)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _clients.remove(q)


# ── Line Parser ───────────────────────────────────────────────────────────────
# Matches:  path::Class::method PASSED   [ 14%]
_TEST_RE = re.compile(
    r"^(?P<nodeid>\S+::\S+)\s+(?P<outcome>PASSED|FAILED|ERROR|SKIPPED)"
    r"(?:\s+\[(?P<pct>\s*\d+%)\])?",
    re.IGNORECASE,
)
# Matches trailing summary: "5 failed, 40 passed in 12.3s"
_SUMMARY_RE = re.compile(
    r"(?:(?P<failed>\d+) failed)?.*?(?:(?P<passed>\d+) passed)?.*?in (?P<dur>[\d.]+)s",
    re.IGNORECASE,
)


def _classify_line(line: str) -> str:
    """Return a CSS class name for terminal line colouring."""
    s = line.strip()
    if re.search(r"\bPASSED\b", s):
        return "pass"
    if re.search(r"\bFAILED\b", s):
        return "fail"
    if re.search(r"\bERROR\b", s):
        return "error"
    if re.search(r"\bSKIPPED\b", s):
        return "skip"
    if s.startswith("=") or s.startswith("_") or s.startswith("-"):
        return "header"
    if s.startswith("FAILED ") or s.startswith("ERROR "):
        return "fail"
    if s.startswith("E ") or s.startswith("AssertionError"):
        return "fail"
    if s.startswith(">") or s.startswith("[REGTEST]") or s.startswith("[GUI]") or s.startswith("[ORCHESTRATOR]"):
        return "info"
    return "dim"


# ── Run Logic ─────────────────────────────────────────────────────────────────
def run_stages(stages: list) -> None:
    global _is_running, _current_proc, _stop_requested
    with _run_lock:
        _is_running = True
        _stop_requested = False
        run_start = time.time()
        broadcast("run_start", stages=stages)

        totals = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0}
        overall_ok = True

        for stage_num in stages:
            if _stop_requested:
                remaining = [s for s in stages if s > stage_num - 1]
                for s in remaining:
                    broadcast("stage_skipped", stage=s,
                              name=STAGE_NAMES.get(s, f"Stage {s}"),
                              reason="Stopped by user")
                break

            stage_dir = SCRIPT_DIR / STAGE_DIRS[stage_num]
            marker = STAGE_MARKERS[stage_num]
            broadcast("stage_start", stage=stage_num, name=STAGE_NAMES[stage_num])

            cmd = [
                sys.executable, "-m", "pytest",
                str(stage_dir),
                "-m", marker,
                "-v",
                "--tb=long",
                "--no-header",
                "--color=no",
                "-x",           # stop on first failure within the stage
            ]

            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            stage_counts = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0}
            stage_start = time.time()
            exit_code = 1

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    cwd=str(SCRIPT_DIR),
                    encoding="utf-8",
                    errors="replace",
                    env=env,
                )
                _current_proc = proc

                for raw_line in proc.stdout:
                    if _stop_requested:
                        proc.terminate()
                        break
                    line = raw_line.rstrip()
                    css = _classify_line(line)
                    broadcast("line", text=line, css=css, stage=stage_num)

                    m = _TEST_RE.match(line.strip())
                    if m:
                        outcome = m.group("outcome").lower()
                        nodeid = m.group("nodeid")
                        short = nodeid.split("::")[-1]
                        broadcast("test_result",
                                  outcome=outcome,
                                  nodeid=nodeid,
                                  name=short,
                                  stage=stage_num)
                        if outcome == "passed":
                            stage_counts["passed"] += 1
                        elif outcome == "failed":
                            stage_counts["failed"] += 1
                        elif outcome == "error":
                            stage_counts["errors"] += 1
                        elif outcome == "skipped":
                            stage_counts["skipped"] += 1

                proc.wait()
                exit_code = proc.returncode
            except Exception as exc:
                broadcast("line", text=f"[GUI ERROR] {exc}", css="fail", stage=stage_num)
                exit_code = 1
            finally:
                _current_proc = None

            stage_duration = round(time.time() - stage_start, 1)
            ok = exit_code == 0 and not _stop_requested
            if not ok:
                overall_ok = False
            for k in ("passed", "failed", "errors", "skipped"):
                totals[k] += stage_counts[k]

            broadcast("stage_end",
                      stage=stage_num,
                      name=STAGE_NAMES[stage_num],
                      ok=ok,
                      exit_code=exit_code,
                      duration=stage_duration,
                      **stage_counts)

            # Any stage failure → abort remaining stages immediately
            if not ok and not _stop_requested:
                broadcast("line", text="", css="dim", stage=0)
                broadcast("line",
                          text=f"Stage {stage_num} failed — stopping. Fix failures before continuing.",
                          css="fail", stage=0)
                remaining = [s for s in stages if s > stage_num]
                for s in remaining:
                    broadcast("stage_skipped", stage=s,
                              name=STAGE_NAMES.get(s, f"Stage {s}"),
                              reason=f"Stage {stage_num} failed")
                overall_ok = False
                break

        total_duration = round(time.time() - run_start, 1)
        broadcast("run_end",
                  ok=overall_ok and not _stop_requested,
                  duration=total_duration,
                  **totals)
        _is_running = False


# ── HTTP Handler ──────────────────────────────────────────────────────────────
class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress access logs

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._serve_html()
        elif self.path == "/events":
            self._serve_sse()
        elif self.path == "/status":
            self._json({"running": _is_running})
        elif self.path == "/report":
            self._serve_report()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/run":
            self._handle_run()
        elif self.path == "/stop":
            self._handle_stop()
        else:
            self.send_response(404)
            self.end_headers()

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_html(self):
        body = _HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        client_q: queue.Queue = queue.Queue(maxsize=500)
        with _clients_lock:
            _clients.append(client_q)

        try:
            init = json.dumps({"type": "connected", "running": _is_running})
            self.wfile.write(f"data: {init}\n\n".encode())
            self.wfile.flush()
        except OSError:
            with _clients_lock:
                if client_q in _clients:
                    _clients.remove(client_q)
            return

        try:
            while True:
                try:
                    msg = client_q.get(timeout=15)
                    self.wfile.write(msg.encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with _clients_lock:
                if client_q in _clients:
                    _clients.remove(client_q)

    def _serve_report(self):
        path = REPORTS_DIR / "regression_report.html"
        if path.exists():
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self._json({"error": "No report yet. Run the full suite first."}, 404)

    def _handle_run(self):
        global _is_running
        if _is_running:
            self._json({"error": "A run is already in progress."}, 409)
            return
        body = self._read_body()
        stages = [int(s) for s in body.get("stages", [1, 2, 3, 4]) if 1 <= int(s) <= 4]
        if not stages:
            self._json({"error": "No valid stages."}, 400)
            return
        threading.Thread(target=run_stages, args=(stages,), daemon=True).start()
        self._json({"started": True, "stages": stages})

    def _handle_stop(self):
        global _stop_requested, _current_proc
        _stop_requested = True
        if _current_proc:
            try:
                _current_proc.terminate()
            except Exception:
                pass
        self._json({"stopped": True})


# ── Embedded HTML / CSS / JS ──────────────────────────────────────────────────
_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Regression Runner — BusinessManager</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d1117;
    --surface:   #161b22;
    --border:    #30363d;
    --text:      #e6edf3;
    --dim:       #8b949e;
    --green:     #3fb950;
    --green-dim: #1a4d25;
    --red:       #f85149;
    --red-dim:   #4d1a1a;
    --yellow:    #d29922;
    --yellow-dim:#4d3a0a;
    --orange:    #f0883e;
    --blue:      #58a6ff;
    --purple:    #bc8cff;
    --accent:    #238636;
    --accent-h:  #2ea043;
    --danger:    #da3633;
    --danger-h:  #f85149;
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; }

  /* ── Layout ── */
  #app { display: grid; grid-template-rows: auto 1fr; height: 100vh; }

  header {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  header h1 { font-size: 15px; font-weight: 600; color: var(--text); white-space: nowrap; }
  header h1 span { color: var(--dim); font-weight: 400; }

  #status-badge {
    padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
    background: var(--border); color: var(--dim); letter-spacing: .5px;
    transition: all .3s;
  }
  #status-badge.running  { background: #1d3d6b; color: var(--blue); animation: pulse 1.5s infinite; }
  #status-badge.passed   { background: var(--green-dim); color: var(--green); }
  #status-badge.failed   { background: var(--red-dim); color: var(--red); }

  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.6; } }

  #timer { font-family: monospace; font-size: 13px; color: var(--dim); min-width: 50px; }
  #header-stats { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
  .hstat { font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
  .hstat-pass { background: var(--green-dim); color: var(--green); }
  .hstat-fail { background: var(--red-dim); color: var(--red); }
  .hstat-skip { background: var(--yellow-dim); color: var(--yellow); }

  #btn-report {
    font-size: 12px; padding: 4px 10px; border-radius: 6px;
    background: transparent; border: 1px solid var(--border); color: var(--dim);
    cursor: pointer; text-decoration: none; display: none;
  }
  #btn-report:hover { border-color: var(--blue); color: var(--blue); }

  /* ── Main ── */
  main { display: grid; grid-template-columns: 230px 1fr; overflow: hidden; }

  /* ── Sidebar ── */
  #sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-section { padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .sidebar-label { font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: var(--dim); margin-bottom: 10px; font-weight: 600; }

  /* Stage cards */
  .stage-card {
    padding: 9px 10px; border-radius: 8px; margin-bottom: 6px;
    background: var(--bg); border: 1px solid var(--border);
    cursor: pointer; user-select: none; transition: border-color .15s;
    position: relative;
  }
  .stage-card:hover { border-color: var(--blue); }
  .stage-card.selected { border-color: #1f6feb; background: #0c1f3a; }
  .stage-card.running  { border-color: var(--blue); animation: pulse 1.5s infinite; }
  .stage-card.passed   { border-color: var(--green); background: var(--green-dim); }
  .stage-card.failed   { border-color: var(--red); background: var(--red-dim); }
  .stage-card.skipped  { border-color: var(--border); opacity: .55; }

  .stage-top { display: flex; align-items: center; gap: 6px; }
  .stage-check {
    width: 16px; height: 16px; border-radius: 4px;
    border: 2px solid var(--border); background: var(--surface);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    font-size: 11px; transition: all .15s;
  }
  .stage-card.selected .stage-check { border-color: var(--blue); background: var(--blue); color: #fff; }
  .stage-name  { font-size: 13px; font-weight: 600; flex: 1; }
  .stage-icon  { font-size: 14px; }

  .stage-desc  { font-size: 11px; color: var(--dim); margin: 3px 0 5px 22px; line-height: 1.4; }
  .stage-counts { display: flex; gap: 6px; margin-left: 22px; flex-wrap: wrap; }
  .sc { font-size: 11px; font-weight: 600; padding: 1px 5px; border-radius: 3px; }
  .sc-pass { background: var(--green-dim); color: var(--green); }
  .sc-fail { background: var(--red-dim); color: var(--red); }
  .sc-skip { background: var(--yellow-dim); color: var(--yellow); }

  /* Buttons */
  .btn {
    width: 100%; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; transition: all .15s; letter-spacing: .3px;
  }
  #btn-run  { background: var(--accent); color: #fff; margin-bottom: 7px; }
  #btn-run:hover:not(:disabled) { background: var(--accent-h); }
  #btn-run:disabled { opacity: .45; cursor: not-allowed; }
  #btn-stop { background: var(--red-dim); color: var(--red); border: 1px solid var(--red); display: none; }
  #btn-stop:hover { background: var(--red); color: #fff; }
  #btn-clear { background: transparent; border: 1px solid var(--border); color: var(--dim); }
  #btn-clear:hover { border-color: var(--text); color: var(--text); }

  /* Grand total row */
  #grand-total { padding: 10px 14px; font-size: 12px; color: var(--dim); margin-top: auto; border-top: 1px solid var(--border); }
  #grand-total b { color: var(--text); }

  /* ── Terminal ── */
  #terminal-wrap { display: flex; flex-direction: column; overflow: hidden; }

  #terminal-toolbar {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px; background: var(--surface);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .tt-dot { width: 12px; height: 12px; border-radius: 50%; }
  .tt-dot.red { background: #ff5f56; }
  .tt-dot.yellow { background: #ffbd2e; }
  .tt-dot.green { background: #27c93f; }
  #terminal-title { font-size: 12px; color: var(--dim); margin-left: 4px; flex: 1; font-family: monospace; }
  #autoscroll-btn {
    font-size: 11px; padding: 2px 8px; border-radius: 4px;
    background: transparent; border: 1px solid var(--border); color: var(--dim);
    cursor: pointer;
  }
  #autoscroll-btn.active { border-color: var(--blue); color: var(--blue); }

  #copy-log-btn {
    font-size: 11px; padding: 2px 8px; border-radius: 4px;
    background: transparent; border: 1px solid var(--border); color: var(--dim);
    cursor: pointer;
  }
  #copy-log-btn:hover { border-color: var(--green); color: var(--green); }
  #copy-log-btn.copied { border-color: var(--green); color: var(--green); }

  #terminal {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
    font-size: 12.5px;
    line-height: 1.6;
    background: var(--bg);
  }
  #terminal::-webkit-scrollbar { width: 6px; }
  #terminal::-webkit-scrollbar-track { background: transparent; }
  #terminal::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .tl { display: block; white-space: pre-wrap; word-break: break-all; }
  .tl.pass   { color: var(--green); }
  .tl.fail   { color: var(--red); }
  .tl.error  { color: var(--orange); }
  .tl.skip   { color: var(--yellow); }
  .tl.header { color: var(--purple); font-weight: 600; }
  .tl.info   { color: var(--blue); }
  .tl.dim    { color: var(--dim); }

  .stage-banner {
    display: block; margin: 12px 0 4px;
    padding: 5px 10px; border-radius: 5px;
    background: #1d2d3e; border-left: 3px solid var(--blue);
    color: var(--blue); font-weight: 700; font-size: 12px; letter-spacing: .5px;
  }
  .stage-banner.done-pass { background: var(--green-dim); border-color: var(--green); color: var(--green); }
  .stage-banner.done-fail { background: var(--red-dim); border-color: var(--red); color: var(--red); }

  /* ── Scrollbar reset ── */
  #sidebar::-webkit-scrollbar { width: 4px; }
  #sidebar::-webkit-scrollbar-thumb { background: var(--border); }
</style>
</head>
<body>
<div id="app">

  <!-- Header -->
  <header>
    <h1>BusinessManager <span>/ Regression Runner</span></h1>
    <span id="status-badge">IDLE</span>
    <span id="timer">00:00</span>
    <div id="header-stats">
      <span class="hstat hstat-pass" id="hstat-pass" style="display:none">✓ 0</span>
      <span class="hstat hstat-fail" id="hstat-fail" style="display:none">✗ 0</span>
      <span class="hstat hstat-skip" id="hstat-skip" style="display:none">~ 0</span>
    </div>
    <a id="btn-report" href="/report" target="_blank">View Full Report</a>
  </header>

  <main>
    <!-- Sidebar -->
    <aside id="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-label">Stages</div>

        <div class="stage-card selected" id="card-1" onclick="toggleStage(1)">
          <div class="stage-top">
            <div class="stage-check" id="check-1">✓</div>
            <div class="stage-name">1 — Pre-check</div>
            <div class="stage-icon" id="icon-1">○</div>
          </div>
          <div class="stage-desc">Connectivity + OpenAPI spec</div>
          <div class="stage-counts" id="counts-1" style="display:none"></div>
        </div>

        <div class="stage-card selected" id="card-2" onclick="toggleStage(2)">
          <div class="stage-top">
            <div class="stage-check" id="check-2">✓</div>
            <div class="stage-name">2 — API Tests</div>
            <div class="stage-icon" id="icon-2">○</div>
          </div>
          <div class="stage-desc">All backend endpoints &amp; auth</div>
          <div class="stage-counts" id="counts-2" style="display:none"></div>
        </div>

        <div class="stage-card selected" id="card-3" onclick="toggleStage(3)">
          <div class="stage-top">
            <div class="stage-check" id="check-3">✓</div>
            <div class="stage-name">3 — E2E Browser</div>
            <div class="stage-icon" id="icon-3">○</div>
          </div>
          <div class="stage-desc">UI tests (needs npm run dev)</div>
          <div class="stage-counts" id="counts-3" style="display:none"></div>
        </div>

        <div class="stage-card selected" id="card-4" onclick="toggleStage(4)">
          <div class="stage-top">
            <div class="stage-check" id="check-4">✓</div>
            <div class="stage-name">4 — DB Integrity</div>
            <div class="stage-icon" id="icon-4">○</div>
          </div>
          <div class="stage-desc">Cascades &amp; constraints</div>
          <div class="stage-counts" id="counts-4" style="display:none"></div>
        </div>
      </div>

      <div class="sidebar-section">
        <button class="btn" id="btn-run" onclick="startRun()">▶  Run Selected</button>
        <button class="btn" id="btn-stop" onclick="stopRun()">■  Stop</button>
        <button class="btn" id="btn-clear" onclick="clearTerminal()">Clear Terminal</button>
      </div>

      <div id="grand-total">
        <div>Total:   <b id="gt-total">—</b></div>
        <div>Passed:  <b id="gt-pass" style="color:var(--green)">—</b></div>
        <div>Failed:  <b id="gt-fail" style="color:var(--red)">—</b></div>
        <div>Duration: <b id="gt-dur">—</b></div>
      </div>
    </aside>

    <!-- Terminal -->
    <div id="terminal-wrap">
      <div id="terminal-toolbar">
        <div class="tt-dot red"></div>
        <div class="tt-dot yellow"></div>
        <div class="tt-dot green"></div>
        <div id="terminal-title">regression-runner ~ ready</div>
        <button id="autoscroll-btn" class="active" onclick="toggleAutoscroll()">Auto-scroll ✓</button>
        <button id="copy-log-btn" onclick="copyLog()">Copy Log</button>
      </div>
      <div id="terminal">
        <span class="tl dim">Select stages on the left, then click ▶ Run Selected.</span>
        <span class="tl dim">Results stream here in real time.</span>
        <span class="tl dim"> </span>
      </div>
    </div>
  </main>
</div>

<script>
// ── State ────────────────────────────────────────────────────────────────────
let selected = new Set([1, 2, 3, 4]);
let autoScroll = true;
let timerInterval = null;
let runStart = null;
let totalPass = 0, totalFail = 0, totalSkip = 0;
let logLines = [];        // plain-text copy of every terminal line
let failedTests = [];     // nodeids of failed/errored tests

const stageCounts = { 1:{p:0,f:0,s:0}, 2:{p:0,f:0,s:0}, 3:{p:0,f:0,s:0}, 4:{p:0,f:0,s:0} };

// ── DOM helpers ──────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const terminal = $('terminal');

function appendLine(text, cls='dim') {
  logLines.push(text);
  const el = document.createElement('span');
  el.className = `tl ${cls}`;
  el.textContent = text;
  terminal.appendChild(el);
  if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
}

function copyLog() {
  const text = logLines.join('\n');
  const btn = $('copy-log-btn');
  const prev = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = prev; btn.classList.remove('copied'); }, 2000);
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = prev; btn.classList.remove('copied'); }, 2000);
  });
}

function appendBanner(text, cls='') {
  const el = document.createElement('span');
  el.className = `stage-banner ${cls}`;
  el.id = `banner-${text.replace(/\W/g,'_')}`;
  el.textContent = text;
  terminal.appendChild(el);
  if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
  return el;
}

// ── Stage card helpers ────────────────────────────────────────────────────────
function toggleStage(n) {
  if ($('btn-run').disabled) return;
  if (selected.has(n)) selected.delete(n);
  else selected.add(n);
  updateCards();
}

function updateCards() {
  for (let n = 1; n <= 4; n++) {
    const card = $(`card-${n}`);
    const chk  = $(`check-${n}`);
    if (!card) continue;
    if (selected.has(n)) {
      card.classList.add('selected');
      chk.textContent = '✓';
    } else {
      card.classList.remove('selected');
      chk.textContent = '';
    }
  }
}

function setCardState(n, state, icon='') {
  const card = $(`card-${n}`);
  if (!card) return;
  card.classList.remove('running','passed','failed','skipped');
  if (state) card.classList.add(state);
  if (icon) $(`icon-${n}`).textContent = icon;
}

function updateCounts(n) {
  const c = stageCounts[n];
  const el = $(`counts-${n}`);
  if (!el) return;
  el.style.display = 'flex';
  el.innerHTML =
    `<span class="sc sc-pass">${c.p} passed</span>` +
    (c.f ? `<span class="sc sc-fail">${c.f} failed</span>` : '') +
    (c.s ? `<span class="sc sc-skip">${c.s} skip</span>` : '');
}

function updateHeaderStats() {
  const hp = $('hstat-pass'), hf = $('hstat-fail'), hs = $('hstat-skip');
  hp.textContent = `✓ ${totalPass}`; hp.style.display = totalPass > 0 ? '' : 'none';
  hf.textContent = `✗ ${totalFail}`; hf.style.display = totalFail > 0 ? '' : 'none';
  hs.textContent = `~ ${totalSkip}`; hs.style.display = totalSkip > 0 ? '' : 'none';
}

// ── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  runStart = Date.now();
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - runStart) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2,'0');
    const ss = String(s % 60).padStart(2,'0');
    $('timer').textContent = `${mm}:${ss}`;
  }, 500);
}
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

// ── Autoscroll ───────────────────────────────────────────────────────────────
terminal.addEventListener('scroll', () => {
  const atBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 40;
  if (!atBottom && autoScroll) {
    autoScroll = false;
    $('autoscroll-btn').classList.remove('active');
    $('autoscroll-btn').textContent = 'Auto-scroll';
  }
});
function toggleAutoscroll() {
  autoScroll = !autoScroll;
  const btn = $('autoscroll-btn');
  btn.classList.toggle('active', autoScroll);
  btn.textContent = autoScroll ? 'Auto-scroll ✓' : 'Auto-scroll';
  if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
}

// ── Controls ─────────────────────────────────────────────────────────────────
function startRun() {
  if (!selected.size) { alert('Select at least one stage.'); return; }
  const stages = [...selected].sort();

  // Reset
  totalPass = totalFail = totalSkip = 0;
  for (let n = 1; n <= 4; n++) {
    stageCounts[n] = {p:0,f:0,s:0};
    setCardState(n, '', '○');
    const c = $(`counts-${n}`); if(c) c.style.display='none';
  }
  updateHeaderStats();
  $('gt-total').textContent = '—';
  $('gt-pass').textContent  = '—';
  $('gt-fail').textContent  = '—';
  $('gt-dur').textContent   = '—';

  fetch('/run', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({stages})
  }).then(r => r.json()).then(d => {
    if (d.error) alert(d.error);
  });
}

function stopRun() {
  fetch('/stop', {method:'POST'});
}

function clearTerminal() {
  terminal.innerHTML = '';
  logLines = [];
  failedTests = [];
}

// ── SSE Events ────────────────────────────────────────────────────────────────
function handleEvent(ev) {
  switch (ev.type) {
    case 'connected':
      if (ev.running) setStatus('running');
      break;

    case 'run_start': {
      logLines = [];
      failedTests = [];
      appendLine('');
      appendLine(`▶  Starting run — stages: ${ev.stages.join(', ')}`, 'info');
      appendLine('');
      setStatus('running');
      $('btn-run').disabled = true;
      $('btn-stop').style.display = '';
      $('btn-report').style.display = 'none';
      startTimer();
      // auto-scroll on new run
      autoScroll = true;
      $('autoscroll-btn').classList.add('active');
      $('autoscroll-btn').textContent = 'Auto-scroll ✓';
      break;
    }

    case 'stage_start': {
      appendBanner(`  Stage ${ev.stage}: ${ev.name}  `, '');
      setCardState(ev.stage, 'running', '⟳');
      $('terminal-title').textContent = `Stage ${ev.stage} — ${ev.name}`;
      break;
    }

    case 'line': {
      appendLine(ev.text, ev.css || 'dim');
      break;
    }

    case 'test_result': {
      const n = ev.stage;
      if (ev.outcome === 'passed')  { stageCounts[n].p++; totalPass++; }
      if (ev.outcome === 'failed')  { stageCounts[n].f++; totalFail++; failedTests.push(ev.nodeid); }
      if (ev.outcome === 'error')   { stageCounts[n].f++; totalFail++; failedTests.push(ev.nodeid); }
      if (ev.outcome === 'skipped') { stageCounts[n].s++; totalSkip++; }
      updateCounts(n);
      updateHeaderStats();
      break;
    }

    case 'stage_end': {
      const ok = ev.ok;
      const cls = ok ? 'done-pass' : 'done-fail';
      const icon = ok ? '✓' : '✗';
      const summary = `${ev.passed}p / ${ev.failed + ev.errors}f / ${ev.skipped}s — ${ev.duration}s`;
      appendLine('');
      appendLine(`  ${icon}  Stage ${ev.stage} (${ev.name}): ${summary}`, ok ? 'pass' : 'fail');
      appendLine('');
      setCardState(ev.stage, ok ? 'passed' : 'failed', icon);
      break;
    }

    case 'stage_skipped': {
      appendLine(`  ⏭  Stage ${ev.stage} (${ev.name}): SKIPPED — ${ev.reason}`, 'dim');
      setCardState(ev.stage, 'skipped', '⏭');
      break;
    }

    case 'run_end': {
      const ok = ev.ok;
      appendLine('');
      appendLine('━'.repeat(60), 'header');
      appendLine(
        ok
          ? `  ✓  ALL TESTS PASSED — ${ev.passed} passed in ${ev.duration}s`
          : `  ✗  TESTS FAILED — ${ev.passed} passed, ${ev.failed} failed in ${ev.duration}s`,
        ok ? 'pass' : 'fail'
      );
      appendLine('━'.repeat(60), 'header');

      if (!ok && failedTests.length > 0) {
        appendLine('');
        appendLine('  FAILED TESTS:', 'fail');
        failedTests.forEach(id => appendLine('    FAILED  ' + id, 'fail'));
        appendLine('');
        appendLine('  Use "Copy Log" in the toolbar to copy the full output to clipboard.', 'info');
        appendLine('━'.repeat(60), 'header');
      }

      setStatus(ok ? 'passed' : 'failed');
      $('btn-run').disabled = false;
      $('btn-stop').style.display = 'none';
      $('btn-report').style.display = '';
      $('terminal-title').textContent = ok ? '✓ Passed' : '✗ Failed';
      stopTimer();

      const total = ev.passed + ev.failed + ev.skipped;
      $('gt-total').textContent = total;
      $('gt-pass').textContent  = ev.passed;
      $('gt-fail').textContent  = ev.failed;
      $('gt-dur').textContent   = ev.duration + 's';
      break;
    }
  }
}

function setStatus(state) {
  const badge = $('status-badge');
  badge.className = '';
  badge.classList.add(state);
  badge.textContent = state.toUpperCase();
}

// ── SSE Connection ────────────────────────────────────────────────────────────
function connect() {
  const src = new EventSource('/events');
  src.onmessage = e => {
    try { handleEvent(JSON.parse(e.data)); } catch(err) {}
  };
  src.onerror = () => {
    setTimeout(connect, 3000);
  };
}

connect();
</script>
</body>
</html>"""


# ── Server + Entry Point ──────────────────────────────────────────────────────
class _ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description="BusinessManager Regression Runner GUI")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port (default {PORT})")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    args = parser.parse_args()

    REPORTS_DIR.mkdir(exist_ok=True)

    # Validate config exists
    env_file = SCRIPT_DIR / ".env"
    if not env_file.exists():
        print("\n[WARNING] regressiontest/.env not found.")
        print("  Copy .env.template to .env and fill in ADMIN_PASSWORD before running tests.\n")

    server = _ThreadedHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://localhost:{args.port}"

    print(f"\n  BusinessManager Regression Runner")
    print(f"  ──────────────────────────────────")
    print(f"  GUI:    {url}")
    print(f"  Tests:  {SCRIPT_DIR}")
    print(f"  Press Ctrl+C to stop\n")

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
