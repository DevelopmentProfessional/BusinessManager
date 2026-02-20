# Data Completeness Analysis

_Reviewed: 2026-02-20_

This document identifies gaps between the database schema and the frontend interface — both tables missing from the database and features in the database that are not yet surfaced in the UI.

---

## 1. Tables Missing from the Database

These are features that exist (or are partially built) in the interface but have **no corresponding database table**, meaning data cannot be persisted.

---

### 1.1 `sale_transaction` — **Critical Gap**

**What the UI does:**
The Sales page (`Sales.jsx`) is a fully functional POS system with a cart, checkout modal (`CheckoutModal.jsx`), client selection, card/cash payment flow, and a "Sales History" section.

**What's missing in the DB:**
Sales transactions are saved to **`localStorage` only** — they are lost when the browser clears storage. The code explicitly acknowledges this:
```js
// Sales.jsx line 395-397
const updated = [sale, ...salesHistory].slice(0, 50); // Keep last 50
setSalesHistory(updated);
try { localStorage.setItem('salesHistory', JSON.stringify(updated)); } catch {}
```
There is also a hardcoded placeholder at the bottom of the page:
```jsx
// Sales.jsx line 862-867
<p className="mb-2">Sales history feature coming soon</p>
```

**Table needed:** `sale_transaction`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID FK → client | Optional |
| employee_id | UUID FK → user | Who processed the sale |
| subtotal | float | Before tax |
| tax_amount | float | Tax charged |
| total | float | Final amount |
| payment_method | str | "card" or "cash" |
| created_at | datetime | Transaction timestamp |

**Also needed:** `sale_transaction_item` (line items per transaction)
| Column | Type | Notes |
|---|---|---|
| sale_transaction_id | UUID FK | Parent transaction |
| item_id | UUID | ID of inventory or service |
| item_type | str | "product" or "service" |
| item_name | str | Snapshot of name at time of sale |
| unit_price | float | Price at time of sale |
| quantity | int | Units sold |
| line_total | float | unit_price × quantity |

---

### 1.2 `schedule_recurrence` — **Moderate Gap**

**What the UI implies:**
The `AppointmentType` enum includes `SERIES` and the `RecurrenceFrequency` enum (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`) exists in `models.py`. This implies recurring appointment support was planned.

**What's missing in the DB:**
The `Schedule` model has no recurrence fields. There is no table or columns to store:
- Recurrence frequency
- Recurrence end date / number of occurrences
- Parent schedule ID (to group a series together)

Without this, creating a recurring appointment just creates a single one-time event regardless of type.

**Columns needed on `schedule` table** (or a separate `schedule_recurrence` table):
| Column | Type | Notes |
|---|---|---|
| recurrence_frequency | str | daily / weekly / biweekly / monthly |
| recurrence_end_date | datetime | When series stops |
| recurrence_count | int | Alternative: max occurrences |
| parent_schedule_id | UUID FK → schedule | Groups a series together |
| is_recurring_master | bool | True on the root event |

---

## 2. Interface Items That Need to Be Added to the UI

These are features that **exist in the database and/or backend** but have **no corresponding page or UI** in the frontend.

---

### 2.1 Tasks Page — **Critical Gap**

**What exists in the DB/backend:**
- `task` table: title, description, status, priority, due_date, assigned_to_id
- `task_link` table: many-to-many task relationships with link_type
- `backend/routers/tasks.py`: full CRUD router with GET, POST, PUT, DELETE + link/unlink endpoints
- `tasksAPI` in `frontend/src/services/api.js` (lines 494–520): complete API client

**What's missing:**
- `tasks.py` router is **NOT registered** in `backend/main.py` — none of the task endpoints are reachable
- There is **no `Tasks.jsx` page** in the frontend
- There is no navigation link to a Tasks section

**To fix:**
1. Add `app.include_router(tasks.router, prefix="/api/v1", tags=["tasks"])` to `backend/main.py`
2. Create a `Tasks.jsx` page with a list, create/edit modal, priority/status filters, due date display, and task linking UI
3. Add "Tasks" to the sidebar navigation in `Layout.jsx`

---

### 2.2 Leave Request Approval Interface — **Moderate Gap**

**What exists in the DB/backend:**
- `leave_request` table: user_id, leave_type (vacation/sick), start_date, end_date, days_requested, status (pending/approved/denied), notes
- `leaveRequestsAPI` in `api.js` (lines 621–631): getByUser, create, update, delete
- `Profile.jsx`: employees can submit leave requests and view their own status

**What's missing:**
- No UI for **managers/admins to view all pending leave requests** and approve or deny them
- No notification or summary of pending leave requests anywhere
- The Employees page has no leave request tab or section

**To add to the interface:**
- A "Leave Requests" tab or section in the Employees page (for admin/manager roles) showing all pending requests with Approve/Deny actions
- Optional: a badge/counter in the sidebar showing pending leave request count

---

### 2.3 Insurance Plan Management UI — **Minor Gap**

**What exists in the DB/backend:**
- `insurance_plan` table: name, description, is_active
- `insurancePlansAPI` in `api.js` (lines 633–647): getAll, create, update, delete
- `EmployeeFormTabs.jsx`: loads and shows plans in a dropdown for employee assignment

**What's missing:**
- No UI to **create, edit, or deactivate** insurance plans
- Plans are seeded by the database migration but there is no admin interface to manage them

**To add to the interface:**
- An "Insurance Plans" section within the Settings page (already exists at `/settings`) allowing admins to add/edit/toggle plans
- Or a dedicated tab within Employees page administration

---

### 2.4 Reports Backend — **Critical Gap**

**What the frontend calls:**
The `Reports.jsx` page and `reportsAPI` call these endpoints:
- `GET /api/v1/reports/appointments`
- `GET /api/v1/reports/revenue`
- `GET /api/v1/reports/clients`
- `GET /api/v1/reports/services`
- `GET /api/v1/reports/inventory`
- `GET /api/v1/reports/employees`

**What exists in the backend:**
There is **no `reports.py` router** in `backend/routers/` and no reports router is included in `main.py`. All `/reports/*` requests return 404. The frontend silently falls back to randomly generated mock data on failure.

**To fix:**
1. Create `backend/routers/reports.py` with SQL aggregation queries per report type
2. Register it: `app.include_router(reports.router, prefix="/api/v1", tags=["reports"])`

---

### 2.5 Inventory → Service Link — **Minor Gap**

**What exists in the DB:**
The `Inventory` model has `service_id: Optional[UUID] = Field(foreign_key="service.id")` for linking resources/assets to specific services.

**What's missing in the UI:**
The inventory creation/edit form (`ItemForm.jsx`) does not expose the `service_id` field. There is no way for a user to link an inventory item to a service through the interface.

**To add to the interface:**
- A "Linked Service" dropdown in the Inventory item form (visible when item type is RESOURCE or ASSET)

---

### 2.6 Schedule Recurrence UI — **Minor Gap**

**What exists in the DB/backend:**
- `RecurrenceFrequency` enum: DAILY, WEEKLY, BIWEEKLY, MONTHLY (in `models.py`)
- `AppointmentType.SERIES` value exists

**What's missing in the UI:**
The `ScheduleForm.jsx` has no UI fields for:
- Selecting recurrence frequency
- Setting a recurrence end date or occurrence count

When a user selects "Series" as the appointment type, there is no follow-up to configure the actual recurrence pattern.

**To add to the interface:**
- Conditional recurrence fields in `ScheduleForm.jsx` that appear when `appointment_type === 'series'`
- Frequency selector (Daily / Weekly / Biweekly / Monthly)
- End date picker or occurrence count

---

### 2.7 Schedule Attendees UI — **Minor Gap**

**What exists in the DB/backend:**
- `schedule_attendee` table: schedule_id, user_id, client_id, attendance_status
- `scheduleAttendeesAPI` in `api.js`: create, delete endpoints

**What's missing in the UI:**
The `ScheduleForm.jsx` does not appear to have a UI for adding/managing multiple attendees to a meeting. The attendee table exists but it's not clear where attendees can be added or their status tracked in the schedule view.

**To add to the interface:**
- A multi-select attendee field in the Schedule form (for appointment_type === 'meeting')
- Attendance status display (pending/accepted/declined) in the schedule detail view

---

### 2.8 Document `description` Field Display — **Minor Gap**

**What exists in the DB:**
The `Document` model has a `description: Optional[str]` field.

**What the frontend shows:**
Documents are listed and viewable, but the description field visibility in the document list table and the document viewer modal should be verified to ensure it's displayed and editable.

---

## Summary Table

| Gap | Type | Severity |
|---|---|---|
| `sale_transaction` table missing | Missing DB table | Critical |
| `schedule_recurrence` fields missing | Missing DB table/columns | Moderate |
| Tasks page & router not connected | Missing UI + router registration | Critical |
| Leave request approval UI | Missing UI | Moderate |
| Insurance plan management UI | Missing UI | Minor |
| Reports backend (`/reports/*` returns 404) | Missing backend router | Critical |
| Inventory → Service link not in UI | Missing UI field | Minor |
| Schedule recurrence UI fields | Missing UI fields | Minor |
| Schedule attendees UI | Missing UI | Minor |
| Document description field | Missing/unclear UI | Minor |
