Frontend Refactoring Plan
Guiding Principles
All styling lives in index.css. Zero style={{}} in JSX.
One class per component type. Variants extend the base class.
Every file has one comment block at the top only. Functions described in one sentence each. No inline comments.
User-facing strings (errors, labels, warnings) are minimal — under 5 words where possible.
Reduce duplication; if three pages do the same thing, extract it once.
Phase 1 — CSS Architecture
1.1 Component Class System
Replace the current mix of Tailwind utilities + Bootstrap classes + inline styles with a semantic layer in index.css. Every component type gets one base class, variants add a modifier.

Buttons — base: .btn-app, modifiers: --primary, --danger, --secondary, --cancel, --icon, --circle


/* base */
.btn-app { height: 3rem; border-radius: 9999px; ... }
/* modifiers */
.btn-app--primary { background: var(--color-secondary-600); }
.btn-app--danger  { background: var(--color-red-600); }
.btn-app--icon    { width: 3rem; padding: 0; }
/* dark */
.dark .btn-app--primary { background: var(--color-secondary-500); }
Current btn-app-primary, btn-app-danger, btn-app-secondary, btn-app-cancel map directly — rename them to -- modifier convention and update all call sites.

Badges — base: .app-badge, modifiers: --blue, --green, --red, --gray, --purple, --gold, --pill


