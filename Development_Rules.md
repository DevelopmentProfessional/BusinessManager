# Business Manager Development Rules

## Repository Information

- 🔗 **GitHub Repository**: <https://github.com/DevelopmentProfessional/BusinessManager>
- 🌐 **Production URL**: <https://lavishbeautyhairandnail.care>
- 📊 **API URL**: <https://api.lavishbeautyhairandnail.care>

## Project Overview
This document outlines the development rules and guidelines for the Business Manager application - a comprehensive salon management system.

## Architecture

## Production Deployment Policy

- Nothing is pushed or deployed to production unless explicitly authorized in writing (e.g., via a commit message note, PR approval comment, or task instruction that states "Approved for production").
- If production deployments are paused, they remain paused until an explicit written instruction states they may resume. Do not assume resumption.
- All production pushes must go through a PR with:
  - A reviewer approval from the project owner.
  - A short release note in the PR description.
  - Confirmation that all non-production files/folders are excluded.

## Non-Production Artifacts (Tests, Docs, Scratch)

- Local-only folders are excluded from VCS and production by default:
  - `Documentation/`
  - `TestSection/`
  - Root-level `test/` and `tests/` folders
- Common local-only files are excluded (see `.gitignore`).
- Test and debug scripts are not deployed to production unless explicitly approved and documented in the PR.

## AI Assistant Operational Guidelines

- Always run commands in the IDE's internal terminal to avoid external shell hangs.
- If a tool or command appears to hang or stall, cancel it and re-run inside the internal terminal.
- Prefer blocking execution for short, critical checks so output is visible; use non-blocking only for long-running servers with clear feedback.
- Never auto-run commands that can alter system state or make external requests without explicit user approval.

## Version Control and Branching

- Use feature branches for changes. Do not commit directly to main/master.
- Keep commits small and descriptive. Use PRs to merge into main.
- Ensure `.gitignore` is up-to-date before opening PRs.

## Checklists Before Merging to Main

- Code builds locally without errors (frontend and backend).
- Tests relevant to the change pass locally.
- No non-production files are included in the diff.
- Security keys/secrets are not committed.
- If targeting production, the PR explicitly states "Approved for production" and includes release notes.

## Bug Logging and Verification

- All discovered bugs must be logged immediately with a short, factual description and reproduction steps.
- Every verification/check attempt for a bug must be logged (what was checked, result), kept concise.
- Continue logging checks for the bug until all planned checks are completed and the bug is resolved or explicitly deferred.
- Link commits/PRs to the bug entry when changes are made.
