# Company Registration

## Overview

Company registration has been refactored from a standalone FastAPI server to fully integrated React components that connect to the main backend API.

## Architecture

### Backend
- **File**: `backend/routers/company_registration.py`
- **Endpoints**:
  - `POST /api/v1/company-registration/register` — Create new company + admin user
  - `GET /api/v1/company-registration/status` — Check database connectivity
  - `GET /api/v1/company-registration/companies` — List all registered companies

### Frontend
- **File**: `client-portal/src/pages/CompanyRegistration.jsx`
- **Route**: `/company-registration`
- **Features**:
  - Company registration form
  - Admin user creation
  - Live company list with employee counts
  - Database status indicator
  - Form validation
  - Success confirmation

## How to Use

### Local Testing

1. **Start the backend** (includes company registration endpoints):
   ```bash
   cd backend
   python main.py
   ```

2. **Start the client-portal frontend**:
   ```bash
   cd client-portal
   npm run dev
   ```

3. **Access the registration page**:
   ```
   http://localhost:5174/company-registration
   ```

### Production Deployment

The company registration is now part of the standard application deployment:

1. **Backend deployment** — Deploy `backend/` normally; includes registration endpoints
2. **Frontend deployment** — Deploy `client-portal/` normally; includes registration page

No separate server/deployment needed.

## API Integration

All requests flow through the main backend API:

```
Client (JSX) → Backend API → Database
```

### Example Request

```javascript
const response = await fetch('/api/v1/company-registration/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_id: 'ACME-CORP',
    company_name: 'Acme Corporation',
    admin_username: 'admin',
    admin_password: 'secure_password',
    admin_first_name: 'John',
    admin_last_name: 'Doe',
    admin_email: 'john@acme.com'
  })
});
```

## Database Models

Registration uses existing backend models:
- `Company` — stores company metadata
- `User` — stores admin user credentials and role

Automatic features:
- Admin user role set to "ADMIN" (uppercase)
- Company ID normalized to uppercase
- Timestamps auto-set on creation

## Validation

### Company ID
- Must be uppercase letters, numbers, hyphens, underscores
- Must be unique
- Max 50 characters

### Admin Account
- Username required
- Password minimum 6 characters
- Passwords must match
- Email optional

### Company Name
- Required
- No length restrictions

## Legacy Files

The `CompanyCreation/` folder now contains only:
- `requirements.txt` — Python dependencies (legacy)
- `app.py` — Legacy FastAPI server (no longer used)
- `create_company.py` — Legacy script (no longer used)

These are kept for reference but no longer deployed or executed. All functionality is in the main backend/frontend.

## Migration Notes

- ✅ Database connection now goes through main backend (no direct DB access from frontend)
- ✅ All validation happens on backend
- ✅ Single database transaction per registration
- ✅ Proper error handling and rollback
- ✅ Responsive React UI with real-time status

## Troubleshooting

### "Database unreachable" message

The backend needs to be running and connected to the database.

**Solution**: Start the backend API first:
```bash
cd backend
python main.py
```

### 409 Conflict error during registration

Company ID already exists in the database.

**Solution**: Use a different, unique company ID.

### 500 Internal Server Error

Check backend logs for details. Common causes:
- Database connection issues
- Invalid enum type for user role
- Missing database tables

**Solution**: Ensure backend migrations have run:
```bash
cd backend
python init_database.py
```