.app-badge { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 0.375rem; }
.app-badge--pill { border-radius: 9999px; }
.app-badge--blue { background: #DBEAFE; color: #1E40AF; }
.dark .app-badge--blue { background: rgba(59,130,246,0.2); color: #93C5FD; }
Eliminates ~50 inline badge class combinations currently scattered across every page.

Form Inputs — base: .app-input, modifiers: --sm, --error


.app-input { height: 3rem; border-radius: 9999px; border: 1px solid var(--bs-border-color); ... }
.app-input--sm { height: 2.25rem; font-size: 0.875rem; }
.app-input--error { border-color: var(--bs-danger); }
Replaces form-control form-control-sm, form-select form-select-sm, and the global pill-radius override.

Tables — base classes already exist (app-table-row, main-page-table-row) but need consolidation


.app-table { width: 100%; border-collapse: collapse; }
.app-table-row { height: 2.25rem; cursor: pointer; border-bottom: 1px solid var(--bs-border-color); }
.app-table-row:hover { background: var(--bs-secondary-bg); }
.app-table-cell { vertical-align: middle; padding: 0 0.5rem; }
Eliminates table table-borderless table-hover mb-0 table-fixed repeated on every page.

Cards / Panels — base: .app-card


.app-card { border-radius: 0.5rem; border: 1px solid var(--bs-border-color); background: var(--bs-body-bg); }
.app-card--elevated { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
Modals — base: .app-modal, modifiers: --sheet (default), --centered, --fullscreen
The three modal variants in Modal.jsx each get a CSS class instead of conditional Tailwind strings.

Layout Utilities — extract repeated flex combos:


.app-row         { display: flex; align-items: center; }
.app-row--between { justify-content: space-between; }
.app-row--gap-2  { gap: 0.5rem; }
.app-col         { display: flex; flex-direction: column; }
.app-scroll-y    { overflow-y: auto; flex: 1 1 0; min-height: 0; }
Replaces d-flex align-items-center justify-content-between, flex-grow-1 overflow-auto d-flex flex-column-reverse, and the rest of the repeated Bootstrap+Tailwind flex chains.

1.2 Inline Styles to Extract
Every style={{}} in JSX has an equivalent CSS class to be created:

Current inline style	New class
style={{ wordBreak: 'break-word' }}	.text-wrap-word
style={{ fontSize: '0.68rem' }}	.text-xxs
style={{ fontSize: '0.8rem' }}	.text-xs (already Tailwind — use it)
style={{ height: '4px' }} on progress bar	.app-progress-bar
style={{ height: '80px' }} on textarea	.app-textarea--sm
style={{ minWidth: '200px' }} on dropdowns	.app-dropdown--min
style={{ width: '1.1rem', height: '1.1rem' }} on icons	.app-icon--sm
style={{ transition: 'transform 0.2s', transform: ... }} on chevrons	.app-chevron + .app-chevron--open
style={{ lineHeight: 1, fontWeight: 700 }}	.app-label--bold
style={{ userSelect: 'none' }}	.no-select
style={{ backgroundColor: employeeColor }}	Keep as inline — dynamic color from data cannot be a static class
The only acceptable remaining style={{}} uses are data-driven dynamic values: employee colors, active calendar color, UI scale factor. Everything else moves to index.css.

Phase 2 — Component Centralization
2.1 New Shared Components to Create
Badge.jsx — replaces all inline badge patterns


// Props: variant ("blue"|"green"|"red"|"gray"|"purple"|"gold"), pill, label
<Badge variant="blue" pill label="Product" />
Eliminates the ~6 per-page color mapping functions (getItemTypeColor, getTierColor, getStatusColor, etc.) — see Phase 3.

FilterButton.jsx — replaces the repeated filter dropdown pattern


// Props: options[], value, onChange, label
<FilterButton options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} label="Type" />
Currently Inventory, Clients, Employees, Documents each have near-identical filter dropdown code.

StatusBadge.jsx — wraps Badge with status-to-variant mapping


<StatusBadge status={item.status} />
FormRow.jsx — wraps form-floating mb-2 pattern


// Props: label, children
<FormRow label="Name"><input .../></FormRow>
ConfirmButton.jsx — wraps delete/destructive actions with a single confirm step built in, replaces showConfirm() calls scattered across pages.

2.2 Existing Components to Consolidate
Button_Toolbar.jsx + Button_Icon.jsx — merge into one AppButton.jsx with icon, label, variant, size props. Training mode behavior moves inside.

Page_Table_Header.jsx + Page_Table_Row.jsx + Page_Table_Footer.jsx — already well-structured. Add CSS classes from Phase 1.1. Remove inline colgroup style={{ width }} by supporting widths prop that injects a <colgroup>.

Modal.jsx — already well-structured. Replace Tailwind class strings inside with CSS classes from Phase 1.1.

Form_Client.jsx, Form_Employee.jsx, Form_Item.jsx, Form_Service.jsx — each has repeated field layout. Validate that FormRow wrapper from 2.1 covers all of them uniformly.

Phase 3 — Code Refactoring
3.1 Centralize Utility Functions
Create src/utils/colorMapping.js:


// Maps entity type/status/tier values to badge variants
export function itemTypeVariant(type) { ... }   // PRODUCT→blue, RESOURCE→green, etc.
export function tierVariant(tier) { ... }         // PLATINUM→purple, GOLD→gold, etc.
export function statusVariant(status) { ... }     // active→green, inactive→gray, etc.
export function stockVariant(item) { ... }        // low→red, ok→green
Delete the equivalent functions currently inline in: Inventory.jsx, Clients.jsx, Employees.jsx, Profile.jsx, ProcurementUI.jsx.

Create src/utils/formatters.js (extend dateFormatters.js or replace it):


export function formatCurrency(v) { return `$${(+v || 0).toFixed(2)}`; }
export function formatPercent(v)  { return `${(+v || 0).toFixed(1)}%`; }
export function formatPhone(raw)  { ... }  // currently only in Form_Client.jsx
Delete hardcoded $${x.toFixed(2)} and formatPhone in Form_Client.jsx.

3.2 Page-Level Refactoring
Profile.jsx (~900 lines) — largest page file. Extract each accordion panel into its own component:

Panel_Profile.jsx (personal info)
Panel_Benefits.jsx
Panel_Wages.jsx
Panel_Settings.jsx
Panel_Schedule.jsx (already partially done with ScheduleSettings.jsx)
Profile.jsx becomes an orchestrator ~150 lines.

Documents.jsx (~600 lines) — extract filter bar + category management into Documents_FilterBar.jsx.

Inventory.jsx (~650 lines) — extract the feature tag panel and stock status logic into Inventory_RowDetail.jsx.

Schedule.jsx — calendar view logic (month/week/day switching, navigation) can move into a useCalendarView hook, leaving Schedule.jsx as layout only.

3.3 Remove Dead/Redundant Code
PageLayout.jsx and Page_Layout.jsx — two files with nearly the same name. Consolidate to one.
Debug_Permission.jsx and Debug_ApiInfo.jsx — gate behind import.meta.env.DEV or remove.
useFetchOnce.js — verify it's not redundant with Zustand store fetching logic.
Remove table-fixed from table className — no fixed-layout tables exist; it's a no-op.
Phase 4 — Comment Standards
Every file gets one comment block at the top. Format:


// FILE: ComponentName.jsx
// renders the main page table row with click handler
// applies hover state and selection highlight
// supports training mode compact size
Rules:

One sentence per function/export, past or present tense, no filler words.
No // comments inside function bodies.
No /* block comments */ inside JSX.
JSX {/* */} comments: only where absolutely required for conditional rendering explanation, max 5 words.
Phase 5 — User-Facing String Reduction
Target: all error messages, empty states, button labels, and tooltips reduced to ≤5 words.

Current	Replacement
"No items found matching your search criteria"	"No results"
"Are you sure you want to delete this item?"	Replaced by ConfirmButton visual pattern — no text
"Something went wrong. Please try again later."	"Error. Try again."
"Loading data, please wait..."	"Loading..."
"No records to display"	"None"
"Successfully saved"	"Saved"
"Failed to load"	"Load failed"
"Upload complete"	"Done"
Column header "Actions"	Remove — icon buttons are self-explanatory
Tooltip "Click to edit"	Remove
Create src/utils/strings.js with all user-facing strings as constants so they're changed in one place and consistent across pages.

Execution Order
Phase	Effort	Risk	Do First?
1.1 CSS component classes	Medium	Low	Yes — unlocks all others
1.2 Inline style extraction	Low	Low	Yes — quick wins
3.1 Utility centralization	Low	Low	Yes
4 Comment standards	Low	None	Yes — do alongside code changes
2.1 New shared components	Medium	Medium	After CSS is stable
2.2 Component consolidation	Medium	Medium	After new components exist
3.2 Page-level refactoring	High	Medium	Last
5 String reduction	Low	Low	Anytime
What NOT to Change
Modal.jsx variant API (centered, fullScreen) — it works and is used consistently.
Zustand store structure in useStore.js — well-designed, no duplication.
dateFormatters.js — already centralized correctly.
Button_Toolbar.jsx training mode logic — keep, just rename and merge with Button_Icon.
The upside-down scrolling table pattern (flex-column-reverse) — intentional UX behavior.