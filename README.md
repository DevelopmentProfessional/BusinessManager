# Business Manager - Feature Documentation

This README is organized by pages/modules. Each section is independent and can be worked on separately.

---

## Attendance

### TO REVIEW

- [ ] Verify all functionality works as expected
- [ ]

### TO CODE

- [ ] Initial implementation pending

---

## Clients

### TO REVIEW

- [ ] Verify all functionality works as expected

### TO CODE

- [ ] Initial implementation pending

---

## Documents

### TO REVIEW

- [ ] Verify all functionality works as expected

### TO CODE

- [ ] Initial implementation pending

---

## Employees

### TO REVIEW

- [X] Use EmployeeFormTabs.jsx as a template for all input fields (DONE)
- [X] All TEXT INPUT and number inputs should have floating labels (DONE)
- [X] Update all dropdowns with floating label design (DONE)
- [X] Move tabs to the bottom of the modal (DONE - tabs now at bottom)

### TO CODE

- [ ] Add to database: "supervisor" column on employee table
- [ ] Restructure employee edit modal with tabs (Details, Benefits, Permissions, Performance)
- [ ] Details tab: personal details, supervisor, direct reports, ID number, hire date, location
- [ ] Benefits tab: pay, insurance, vacation, and deductions
- [ ] Permissions tab: granting/denying access to specific pages
- [ ] Performance tab: reviews log, goals, feedbacks, completed/pending tasks stats

---

## Inventory

### TO REVIEW

- [X] Top header title fixed at top on mobile (DONE)
- [X] Minimize "All Types" and "All Stock" components to text width (DONE)
- [X] "Add new item" and "edit" item designed like sales cards (DONE)
- [X] Remove the (x) button from edit item modal (DONE)
- [X] Change "Edit Item" title to just "Edit" (DONE)
- [X] The inventory add new format matches edit item format (DONE)
- [X] Remove the count label (e.g., "84/48") - verify if this exists
- [ ] Remove count/total indicator next to "All Stock" input - verify if this exists

### TO CODE

- [ ] Add procurement management fields to item edit:
  - Unit Cost
  - Weight
  - Length
  - Height
  - Pattern
  - Manufacture Date
  - Expiration Date
- [ ] CSV Import: Display which columns are being imported under "Import Items from CSV" popup
- [ ] The import should match header fields with column headers dynamically
- [ ] Demand Forecasting:
  - Use historical records to forecast next month/year
  - Link to RSS feeds for topic interpolation
  - Analyze historical data from previous year, quarter, and month
  - Generate supply trend recommendations
- [ ] Dynamic Stock Thresholds:
  - Min stock order and max threshold calculated based on sales rate
  - Lower thresholds when sales slow down
  - Increase thresholds when sales accelerate
- [ ] Location Capacity Management:
  - Add capacity volume to locations
  - Add to Products database: selectable measure unit (sq ft, sq m, sq yd)
  - Add product size field (how much of product fits per unit)
  - Alert user when location nears capacity
- [ ] Location Types:
  - Storage locations: capacity-based
  - Operation locations: asset/people assignment-based
  - Relationships: 1 Employee → Many Assets, 1 Location → Many Assets, 1 Location → Many Employees, 1 Asset → Many Employees
  - Assets can be shareable between employees

---

## Reports

### TO REVIEW

- [X] Float reports to the bottom of the page (DONE)

### TO CODE

- [ ] Initial implementation pending

---

## Sales

### TO REVIEW

- [X] Add sales history section to sales page (DONE - placeholder added)
- [ ] For the sales history, it should open as a modal

### TO CODE

- [X] Customer search: Add "+" button to create new client (DONE - already implemented)

---

## Schedule

### TO REVIEW

- [ ] Swipe navigation is COMPLETE (see Schedule Swipe Implementation section below)
- [ ] Based on appointment type, the layout should change
- [ ] Move checkbox position
- [ ] Empty timeslots should be cell height of the time
- [ ] Auto-navigate to current time when opening day view
- [ ] Update event modal to show selected dropdown items
- [ ] Add checkbox-like button on edit appointment modal to right of dropdown (renders selected items instead of count)
- [ ] Display client/employee names instead of "3 people" on dropdowns
- [ ] Expand employee dropdown width to w-1200 for responsiveness
- [ ] Make horizontal dropdown lists scrollable right when needed
- [ ] Prevent scrollbars at 100% - flex vertically to fit on single row
- [ ] Clicking event on schedule should open edit modal

### TO CODE

- [ ] None pending

### Schedule Swipe Implementation (COMPLETED)

**Status:** ✅ Feature Complete - Testing phase required

**What was implemented:**

- Enhanced Schedule.jsx with touch handlers (handleTouchStart, handleTouchMove, handleTouchEnd)
- Swipe detection with 50px minimum distance, 500ms duration check
- 300ms cooldown between swipes
- Date bounds validation (1900-2100)
- Month boundary edge case handling
- Reusable SwipeCalendarNavigation.js utility class (370 lines)
- Standalone demo: swipe_calendar_demo.html (608 lines)

**What remains (Testing & Validation):**

- [ ] Physical device testing on Android (Chrome)
- [ ] Physical device testing on iOS (Safari)
- [ ] Cross-browser testing (Samsung Internet, Firefox Mobile)
- [ ] Edge case verification (Jan 31 → Feb 28/29 transitions, boundary alerts)
- [ ] Performance validation (60fps, memory leaks, large datasets)
- [ ] Accessibility improvements (ARIA, screen reader support)
- [ ] Optional enhancements (haptic feedback, loading states, undo)

---

## Services

### TO REVIEW

- [ ] Verify all functionality works as expected

### TO CODE

- [ ] Initial implementation pending

---

## Settings

### TO REVIEW

- [ ] Float settings cards to the bottom of the page
- [ ] Settings are too text-heavy: add question mark icon (blends with theme) for context help

### TO CODE

- [ ] Add global scheduling settings:
  - Start of day
  - End of day
  - Attendance check-in required (show attendance input on schedule when enabled)
- [ ] Restructure left menu:
  - Move to bottom footer (fixed)
  - Show icons only (remove text)
  - Remove "Account" section
  - Remove "API & Debug" section
- [ ] Move "Branding" and "Notification" inside "General" section
- [ ] Database section: Add dynamic import feature
  - Select database table from dropdown
  - Show table columns after selection
  - CSV import with header row matching
  - Dynamically construct INSERT query based on column matching
  - Escape special characters (') before insert to prevent SQL injection
- [ ] General Settings: Add logo image upload (saves to branding database)
- [ ] Branding Settings: Include the following fields
  - Brand Name
  - Logo (with image upload)
  - Slogan / Tagline
  - Color Palette
  - Typography / Fonts
  - Imagery / Photography Style
  - Brand Voice / Tone
  - Shape / Icons / Symbols
  - Packaging / Design Style
  - Brand Story / Mission / Values

---

## Profile

### TO REVIEW

- [X] Float cards to the bottom of the page (DONE)
- [X] Move database environment section to Settings as a dropdown (PENDING)

### TO CODE

- [ ] Add color picker in settings (color correlates to employee's calendar color)

---

## Global Components

### TO REVIEW

- [X] All buttons positioned in bottom left within footer section (DONE)
- [X] Button width based on text length (DONE)
