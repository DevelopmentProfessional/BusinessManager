/**
 * COMPANY REGISTRATION PAGE
 * Public-facing form for new company registration
 *
 * Allows users to:
 * - Enter company details (ID, name)
 * - Create admin user account
 * - View list of created companies
 */

import React, { useEffect, useState } from "react";

export default function CompanyRegistration() {
  const [step, setStep] = useState("form"); // 'form', 'success', 'list'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [successData, setSuccessData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    company_id: "",
    company_name: "",
    admin_username: "",
    admin_password: "",
    admin_confirm_password: "",
    admin_first_name: "Admin",
    admin_last_name: "User",
    admin_email: "",
  });

  const API_BASE = "/api/v1/company-registration";

  // Check database status on mount
  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.error("Failed to check database status:", err);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/companies`);
      if (!res.ok) throw new Error("Failed to load companies");
      const data = await res.json();
      setCompanies(data);
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.company_id.trim()) {
      setError("Company ID is required");
      return false;
    }
    if (!/^[A-Z0-9_-]+$/.test(formData.company_id)) {
      setError("Company ID may only contain letters, numbers, hyphens and underscores");
      return false;
    }
    if (!formData.company_name.trim()) {
      setError("Company Name is required");
      return false;
    }
    if (!formData.admin_username.trim()) {
      setError("Admin username is required");
      return false;
    }
    if (formData.admin_password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.admin_password !== formData.admin_confirm_password) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: formData.company_id.toUpperCase(),
          company_name: formData.company_name,
          admin_username: formData.admin_username,
          admin_password: formData.admin_password,
          admin_first_name: formData.admin_first_name || "Admin",
          admin_last_name: formData.admin_last_name || "User",
          admin_email: formData.admin_email || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      // Success
      setSuccessData(data);
      loadCompanies();
      setStep("success");

      // Reset form
      setTimeout(() => {
        setFormData({
          company_id: "",
          company_name: "",
          admin_username: "",
          admin_password: "",
          admin_confirm_password: "",
          admin_first_name: "Admin",
          admin_last_name: "User",
          admin_email: "",
        });
      }, 2000);
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setSuccessData(null);
    setError(null);
  };

  const styles = {
    container: {
      maxWidth: 900,
      margin: "0 auto",
      padding: "2rem 1rem 4rem",
      fontFamily: "system-ui, sans-serif",
      background: "#f8fafc",
    },
    header: {
      textAlign: "center",
      marginBottom: "2rem",
    },
    title: {
      fontSize: "2rem",
      fontWeight: 700,
      marginBottom: "0.5rem",
      color: "#1e293b",
    },
    subtitle: {
      fontSize: "1rem",
      color: "#64748b",
      marginBottom: "1.5rem",
    },
    layout: {
      display: "flex",
      gap: "2rem",
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    column: {
      flex: "1 1 400px",
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "0.75rem",
      padding: "1.5rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    },
    form: {
      flex: "1 1 400px",
    },
    field: {
      marginBottom: "1rem",
    },
    label: {
      display: "block",
      marginBottom: "0.35rem",
      fontWeight: 600,
      fontSize: "0.9rem",
      color: "#1e293b",
    },
    required: {
      color: "#ef4444",
    },
    input: {
      width: "100%",
      padding: "0.625rem",
      border: "1px solid #cbd5e1",
      borderRadius: "0.375rem",
      fontSize: "0.9rem",
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
    inputFocus: {
      outline: "none",
      borderColor: "#4f46e5",
      boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.1)",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "1rem",
      marginBottom: "1rem",
    },
    hint: {
      fontSize: "0.8rem",
      color: "#64748b",
      marginTop: "0.25rem",
    },
    error: {
      padding: "1rem",
      background: "#fee2e2",
      border: "1px solid #fecaca",
      color: "#dc2626",
      borderRadius: "0.5rem",
      marginBottom: "1rem",
      fontSize: "0.9rem",
    },
    success: {
      padding: "1.5rem",
      background: "#ecfdf5",
      border: "1px solid #d1fae5",
      color: "#059669",
      borderRadius: "0.5rem",
      marginBottom: "1rem",
      textAlign: "center",
    },
    button: {
      width: "100%",
      padding: "0.75rem 1rem",
      background: "#4f46e5",
      color: "#fff",
      border: "none",
      borderRadius: "0.375rem",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: "0.9rem",
      marginTop: "1rem",
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
    buttonSecondary: {
      background: "#6b7280",
    },
    check: {
      fontSize: "3rem",
      marginBottom: "1rem",
    },
    badgeSuccess: {
      display: "inline-block",
      background: "#dbeafe",
      color: "#1e40af",
      padding: "0.5rem 1rem",
      borderRadius: "9999px",
      fontWeight: 600,
      marginBottom: "1rem",
      fontSize: "0.9rem",
    },
    companyList: {
      flex: "1 1 350px",
    },
    companyCard: {
      padding: "1rem",
      border: "1px solid #e2e8f0",
      borderRadius: "0.5rem",
      marginBottom: "0.75rem",
      background: "#f8fafc",
    },
    companyName: {
      fontWeight: 600,
      color: "#1e293b",
      marginBottom: "0.25rem",
    },
    companyId: {
      fontSize: "0.85rem",
      color: "#64748b",
      fontFamily: "monospace",
      marginBottom: "0.5rem",
    },
    companyMeta: {
      fontSize: "0.8rem",
      color: "#94a3b8",
    },
    noCompanies: {
      textAlign: "center",
      padding: "2rem 1rem",
      color: "#64748b",
      fontSize: "0.9rem",
    },
    statusBox: {
      padding: "1rem",
      marginBottom: "1rem",
      borderRadius: "0.375rem",
      fontSize: "0.85rem",
    },
    statusGood: {
      background: "#ecfdf5",
      border: "1px solid #d1fae5",
      color: "#059669",
    },
    statusBad: {
      background: "#fee2e2",
      border: "1px solid #fecaca",
      color: "#dc2626",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>BusinessManager — Company Registration</h1>
        <p style={styles.subtitle}>Create a new company and admin account</p>
      </div>

      {dbStatus && (
        <div
          style={{
            ...styles.statusBox,
            ...(dbStatus.connected ? styles.statusGood : styles.statusBad),
          }}
        >
          {dbStatus.message}
        </div>
      )}

      <div style={styles.layout}>
        {/* FORM COLUMN */}
        {step === "form" && (
          <div style={{ ...styles.column, ...styles.form }}>
            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>
                  Company ID <span style={styles.required}>*</span>
                </label>
                <input type="text" name="company_id" style={styles.input} value={formData.company_id} onChange={handleInputChange} placeholder="e.g., ACME-CORP" disabled={loading} maxLength="50" required />
                <div style={styles.hint}>Letters, numbers, hyphens only</div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  Company Name <span style={styles.required}>*</span>
                </label>
                <input type="text" name="company_name" style={styles.input} value={formData.company_name} onChange={handleInputChange} placeholder="e.g., Acme Corporation" disabled={loading} required />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Admin Email</label>
                <input type="email" name="admin_email" style={styles.input} value={formData.admin_email} onChange={handleInputChange} placeholder="admin@company.com" disabled={loading} />
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>First Name</label>
                  <input type="text" name="admin_first_name" style={styles.input} value={formData.admin_first_name} onChange={handleInputChange} placeholder="First" disabled={loading} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Last Name</label>
                  <input type="text" name="admin_last_name" style={styles.input} value={formData.admin_last_name} onChange={handleInputChange} placeholder="Last" disabled={loading} />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  Admin Username <span style={styles.required}>*</span>
                </label>
                <input type="text" name="admin_username" style={styles.input} value={formData.admin_username} onChange={handleInputChange} placeholder="username" disabled={loading} required />
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Password <span style={styles.required}>*</span>
                  </label>
                  <input type="password" name="admin_password" style={styles.input} value={formData.admin_password} onChange={handleInputChange} placeholder="••••••••" disabled={loading} required />
                  <div style={styles.hint}>Min 6 characters</div>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Confirm Password <span style={styles.required}>*</span>
                  </label>
                  <input type="password" name="admin_confirm_password" style={styles.input} value={formData.admin_confirm_password} onChange={handleInputChange} placeholder="••••••••" disabled={loading} required />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  ...styles.button,
                  ...(loading && styles.buttonDisabled),
                }}
                disabled={loading}
              >
                {loading ? "Creating Company..." : "Create Company"}
              </button>
            </form>
          </div>
        )}

        {/* SUCCESS STATE */}
        {step === "success" && successData && (
          <div style={{ ...styles.column, ...styles.form, textAlign: "center" }}>
            <div style={styles.check}>✅</div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#1e293b" }}>Company Created!</h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>Your new company is ready to use.</p>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.5rem" }}>Company ID</p>
              <div style={styles.badgeSuccess}>{successData.company_id}</div>
            </div>

            <div style={{ marginBottom: "1.5rem", background: "#f0f9ff", padding: "1rem", borderRadius: "0.375rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.25rem" }}>Admin Username</p>
              <p style={{ fontFamily: "monospace", fontWeight: 600, color: "#1e293b" }}>{successData.admin_username}</p>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>Users can now log in using the Company ID above.</p>

            <button
              onClick={() => {
                resetForm();
                loadCompanies();
              }}
              style={{ ...styles.button, ...styles.buttonSecondary }}
            >
              Register Another Company
            </button>
          </div>
        )}

        {/* COMPANIES LIST */}
        <div style={{ ...styles.column, ...styles.companyList }}>
          <h3 style={{ marginBottom: "1rem", color: "#1e293b", fontSize: "1.1rem" }}>Registered Companies</h3>

          {companies.length === 0 ? (
            <div style={styles.noCompanies}>No companies registered yet</div>
          ) : (
            <div>
              {companies.map((company) => (
                <div key={company.company_id} style={styles.companyCard}>
                  <div style={styles.companyName}>{company.name}</div>
                  <div style={styles.companyId}>{company.company_id}</div>
                  <div style={styles.companyMeta}>
                    {company.employee_count || 0} user{company.employee_count !== 1 ? "s" : ""}
                    {" • "}
                    {company.is_active ? <span style={{ color: "#059669" }}>Active</span> : <span style={{ color: "#ef4444" }}>Inactive</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={loadCompanies}
            style={{
              ...styles.button,
              ...styles.buttonSecondary,
              marginTop: "1rem",
            }}
          >
            Refresh List
          </button>
        </div>
      </div>
    </div>
  );
}
