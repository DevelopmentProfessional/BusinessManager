import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CompanyManagement from "./pages/CompanyManagement";

const token = () => localStorage.getItem("cc_token");

function ProtectedRoute({ children }) {
  return token() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Router>
      <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CompanyManagement />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
