# Implementation Requirements

Organized feedback into actionable sections by page and component.

---

## **IMMEDIATE FIXES (High Priority)**

### **Inventory Page**
- **Fix**: Header should remain sticky on mobile but not overlap the table
- **Fix**: Middle scrollable area should be 100% height minus header and footer heights (prevent overflow)

### **History**
- **Add**: Sales history section on Sales page

---

## **PAGE-SPECIFIC UPDATES**

### **Employee Page**
- [ ] **Database**: Add "supervisor" column to employee table
- [ ] **UI**: Convert edit modal to tabbed interface (Details | Benefits | Permissions | Performance)
  - **Details tab**: Personal info, supervisor, direct reports, ID number, hire date, location
  - **Benefits tab**: Pay, insurance, vacation, deductions
  - **Permissions tab**: Page access controls
  - **Performance tab**: Review logs, goals, feedback, completed/pending task stats

### **Sales Page**
- [ ] **Customer Search**: Add "+" button to create new client (opens client modal)
- [ ] **Cart Modal**: 
  - Add cancel button to bottom
  - Replace "Add to cart" button with "Amount in cart" display
  - Add exit button when viewing item details
- [ ] **Footer Redesign**:
  - Layout: Search bar left + circular icon buttons right
  - Replace ALL/Services/Products toggle with 2 checkboxes (Services | Products)
  - Footer buttons: (Service icon) (Product icon) (Cart icon)
  - Sales history → separate button/modal (left of cart)
- [ ] **Component Updates**: 
  - All buttons in footer section
  - Button widths based on content (no column spacing)
  - Service/Product toggle → icons only, cart-button size

### **Schedule Page**
- [ ] **Appointments**: Make span height proportional to duration (not fixed 1-hour chunks)
- [ ] **Mobile Layout**: 
  - Calendar container scrollable vertically
  - Header and footer fixed at top/bottom
  - No scrolling needed to access controls

### **Profile Page**
- [ ] **Database**: Add employee profile picture (blob storage)
- [ ] **UI Updates**:
  - Float cards to bottom of page
  - Add collapse/expand toggle to each card's top-right
  - Collapsed state: card header visible only
  - Expanded state: full content, header hidden
- [ ] **Settings Section in Profile**:
  - Notification toggle (accordion style, card width)
  - "Add to home screen" → house icon only (no text)
  - Logout button → icon only (no text)

### **Reports Page**
- [ ] **UI**: Float reports to bottom of page

### **Settings Page**
- [ ] **General**: Logo image upload (saves to branding settings in DB)
- [ ] **Theme**: Changes should update all interface buttons and components in real-time
- [ ] **Branding Settings** (create/update DB schema):
  - Brand Name
  - Logo (image blob)
  - Slogan/Tagline
  - Color Palette (primary, secondary, accent colors)
  - Typography/Fonts
  - Imagery/Photography Style
  - Brand Voice/Tone
  - Shapes/Icons/Symbols
  - Packaging/Design Style
  - Brand Story/Mission/Values

---

## **GLOBAL/COMPONENT UPDATES**

### **Mobile Browser UI**
- **Challenge**: Browser chrome (address bar, tabs, home icon, etc.) takes up space
- **Solution**: Add toggle button to hide/show browser chrome (if possible via PWA/viewport settings)

### **Component Library**
- [ ] All footer buttons should be circular icons (consistent sizing)
- [ ] Button widths: content-based (CSS `width: auto`)
- [ ] Checkbox style for toggles (Services/Products filter pattern)

---

## **IMPLEMENTATION PRIORITY ORDER**

1. **Database schema updates** (Employee supervisor, Profile picture, Branding settings)
2. **Inventory Layout** (sticky header, scrollable container)
3. **Employee Tabbed Modal** (UI framework)
4. **Sales Footer Redesign** (impacts several features)
5. **Other UI refinements**
