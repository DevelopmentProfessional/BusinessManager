import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './pages/components/Layout';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import useStore from './services/useStore';
import useDarkMode from './services/useDarkMode';
import useBranding from './services/useBranding';
import GlobalClientModal from './pages/components/GlobalClientModal';
import MobileAddressBarManager from './pages/components/MobileAddressBarManager';
import InstallAppPrompt from './pages/components/InstallAppPrompt';

// Lazy load pages - only load when navigating to them
const Clients = lazy(() => import('./pages/Clients'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Services = lazy(() => import('./pages/Services'));
const Sales = lazy(() => import('./pages/Sales'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Employees = lazy(() => import('./pages/Employees'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor'));
const Profile = lazy(() => import('./pages/Profile'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading fallback component
const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

// Component to clear errors on navigation
const ClearErrorOnNavigate = () => {
  const location = useLocation();
  const { clearError } = useStore();

  useEffect(() => {
    clearError();
  }, [location.pathname, clearError]);

  return null;
};



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
  const { isInitialized: brandingInitialized } = useBranding();

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
      <ClearErrorOnNavigate />
      <MobileAddressBarManager />
      <InstallAppPrompt />
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/sales" element={
            <ProtectedRoute requiredPermission="services:read">
              <Layout>
                <Sales />
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
              <Suspense fallback={<PageLoader />}>
                <DocumentEditor />
              </Suspense>
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
      </Suspense>
      <GlobalClientModal />
    </Router>
  );
}

export default App;
