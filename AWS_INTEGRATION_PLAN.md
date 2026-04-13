# AWS Integration Plan — BusinessManager
_Created: 2026-04-13_

This document outlines the plan for integrating AWS Always-Free services into the BusinessManager
application. Each section covers what is being built, why, how it connects to the existing codebase,
and the implementation steps required.

---

## Overview

| Service | Priority | Effort | Cost |
|---|---|---|---|
| SES — Business Email | High | Medium | Always Free (62K emails/mo) |
| CloudFront — Frontend Hosting | High | Low | Always Free (1TB/mo) |
| CloudWatch — Filtered Logging | Medium | Low | Always Free (5GB/mo) |
| Lambda — Background Functions | Medium | Medium | Always Free (1M req/mo) |
| Step Functions — Workflows | Low | Medium | Always Free (4K transitions/mo) |
| DynamoDB — Free Database | Low–High* | High | Always Free (25GB) |

> *DynamoDB priority escalates to High if PostgreSQL hosting costs become a concern.*

---

## 1. SES — Business Email Sending

### What It Does
Amazon SES (Simple Email Service) sends emails on behalf of the business — invoices, appointment
reminders, payroll slips, leave request notifications — using the business's own email address as
the sender. The business owner never sees SES; they just configure their email address in Settings.

### How It Works
- AWS requires the sender email address to be **verified** — AWS sends a one-click confirmation
  link to that address. This is standard practice and confirms the business owns the address.
