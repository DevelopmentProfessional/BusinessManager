import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './pages/components/Layout';
import Login from './pages/Login';
import Clients from './pages/Clients';
import Inventory from './pages/Inventory';
import Services from './pages/Services';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Schedule from './pages/Schedule';
import Documents from './pages/Documents';
import DocumentEditor from './pages/DocumentEditor';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import useStore from './services/useStore';
import useDarkMode from './services/useDarkMode';



// Protected Route Component
const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const { isAuthenticated, hasPermission, user } = useStore();
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user has required permission
  if (requiredPermission) {
    const [page, permission] = requiredPermission.split(':');
    if (!hasPermission(page, permission)) {
      return <Navigate to="/profile" replace />;
    }
  }
  
  return children;
};

function App() {
  const { setUser, setToken, setPermissions, loadPersistedFilters } = useStore();
  const { initializeDarkMode } = useDarkMode();

  // Initialize user data from localStorage/sessionStorage on app startup
  useEffect(() => {
    const initializeUserData = () => {
      try {
        // Try to get token and user data from storage
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
        const permissionsData = localStorage.getItem('permissions') || sessionStorage.getItem('permissions');
        
        if (token && userData) {
          const user = JSON.parse(userData);
          const permissions = permissionsData ? JSON.parse(permissionsData) : [];
          
          // Set the data in the store
          setToken(token);
          setUser(user);
          setPermissions(permissions);
        }
        
        // Load persisted filters
        loadPersistedFilters();
      } catch (error) {
        console.error('Error initializing user data:', error);
      }
    };
    
    initializeUserData();
  }, [setUser, setToken, setPermissions, loadPersistedFilters]);

  // Initialize dark mode on app startup
  useEffect(() => {
    initializeDarkMode();
  }, [initializeDarkMode]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/profile" replace />
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
        <Route path="/suppliers" element={
          <ProtectedRoute requiredPermission="suppliers:read">
            <Layout>
              <Suppliers />
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
        <Route path="/reports" element={
          <ProtectedRoute requiredPermission="schedule:read">
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        } />
        {/* Catch-all route for any unmatched paths */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
