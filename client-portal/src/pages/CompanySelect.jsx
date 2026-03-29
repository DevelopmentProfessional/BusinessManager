/**
 * COMPANY SELECT — First page clients see.
 * Modern full-screen landing page with company cards.
 * - If the user has saved credentials, auto-redirects to /shop.
 * - Wipes stale cache/localStorage (except nav pref) on load.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BuildingOffice2Icon, MagnifyingGlassIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { companiesAPI } from "../services/api";
import useStore from "../store/useStore";

const PERSISTENT_KEYS = new Set(["cp_client", "cp_token", "cp_company", "cp_nav_align"]);

function clearStaleCaches() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && !PERSISTENT_KEYS.has(k)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));

  if ("caches" in window) {
    caches.keys().then((names) => names.filter((n) => !n.startsWith("workbox-precache")).forEach((n) => caches.delete(n)));
  }
}

function safeParseJson(val) {
  try {
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

function CompanyCard({ company, onClick }) {
  const hasLogo = Boolean(company?.has_logo_data || company?.logo_url);
  const logoSrc = hasLogo ? companiesAPI.logoUrl(company.company_id) : null;

  const [imgError, setImgError] = useState(false);
  const showLogo = logoSrc && !imgError;
  const initial = (company.name || "?")[0].toUpperCase();

  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
  const color = COLORS[initial.charCodeAt(0) % COLORS.length];

  return (
    <button
      onClick={() => onClick(company)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 16px",
        background: "#fff",
        border: "2px solid #f0f0f0",
        borderRadius: "1.25rem",
        cursor: "pointer",
        transition: "all 0.18s ease",
        textAlign: "center",
        minWidth: 130,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#4f46e5";
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(79,70,229,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#f0f0f0";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Logo / initial */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "0.75rem",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: showLogo ? "#f9f9f9" : color,
        }}
      >
        {showLogo ? <img src={logoSrc} alt={company.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} onError={() => setImgError(true)} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.4rem" }}>{initial}</span>}
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#111827",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {company.name}
      </span>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: "0.7rem",
          color: "#4f46e5",
          fontWeight: 500,
        }}
      >
        Select <ArrowRightIcon style={{ width: 10, height: 10 }} />
      </span>
    </button>
  );
}

export default function CompanySelect() {
  const navigate = useNavigate();
  const restoreAuth = useStore((s) => s.restoreAuth);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await companiesAPI.getAll();
      setCompanies(list);
      if (list.length === 0) setError("No businesses are currently registered. Contact support.");
    } catch (err) {
      setError(err.message || "Could not load businesses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreAuth();

    const savedToken = localStorage.getItem("cp_token");
    const savedCompany = localStorage.getItem("cp_company");
    const savedClient = safeParseJson(localStorage.getItem("cp_client"));

    if (savedToken && savedCompany && savedClient) {
      navigate("/shop", { replace: true });
      return;
    }

    clearStaleCaches();
    fetchCompanies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(company) {
    navigate("/login", { state: { company } });
  }

  const companiesSafe = Array.isArray(companies) ? companies : [];
  const filtered = companiesSafe.filter((c) =>
    String(c?.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fc", display: "flex", flexDirection: "column" }}>
      {/* ── Hero header ───────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          padding: "40px 24px 32px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: -30,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />

        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "1rem",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <BuildingOffice2Icon style={{ width: 28, height: 28, color: "#fff" }} />
          </div>
          <h1
            style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: "1.6rem",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Client Portal
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", margin: "6px 0 0" }}>Select your business to continue</p>
        </div>
      </div>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: 600, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        {/* Search */}
        {companiesSafe.length >= 5 && (
          <div style={{ position: "relative", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            <MagnifyingGlassIcon
              style={{
                width: 16,
                height: 16,
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                pointerEvents: "none",
              }}
            />
            <input
              style={{
                width: "100%",
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: "0.85rem",
                border: "1.5px solid #e5e7eb",
                borderRadius: "0.75rem",
                outline: "none",
                background: "#fff",
                color: "#111827",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
              placeholder="Search businesses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid #e0e7ff",
                borderTopColor: "#4f46e5",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <BuildingOffice2Icon style={{ width: 52, height: 52, margin: "0 auto 16px", color: "#d1d5db" }} />
            <p style={{ color: "#ef4444", marginBottom: 16, fontSize: "0.9rem" }}>{error}</p>
            <button
              onClick={fetchCompanies}
              style={{
                padding: "8px 20px",
                borderRadius: "0.6rem",
                border: "1.5px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && companies.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
            <BuildingOffice2Icon style={{ width: 52, height: 52, margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>No businesses available.</p>
            <button
              onClick={fetchCompanies}
              style={{
                marginTop: 12,
                padding: "7px 18px",
                borderRadius: "0.6rem",
                border: "1.5px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* No search match */}
        {!loading && !error && filtered.length === 0 && search && <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0" }}>No businesses match "{search}"</p>}

        {/* Company grid */}
        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: 14,
              justifyItems: "stretch",
            }}
          >
            {filtered.map((company) => (
              <CompanyCard key={company.company_id} company={company} onClick={handleSelect} />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ textAlign: "center", padding: "20px", fontSize: "0.72rem", color: "#c4c9d4" }}>Powered by BusinessManager</footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