- The BusinessManager backend uses `boto3` (AWS Python SDK) to call SES.
- All emails go out from a single SES account (the app's AWS account), but the `From:` address
  shown to recipients is the business's own verified address.
- Replies go back to the business email — SES is invisible to end recipients.

### Codebase Changes

**Backend:**
- `backend/routers/email.py` — new router with endpoints:
  - `POST /api/v1/email/verify` — trigger AWS verification email for a given address
  - `GET  /api/v1/email/verify/status` — check if address is verified in SES
  - `POST /api/v1/email/send` — internal endpoint (not public) to send an email
  - `POST /api/v1/email/test` — send a test email to confirm setup works
- `backend/services/ses_service.py` — boto3 SES wrapper (send_email, check_identity_status)
- `backend/.env` — add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**Frontend:**
- `frontend/src/pages/components/Panel_Email.jsx` — new Settings panel (Email tab)
  - Input: business email address
  - Button: "Verify Email" → calls `/api/v1/email/verify`
  - Status badge: Verified / Pending / Not configured
  - Button: "Send Test Email" (only enabled when verified)
- `frontend/src/pages/components/Panel_Settings.jsx` — add "Email" tab alongside existing tabs

**Where Emails Get Triggered (existing pages, minimal changes):**
- `Employees.jsx` — payroll slip sent after pay is processed
- `Schedule.jsx` — appointment confirmation / reminder
- `Clients.jsx` — invoice or follow-up email
- `backend/routers/payroll.py` — call `ses_service.send_email()` after payroll record is created
- `backend/routers/leave_requests.py` — notify employee when leave is approved/denied

### Implementation Steps
1. Create AWS IAM user with `AmazonSESFullAccess` policy, generate access keys
2. Add AWS credentials to `backend/.env`
3. Install `boto3` → add to `backend/requirements.txt`
4. Build `ses_service.py` with `send_email()` and `get_verification_status()` functions
5. Build `email.py` router, register in `main.py`
6. Build `Panel_Email.jsx` in Settings
7. Wire email calls into payroll, leave requests, and schedule routers
8. Test with a real email address in SES sandbox mode
9. Request SES production access (removes sandbox restriction) via AWS console

---

## 2. CloudFront — Frontend Hosting

### What It Does
CloudFront is a CDN (Content Delivery Network). Instead of serving the React app from an EC2
instance (which costs money), the built frontend is uploaded to an S3 bucket and served through
CloudFront — globally fast, HTTPS included, and free up to 1TB/month of data transfer.

### Is This the Right Use?
Yes. CloudFront is exactly designed for this. The React app is a collection of static files
(HTML, JS, CSS) after `npm run build`. These do not need a running server — they just need
to be hosted somewhere. CloudFront + S3 is the standard AWS way to do this for free.

**The backend (FastAPI/uvicorn) still needs a server** — CloudFront only replaces frontend hosting.

### Current vs Future Architecture

```
CURRENT:
  Browser → EC2 Instance → serves React files + proxies API

FUTURE:
  Browser → CloudFront → S3 (React static files)
  Browser → App Runner / EC2 → FastAPI backend (API only)
```

### Codebase Changes

**Build process:**
- `frontend/vite.config.js` — ensure `base` is set correctly for S3/CloudFront paths
- `package.json` — add deploy script: `"deploy:frontend": "vite build && aws s3 sync frontend/dist s3://YOUR_BUCKET_NAME --delete"`

**Infrastructure (manual AWS setup, one-time):**
1. Create S3 bucket (e.g. `businessmanager-frontend`) — block public access
2. Create CloudFront distribution pointing to S3 bucket
3. Set default root object to `index.html`
4. Add CloudFront error page: 404 → `/index.html` (required for React Router)
5. Note the CloudFront URL (e.g. `https://abc123.cloudfront.net`)

**Frontend API URL:**
- `frontend/src/services/api.js` — ensure API base URL comes from env variable
- `frontend/.env.production` — `VITE_API_URL=https://your-backend-url.com`

**Deployment:**
- `aws s3 sync frontend/dist s3://BUCKET_NAME --delete` after each build
- Optional: automate with GitHub Actions on push to `main`

### Implementation Steps
1. Run `npm run build` — confirm `frontend/dist/` is generated correctly
2. Create S3 bucket in AWS console
3. Create CloudFront distribution, set S3 as origin
4. Configure React Router fallback (404 → index.html)
5. Update `VITE_API_URL` in `.env.production` to point to backend
6. Upload `frontend/dist/` to S3
7. Test the CloudFront URL in browser
8. (Optional) Add a custom domain via Route 53 or your DNS provider

---

## 3. CloudWatch — Filtered Application Logging

### What It Does
CloudWatch collects and stores logs from the backend. The key difference from basic logging is
**structured, filtered logging** — instead of a wall of text, logs are categorised by feature area
and severity so that errors in payroll, auth failures, email sends, etc. can be searched and
alerted on independently.

### Log Structure
Each log entry will be a JSON object:

```json
{
  "timestamp": "2026-04-13T15:30:00Z",
  "level": "ERROR",
  "module": "payroll",
  "action": "generate_payslip",
  "user_id": 42,
  "message": "Failed to calculate gross pay — missing hourly_rate",
  "details": {}
}
```

### Log Groups (one per feature area)
| Log Group | Captures |
|---|---|
| `/businessmanager/auth` | Logins, token failures, permission denials |
| `/businessmanager/payroll` | Payroll processing, payslip generation |
| `/businessmanager/email` | SES sends, verification events |
| `/businessmanager/schedule` | Appointment creates, updates, reminders |
| `/businessmanager/documents` | Uploads, edits, downloads |
| `/businessmanager/errors` | All ERROR-level events across all modules |

### Codebase Changes

**Backend:**
- `backend/services/logger.py` — new structured logger service
  - `get_logger(module: str)` — returns a logger that sends to the correct CloudWatch log group
  - Wraps Python's `logging` module + `watchtower` library (CloudWatch handler)
- Each router imports `get_logger(__name__)` and replaces `print()` statements
- `backend/.env` — same AWS credentials as SES (reused)

**Install:**
- `watchtower` → add to `backend/requirements.txt`

**Frontend (optional):**
- `frontend/src/services/logger.js` — client-side error logger
  - Catches unhandled React errors (via ErrorBoundary) and POSTs to backend log endpoint
  - `backend/routers/client_logs.py` — receives frontend errors and forwards to CloudWatch

**CloudWatch Alarms (manual AWS setup):**
- Alarm: ERROR count > 5 in 5 minutes → SNS notification → email alert
- Alarm: Auth failures > 10 in 1 minute → possible brute force alert

### Implementation Steps
1. Install `watchtower`: add to `requirements.txt`
2. Build `backend/services/logger.py`
3. Add CloudWatch log group creation to app startup (`main.py`)
4. Replace `print()` and bare `logging` calls in routers with structured logger
5. (Optional) Build frontend error capture via `ErrorBoundary.jsx` → backend endpoint
6. Set log retention to 30 days in CloudWatch (free tier: 5GB — manage with retention)
7. Create metric filters and alarms in CloudWatch console

---

## 4. Lambda — Background Functions

### What It Does
Lambda functions are small, self-contained Python scripts that run in the cloud **without a
server**. They are triggered by a schedule (like a cron job), an API call, or a Step Function.
They are **not part of the main application** — they live in their own directory and are deployed
separately to AWS.

These handle tasks that should not block the main API or require a server to be always running.

### Directory Structure

```
BusinessManager/
├── backend/
├── frontend/
├── lambda/                        ← new top-level directory
│   ├── shared/
│   │   ├── db.py                  ← shared DB connection helper
│   │   ├── ses.py                 ← shared SES email sender
│   │   └── config.py             ← env vars / secrets
│   ├── payroll_generator/
│   │   ├── handler.py            ← Lambda entry point
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── appointment_reminder/
│   │   ├── handler.py
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── invoice_sender/
│   │   ├── handler.py
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── report_generator/
│   │   ├── handler.py
│   │   ├── requirements.txt
│   │   └── README.md
│   └── deploy.sh                 ← script to zip and deploy each function
```

### Lambda Functions Planned

#### `payroll_generator`
- **Trigger:** EventBridge schedule (e.g. every Friday at 5pm) OR manual API call
- **What it does:** Queries the database for employees with a pay period ending today,
  calculates gross/net pay, creates PaySlip records, sends payslip emails via SES
- **Replaces:** The manual "Process Pay" button still exists in the UI, but this automates it

#### `appointment_reminder`
- **Trigger:** EventBridge schedule (daily at 8am)
- **What it does:** Queries appointments for the next 24 hours, sends reminder emails
  to clients and/or employees via SES
- **Replaces:** Nothing — this is new functionality

#### `invoice_sender`
- **Trigger:** API call from backend (when a sale is completed) OR scheduled
- **What it does:** Generates a PDF invoice and emails it to the client via SES
- **Replaces:** Nothing — this is new functionality

#### `report_generator`
- **Trigger:** EventBridge schedule (e.g. every Monday 6am)
- **What it does:** Runs revenue/appointment/inventory reports, emails summary to admin
- **Replaces:** Nothing — the Reports page still exists for on-demand, this automates weekly delivery

### How Lambda Connects to the Database
Lambda functions will use the same `DATABASE_URL` (stored in AWS Secrets Manager or
Lambda environment variables) to connect to PostgreSQL directly via `psycopg`.

### Implementation Steps
1. Create `lambda/` directory structure
2. Build `lambda/shared/` helpers (DB connection, SES wrapper, config)
3. Implement `appointment_reminder` first (simplest, high value)
4. Implement `invoice_sender` second
5. Implement `payroll_generator` third (most complex)
6. Implement `report_generator` fourth
7. Create IAM role for Lambda with permissions: RDS access, SES send, CloudWatch logs
8. Deploy each function via `deploy.sh` (zip + `aws lambda create-function`)
9. Set up EventBridge rules for scheduled triggers
10. Test each function manually via AWS Lambda console before activating schedules

---

## 5. Step Functions — Workflow Orchestration

### What It Does
Step Functions coordinate multi-step workflows where each step depends on the previous one.
Rather than a single Lambda doing everything, Step Functions chain Lambdas together with
conditional logic, retries, and error handling.

### Intended Use
Step Functions in this project are intended to be **triggered by an AI agent or an explicit
admin action**, not by end users directly. They handle complex business processes that involve
multiple steps across multiple services.

### Planned Workflows

#### Client Onboarding Workflow
```
New Client Created
  → Send welcome email (SES Lambda)
  → Create default appointment slot (API call)
  → Notify assigned employee (SES Lambda)
  → Log onboarding event (CloudWatch)
```

#### Payroll Processing Workflow
```
Payroll Period Ends
  → Validate all timesheets complete
  → Calculate gross/net for each employee
  → Generate payslip PDFs
  → Send payslip emails
  → Mark period as paid
  → Log to audit trail
```

#### Appointment Lifecycle Workflow
```
Appointment Booked
  → Send confirmation to client
  → Wait 24 hours
  → Send reminder to client
  → Wait for appointment time
  → Send follow-up / feedback request
```

### Codebase Changes
- Step Functions are defined as **state machine JSON files** in `lambda/workflows/`
- Each workflow references Lambda function ARNs
- The backend can trigger a workflow via `boto3` Step Functions client:
  `backend/services/stepfunctions_service.py`
- A new admin endpoint `POST /api/v1/workflows/trigger` allows triggering from the UI

### Implementation Steps
1. Define state machine JSON for `appointment_lifecycle` workflow first
2. Deploy state machine via AWS console or CLI
3. Build `backend/services/stepfunctions_service.py`
4. Add trigger endpoint to backend
5. Add workflow trigger UI in the relevant admin panels (Schedule, Payroll)
6. Expand to other workflows after first one is validated

> Note: Step Functions work best after Lambda functions are deployed. Implement Lambda first.

---

## 6. DynamoDB — Free Tier Database (Cost Mitigation)

### What It Does
DynamoDB is a NoSQL database with a permanent free tier of 25GB storage and
25 read/write capacity units per month. It does not replace PostgreSQL for relational data,
but can handle specific use cases — and if PostgreSQL costs become a concern, a migration
plan exists.

### Current Database Situation
- Current: PostgreSQL (hosted — may incur cost depending on provider)
- DynamoDB free tier: 25GB, 25 WCU/RCU — enough for a small business application

### Immediate Use (No Migration Required)
These data types are a natural fit for DynamoDB without touching PostgreSQL:

| Use Case | DynamoDB Table | Notes |
|---|---|---|
| Audit logs | `audit_logs` | Append-only, high write volume |
| Session / token cache | `sessions` | Short TTL, fast reads |
| Notification queue | `notifications` | Per-user unread notifications |
| Feature flags | `feature_flags` | App-wide toggles |

### Migration Plan (If PostgreSQL Costs Arise)
If the hosted PostgreSQL bill becomes a concern, the migration path is:

**Phase 1 — Hybrid (low effort)**
- Move audit logs, sessions, and notifications to DynamoDB (already planned above)
- Keep all relational data (clients, employees, schedules, etc.) in PostgreSQL
- Reduces PostgreSQL storage and query load

**Phase 2 — Evaluate costs**
- If PostgreSQL cost drops to $0 with reduced load → done
- If still costly → assess which tables can move to DynamoDB without losing relational integrity

**Phase 3 — Full migration (high effort, only if needed)**
- Migrate remaining tables using a custom migration script (`db_schema.py` already exists)
- Update all SQLModel models to use DynamoDB via `boto3` instead of SQLAlchemy
- This is a significant change — only warranted if hosting costs are substantial

### Codebase Changes (Immediate — Audit Logs)
- `backend/services/dynamo_service.py` — boto3 DynamoDB wrapper
- `backend/routers/audit.py` — update to write to DynamoDB instead of PostgreSQL
- `backend/.env` — same AWS credentials (reused from SES and CloudWatch)

### Implementation Steps
1. Create DynamoDB tables in AWS console: `audit_logs`, `sessions`, `notifications`
2. Build `backend/services/dynamo_service.py`
3. Migrate audit log writes to DynamoDB (lowest risk, no relational dependencies)
4. Add TTL to sessions table (auto-expire old sessions)
5. Monitor PostgreSQL storage — if reduction is sufficient, stop here
6. Revisit full migration only if PostgreSQL costs appear in Cost Explorer

---

## AWS Credentials — Shared Configuration

All services above (SES, CloudWatch, Lambda invocation, Step Functions, DynamoDB) use the
**same AWS credentials**. This is configured once and shared.

### Local Development
`backend/.env`:
```
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_REGION=us-east-1
DATABASE_URL=postgresql+psycopg://...
```

### Production
Store credentials in **AWS Secrets Manager** or as **environment variables** on your hosting
platform (App Runner / EC2). Never commit credentials to git.

### IAM Policy for the Application User
Create a single IAM user (`businessmanager-app`) with these policies:
- `AmazonSESFullAccess`
- `CloudWatchLogsFullAccess`
- `AmazonDynamoDBFullAccess`
- `AWSStepFunctionsFullAccess` (for triggering workflows)
- `AWSLambdaRole` (for invoking Lambda functions)

---

## Implementation Order (Recommended)

| Phase | What | Why |
|---|---|---|
| **Phase 1** | AWS credentials + IAM user | Required for everything else |
| **Phase 2** | CloudWatch logging | Low effort, immediately useful for debugging |
| **Phase 3** | SES + Email Settings UI | High value, enables email across all features |
| **Phase 4** | CloudFront frontend hosting | Eliminates EC2 frontend cost |
| **Phase 5** | Lambda functions | `appointment_reminder` first, then others |
| **Phase 6** | DynamoDB audit logs | Quick win, free storage |
| **Phase 7** | Step Functions | After Lambda functions are stable |

---

## What Is Not in This Plan

- **Cognito (social login)** — not included. Existing JWT auth is sufficient. Social login
  (Google/Yahoo account linking) can be added later as an optional enhancement if credibility
  or user convenience becomes a priority. It does not affect core functionality.

---

_This document will be updated as each phase is implemented._
