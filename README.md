# Business Management System

A comprehensive full-stack business management application built with React, FastAPI, and PostgreSQL.

## 🚀 Features

- **Client Management**: CRUD operations for client contacts and information
- **Product Catalog**: Manage products with SKU, pricing, and descriptions
- **Inventory Tracking**: Monitor stock levels with low-stock alerts
- **Service Management**: Define billable services and pricing
- **Employee Management**: Staff records and role management
- **Appointment Scheduling**: Book and manage client appointments
- **Asset Tracking**: Monitor company equipment and assignments
- **Attendance System**: Employee clock-in/out tracking
- **Document Management**: File uploads and metadata storage
- **Dashboard**: Overview with key metrics and alerts

## 🛠️ Technology Stack

### Frontend
- **React 18** with Vite for fast development
- **Tailwind CSS** for responsive styling
- **Zustand** for state management
- **React Router** for navigation
- **Axios** for API communication
- **Heroicons** for UI icons

### Backend
- **FastAPI** with Python for RESTful API
- **SQLModel** (SQLAlchemy + Pydantic) for database ORM
- **PostgreSQL** for data persistence
- **Uvicorn** ASGI server
- **Auto-generated API docs** with Swagger UI

### Deployment
- **Render.com** for hosting (frontend, backend, database)
- **GitHub** integration for CI/CD
- **Environment-based configuration**

## 📁 Project Structure

```
BusinessManager/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLModel data models
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   └── routers/            # API route modules
│       ├── clients.py
│       ├── products.py
│       ├── inventory.py
│       ├── services.py
│       ├── employees.py
│       ├── schedule.py
│       ├── assets.py
│       ├── attendance.py
│       └── documents.py
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/          # Main application pages
│   │   ├── services/       # API service functions
│   │   ├── store/          # Zustand state management
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # React entry point
│   ├── package.json        # Node.js dependencies
│   ├── vite.config.js      # Vite configuration
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── .env.example        # Environment variables template
└── render.yaml             # Render deployment configuration
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL database

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BusinessManager
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your database URL
   uvicorn main:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your API URL
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 🌐 Deployment

The application is configured for deployment on Render.com using the `render.yaml` file.

### Deploy to Render

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Render**
   - Create a new Render account
   - Connect your GitHub repository
   - Render will automatically deploy using `render.yaml`

3. **Environment Variables**
   - Database URL is automatically configured
   - Update CORS origins for production URLs

## 📊 Database Schema

The application uses UUID primary keys and includes the following entities:

- **Clients**: Customer contact information
- **Products**: Catalog items with SKU and pricing
- **Inventory**: Stock tracking linked to products
- **Suppliers**: Product suppliers and contacts
- **Services**: Billable services and duration
- **Employees**: Staff information and roles
- **Schedule**: Appointments linking clients, services, and employees
- **Assets**: Company equipment and assignments
- **Attendance**: Employee time tracking
- **Documents**: File metadata for entity attachments

## 🔧 API Endpoints

All endpoints are prefixed with `/api/v1`:

- `GET/POST/PUT/DELETE /clients` - Client management
- `GET/POST/DELETE /products` - Product catalog
- `GET /inventory` - Inventory tracking
- `GET/POST/PUT/DELETE /services` - Service management
- `GET/POST/PUT/DELETE /employees` - Employee management
- `GET/POST/PUT /schedule` - Appointment scheduling
- `GET/POST/PUT /assets` - Asset tracking
- `GET/POST/PUT /attendance` - Time tracking
- `GET/POST/DELETE /documents` - Document management

## 🎨 UI Components

The frontend includes:

- **Responsive Layout** with sidebar navigation
- **Dashboard** with key metrics and alerts
- **Data Tables** with CRUD operations
- **Modal Forms** for data entry
- **Loading States** and error handling
- **Modern Design** with Tailwind CSS

## 🔐 Security Features

- CORS configuration for cross-origin requests
- Input validation with Pydantic models
- SQL injection prevention with SQLModel
- File upload security for documents

## 📈 Future Enhancements

- User authentication and authorization
- Role-based access control
- Advanced reporting and analytics
- Email notifications
- Mobile application
- Integration with external services
- Audit logging system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions, please create an issue in the GitHub repository.
