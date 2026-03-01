# BusinessManager — Full Application Audit Report
> Generated: 2026-03-01

---

## Table of Contents
1. [Application Overview](#1-application-overview)
2. [Page Inventory](#2-page-inventory)
3. [Component Inventory](#3-component-inventory)
4. [Component Relationship Diagram (UML)](#4-component-relationship-diagram)
5. [Data Model / ERD](#5-data-model--erd)
6. [UI Inconsistencies Found](#6-ui-inconsistencies-found)
7. [Logic & Architecture Issues](#7-logic--architecture-issues)
8. [Proposed Business Workflows](#8-proposed-business-workflows)

---

## 1. Application Overview

**BusinessManager** is a full-stack general-purpose business management platform targeting product and service businesses. It is built as a mobile-first Progressive Web App (PWA).

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Vite, TailwindCSS + Bootstrap 5 |
| State | Zustand |
| HTTP | Axios with persistent localStorage cache |
| Backend | FastAPI + SQLModel (PostgreSQL / SQLite) |
| Icons | Heroicons v24 (outline) |
| Charts | Chart.js via react-chartjs-2 |
| Documents | Tiptap, CodeMirror 6, react-pdf, xlsx, mammoth.js, OnlyOffice |
| PWA | Vite PWA plugin, service worker, install prompt |

---

## 2. Page Inventory

### 2.1 Login.jsx
**Purpose:** Authentication gateway with "Remember Me" cookie persistence and inline password-reset form.
**API:** `POST /auth/login`, `POST /auth/reset-password`
**Modals:** None
**Layout:** Centered card on gradient background, no navigation

### 2.2 NotFound.jsx
**Purpose:** Catch-all 404 page. Clears auth entirely (localStorage, sessionStorage, cookies, Zustand store, cache) and auto-redirects to /login after 2 seconds.
**API:** None
**Notes:** Double-serves as a forced logout — any unknown URL logs the user out.

### 2.3 Clients.jsx
**Purpose:** Client roster with tier-based filtering (PLATINUM/GOLD/SILVER/BRONZE) and template email dispatch.
**API:** `clientsAPI`, `settingsAPI`
**Modals:** Modal_Detail_Client, Form_Client, Modal_Template_Use
**Layout:** Upside-down scrollable table + sticky footer (search + filter + add)

### 2.4 Inventory.jsx
**Purpose:** Multi-type inventory management (PRODUCT/RESOURCE/ASSET/LOCATION/ITEM) with stock-level alerts and image upload.
**API:** `inventoryAPI`
**Modals:** Modal_Detail_Item, Form_Item
**Layout:** Same upside-down table pattern as Clients

### 2.5 Services.jsx
**Purpose:** Service catalog with price, duration, and free-form category tagging.
**API:** `servicesAPI`
**Modals:** Form_Service
**Layout:** Same upside-down table pattern

### 2.6 Suppliers.jsx
**Purpose:** Vendor contact management. Has a unique dual mobile/desktop view and an embedded `SupplierForm` component.
**API:** `suppliersAPI`
**Modals:** SupplierForm (inline, not via Modal component)
**Layout:** DIFFERENT from all other pages — uses `Table_Mobile` + standard HTML `<table>`, no upside-down table, add button in header not footer

### 2.7 Employees.jsx
**Purpose:** Central HR hub — roster, payroll, permissions/roles, leave/onboarding/offboarding requests, chat, insurance.
**API:** `employeesAPI`, `rolesAPI`, `leaveRequestsAPI`, `onboardingRequestsAPI`, `offboardingRequestsAPI`, `insurancePlansAPI`, `payrollAPI`, `chatAPI`
**Modals:** Form_Employee, Modal_Create_User, Modal_Permissions_User, Modal_Manage_Roles, Modal_Requests_Employee, Modal_Insurance_Plans, Chat_Employee, Modal_Wages
**Layout:** Complex, ~2500 lines — not audited in full

### 2.8 Schedule.jsx
**Purpose:** Full calendar (month/week/day views) with drag-and-drop rescheduling, swipe navigation, attendee management, attendance check-in, and reminder email templates.
**API:** `scheduleAPI`, `settingsAPI`, `leaveRequestsAPI`, isud (clients/services/employees)
**Modals:** Form_Schedule, Modal_Filter_Schedule, Modal_Template_Use
**Layout:** Calendar grid + filter panel + live clock

### 2.9 Sales.jsx
**Purpose:** Point-of-sale (POS) — browse services/products, shopping cart with quantity controls, client assignment, checkout/payment, transaction history.
**API:** `servicesAPI`, `clientsAPI`, `inventoryAPI`, `saleTransactionsAPI`, `settingsAPI`
**Modals:** Modal_Detail_Item, Modal_Checkout_Sales, Modal_Cart_Sales, Modal_History_Sales
**Layout:** DIFFERENT from all other pages — footer is `position: fixed` instead of flexbox column

### 2.10 Documents.jsx
**Purpose:** Document library with upload (drag-and-drop), view, edit, sign, category management, and template editor toggle.
**API:** `documentsAPI`, `documentCategoriesAPI`, `templatesAPI`
**Modals:** Modal_Viewer_Document, Modal_Edit_Document, Modal_Template_Editor
**Layout:** Tab-based (Documents / Templates) + footer search/filter

### 2.11 DocumentEditor.jsx
**Purpose:** Standalone full-screen editor route (`/documents/:id/edit`) using OnlyOffice for collaborative OOXML editing.
**API:** `documentsAPI`
**Modals:** None (is itself the editor)

### 2.12 Profile.jsx
**Purpose:** User personal hub — profile info, benefits, wages, app settings, database env switcher, CSV bulk import, leave management, company branding.
**API:** `settingsAPI`, `payrollAPI`, `leaveRequestsAPI`, `schemaAPI`, `adminAPI`
**Modals:** Modal_Signature, Modal_Wages, leave forms
**Layout:** Accordion-style bottom-panel sections (~2000 lines)

### 2.13 Reports.jsx
**Purpose:** Analytics dashboard with 9 selectable report types, date range filtering, chart type switching, and PDF export.
**API:** `reportsAPI` (9 endpoints)
**Modals:** None
**Components:** Chart_Report, Filter_Report

---

## 3. Component Inventory

### 3.1 Layout & Shell
| Component | Purpose |
|---|---|
| `Layout.jsx` | App shell with bottom navigation; permission-filtered route list |
| `Modal.jsx` | Base modal (3 variants: fullscreen / centered / bottom-sheet) |
| `Container_Scrollable.jsx` | Flex wrapper with overflow-auto |

### 3.2 Buttons
| Component | Purpose |
|---|---|
| `Button_Toolbar.jsx` | Icon button with training-mode scaling and badge support |
| `Button_Add_Mobile.jsx` | Floating action button (mobile, fixed bottom-right) |
| `Button_Icon.jsx` | Icon-only button with tooltip |
| `Footer_Action.jsx` | Footer container for action button rows |

### 3.3 Forms
| Component | Purpose |
|---|---|
| `Form_Client.jsx` | Client create/edit |
| `Form_Employee.jsx` | Employee CRUD |
| `Form_Item.jsx` | Inventory item with barcode scanner + camera |
| `Form_Service.jsx` | Service create/edit |
| `Form_Schedule.jsx` | Appointment create/edit with multi-select attendees |
| `Button_ImportCSV.jsx` | CSV bulk import with column mapping |
| `Dropdown_Custom.jsx` | Multi-select + search dropdown |

### 3.4 Data Display
| Component | Purpose |
|---|---|
| `Table_Mobile.jsx` | Card-based mobile list |
| `Chart_Report.jsx` | Chart.js wrapper (line/bar/pie/area/doughnut) |
| `Filter_Report.jsx` | Report filter builder (date range, grouping, entity filters) |
| `Image_Square.jsx` | Square image with fallback placeholder |

### 3.5 Modals
| Component | Purpose |
|---|---|
| `Modal_Client.jsx` | Global client create modal (from sidebar) |
| `Modal_Detail_Client.jsx` | Client view/edit/delete |
| `Modal_Detail_Item.jsx` | Inventory item view/edit with image gallery |
| `Modal_Viewer_Document.jsx` | Document preview (PDF/XLSX/code/HTML) |
| `Modal_Edit_Document.jsx` | Document content editor with lazy-loaded editors |
| `Modal_Template_Editor.jsx` | Full-screen template HTML design (Tiptap + variable picker) |
| `Modal_Template_Use.jsx` | Template picker + preview + print/copy actions |
| `Modal_Create_User.jsx` | Admin user creation |
| `Modal_Permissions_User.jsx` | Granular per-user permission grid |
| `Modal_Manage_Roles.jsx` | Role CRUD + permission grid |
| `Modal_Requests_Employee.jsx` | Leave/onboarding/offboarding workflow tabs |
| `Modal_Insurance_Plans.jsx` | Insurance plan manager |
| `Modal_Wages.jsx` | Payroll processing + pay slip history |
| `Modal_Cart_Sales.jsx` | Shopping cart review |
| `Modal_Checkout_Sales.jsx` | Payment processing (cash/card) |
| `Modal_History_Sales.jsx` | Transaction history |
| `Modal_Chart_Sales.jsx` | Sales visualization |
| `Modal_Filter_Schedule.jsx` | Advanced schedule filters |
| `Modal_Signature.jsx` | Signature capture |

### 3.6 Editors
| Component | Purpose |
|---|---|
| `editors/RichTextEditor.jsx` | Tiptap rich text editor |
| `editors/CodeEditor.jsx` | CodeMirror 6 syntax editor |
| `editors/EditorToolbar.jsx` | Shared toolbar (B/I/U/H/lists/code) |
| `Editor_OnlyOffice.jsx` | OnlyOffice collaborative editor (iframe) |

### 3.7 Viewers
| Component | Purpose |
|---|---|
| `viewers/PDFViewer.jsx` | PDF viewer (react-pdf + iframe fallback) |
| `viewers/XlsxViewer.jsx` | Excel viewer (xlsx lib + sheet tabs) |

### 3.8 Widgets & Utilities
| Component | Purpose |
|---|---|
| `Widget_Attendance.jsx` | Clock in/out widget |
| `Widget_Camera.jsx` | Camera capture |
| `Widget_Signature.jsx` | Signature canvas |
| `Widget_ClockInOut.jsx` | Enhanced live clock with status |
| `Chat_Employee.jsx` | Real-time employee messaging |
| `Scanner_Barcode.jsx` | QuaggaJS barcode scanner |
| `Prompt_InstallApp.jsx` | PWA install prompt |
| `Manager_DatabaseConnection.jsx` | DB environment switcher |
| `Manager_MobileAddressBar.jsx` | Mobile address bar color controller |
| `Gate_Permission.jsx` | Conditional render based on user permissions |
| `Toggle_DarkMode.jsx` | Dark mode toggle |
| `Debug_ApiInfo.jsx` | API debug overlay (dev) |
| `Debug_Permission.jsx` | Permission debug overlay (dev) |
| `imageUtils.js` | getDisplayImageUrl() helper |

---

## 4. Component Relationship Diagram

```
App.jsx
├── Layout.jsx (shell, bottom nav)
│   ├── Profile.jsx
│   │   ├── Modal_Signature
│   │   └── Modal_Wages
│   ├── Reports.jsx
│   │   ├── Chart_Report
│   │   └── Filter_Report
│   ├── Inventory.jsx
│   │   ├── Modal_Detail_Item
│   │   └── Form_Item (via Modal fullscreen)
│   │       └── Scanner_Barcode
│   │       └── Widget_Camera
│   ├── Clients.jsx
│   │   ├── Modal_Detail_Client
│   │   ├── Form_Client (via Modal fullscreen)
│   │   └── Modal_Template_Use
│   ├── Employees.jsx
│   │   ├── Form_Employee (via Modal fullscreen)
│   │   ├── Modal_Create_User
│   │   ├── Modal_Permissions_User
│   │   ├── Modal_Manage_Roles
│   │   ├── Modal_Requests_Employee
│   │   ├── Modal_Insurance_Plans
│   │   ├── Modal_Wages
│   │   └── Chat_Employee
│   ├── Documents.jsx
│   │   ├── Modal_Viewer_Document
│   │   │   ├── PDFViewer
│   │   │   └── XlsxViewer
│   │   ├── Modal_Edit_Document
│   │   │   ├── RichTextEditor (lazy)
│   │   │   ├── CodeEditor (lazy)
│   │   │   └── EditorToolbar
│   │   └── Modal_Template_Editor
│   ├── Sales.jsx
│   │   ├── Modal_Cart_Sales
│   │   ├── Modal_Checkout_Sales
│   │   ├── Modal_History_Sales
│   │   └── Modal_Chart_Sales
│   ├── Services.jsx
│   │   └── Form_Service (via Modal fullscreen)
│   ├── Suppliers.jsx
│   │   ├── Table_Mobile
│   │   ├── Button_Add_Mobile
│   │   └── SupplierForm (inline, not via Modal)
│   └── Schedule.jsx
│       ├── Form_Schedule (via Modal fullscreen)
│       ├── Modal_Filter_Schedule
│       ├── Modal_Template_Use
│       └── Widget_Attendance
├── Modal_Client (global, always mounted)
├── Manager_MobileAddressBar (global)
└── Prompt_InstallApp (global)

DocumentEditor.jsx (standalone route: /documents/:id/edit)
└── Editor_OnlyOffice

Shared by many pages:
├── Modal.jsx (base wrapper)
├── Button_Toolbar.jsx (icon action buttons)
├── Button_Icon.jsx
├── Gate_Permission.jsx
├── Dropdown_Custom.jsx
└── Toggle_DarkMode.jsx
```

---

## 5. Data Model / ERD

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐
│    User     │1────*│  UserPermission  │      │     Role      │
│─────────────│      │──────────────────│      │───────────────│
│ id          │      │ user_id (FK)     │      │ id            │
│ username    │      │ page             │      │ name          │
│ email       │      │ permission       │      └──────┬────────┘
│ role_id (FK)│      └──────────────────┘             │1
└──────┬──────┘                                        │
       │                                              *│
       │1                                    ┌──────────────────┐
       │                                     │  RolePermission  │
       │                                     │──────────────────│
       │                                     │ role_id (FK)     │
       │                                     │ page             │
       │                                     │ permission       │
       │                                     └──────────────────┘
       │
       │* (employee records)
┌──────▼──────┐      ┌───────────────┐      ┌────────────────┐
│   Client    │      │  SaleTransact │1────*│ SaleTransItem  │
│─────────────│      │───────────────│      │────────────────│
│ id          │      │ id            │      │ id             │
│ name        │*─┐   │ client_id(FK) │      │ transaction_id │
│ email       │  │   │ employee_id   │      │ item_id        │
│ phone       │  │   │ total         │      │ item_type      │
│ tier        │  │   │ payment_method│      │ quantity       │
└─────────────┘  │   │ timestamp     │      │ price          │
                 │   └───────────────┘      └────────────────┘
                 │
                 │   ┌───────────────┐
                 └──*│   Schedule    │
                     │───────────────│
                     │ id            │
                     │ client_id(FK) │*─────────────────────┐
                     │ service_id(FK)│                       │
                     │ date          │                       │
                     │ start_time    │             ┌─────────▼────────┐
                     │ end_time      │             │ ScheduleAttendee │
                     │ notes         │             │──────────────────│
                     └───────────────┘             │ schedule_id (FK) │
                                                   │ employee_id (FK) │
                                                   └──────────────────┘

┌──────────────┐      ┌──────────────────┐
│  Inventory   │1────*│  InventoryImage  │
│──────────────│      │──────────────────│
│ id           │      │ id               │
│ name         │      │ inventory_id(FK) │
│ type         │      │ url              │
│ price        │      │ is_primary       │
│ quantity     │      └──────────────────┘
│ min_stock    │
│ sku          │
└──────────────┘

┌──────────┐      ┌───────────────────┐      ┌──────────────────────┐
│ Document │      │  DocumentAssignment│      │   DocumentCategory   │
│──────────│1────*│───────────────────│      │──────────────────────│
│ id       │      │ document_id (FK)  │      │ id                   │
│ name     │      │ entity_id         │      │ name                 │
│ category │      │ entity_type       │      │ color                │
│ owner_id │      └───────────────────┘      └──────────────────────┘
│ file_path│
│ blob_id  │1────1┌──────────────────┐
│ content  │      │  DocumentBlob    │
│ content_type│   │──────────────────│
└──────────┘      │ id               │
                  │ document_id (FK) │
                  │ data (binary)    │
                  └──────────────────┘

┌───────────────────┐      ┌──────────────────────┐
│  DocumentTemplate │      │     AppSettings      │
│───────────────────│      │──────────────────────│
│ id                │      │ id                   │
│ name              │      │ schedule_start_time  │
│ template_type     │      │ schedule_end_time    │
│ content (HTML)    │      │ timezone             │
│ is_standard       │      │ calendar_color       │
│ is_active         │      │ company_name         │
│ accessible_pages  │      │ company_email        │
└───────────────────┘      │ company_phone        │
                           │ company_address      │
                           └──────────────────────┘

┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Service    │    │  LeaveRequest    │    │OnboardingRequest  │
│──────────────│    │──────────────────│    │───────────────────│
│ id           │    │ id               │    │ id                │
│ name         │    │ employee_id (FK) │    │ employee_id (FK)  │
│ category     │    │ type             │    │ status            │
│ price        │    │ start_date       │    │ tasks (JSON)      │
│ duration_min │    │ end_date         │    └───────────────────┘
│ description  │    │ status           │
└──────────────┘    │ reason           │    ┌───────────────────┐
                    └──────────────────┘    │OffboardingRequest │
                                            │───────────────────│
┌──────────────┐    ┌──────────────────┐    │ employee_id (FK)  │
│  Attendance  │    │ InsurancePlan    │    │ status            │
│──────────────│    │──────────────────│    │ tasks (JSON)      │
│ id           │    │ id               │    └───────────────────┘
│ employee_id  │    │ name             │
│ clock_in     │    │ description      │    ┌───────────────────┐
│ clock_out    │    │ is_active        │    │   PayrollRecord   │
│ date         │    └──────────────────┘    │───────────────────│
└──────────────┘                            │ employee_id (FK)  │
                                            │ pay_period        │
                                            │ amount            │
                                            │ deductions        │
                                            │ net_pay           │
                                            └───────────────────┘
```

---

## 6. UI Inconsistencies Found

### 6.1 Footer Structure — CRITICAL

The app has two fundamentally different footer implementations:

**Pattern A — Standard (Clients, Inventory, Services, Schedule, Documents):**
```jsx
// Flexbox column layout — footer stays at bottom naturally
<div className="d-flex flex-column overflow-hidden" style={{ height: '100dvh' }}>
  <div className="flex-grow-1 overflow-auto">...</div>
  <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top ...">
    {/* Footer content */}
  </div>
</div>
```

**Pattern B — Fixed position (Sales.jsx only):**
```jsx
// Footer is fixed to viewport — problematic on mobile keyboards
<div className="app-footer-search fixed bottom-0 left-0 right-0 w-100 z-40 bg-white
  dark:bg-gray-800 border-t ... p-3 pt-2 pr-16 md:ml-64">
```

**Problem:** `fixed` positioning in Sales causes content to scroll under the footer instead of stopping at it. This also breaks on iOS when the software keyboard appears (the keyboard pushes up the fixed footer). The sidebar offset `md:ml-64` is hardcoded and will break if the sidebar width ever changes.

**Action:** Refactor Sales.jsx footer to use the standard flexbox column pattern.

---

### 6.2 Footer Height — INCONSISTENT

| Page/Component | Footer padding | Min-height |
|---|---|---|
| Clients footer | `app-footer-search` CSS class | `minHeight: '3rem'` on inner row |
| Inventory footer | same | `minHeight: '3rem'` on inner row |
| Services footer | same | `minHeight: '3rem'` on inner row |
| Sales footer row 1 | `p-3 pt-2 pr-16` | `minHeight: '3rem'` |
| Sales footer row 2 | same | `minHeight: '3rem'` |
| Modal.jsx fullscreen footer | `px-3 py-2` | none |
| Modal.jsx centered footer | `px-4 py-3` | none |
| Modal.jsx default footer | `px-4 py-3` | none |
| Footer_Action.jsx | `pt-1 mt-1` | none |
| Modal_History_Sales footer | `px-4 py-3` | none |
| Modal_Cart_Sales summary | `p-4` | none |

**Problem:** Fullscreen modal footer uses `py-2` (8px top/bottom) while centered and default use `py-3` (12px). This creates a visually shorter footer in fullscreen modals despite them needing more space. The Footer_Action component (`pt-1 mt-1`) has minimal padding — likely looks cramped when used.

**Action:** Standardize all modal footers to `px-4 py-3`. Standardize Footer_Action to `px-4 pt-3`.

---

### 6.3 Button Styling — CRITICAL INCONSISTENCY

The application uses **three incompatible button design systems** simultaneously:

**System 1 — Tailwind custom utilities (majority of pages):**
```jsx
// Primary action (green/secondary)
className="bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
// Danger
className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg transition-all"
// Toolbar (circle)
className="btn flex-shrink-0 d-flex ... rounded-circle" style={{ width: '3rem', height: '3rem' }}
```

**System 2 — Bootstrap classes (Suppliers.jsx):**
```jsx
className="btn-primary flex items-center"
className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent
  rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2
  focus:ring-indigo-500"
```

**System 3 — Custom inline Tailwind (Sales modals):**
```jsx
// Cart checkout button
className="flex-1 py-3 bg-secondary-600 hover:bg-secondary-700 text-white rounded-full ..."
// Confirm cash payment
className="w-full py-4 rounded-xl font-semibold text-white bg-emerald-600 ..."
// History close button
className="px-6 py-2 rounded-lg bg-gray-500 ..."
```

**Specific inconsistencies:**
- Suppliers uses `bg-indigo-600` while all other pages use `bg-secondary-600` for primary actions
- Cart uses `rounded-full` buttons; Checkout uses `rounded-xl`; most pages use `rounded-pill` (Bootstrap) or no explicit rounding
- Checkout payment button is `py-4` (16px padding) — twice the size of standard buttons
- Sales item increment/decrement buttons are `w-6 h-6` (24px) while Toolbar buttons are `w-[3rem] h-[3rem]` (48px) — 2× size difference within same product
- `transition-all` is present on some buttons, absent on identical-looking buttons elsewhere
- Filter toggle buttons in Clients/Inventory/Services use `rounded-pill` (Bootstrap), but Schedule filter uses `rounded-full` (Tailwind)

**Action:** Create a `btn.css` or `buttons.css` utility file with 4-5 named variants (`btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `btn-icon`) and apply consistently.

---

### 6.4 Border Syntax — Mixed Bootstrap and Tailwind

| Usage | Syntax |
|---|---|
| Clients/Inventory/Services footer | `border-top border-gray-200 dark:border-gray-700` (Bootstrap + Tailwind mixed) |
| Sales footer | `border-t border-gray-200 dark:border-gray-700` (pure Tailwind) |
| Modal.jsx footers | `border-t border-gray-200 dark:border-gray-700` (pure Tailwind) |
| Footer_Action | `border-t border-gray-200 dark:border-gray-700` (pure Tailwind) |

**Problem:** `border-top` is Bootstrap, `border-t` is Tailwind — they both apply `border-top-width: 1px` but may conflict or produce double borders if Bootstrap's `border-top` also sets a color that overrides Tailwind's `border-gray-200`.

**Action:** Standardize to `border-t border-gray-200 dark:border-gray-700` (Tailwind) across all footers and separators.

---

### 6.5 Dark Mode Background — Inconsistent gray shade

| Component | Dark mode bg class |
|---|---|
| Clients/Inventory/Services/Sales footer | `dark:bg-gray-800` |
| Modal.jsx fullscreen footer | `dark:bg-gray-900` |
| Modal.jsx default footer | `dark:bg-gray-800` |
| Modal_History_Sales footer | `dark:bg-gray-900` |

**Problem:** `gray-900` and `gray-800` look visibly different. Fullscreen modal footers appear darker than they should relative to the content area. This is likely unintentional.

**Action:** Decide on one shade per surface type (page background: gray-900, card/modal: gray-800, footer: gray-800) and apply consistently.

---

### 6.6 Suppliers.jsx — Architectural Outlier

Suppliers is the only page that:
- Does NOT follow the upside-down scrollable table pattern
- Uses `Table_Mobile` + a separate standard HTML `<table>` instead of one unified component
- Has its Add button in the **header** instead of the **footer**
- Uses `SupplierForm` as an inline conditional render (not a Modal-wrapped fullscreen form)
- Uses Bootstrap `btn-primary` instead of the custom utility classes
- Uses different inline styles (`style={{ height: '80px' }}` on textarea) not seen in other forms

**Action:** Refactor Suppliers to match the standard page pattern. Extract SupplierForm into the same modal-based pattern used by Form_Client, Form_Item, etc.

---

### 6.7 Textarea Heights — Hardcoded

Found in: `Suppliers.jsx` line 381, `Documents.jsx` line 187
```jsx
style={{ height: '80px' }}
```
All other textareas use CSS classes or no explicit height. This prevents the textarea from adapting to content or responsive breakpoints.

**Action:** Replace with `className="min-h-[80px]"` (Tailwind) or `rows={3}`.

---

### 6.8 Upside-Down Table Pattern — Undocumented Quirk

Clients, Inventory, and Services all use `flex-column-reverse` to make the list grow upward so the newest items appear at the bottom-most visible position (header columns appear at the bottom as a footer, items grow upward). This is clever but:
- Makes keyboard navigation counterintuitive (Tab order is reversed)
- Screen readers may read items in wrong order
- The "header" row visually appears at the bottom — confusing to new users

**Action:** Document this pattern. Consider replacing with a standard top-to-bottom table sorted `ORDER BY created_at DESC` and a sticky column header at the top. This is more semantically correct and accessible.

---

## 7. Logic & Architecture Issues

### 7.1 Mega-Pages: Employees.jsx (~2500 lines) and Profile.jsx (~2000 lines)
These files are too large to maintain. Employees.jsx alone contains the full implementation of payroll, permissions, roles, leave requests, onboarding, offboarding, insurance, and chat — all in one file.

**Problem:** Any change in one feature risks breaking another. The file is nearly impossible to code-review meaningfully.

**Action:** Split Employees.jsx into at minimum:
- `Employees_Roster.jsx` (list + CRUD)
- `Employees_Payroll.jsx` (wages + pay slips)
- `Employees_HR.jsx` (leave/onboarding/offboarding)
- `Employees_Access.jsx` (permissions + roles)
- Move insurance and chat into their own section components

---

### 7.2 NotFound.jsx Logs Out the User
Any typo in the URL or stale bookmark logs the user out completely. This is too aggressive. A 404 should show the not-found page and let the user navigate back.

**Action:** Remove session clearing from NotFound. Only the auth interceptor (401 response) should log out the user.

---

### 7.3 Sale Transaction History is localStorage-Cached but Also DB-Backed
`saleTransactionsAPI` has a backend with full persistence, but comments in Sales.jsx suggest transaction history is also stored in localStorage as a fallback/cache. This creates a split-brain problem where the local cache may show deleted or updated transactions.

**Action:** Remove localStorage caching for transactions. Rely solely on the API + the existing `getCachedOrFetch()` cache layer in `api.js`.

---

### 7.4 Permission System Has Three Overlapping Layers
- `ProtectedRoute` (router level) — checks if user can even access the page
- `Gate_Permission` (component level) — hides UI elements
- `hasPermission()` inline checks — manual conditional rendering

When a user's permissions change, only a full page reload will reflect the new state because permissions are stored in Zustand (in-memory). There is no websocket/push mechanism to invalidate permissions live.

**Action:** Add a `refetchPermissions()` call after any permission update in Modal_Permissions_User and Modal_Manage_Roles.

---

### 7.5 No Optimistic UI Updates
All mutations (create/update/delete) wait for the API response before updating the list. On a slow connection (common for the target Render deployment) this creates a visible lag.

**Action:** Implement optimistic updates for the most common operations: add client, add inventory item. Roll back on error.

---

### 7.6 Schedule Uses `isud` Generic Endpoint for Related Data
Schedule.jsx fetches clients, services, and employees via the generic `/api/v1/isud/{table}` endpoint rather than the typed endpoints. This bypasses the `READ_SCHEMA_MAP` serialization, meaning it gets raw model dumps without relationship loading.

**Action:** Switch Schedule.jsx to use the typed APIs (`clientsAPI`, `servicesAPI`, `employeesAPI`).

---

### 7.7 Documents Page Embeds Template Management
The Documents page is responsible for both document library and template management. These are logically separate concerns — templates are used across Clients, Employees, and Schedule pages, but managed only through Documents.

**Action:** Move template management into its own route (`/templates`) or into the Profile settings area. The template-use modals (Modal_Template_Use) can remain accessible from wherever they're triggered.

---

### 7.8 No Offline State Handling
The app caches data in localStorage but provides no UI feedback when the API is unreachable. A user could believe they successfully saved a record when the request silently failed.

**Action:** Add a global online/offline indicator (navigator.onLine event) and disable write operations (add/edit/delete buttons) when offline, showing a banner message.

---

## 8. Proposed Business Workflows

The following workflows represent what a complete general-purpose business application should support. They are mapped against what currently exists and what is missing.

---

### 8.1 Client Lifecycle Workflow
```
PROSPECT
    │ (manual add or CSV import)
    ▼
CLIENT CREATED (Clients page)
    │
    ├──► APPOINTMENT BOOKED (Schedule page)
    │        │
    │        ▼
    │    SERVICE DELIVERED
    │        │
    │        ▼
    │    ATTENDANCE LOGGED (Widget_Attendance)
    │        │
    │        ▼
    │    INVOICE GENERATED (Template: Invoice)
    │        │
    │        ▼
    │    PAYMENT RECORDED (Sales POS → checkout)
    │        │
    │        ▼
    │    RECEIPT SENT (Template: Receipt via email)
    │        │
    │        ▼
    │    CLIENT TIER UPGRADED (Clients edit)
    │
    └──► DIRECT SALE (Sales POS, no appointment)
             │
             ▼
         PAYMENT RECORDED → RECEIPT SENT

MISSING:
- ❌ No quote/estimate workflow before booking
- ❌ No follow-up task or reminder creation after sale
- ❌ No client portal / self-service booking
- ❌ No loyalty point tracking (tier is manual)
```

---

### 8.2 Employee Lifecycle Workflow
```
CANDIDATE
    │ (admin creates user)
    ▼
ONBOARDING REQUEST CREATED (Employees → HR)
    │
    ├── Tasks assigned (checklist in OnboardingRequest)
    ├── Insurance plan assigned
    ├── Role + permissions granted
    │
    ▼
ACTIVE EMPLOYEE
    │
    ├──► SCHEDULE ASSIGNED (Schedule page, attendees)
    │        │
    │        ▼
    │    ATTENDANCE TRACKED (clock in/out)
    │
    ├──► LEAVE REQUEST SUBMITTED (Profile or Employees → HR)
    │        │
    │        ▼
    │    MANAGER APPROVES/REJECTS
    │        │
    │        ▼
    │    SCHEDULE BLOCKED (out-of-office indicator)
    │
    ├──► PAYROLL PROCESSED (Employees → Wages)
    │        │
    │        ▼
    │    PAY SLIP GENERATED → EMPLOYEE VIEWS (Profile → Wages)
    │
    └──► OFFBOARDING REQUEST (Employees → HR)
             │
             ▼
         USER DEACTIVATED

MISSING:
- ❌ No performance review / evaluation module
- ❌ No training/certification tracking
- ❌ No shift swap or coverage requests
- ❌ Payroll does not auto-calculate from attendance hours
```

---

### 8.3 Inventory Management Workflow
```
ITEM CREATED (Inventory page)
    │
    ├── Type assigned: PRODUCT / RESOURCE / ASSET / LOCATION / ITEM
    │
    ├──► STOCK MONITORED
    │        │
    │        ├── Stock OK → normal operation
    │        └── Stock LOW (qty < min_stock_level) → red badge
    │                    ↓
    │               [MISSING: auto-notification / reorder alert]
    │
    ├──► SOLD (Sales POS → SaleTransItem)
    │        │
    │        ▼
    │    STOCK DECREMENTED [MISSING: not currently implemented]
    │
    ├──► USED IN SERVICE (Service resources linked via serviceRelationsAPI)
    │
    └──► SUPPLIER LINKED [MISSING: no Supplier ↔ Inventory link]

MISSING:
- ❌ Stock is not automatically decremented when an item is sold
- ❌ No purchase order / restock workflow
- ❌ No supplier-to-inventory link (can't see which supplier provides which item)
- ❌ No inventory audit log (who changed stock and when)
- ❌ No bulk stock adjustment
```

---

### 8.4 Sales / POS Workflow
```
BROWSE CATALOGUE (Sales page)
    │ (Services tab / Products tab)
    ▼
ADD TO CART → adjust quantities
    │
    ▼
ASSIGN CLIENT (optional)
    │
    ▼
CHECKOUT
    │
    ├── Payment method: CASH / CARD
    ├── Process → SaleTransaction saved to DB
    ├── Receipt template printable
    │
    ▼
TRANSACTION HISTORY → Modal_History_Sales
    │
    └── Analytics → Reports page (Sales Trends report)

MISSING:
- ❌ Stock not decremented on sale (critical gap)
- ❌ No discount / coupon code support
- ❌ No split payment (e.g. half cash, half card)
- ❌ No refund / return workflow
- ❌ No tax configuration (tax rate is not configurable)
- ❌ No invoice auto-send on checkout (currently manual via template mailer)
- ❌ No daily sales summary / end-of-day report
```

---

### 8.5 Document Management Workflow
```
DOCUMENT CREATED
    │
    ├── Upload file (drag-and-drop) → stored in DB blob + filesystem
    │       │
    │       └── Category assigned
    │
    ├── Assign to entity (client, employee, service)
    │       │
    │       └── Entity can view assigned documents in their detail modal
    │
    ├── View inline (PDF / XLSX / HTML / code)
    │
    ├── Edit (RichText / Code / OnlyOffice)
    │       │
    │       └── Save → content_type updated if converted
    │
    └── Sign → Modal_Signature → signature appended

TEMPLATE WORKFLOW:
TEMPLATE CREATED (Modal_Template_Editor)
    │ Uses {{variable}} placeholders
    ▼
TEMPLATE TRIGGERED (from Clients / Employees / Schedule)
    │ Variables populated (buildClientVariables, etc.)
    ▼
TEMPLATE PREVIEW + PRINT / COPY

MISSING:
- ❌ No version history for documents (edits overwrite)
- ❌ No document expiry / renewal reminders
- ❌ No e-signature workflow (currently just a canvas signature, not legally binding)
- ❌ Template emails are print/copy only — no direct email send (SMTP)
- ❌ No document sharing link (external access)
```

---

### 8.6 Scheduling Workflow
```
APPOINTMENT CREATED (Schedule page)
    │
    ├── Client selected
    ├── Service selected
    ├── Employees assigned (multi-select attendees)
    ├── Date + time set
    │
    ▼
CALENDAR DISPLAY (month/week/day view)
    │
    ├── Drag-and-drop reschedule
    ├── Leave blocking (out-of-office indicators)
    │
    ▼
REMINDER EMAIL (Modal_Template_Use, manual trigger)
    │
    ▼
ATTENDANCE LOGGED (Widget_Attendance on Schedule page)
    │
    ▼
APPOINTMENT COMPLETED

MISSING:
- ❌ No online booking form (client self-service)
- ❌ No automated reminder send (reminders are manual copy/print only)
- ❌ No recurring appointment support
- ❌ No waitlist management
- ❌ No appointment status field (pending / confirmed / completed / cancelled)
- ❌ No buffer time between appointments
```

---

### 8.7 Reporting Workflow
```
SELECT REPORT TYPE (Reports page)
    │ (9 types: Appointments, Revenue, Client Activity, Service Performance,
    │  Sales Trends, Attendance, Employee Stats, Inventory Status, Payroll)
    ▼
SET DATE RANGE + GROUPING (daily/weekly/monthly)
    │
    ▼
CHART RENDERED (Chart.js)
    │
    ├── Switch chart type (line/bar/pie/area/doughnut)
    └── Print/PDF export (browser print dialog)

MISSING:
- ❌ No data table view alongside chart
- ❌ No CSV/XLSX export for report data
- ❌ No saved/scheduled reports
- ❌ No comparison periods (e.g. this month vs last month)
- ❌ No KPI dashboard / summary cards (just charts, no headline numbers)
```

---

## 9. Priority Action List

### Critical (affects core correctness)
1. **Stock is not decremented on sale** — inventory counts become meaningless
2. **Sales footer fixed position** — breaks on iOS keyboard open
3. **Button design system unification** — three competing systems cause maintenance hell

### High (affects user experience)
4. **Suppliers page refactor** — architectural outlier, inconsistent UX
5. **Split Employees.jsx** — 2500 lines is unmaintainable
6. **Standardize footer heights and padding** across all modals
7. **Standardize border-top to border-t** (remove Bootstrap/Tailwind mix)

### Medium (affects business value)
8. **Add appointment status field** (pending/confirmed/completed/cancelled)
9. **Add supplier-inventory link** (which supplier provides which item)
10. **Add refund/return workflow** to POS
11. **Add tax rate configuration** to AppSettings
12. **Auto-calculate payroll from attendance hours**
13. **Remove localStorage transaction caching** (use API cache only)

### Low (polish and future-proofing)
14. **Replace upside-down table pattern** with standard sorted table + sticky header
15. **Add offline indicator** and write-operation blocking
16. **Add optimistic UI updates** for common operations
17. **Add refetchPermissions() after permission changes**
18. **Replace hardcoded textarea heights** with Tailwind classes
19. **Document version history** (currently edits overwrite without history)
20. **Direct email send** (SMTP integration for template dispatch)
