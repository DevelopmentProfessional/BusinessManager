# BusinessManager Project - Scope, Rules & Requirements

## 🎯 Project Overview
A full-stack business management application with React frontend and FastAPI backend, designed for managing clients, employees, services, inventory, schedules, and documents.

## 🔐 Permission System Rules

### Permission Hierarchy
1. **view/read** - Can see content but cannot edit or delete
2. **edit** - Can see and edit content but cannot delete
3. **delete** - Can delete content but cannot edit
4. **admin** - Has access to ALL permissions (view, edit, delete)

### Navigation Visibility Rule
**CRITICAL**: If a user has ANY permission (view, edit, delete, or admin) for a page, they should see that page in their navigation.

### Permission Logic Implementation
- `PermissionGate` component should allow access if user has the required permission OR admin access
- Admin users automatically have access to all pages and all operations
- Permission checks should be: `userPermission === requiredPermission || userPermission === 'admin'`

## 🏗️ Architecture Rules

### Frontend Structure
- **Framework**: React with Vite
- **State Management**: Zustand stores (`useStore.js`, `useDarkMode.js`)
- **Styling**: Bootstrap + Custom CSS (dark mode support)
- **Routing**: React Router with protected routes
- **Components**: Reusable components in `/components` directory

### Backend Structure
- **Framework**: FastAPI with Python
- **Database**: SQLite with SQLModel ORM
- **Authentication**: JWT tokens
- **API**: RESTful endpoints under `/api/v1/`
- **Permissions**: Role-based access control

### Key Files & Their Purposes
- `frontend/src/pages/Schedule.jsx` - Calendar/scheduling interface
- `frontend/src/components/PermissionGate.jsx` - Permission-based access control
- `frontend/src/store/useStore.js` - Main application state
- `backend/routers/` - API endpoint definitions
- `backend/models.py` - Database models

## 🎨 UI/UX Rules

### Calendar Component
- **Views**: Month, Week, Day views supported
- **Dark Mode**: Toggle with 🌚/🌞 emoji icons
- **Navigation**: Month/Week/Day on left, Previous/Today/Next on right
- **Appointments**: Display across all views, clickable for editing
- **Styling**: Clean grid layout, minimal custom CSS, preserve dark mode

### Form Components
- **Validation**: Client-side validation with error messages
- **Responsive**: Mobile-friendly design
- **Consistency**: Uniform styling across all forms

## 🔧 Development Rules

### Code Standards
- **No Custom CSS Override**: Avoid custom spacing/borders that break grid layouts
- **Dark Mode First**: All components must support dark mode
- **Permission Checks**: Always implement proper permission gates
- **NO TRY CATCH BLOCKS**: Never use try-catch blocks anywhere in the codebase
- **NO ERROR HANDLING**: No setError, clearError, or error state management
- **Data Loading**: Load all required data for dropdowns/forms

### File Modification Rules
- **Preserve Existing Logic**: Don't break working functionality
- **Incremental Changes**: Make small, testable changes
- **Documentation**: Update this file when adding new rules
- **Testing**: Verify changes work across all permission levels

## 📊 Data Flow Rules

### API Integration
- **Authentication**: JWT tokens in Authorization headers
- **Caching**: Use Zustand stores for data persistence
- **Refresh**: Manual refresh buttons for data reloading
- **NO ERROR HANDLING**: No error states, no try-catch blocks, no error management

### Database Operations
- **CRUD Operations**: Create, Read, Update, Delete with proper permissions
- **Data Validation**: Backend validation for all inputs
- **Relationships**: Maintain referential integrity

## 🚫 What NOT to Do

### Avoid These Practices
- ❌ Don't remove working permission logic
- ❌ Don't add custom CSS that breaks grid layouts
- ❌ Don't hardcode permissions - use the permission system
- ❌ Don't break dark mode functionality
- ❌ Don't remove appointment rendering logic
- ❌ Don't modify core architecture without documentation
- ❌ NEVER use try-catch blocks anywhere in the codebase
- ❌ NEVER implement error handling or error states

### Breaking Changes to Avoid
- Changing permission hierarchy without updating all components
- Removing essential imports or dependencies
- Modifying database schemas without migration scripts
- Breaking the calendar grid layout with custom CSS

## 🔄 Maintenance Guidelines

### When Adding Features
1. Check existing permission logic first
2. Ensure dark mode compatibility
3. Test with different user permission levels
4. Update this documentation if rules change

### When Fixing Bugs
1. Identify root cause without breaking working features
2. Test permission scenarios (view, edit, delete, admin)
3. Verify calendar functionality across all views
4. Ensure data loading works for all user types
5. NEVER add try-catch blocks or error handling

## 📝 Current Status
- ✅ Calendar component with Month/Week/Day views
- ✅ Dark mode toggle functionality
- ✅ Appointment rendering and editing
- ✅ Permission-based navigation
- ✅ Permission logic fixed (admin has all access)
- ✅ Navigation visibility working
- ✅ NO TRY CATCH BLOCKS - All error handling removed
- ✅ Responsive calendar layout

---
**Last Updated**: Current session
**Maintainer**: AI Assistant
**Purpose**: Keep project rules and architecture consistent across development sessions
