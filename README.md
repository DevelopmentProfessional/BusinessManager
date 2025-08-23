# Business Manager

A comprehensive business management system with client management, inventory tracking, employee scheduling, and document management.

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BusinessManager
   ```

2. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

**Option 1: Use the startup script (Windows)**
```bash
start.bat
```

**Option 2: Manual startup**

1. **Start the backend server**
   ```bash
   cd backend
   python main.py
   ```

2. **Start the frontend server (in a new terminal)**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000

## Features

- **Dashboard**: Overview of business metrics
- **Clients**: Customer management
- **Employees**: Staff management
- **Services**: Service catalog
- **Schedule**: Appointment scheduling
- **Inventory**: Stock management
- **Documents**: File management
- **Attendance**: Time tracking

## Development

The application uses:
- **Backend**: FastAPI with SQLite database
- **Frontend**: React with Vite
- **Styling**: Tailwind CSS

## API Endpoints

- `/api/v1/clients` - Client management
- `/api/v1/employees` - Employee management
- `/api/v1/services` - Service management
- `/api/v1/schedule` - Scheduling
- `/api/v1/inventory` - Inventory management
- `/api/v1/documents` - Document management

## Database

The application uses SQLite for data storage. The database file is automatically created at `backend/business_manager.db`.
