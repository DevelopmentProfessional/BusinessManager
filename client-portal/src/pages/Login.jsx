/**
 * LOGIN PAGE — Modern full-screen layout with company branding.
 */
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { authAPI, companiesAPI } from "../services/api";
import useStore from "../store/useStore";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useStore((s) => s.setAuth);
  const loadCart = useStore((s) => s.loadCart);
  const addToast = useStore((s) => s.addToast);

  const preselected = location.state?.company || null;

  const [form, setForm] = useState({
    email: "",
    password: "",
    company_id: preselected?.company_id || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [branding, setBranding] = useState(null);

  const hasLogo = Boolean(preselected?.has_logo_data);
  const logoSrc = hasLogo ? companiesAPI.logoUrl(preselected.company_id) : null;

  // Load branding if company is pre-selected
  useEffect(() => {
    if (!preselected?.company_id) return;
    companiesAPI
      .getBranding(preselected.company_id)
      .then((b) => {
        if (b) setBranding(b);
      })
      .catch(() => {});
  }, [preselected?.company_id]);

  const primaryColor = branding?.portal_primary_color || "#4f46e5";
  const heroBg = branding?.portal_hero_bg_color || primaryColor;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authAPI.login(form);
      setAuth({ id: data.client_id, name: data.name, email: data.email, membership_tier: data.membership_tier }, data.access_token, form.company_id);
      await loadCart();
      navigate("/shop");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fc", display: "flex", flexDirection: "column" }}>
      {/* ── Company header ─────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${heroBg} 0%, ${heroBg}cc 100%)`,
          padding: "32px 24px 28px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
          }}
        />

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "0.5rem",
            padding: "6px 10px",
            color: "#fff",
            fontSize: "0.8rem",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          <ArrowLeftIcon style={{ width: 14, height: 14 }} />
          Back
        </button>

        {preselected ? (
          <div style={{ position: "relative" }}>
            {logoSrc ? (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "1rem",
                  background: "rgba(255,255,255,0.15)",
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  padding: 6,
                }}
              >
                <img src={logoSrc} alt={preselected.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "1rem",
                  background: "rgba(255,255,255,0.2)",
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.5rem" }}>{(preselected.name || "?")[0].toUpperCase()}</span>
              </div>
            )}
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>{branding?.portal_hero_title || preselected.name}</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", margin: "4px 0 0" }}>{branding?.portal_hero_subtitle || "Sign in to your account"}</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "1rem",
                background: "rgba(255,255,255,0.15)",
                margin: "0 auto 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.5rem" }}>C</span>
            </div>
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>Client Portal</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", margin: "4px 0 0" }}>Sign in to your account</p>
          </div>
        )}
      </div>

      {/* ── Form card ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 20px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: "#fff",
            borderRadius: "1.25rem",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            padding: "28px 24px",
            marginTop: -8,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>Email address</label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "0.88rem",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "0.6rem",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = primaryColor)}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 12px",
                    fontSize: "0.88rem",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "0.6rem",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = primaryColor)}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    padding: 2,
                  }}
                >
                  {showPwd ? <EyeSlashIcon style={{ width: 16, height: 16 }} /> : <EyeIcon style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {/* Company ID — hidden if pre-selected */}
            {!preselected ? (
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>Company ID</label>
                <input
                  type="text"
                  placeholder="acme-corp"
                  value={form.company_id}
                  onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "0.88rem",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "0.6rem",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = primaryColor)}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
            ) : (
              <input type="hidden" value={form.company_id} readOnly />
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.6rem",
                  padding: "10px 12px",
                  color: "#dc2626",
                  fontSize: "0.82rem",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px",
                background: loading ? "#a5b4fc" : primaryColor,
                color: "#fff",
                border: "none",
                borderRadius: "0.7rem",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                marginTop: 4,
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#6b7280", marginTop: 18 }}>
            Don't have an account?{" "}
            <Link to="/register" state={{ company: preselected }} style={{ color: primaryColor, fontWeight: 600, textDecoration: "none" }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
