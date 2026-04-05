# Step 6 Manual Sign-Off Template

Date:
Tester:
Branch:
Environment:

## Instructions

1. Run automated checks first: `powershell -ExecutionPolicy Bypass -File .\verify-step6.ps1`
2. Start required services and UI surfaces.
3. Fill each scenario with Result, Evidence, and Notes.
4. Final sign-off is approved only when all Critical scenarios pass.

## Result Values

PASS
FAIL
BLOCKED
N/A

## Manager Surface Scenarios

### M-01

Priority: High
Scenario: Manager login and permission refresh
Steps: Login and open protected pages; validate permission-restricted route behavior.
Expected: Access rules are correct and stale permission denial is resolved after refresh path.
Result:
Evidence:
Notes:

### M-02

Priority: Critical
Scenario: Sales checkout consistency
Steps: Build mixed cart where applicable, complete checkout, verify UI/backend status alignment.
Expected: Post-checkout status and totals remain consistent after refresh.
Result:
Evidence:
Notes:

### M-03

Priority: High
Scenario: Schedule attendee synchronization
Steps: Create, edit, and remove attendees on schedule entries.
Expected: Attendee state remains consistent without duplicate or orphan rows.
Result:
Evidence:
Notes:

### M-04

Priority: High
Scenario: Reports parity check
Steps: Open report date ranges including edge/end dates.
Expected: Revenue and sales views reflect expected source totals and inclusive date behavior.
Result:
Evidence:
Notes:

## Client Surface Scenarios

### C-01

Priority: Medium
Scenario: Company select and branding fallback
Steps: Open portal, select company, validate hero/banner/logo fallback paths.
Expected: Portal loads branding cleanly and degrades gracefully when assets are missing.
Result:
Evidence:
Notes:

### C-02

Priority: High
Scenario: Slot conflict messaging
Steps: Attempt booking with stale/unavailable slot conditions.
Expected: User receives clear conflict guidance and availability refresh behavior.
Result:
Evidence:
Notes:

### C-03

Priority: Critical
Scenario: Checkout and pay lifecycle
Steps: Checkout and pay from cart; verify order history updates.
Expected: Order transitions are correct, payment state aligns, and stale-state recovery works.
Result:
Evidence:
Notes:

### C-04

Priority: High
Scenario: Order History controls and sync UI
Steps: Validate pay button lock, refresh button, last-synced text, and auto-refresh badge.
Expected: Controls prevent duplicate pay and status sync indicators update as expected.
Result:
Evidence:
Notes:

## Cross-Surface Contract Scenarios

### X-01

Priority: Critical
Scenario: Payment visibility across surfaces
Steps: Complete client pay flow and inspect manager-side visibility.
Expected: Manager views reflect paid order status without manual data correction.
Result:
Evidence:
Notes:

### X-02

Priority: Critical
Scenario: Booking to schedule progression after payment
Steps: Pay booking-linked order and inspect booking and schedule state.
Expected: Booking and schedule states move to expected confirmed and scheduled state.
Result:
Evidence:
Notes:

### X-03

Priority: Critical
Scenario: Inventory deduction and idempotent pay behavior
Steps: Validate stock changes on paid order and retry pay on already-ordered path.
Expected: Inventory deduction occurs once; retry pay does not double-deduct.
Result:
Evidence:
Notes:

## Defect Log

Defect ID:
Scenario ID:
Severity:
Repro Summary:
Status:
Owner:

## Final Decision

Critical scenarios passing count:
High scenarios passing count:
Open blockers:

Final Step 6 Manual Sign-Off:

- [ ] APPROVED
- [ ] NOT APPROVED

Approver:
Date:
