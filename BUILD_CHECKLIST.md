# BusinessManager — Build Checklist
> Last updated: 2026-03-01
> See AUDIT_REPORT.md for full context on each item.

---

## HOW TO USE THIS CHECKLIST

- **Check off each item as it is completed** using `[x]` syntax.
- Work **top to bottom within each phase** — items within a phase can sometimes be done in parallel, but phases must complete in order.
- If a session ends mid-phase, resume from the first unchecked item.
- Each item includes the file(s) to touch so you can start immediately.
- Backend items use FastAPI/SQLModel conventions; frontend uses React + TailwindCSS + Bootstrap mix.

---

## PHASE 0 — Independent Fixes (No Dependencies)
> These touch isolated files and do not block or depend on anything else.
> Do these first — quick wins that improve the codebase immediately.

- [x] **P0-A — Fix Sales.jsx footer positioning**
  - File: `frontend/src/pages/Sales.jsx`
  - Change the footer div from `fixed bottom-0 left-0 right-0 w-100 z-40 ... md:ml-64` to the standard flexbox column pattern used by Clients/Inventory/Services.
  - Wrap the page in `d-flex flex-column overflow-hidden` with `height: 100dvh`, make the item grid `flex-grow-1 overflow-auto`, and footer `flex-shrink-0`.
  - Remove the hardcoded `pr-16 md:ml-64` sidebar offset.

- [x] **P0-B — Standardize modal footer padding**
  - File: `frontend/src/pages/components/Modal.jsx`
  - The fullscreen variant footer uses `px-3 py-2`; change to `px-4 py-3` to match centered and default variants.
  - Result: all 3 modal variants have the same footer padding.

- [x] **P0-C — Standardize border syntax (Bootstrap → Tailwind)**
  - Files: `frontend/src/pages/Clients.jsx`, `Inventory.jsx`, `Services.jsx`
  - Change `border-top border-gray-200 dark:border-gray-700` → `border-t border-gray-200 dark:border-gray-700` on all footer divs with the `app-footer-search` class.
  - This removes the Bootstrap/Tailwind collision on border rendering.

- [x] **P0-D — Fix hardcoded textarea heights**
  - Files: `frontend/src/pages/Suppliers.jsx` (line ~381), `frontend/src/pages/Documents.jsx` (line ~187)
  - Replace `style={{ height: '80px' }}` with `className="min-h-[80px]"` on all textarea elements.

- [x] **P0-E — Fix NotFound.jsx: remove auto-logout**
  - File: `frontend/src/pages/NotFound.jsx`
  - Remove the session clearing code (localStorage, sessionStorage, cookies, store, cache wipe).
  - The 404 page should display a "page not found" message and offer a link back to home — it should NOT log the user out.
  - Auth expiry is handled by the Axios response interceptor (401) already.

- [x] **P0-F — Standardize dark mode footer background**
  - Files: `frontend/src/pages/components/Modal.jsx` (fullscreen variant footer)
  - Change `dark:bg-gray-900` → `dark:bg-gray-800` to match all other footers.
  - Also check `Modal_History_Sales.jsx` footer and update similarly.

---

## PHASE 1 — Backend: Schema & Model Updates
> These are foundational. Frontend features in Phase 2 and 3 depend on these.

- [x] **P1-A — Add `supplier_id` FK to Inventory model** *(was already present)*
  - File: `backend/models.py`
  - Add `supplier_id: Optional[uuid.UUID] = Field(default=None, foreign_key="supplier.id")` to the `Inventory` model.
  - Add relationship: `supplier: Optional["Supplier"] = Relationship(back_populates="inventory_items")` on Inventory.
  - Add reverse: `inventory_items: List["Inventory"] = Relationship(back_populates="supplier")` on Supplier.
  - This field is nullable — existing items are unaffected.

- [x] **P1-B — Update Inventory read schema to include supplier name**
  - File: `backend/routers/isud.py` (READ_SCHEMA_MAP section) and/or `backend/models.py`
  - Create or update `InventoryRead` Pydantic schema to include `supplier_id: Optional[uuid.UUID]` and `supplier_name: Optional[str]`.
  - In `_serialize_record()`, when serializing an Inventory record, populate `supplier_name` from `record.supplier.name` if the relationship is loaded.
  - Ensure the inventory GET endpoint eager-loads the supplier relationship.

- [x] **P1-C — Add `status` field to Schedule model** *(was already present, default "scheduled")*
  - File: `backend/models.py`
  - Add `status: str = Field(default="pending")` to the `Schedule` model.
  - Valid values: `"pending"`, `"confirmed"`, `"completed"`, `"cancelled"`.
  - This field is optional with a default so existing records are unaffected.

- [x] **P1-D — Add `tax_rate` to AppSettings model**
  - File: `backend/models.py`
  - Add `tax_rate: Optional[float] = Field(default=0.0)` to `AppSettings`.
  - This will be used by the Sales POS checkout to calculate tax.

- [x] **P1-E — Implement stock decrement on sale**
  - File: `backend/routers/` (wherever sale transactions are created — likely `isud.py` or a dedicated `sales.py` router)
  - After a `SaleTransaction` is successfully committed, iterate its `SaleTransactionItem` records.
  - For each item with `item_type == "inventory"`, find the `Inventory` record and decrement `quantity` by the sold quantity.
  - If quantity would go negative, allow it but flag it (do not block the sale).
  - Wrap in the same transaction so a rollback reverts the decrement too.

---

## PHASE 2 — Suppliers Panel Component
> Depends on: P1-A, P1-B completed.
> Converts Suppliers from a standalone page into a reusable panel component.

- [x] **P2-A — Create `Suppliers_Panel.jsx` component**
  - File: `frontend/src/pages/components/Suppliers_Panel.jsx` (new file)
  - Extract all logic from `frontend/src/pages/Suppliers.jsx` into this component.
  - Props the component should accept: `isOpen` (bool), `onClose` (fn).
  - It should be self-contained: fetch its own supplier data, manage its own state.
  - UI: Use the standard Modal fullscreen wrapper (via `Modal.jsx`) with a scrollable list and a footer form.
  - Replace the mixed Bootstrap/indigo button styles with the app's standard: `bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg` for primary actions, `bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg` for delete.
  - The embedded `SupplierForm` becomes the modal's footer-form (same pattern as Modal_Insurance_Plans.jsx — form lives at the bottom, list scrolls above).
  - Retain all permission gating (`suppliers:read`, `suppliers:write`, `suppliers:delete`).

- [x] **P2-B — Add supplier dropdown to `Form_Item.jsx`**
  - File: `frontend/src/pages/components/Form_Item.jsx`
  - Add a "Supplier" select/dropdown field to the form.
  - On mount, fetch suppliers via `suppliersAPI.getAll()`.
  - Store selected `supplier_id` in formData.
  - Show as: `<select>` with an "— None —" default option, then a list of supplier names.
  - Pass `supplier_id` in the create/update payload.

- [x] **P2-C — Update `Modal_Detail_Item.jsx` to show supplier**
  - File: `frontend/src/pages/components/Modal_Detail_Item.jsx`
  - In the item detail display, add a "Supplier" row showing `item.supplier_name` (from enriched API response after P1-B).
  - If no supplier is assigned, show "— None —" in muted text.

- [x] **P2-D — Update `Inventory.jsx` footer to 2-row layout**
  - File: `frontend/src/pages/Inventory.jsx`
  - Add a second row to the footer (above the existing search/filter row).
  - This row contains a single "Suppliers" button (use `TruckIcon` or `BuildingStorefrontIcon` from Heroicons).
  - Clicking the button sets `showSuppliersPanel = true` (new local state).
  - Import and render `<Suppliers_Panel isOpen={showSuppliersPanel} onClose={() => setShowSuppliersPanel(false)} />`.
  - The two footer rows should have consistent height (`minHeight: '3rem'` each).

- [x] **P2-E — Show supplier name in Inventory list row**
  - File: `frontend/src/pages/Inventory.jsx`
  - In the table row rendering, add a small muted supplier name badge or text alongside the item name (e.g., `text-xs text-gray-400`) if `item.supplier_name` exists.

---

## PHASE 3 — Remove Suppliers as a Standalone Page
> Depends on: P2-A through P2-D all completed and verified working.

- [x] **P3-A — Remove Suppliers route from App.jsx**
  - File: `frontend/src/App.jsx`
  - Remove the `<Route path="/suppliers" ...>` block.
  - Remove the `const Suppliers = lazy(() => import('./pages/Suppliers'))` import.
  - Note: Suppliers is already absent from `Layout.jsx` navigation so no nav change needed.

- [x] **P3-B — Archive Suppliers.jsx**
  - File: `frontend/src/pages/Suppliers.jsx`
  - Delete this file once P3-A is confirmed working and `Suppliers_Panel.jsx` is live.
  - Verify no other file imports from `./pages/Suppliers` or `../Suppliers`.

---

## PHASE 4 — Employees: Extract Inline Pay Modal
> Depends on: Nothing (self-contained Employees refactor).
> The main inline section in Employees.jsx is the Pay Modal (lines 1438–1602).

- [x] **P4-A — Extract inline Pay Modal to `Modal_Pay_Employee.jsx`**
  - File to create: `frontend/src/pages/components/Modal_Pay_Employee.jsx`
  - The inline Pay Modal in `Employees.jsx` (approx. lines 1438-1602) handles processing a single employee's payment for a specific period.
  - This is different from `Modal_Wages.jsx` (which does bulk payroll).
  - Extract all JSX and state for the pay modal into a new component.
  - Props: `isOpen`, `onClose`, `employee` (the selected employee object), `onPaySubmit` (callback fn).
  - The component manages its own `formData`, `isSubmitting`, `error`, `success` state internally.
  - In `Employees.jsx`, replace the inline JSX with `<Modal_Pay_Employee isOpen={showPayModal} onClose={() => setShowPayModal(false)} employee={selectedEmployee} onPaySubmit={handlePaySubmit} />`.

- [x] **P4-B — Extract Role Filter and Status Filter dropdowns**
  - File: `frontend/src/pages/Employees.jsx`
  - The role filter dropdown (lines ~1252-1270) and status filter dropdown (lines ~1282-1303) are inline positioned dropdowns.
  - These are small and can simply be extracted into local sub-components at the top of the Employees.jsx file (not separate files) to reduce the main JSX body length.
  - Alternatively, use the existing `Dropdown_Custom.jsx` if it supports the use case.

- [x] **P4-C — Consolidate Employees.jsx state declarations**
  - File: `frontend/src/pages/Employees.jsx`
  - After P4-A, the pay-related state variables (`payFormData`, `payWeeks`, `isPaidMap`, etc.) can move into `Modal_Pay_Employee.jsx`.
  - The modal-control states that remain in Employees.jsx (`showPayModal`, `showWagesModal`, `showRequestsModal`, etc.) should be grouped together with a comment block for clarity.
  - Target: Employees.jsx under 800 lines after this phase.

---

## PHASE 5 — Schedule: Add Appointment Status
> Depends on: P1-C completed.

- [x] **P5-A — Add status field to `Form_Schedule.jsx`**
  - File: `frontend/src/pages/components/Form_Schedule.jsx`
  - Add a `status` select field: options are Pending / Confirmed / Completed / Cancelled.
  - Default to "pending" on create.
  - Pass `status` in the create/update payload.

- [x] **P5-B — Display status badge on Schedule calendar**
  - File: `frontend/src/pages/Schedule.jsx`
  - In the calendar event rendering, add a small colored dot or badge based on appointment status:
    - pending → gray
    - confirmed → blue
    - completed → green
    - cancelled → red with strikethrough text
  - In the appointment detail/edit view, show the current status prominently.

---

## PHASE 6 — Sales: Tax Rate Integration
> Depends on: P1-D completed.

- [x] **P6-A — Add tax rate to Profile settings UI**
  - File: `frontend/src/pages/Profile.jsx` (Company Info section or Schedule Settings section)
  - Add a "Tax Rate (%)" number input field to the App Settings form.
  - Load from and save to `AppSettings.tax_rate`.
  - Hint text: "e.g. 8.5 for 8.5%"

- [x] **P6-B — Apply tax rate in `Modal_Checkout_Sales.jsx`**
  - File: `frontend/src/pages/components/Modal_Checkout_Sales.jsx`
  - On mount, fetch `settingsAPI.getSettings()` to get `tax_rate`.
  - Calculate: `tax = subtotal × (tax_rate / 100)`, display as a line item.
  - Total = subtotal + tax.
  - Pass the total (including tax) to the transaction save call.

---

## PHASE 7 — Button Design System Unification
> Depends on: Nothing. Can be done any time after Phase 0.
> This is the most visually impactful consistency fix.

- [x] **P7-A — Create button utility classes**
  - File: `frontend/src/styles/buttons.css` (new file, or add to existing global CSS)
  - Define these Tailwind `@apply` utility classes:
    ```css
    .btn-app-primary    { @apply bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg transition-colors rounded-pill px-3 py-2 text-sm font-medium; }
    .btn-app-secondary  { @apply bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border-0 transition-colors rounded-pill px-3 py-2 text-sm font-medium; }
    .btn-app-danger     { @apply bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg transition-colors rounded-pill px-3 py-2 text-sm font-medium; }
    .btn-app-ghost      { @apply text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-0 transition-colors rounded-pill px-3 py-2 text-sm; }
    .btn-app-icon       { @apply w-12 h-12 flex items-center justify-center rounded-full border-0 transition-colors; }
    ```
  - Import this CSS file in `frontend/src/main.jsx` or `App.jsx`.

- [x] **P7-B — Apply `btn-app-*` classes to Clients, Inventory, Services, Schedule, Documents**
  - Files: `Clients.jsx`, `Inventory.jsx`, `Services.jsx`, `Schedule.jsx`, `Documents.jsx`
  - Replace `bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg` with `btn-app-primary`.
  - Replace `bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg` with `btn-app-danger`.
  - Do NOT change button colors, only the className notation.

- [x] **P7-C — Apply `btn-app-*` classes to Suppliers_Panel.jsx**
  - File: `frontend/src/pages/components/Suppliers_Panel.jsx` (created in P2-A)
  - Use the new classes from the start so Suppliers is consistent.

- [x] **P7-D — Normalize Sales modal buttons**
  - Files: `Modal_Cart_Sales.jsx`, `Modal_Checkout_Sales.jsx`, `Modal_History_Sales.jsx`
  - The checkout confirm button uses `py-4 rounded-xl` — normalize to `btn-app-primary` style.
  - Cart checkout button uses `rounded-full py-3` — normalize to `btn-app-primary`.
  - History close button uses `px-6 py-2 rounded-lg` — normalize.
  - Exception: the cart increment/decrement `w-7 h-7` circle buttons are a unique UI pattern, leave those as-is.

---

## PHASE 8 — Business Logic: Inventory Stock on Sale
> Depends on: P1-E (backend stock decrement) completed.

- [x] **P8-A — Reflect stock changes in frontend after checkout**
  - File: `frontend/src/pages/Sales.jsx`
  - After a successful transaction, invalidate the inventory cache (call `inventoryAPI.invalidateCache()` or equivalent) so the next load of Inventory shows updated quantities.
  - Optionally: update the local `products` state array immediately (optimistic decrement) before the cache refresh.

---

## PHASE 9 — Reliability & UX Improvements
> Depends on: Nothing. Can be done any time.

- [x] **P9-A — Add offline indicator**
  - File: `frontend/src/pages/components/Layout.jsx` or a new `Banner_Offline.jsx`
  - Listen to `window.addEventListener('online'/'offline')` events.
  - When offline: show a fixed top banner "You are offline — changes cannot be saved."
  - Disable write-operation buttons (add/edit/delete) when `navigator.onLine === false`.

- [x] **P9-B — Add `refetchPermissions()` after permission changes**
  - Files: `frontend/src/pages/components/Modal_Permissions_User.jsx`, `Modal_Manage_Roles.jsx`
  - After a successful permission save/update, call a `refetchPermissions()` function from the auth store to reload the user's permission set from the API.
  - This ensures permission changes take effect immediately without requiring a page reload.

- [x] **P9-C — Remove localStorage transaction caching in Sales**
  - File: `frontend/src/pages/Sales.jsx` and `frontend/src/services/api.js`
  - Sale transactions should only be stored in the DB and retrieved via `saleTransactionsAPI`.
  - Remove any `localStorage.setItem` / `localStorage.getItem` calls for transactions.
  - The existing `getCachedOrFetch()` cache layer in `api.js` handles caching transparently.

---

## PHASE 10 — Reports: Data & Export Enhancements
> Depends on: Nothing. Can be done any time.

- [x] **P10-A — Add KPI summary cards to Reports page**
  - File: `frontend/src/pages/Reports.jsx`
  - Above the chart, render 3-4 headline numbers (e.g., total revenue, total clients, total appointments for the selected period).
  - These are derived from the same API response data that populates the chart.
  - Style as cards with large bold number + label below.

- [x] **P10-B — Add data table below report charts**
  - File: `frontend/src/pages/Reports.jsx`
  - Below the chart, render a collapsible `<table>` of the raw data points.
  - Columns: period label (date/week/month) + the measured value(s).

- [x] **P10-C — Add CSV export for report data**
  - File: `frontend/src/pages/Reports.jsx`
  - Add an "Export CSV" button in the report filter area.
  - On click: serialize the chart data array to CSV format and trigger a browser download.
  - No backend change needed — use client-side CSV generation (`data:text/csv` URI or FileSaver).

---

## DONE — Verification Steps

After completing all phases, verify:

- [ ] Suppliers can be viewed and managed from the Inventory page footer
- [ ] Inventory items can be assigned a supplier and the supplier name shows in the list
- [ ] Suppliers.jsx route is removed and navigating to `/suppliers` redirects appropriately
- [ ] Employees.jsx is under 800 lines
- [ ] The Pay Modal is its own component file
- [ ] All page footers use `border-t` (not `border-top`) and `dark:bg-gray-800`
- [ ] All primary action buttons across all pages look visually identical
- [ ] Sales footer does not use `fixed` positioning
- [ ] Navigating to a 404 URL does NOT log the user out
- [ ] Selling an item decrements its inventory count
- [ ] Tax rate is configurable and applied at checkout
- [ ] Appointment status is visible on the calendar and editable in the form
