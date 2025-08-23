import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Inventory from './pages/Inventory';
import Services from './pages/Services';
import Employees from './pages/Employees';
import Schedule from './pages/Schedule';
import Attendance from './pages/Attendance';
import Documents from './pages/Documents';
import DocumentEditor from './pages/DocumentEditor';
import Admin from './pages/Admin';
import useStore from './store/useStore';

// Protected Route Component
const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const { isAuthenticated, hasPermission, user } = useStore();
  
  // TEMPORARY: Always allow access during development
  // TODO: Remove this bypass when login is working properly
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    console.log('🔓 LOGIN BYPASSED: Redirecting to dashboard instead of login');
    return <Navigate to="/dashboard" replace />;
  }
  
  // Check if user has required permission
  if (requiredPermission) {
    const [page, permission] = requiredPermission.split(':');
    if (!hasPermission(page, permission)) {
      console.log(`🔓 PERMISSION BYPASSED: Accessing ${page}:${permission} without permission`);
      // Allow access anyway during development
    }
  }
  
  return children;
};

function App() {
  const { setUser, setToken, setPermissions } = useStore();

  useEffect(() => {
    // TEMPORARY: Bypass login for development - Create fake admin session
    const fakeToken = 'fake-jwt-token-for-development';
    const fakeUser = {
      id: 'fake-admin-id',
      username: 'admin',
      email: 'admin@businessmanager.com',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true
    };
    const fakePermissions = [
      'clients:read', 'clients:write', 'clients:delete', 'clients:admin',
      'inventory:read', 'inventory:write', 'inventory:delete', 'inventory:admin',
      'suppliers:read', 'suppliers:write', 'suppliers:delete', 'suppliers:admin',
      'services:read', 'services:write', 'services:delete', 'services:admin',
      'employees:read', 'employees:write', 'employees:delete', 'employees:admin',
      'schedule:read', 'schedule:write', 'schedule:delete', 'schedule:admin',
      'attendance:read', 'attendance:write', 'attendance:delete', 'attendance:admin',
      'documents:read', 'documents:write', 'documents:delete', 'documents:admin',
      'admin:read', 'admin:write', 'admin:delete', 'admin:admin'
    ];
    
    // Set fake authentication data
    setToken(fakeToken);
    setUser(fakeUser);
    setPermissions(fakePermissions);
    
    // Store in localStorage for persistence
    localStorage.setItem('token', fakeToken);
    localStorage.setItem('user', JSON.stringify(fakeUser));
    localStorage.setItem('permissions', JSON.stringify(fakePermissions));
    
    console.log('🔓 LOGIN BYPASSED: Using fake admin session for development');
  }, [setUser, setToken, setPermissions]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/dashboard" replace />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute requiredPermission="clients:read">
            <Layout>
              <Clients />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/services" element={
          <ProtectedRoute requiredPermission="services:read">
            <Layout>
              <Services />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute requiredPermission="employees:read">
            <Layout>
              <Employees />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/schedule" element={
          <ProtectedRoute requiredPermission="schedule:read">
            <Layout>
              <Schedule />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute requiredPermission="inventory:read">
            <Layout>
              <Inventory />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute requiredPermission="attendance:read">
            <Layout>
              <Attendance />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute requiredPermission="documents:read">
            <Layout>
              <Documents />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/documents/:documentId/edit" element={
          <ProtectedRoute requiredPermission="documents:write">
            <DocumentEditor />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute requiredPermission="admin:admin">
            <Layout>
              <Admin />
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
