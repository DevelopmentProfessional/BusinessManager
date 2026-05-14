// credentials are checked locally — no API needed for login
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = `${import.meta.env.VITE_API_URL || "/api/v1"}/company-registration`;

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const username = form.username.trim();
    const basicToken = btoa(`${username}:${form.password}`);

    fetch(`${API}/companies`, {
      headers: { Authorization: `Basic ${basicToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const message = res.status === 401 ? "Invalid username or password." : "Unable to sign in right now.";
          throw new Error(message);
        }
        localStorage.setItem("cc_token", `Basic ${basicToken}`);
        navigate("/");
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Company Creation Portal</h1>
        <p style={s.sub}>Sign in to manage company registrations.</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={submit}>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input style={s.input} name="username" value={form.username} onChange={set} required autoComplete="username" disabled={loading} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" name="password" value={form.password} onChange={set} required autoComplete="current-password" disabled={loading} />
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    padding: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: "0.75rem",
    padding: "2.5rem",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  title: { fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" },
  sub: { color: "#64748b", fontSize: "0.875rem", marginBottom: "1.75rem" },
  field: { marginBottom: "1rem" },
  label: { display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", marginBottom: "0.3rem" },
  input: {
    width: "100%",
    padding: "0.65rem 0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: "0.375rem",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
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
  error: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    padding: "0.75rem 1rem",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
};
