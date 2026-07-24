/* v2 */
/*
 * ============================================================
 * FILE: Login.jsx
 *
 * PURPOSE:
 *   Renders the application login screen, handling credential submission,
 *   session persistence via "remember me" cookies, and an inline password
 *   reset flow. On successful login, stores the auth token and user data
 *   then redirects to the profile page.
 *
 * FUNCTIONAL PARTS:
 *   [1] Imports — React, routing, icons, store, API services, and performance tracker
 *   [2] State — form data, loading flags, error/success messages, and password-reset toggle
 *   [3] Lifecycle Hook — checks for saved credentials in cookies and redirects if already logged in
 *   [4] Form Validation — validates username and password fields before submission
 *   [5] Input Change Handlers — updates form state and clears stale validation errors
 *   [6] Cookie Helpers — reads and writes "remember me" credentials to browser cookies
 *   [7] Login Handler — posts credentials to the auth API, stores token, and navigates on success
 *   [8] Password Reset Handler — submits new password to the reset endpoint
 *   [9] Render — login form and password-reset form, conditionally toggled
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

// ─── [1] IMPORTS ────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon, ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import useStore from "../services/useStore";
import api from "../services/api";
import { getDetailedApiErrorMessage } from "../services/api";
import { startPerformanceSession } from "../services/performanceTracker";

const Login = () => {
  // ─── [2] STATE ───────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    company_id: "",
    remember_me: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetData, setResetData] = useState({
    username: "",
    new_password: "",
    confirm_password: "",
  });

  const navigate = useNavigate();
  const { setUser, setToken, setPermissions } = useStore();
  // Login page respects the active theme (light or dark) from store

  // ─── [6] COOKIE HELPERS ─────────────────────────────────────────────────────
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  };

  // ─── [3] LIFECYCLE HOOK ─────────────────────────────────────────────────────
  useEffect(() => {
    // Check cookies for saved parameters
    const savedRememberMe = getCookie("rememberMe") === "true";
    const savedUsername = getCookie("savedUsername");
    const savedPassword = getCookie("savedPassword");
    const savedCompanyId = getCookie("savedCompanyId");

    console.log("Saved data found in cookies:", { savedRememberMe, savedUsername, savedPassword, savedCompanyId });

    // If remember me is true, set the form values
    if (savedRememberMe) {
      setFormData({
        username: savedUsername || "",
        password: savedPassword || "",
        company_id: savedCompanyId || "",
        remember_me: true,
      });
    }

    // Check if user is already logged in
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      navigate("/profile");
    }
  }, [navigate]);

  // ─── [4] FORM VALIDATION ────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};

    if (!formData.company_id.trim()) {
      errors.company_id = "Company ID is required";
    }

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 2) {
      errors.username = "Username must be at least 2 characters";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 3) {
      errors.password = "Password must be at least 3 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── [5] INPUT CHANGE HANDLERS ──────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear validation errors when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    // Clear general error when user makes changes
    if (error) setError("");
    if (success) setSuccess("");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const saveUserCredentials = (username, password, companyId, rememberMe) => {
    // (part of [6] COOKIE HELPERS)
    try {
      if (rememberMe) {
        console.log("Saving user credentials:", { username, companyId, rememberMe });
        const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `rememberMe=true; expires=${expireDate}; path=/; secure; samesite=strict`;
        document.cookie = `savedUsername=${encodeURIComponent(username)}; expires=${expireDate}; path=/; secure; samesite=strict`;
        document.cookie = `savedPassword=${encodeURIComponent(password)}; expires=${expireDate}; path=/; secure; samesite=strict`;
        document.cookie = `savedCompanyId=${encodeURIComponent(companyId)}; expires=${expireDate}; path=/; secure; samesite=strict`;
        console.log("Data saved to cookies");
      } else {
        console.log("Clearing saved credentials");
        document.cookie = "rememberMe=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "savedUsername=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "savedPassword=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "savedCompanyId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
      return true;
    } catch (error) {
      console.error("Failed to save credentials:", error);
      return false;
    }
  };

  const handleResetInputChange = (e) => {
    // (part of [5] INPUT CHANGE HANDLERS)
    const { name, value } = e.target;
    setResetData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ─── [7] LOGIN HANDLER ──────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();

    // Clear previous states
    setError("");
    setSuccess("");
    setValidationErrors({});

    // Start performance tracking
    startPerformanceSession();

    // Validate form before submission
    if (!validateForm()) {
      setError("Please fix the validation errors below.");
      return;
    }

    setLoading(true);
    const selectedStorage = formData.remember_me ? localStorage : sessionStorage;

    const loginData = {
      username: formData.username.trim(),
      password: formData.password,
      company_id: formData.company_id.trim(),
    };

    try {
      const response = await api.post("/auth/login", loginData);
      const data = response?.data;

      if (data.access_token && data.user) {
        const companyId = formData.company_id.trim();

        // Store authentication data
        selectedStorage.setItem("token", data.access_token);
        selectedStorage.setItem("user", JSON.stringify(data.user));

        // Update Zustand store
        setToken(data.access_token);
        setUser(data.user);
        if (data.permissions) {
          selectedStorage.setItem("permissions", JSON.stringify(data.permissions));
          setPermissions(data.permissions);
        }

        // Save credentials if remember me is checked
        saveUserCredentials(formData.username.trim(), formData.password, companyId, formData.remember_me);

        // Show success message briefly
        setSuccess("Login successful! Redirecting...");

        // Navigate to profile after a brief delay
        setTimeout(() => {
          navigate("/profile");
        }, 1000);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      if (error.name === "TypeError" && String(error.message || "").includes("fetch")) {
        setError(`Cannot connect to server: ${error.message || "network failure"}`);
      } else {
        setError(getDetailedApiErrorMessage(error, "Login failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── [8] PASSWORD RESET HANDLER ─────────────────────────────────────────────
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (resetData.new_password !== resetData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    if (resetData.new_password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/reset-password", {
        username: resetData.username,
        new_password: resetData.new_password,
      });

      setError("");
      setShowPasswordReset(false);
      setResetData({ username: "", new_password: "", confirm_password: "" });
      alert("Password reset successfully! You can now login with your new password.");
    } catch (err) {
      setError(getDetailedApiErrorMessage(err, "Password reset failed"));
    } finally {
      setLoading(false);
    }
  };

  // ─── [9] RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br dark:from-gray-900 dark:to-gray-900 dark:via-gray-800 flex from-gray-100 items-center justify-center lg:px-1 min-h-screen px-1 py-1 sm:px-1 to-gray-100 via-white">
      <div className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 max-h-[calc(100vh-1rem)] max-w-md overflow-y-auto p-1 rounded-3xl shadow-xl space-y-1 w-full">
        <div className="text-center">
          <h2 className="dark:text-white font-bold mb-1 text-3xl text-gray-900">login</h2>
          {import.meta.env.VITE_BUILD_TIME && <p className="dark:text-gray-500 text-gray-400 text-xs">Updated on: {import.meta.env.VITE_BUILD_TIME}</p>}
        </div>

        {!showPasswordReset ? (
          <form className="mt-1 space-y-1" onSubmit={handleLogin}>
            {/* Success Message */}
            {success && (
              <div className="bg-green-900/30 border border-green-700 p-1 rounded-lg">
                <div className="flex">
                  <svg className="h-5 text-green-400 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium ml-3 text-green-300 text-sm">{success}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 p-1 rounded-lg">
                <div className="flex">
                  <svg className="h-5 text-red-400 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium ml-3 text-red-300 text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* Company ID Field */}
              <div className="form-floating ui-form-floating-mb2">
                <input id="company_id" name="company_id" type="text" required className={`form-control ${validationErrors.company_id ? "is-invalid" : ""}`} placeholder="Company ID" value={formData.company_id} onChange={handleInputChange} />
                <label htmlFor="company_id">Company ID</label>
                {validationErrors.company_id && <p className="mt-1 text-red-400 text-sm">{validationErrors.company_id}</p>}
              </div>

              {/* Username Field */}
              <div className="form-floating ui-form-floating-mb2">
                <input id="username" name="username" type="text" required className={`form-control ${validationErrors.username ? "is-invalid" : ""}`} placeholder="Username" value={formData.username} onChange={handleInputChange} />
                <label htmlFor="username">Username</label>
                {validationErrors.username && <p className="mt-1 text-red-400 text-sm">{validationErrors.username}</p>}
              </div>

              {/* Password Field */}
              <div className="form-floating mb-2 position-relative">
                <input id="password" name="password" type={showPassword ? "text" : "password"} required className={`form-control ${validationErrors.password ? "is-invalid" : ""}`} placeholder="Password" value={formData.password} onChange={handleInputChange} style={{ paddingRight: "3rem" }} />
                <label htmlFor="password">Password</label>
                <button type="button" onClick={togglePasswordVisibility} className="btn btn-unstyled hover:text-gray-300 position-absolute text-gray-400 transition-colors" style={{ right: "1rem", top: "50%", transform: "translateY(-50%)", zIndex: 5 }}>
                  {showPassword ? <EyeSlashIcon className="ui-icon-5" /> : <EyeIcon className="ui-icon-5" />}
                </button>
                {validationErrors.password && <p className="mt-1 text-red-400 text-sm">{validationErrors.password}</p>}
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember_me" name="remember_me" type="checkbox" className="bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-500 focus:ring-indigo-500 h-4 mb-4 rounded text-indigo-600 w-4" checked={formData.remember_me} onChange={handleInputChange} />
                <label htmlFor="remember_me" className="block dark:text-gray-200 mb-4 ml-2 text-gray-200 text-sm">
                  Remember me for 30 days
                </label>
              </div>

              <button type="button" onClick={() => setShowPasswordReset(true)} className="font-medium hover:text-indigo-300 mb-4 text-indigo-400 text-sm transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 border border-transparent disabled:cursor-not-allowed disabled:opacity-50 duration-200 flex focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium group hover:bg-indigo-700 hover:shadow-xl justify-center px-1 py-1 relative rounded-full shadow-lg text-sm text-white transition-all w-full"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="-ml-1 animate-spin h-5 mr-3 text-white w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  …
                </div>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        ) : (
          <div className="mt-8">
            <div className="mb-6 text-center">
              <h3 className="dark:text-white font-medium text-gray-900 text-lg">Reset Password</h3>
              <p className="dark:text-gray-300 mt-1 text-gray-600 text-sm">Enter your username and new password</p>
            </div>

            <form className="space-y-1" onSubmit={handlePasswordReset}>
              {/* Error Message */}
              {error && (
                <div className="bg-red-900/30 border border-red-700 p-1 rounded-lg">
                  <div className="flex">
                    <svg className="h-5 text-red-400 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="font-medium ml-3 text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {/* Username Field */}
                <div className="form-floating ui-form-floating-mb2">
                  <input id="reset-username" name="username" type="text" required className="form-control" placeholder="Username" value={resetData.username} onChange={handleResetInputChange} />
                  <label htmlFor="reset-username">Username</label>
                </div>

                {/* New Password Field */}
                <div className="form-floating ui-form-floating-mb2">
                  <input id="new-password" name="new_password" type="password" required className="form-control" placeholder="New Password" value={resetData.new_password} onChange={handleResetInputChange} />
                  <label htmlFor="new-password">New Password</label>
                </div>

                {/* Confirm Password Field */}
                <div className="form-floating ui-form-floating-mb2">
                  <input id="confirm-password" name="confirm_password" type="password" required className="form-control" placeholder="Confirm Password" value={resetData.confirm_password} onChange={handleResetInputChange} />
                  <label htmlFor="confirm-password">Confirm Password</label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setError("");
                    setResetData({ username: "", new_password: "", confirm_password: "" });
                  }}
                  className="bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-200 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium hover:bg-gray-200 px-1 py-1 rounded-lg shadow-sm text-gray-700 text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 border border-transparent disabled:cursor-not-allowed disabled:opacity-50 duration-200 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium hover:bg-indigo-700 px-1 py-1 rounded-lg shadow-sm text-sm text-white transition-all"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="-ml-1 animate-spin h-5 mr-3 text-white w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      …
                    </div>
                  ) : (
                    "Reset"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
