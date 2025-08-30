# Business Manager - Render Deployment Guide

## 🚀 Deploy to Render

This project is configured to deploy on Render with a PostgreSQL database, FastAPI backend, and React frontend.

### 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Environment Variables**: Configure as needed

### 🔧 Deployment Steps

#### 1. Connect Your Repository

1. Log into Render Dashboard
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository containing this project

 #### 2. Automatic Deployment

 The `render.yaml` file will automatically create:
 - **Backend API**: `business-manager-api` (with SQLite database) - **FREE TIER**
 - **Frontend**: `business-manager-frontend` - **FREE TIER**

#### 3. Manual Deployment (Alternative)

If you prefer manual setup:

 ##### Database Setup
 1. No external database needed - uses SQLite (included with backend)
 2. Database file is created automatically

##### Backend API Setup
1. Create a new **Web Service**
2. **Environment**: Python
3. **Build Command**: `pip install -r backend/requirements.txt`
4. **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   5. **Environment Variables**:
     - `DATABASE_URL`: `sqlite:///./business_manager.db` (SQLite database)
     - `ALLOWED_ORIGINS`: `https://your-frontend-url.onrender.com,http://localhost:5173`
     - `ENVIRONMENT`: `development`

##### Frontend Setup
1. Create a new **Web Service**
2. **Environment**: Node
3. **Build Command**: `cd frontend && npm install && npm run build`
4. **Start Command**: `cd frontend && npm run preview -- --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend-url.onrender.com/api/v1`
   - `VITE_HTTPS`: `false`

### 🔐 Environment Variables

   #### Backend (API Service)
  ```env
  DATABASE_URL=sqlite:///./business_manager.db
  ALLOWED_ORIGINS=https://business-manager-frontend.onrender.com,http://localhost:5173
  ENVIRONMENT=development
  ```

 #### Frontend
 ```env
 VITE_API_URL=https://business-manager-api.onrender.com/api/v1
 VITE_HTTPS=false
 ```

### 📊 Database Migration

The application will automatically:
1. Create all necessary tables on first startup
2. Handle schema migrations
3. Initialize with default data if needed

 ### 🔍 Health Checks

 - **Backend**: `https://business-manager-api.onrender.com/health`
 - **Frontend**: `https://business-manager-frontend.onrender.com/`

   ### 🚨 Important Notes

  1. **Database**: Uses SQLite (no external database costs!)
  2. **CORS**: Configured for Render domains
  3. **HTTPS**: Disabled for frontend on Render (handled by Render's proxy)
  4. **File Uploads**: Consider using cloud storage (AWS S3, etc.) for production
  5. **Environment**: Set to development mode (free tier)

### 🔧 Troubleshooting

#### Common Issues

1. **Build Failures**:
   - Check Node.js version compatibility
   - Verify all dependencies in requirements.txt and package.json

 2. **Database Connection**:
    - Ensure DATABASE_URL is correctly set
    - SQLite database file is created automatically

3. **CORS Errors**:
   - Verify ALLOWED_ORIGINS includes your frontend URL
   - Check for typos in URLs

4. **API Connection**:
   - Ensure VITE_API_URL points to correct backend URL
   - Check backend service is running

#### Logs

- Check Render dashboard for service logs
- Backend logs show database connection and API requests
- Frontend logs show build and runtime errors

 ### 📈 Scaling

 - **Free Tier**: Limited resources, good for testing
 - **Paid Plans**: Better performance and reliability
 - **Auto-scaling**: Available on paid plans

 ### 🔄 Upgrading to Production

 When you're ready to go live:

 1. **In Render Dashboard**: Go to each service settings
 2. **Change Plan**: Select "Starter" ($7/month) for each service
 3. **Update Environment**: Change `ENVIRONMENT` from `development` to `production`
 4. **Test**: Verify everything works with paid resources
 5. **Go Live**: Your app is now production-ready!

 **Cost for Production**: $14/month total (Backend + Frontend)

### 🔄 Updates

1. Push changes to GitHub
2. Render automatically redeploys
3. Database migrations run automatically
4. Zero-downtime deployments

### 🛡️ Security

- HTTPS enabled by default
- Environment variables for sensitive data
- CORS properly configured
- Database credentials managed by Render

### 📞 Support

- Render Documentation: [docs.render.com](https://docs.render.com)
- Render Community: [community.render.com](https://community.render.com)
- Project Issues: Check GitHub repository

---

**Ready to deploy?** Just connect your GitHub repository to Render and let the `render.yaml` handle the rest!
