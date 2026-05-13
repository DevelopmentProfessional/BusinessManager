import React, { useState } from "react";
import { Link } from "react-router-dom";

const API = "/api/v1/company-registration";

const INIT = {
  company_id: "",
  company_name: "",
  company_email: "",
  company_phone: "",
  company_address: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_username: "",
  admin_email: "",
  admin_password: "",
  admin_password_confirm: "",
};

export default function CompanyRegistration() {
  const [form, setForm] = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.admin_password !== form.admin_password_confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.admin_password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: form.company_id.trim().toUpperCase(),
          company_name: form.company_name.trim(),
          company_email: form.company_email.trim() || null,
          company_phone: form.company_phone.trim() || null,
          company_address: form.company_address.trim() || null,
          admin_username: form.admin_username.trim(),
          admin_password: form.admin_password,
          admin_first_name: form.admin_first_name.trim() || "Admin",
          admin_last_name: form.admin_last_name.trim() || "User",
          admin_email: form.admin_email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Registration failed.");
        return;
      }
      setSuccess(data);
      setForm(INIT);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: "center", maxWidth: 520 }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <h2 style={s.heading}>Registration Submitted!</h2>
          <p style={s.muted}>
            Your company <strong>{success.company_name}</strong> has been submitted for review.
          </p>
          <div style={s.pendingBadge}>Status: Pending Approval</div>
          <p style={{ ...s.muted, marginTop: "1rem" }}>You will be notified once your account is approved. Your login details will work as soon as the account is active.</p>
          <div style={{ marginTop: "1.5rem", background: "#f8fafc", borderRadius: "0.5rem", padding: "1rem", textAlign: "left" }}>
            <p style={s.detailRow}>
              <span style={s.detailLabel}>Company ID</span>
              <code>{success.company_id}</code>
            </p>
            <p style={s.detailRow}>
              <span style={s.detailLabel}>Admin Username</span>
              <code>{success.admin_username}</code>
            </p>
          </div>
          <button style={{ ...s.btn, marginTop: "1.5rem" }} onClick={() => setSuccess(null)}>
            Register Another Company
          </button>
          <Link to="/" style={s.backLink}>
            ← Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.heading}>Register Your Company</h1>
        <p style={s.muted}>Fill in the details below to request access. Your account will be reviewed before activation.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={submit}>
          <div style={s.sectionTitle}>Company Details</div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>
                Company ID <span style={s.req}>*</span>
              </label>
              <input style={s.input} name="company_id" value={form.company_id} onChange={set} placeholder="e.g. ACME" required disabled={loading} />
              <span style={s.hint}>Letters and numbers only</span>
            </div>
            <div style={s.field}>
              <label style={s.label}>
                Company Name <span style={s.req}>*</span>
              </label>
              <input style={s.input} name="company_name" value={form.company_name} onChange={set} placeholder="Acme Corporation" required disabled={loading} />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Business Email</label>
              <input style={s.input} type="email" name="company_email" value={form.company_email} onChange={set} placeholder="info@company.com" disabled={loading} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Phone Number</label>
              <input style={s.input} type="tel" name="company_phone" value={form.company_phone} onChange={set} placeholder="+1 (555) 000-0000" disabled={loading} />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Business Address</label>
            <input style={s.input} name="company_address" value={form.company_address} onChange={set} placeholder="123 Main St, City, State, ZIP" disabled={loading} />
          </div>

          <div style={{ ...s.sectionTitle, marginTop: "1.5rem" }}>Admin Account</div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>First Name</label>
              <input style={s.input} name="admin_first_name" value={form.admin_first_name} onChange={set} placeholder="First" disabled={loading} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Last Name</label>
              <input style={s.input} name="admin_last_name" value={form.admin_last_name} onChange={set} placeholder="Last" disabled={loading} />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>
                Username <span style={s.req}>*</span>
              </label>
              <input style={s.input} name="admin_username" value={form.admin_username} onChange={set} placeholder="admin_user" required disabled={loading} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Admin Email</label>
              <input style={s.input} type="email" name="admin_email" value={form.admin_email} onChange={set} placeholder="admin@company.com" disabled={loading} />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>
                Password <span style={s.req}>*</span>
              </label>
              <input style={s.input} type="password" name="admin_password" value={form.admin_password} onChange={set} placeholder="Min 6 characters" required disabled={loading} />
            </div>
            <div style={s.field}>
              <label style={s.label}>
                Confirm Password <span style={s.req}>*</span>
              </label>
              <input style={s.input} type="password" name="admin_password_confirm" value={form.admin_password_confirm} onChange={set} placeholder="Repeat password" required disabled={loading} />
            </div>
          </div>

          <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Registration"}
          </button>
        </form>

        <Link to="/" style={s.backLink}>
          ← Back to Portal
        </Link>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "2rem 1rem 4rem",
  },
  card: {
    background: "#fff",
    borderRadius: "0.75rem",
    padding: "2rem",
    width: "100%",
    maxWidth: 720,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  heading: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "0.4rem",
  },
  muted: {
    color: "#64748b",
    fontSize: "0.9rem",
    marginBottom: "1.25rem",
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#94a3b8",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "0.4rem",
    marginBottom: "1rem",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  field: {
    marginBottom: "1rem",
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#1e293b",
    marginBottom: "0.3rem",
  },
  req: { color: "#ef4444" },
  input: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: "0.375rem",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  hint: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    marginTop: "0.2rem",
  },
  btn: {
    width: "100%",
    padding: "0.75rem",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    padding: "0.75rem 1rem",
    borderRadius: "0.375rem",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
  pendingBadge: {
    display: "inline-block",
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: "9999px",
    padding: "0.4rem 1rem",
    fontWeight: 700,
    fontSize: "0.85rem",
    marginTop: "0.75rem",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.875rem",
    margin: "0.25rem 0",
    color: "#1e293b",
  },
  detailLabel: {
    color: "#64748b",
    fontWeight: 500,
  },
  backLink: {
    display: "block",
    textAlign: "center",
    marginTop: "1.25rem",
    color: "#6366f1",
    fontSize: "0.875rem",
    textDecoration: "none",
  },
};
