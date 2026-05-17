import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const normalizeApiBase = (value) => {
  const raw = (value || "/api/v1").trim();
  if (!raw) return "/api/v1";
  if (raw.endsWith("/api/v1")) return raw;
  if (raw.endsWith("/api/v1/")) return raw.slice(0, -1);
  return `${raw.replace(/\/+$/, "")}/api/v1`;
};

const API = `${normalizeApiBase(import.meta.env.VITE_API_URL)}/company-registration`;

const STATUS_COLORS = {
  pending: { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Pending" },
  approved: { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", label: "Approved" },
  denied: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5", label: "Denied" },
};

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: token } : {};
}

export default function CompanyManagement() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialForm, setCredentialForm] = useState({
    username: "",
    password: "",
    force_password_reset: false,
  });

  const logout = () => {
    localStorage.removeItem("cc_token");
    navigate("/login");
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/companies`, { headers: authHeaders() });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Failed to load companies");
      setCompanies(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadCompanyUsers = async (companyId) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/users`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to load company users");
      }
      const users = await res.json();
      setCompanyUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      showToast(e.message || "Failed to load company users", "error");
      setCompanyUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const openReview = async (company) => {
    setSelected(company);
    setNotes(company.registration_notes || "");
    setEditingUser(null);
    setCredentialForm({ username: "", password: "", force_password_reset: false });
    await loadCompanyUsers(company.company_id);
  };

  const closeReview = () => {
    setSelected(null);
    setNotes("");
    setCompanyUsers([]);
    setEditingUser(null);
    setCredentialForm({ username: "", password: "", force_password_reset: false });
  };

  const openCredentialEditor = (user) => {
    setEditingUser(user);
    setCredentialForm({
      username: user.username || "",
      password: "",
      force_password_reset: Boolean(user.force_password_reset),
    });
  };

  const cancelCredentialEditor = () => {
    setEditingUser(null);
    setCredentialForm({ username: "", password: "", force_password_reset: false });
  };

  const saveCredentials = async () => {
    if (!selected || !editingUser) return;

    const nextUsername = credentialForm.username.trim();
    const nextPassword = credentialForm.password.trim();

    if (!nextUsername) {
      showToast("Username is required.", "error");
      return;
    }
    if (nextPassword && nextPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    const payload = {
      username: nextUsername,
      force_password_reset: credentialForm.force_password_reset,
    };
    if (nextPassword) {
      payload.password = nextPassword;
    }

    setCredentialSaving(true);
    try {
      const res = await fetch(
        `${API}/companies/${encodeURIComponent(selected.company_id)}/users/${encodeURIComponent(editingUser.id)}/credentials`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        }
      );
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to update credentials");
      }

      showToast(`Updated credentials for ${nextUsername}.`, "success");
      await loadCompanyUsers(selected.company_id);
      cancelCredentialEditor();
    } catch (e) {
      showToast(e.message || "Failed to update credentials", "error");
    } finally {
      setCredentialSaving(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/companies/${selected.company_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status, notes }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Update failed");
      }
      showToast(`"${selected.company_id}" ${status}.`, status === "approved" ? "success" : "warn");
      closeReview();
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = companies.filter((c) => (filter === "all" ? true : (c.registration_status || "approved") === filter));

  const counts = {
    all: companies.length,
    pending: companies.filter((c) => (c.registration_status || "approved") === "pending").length,
    approved: companies.filter((c) => (c.registration_status || "approved") === "approved").length,
    denied: companies.filter((c) => (c.registration_status || "approved") === "denied").length,
  };

  const toastBg = toast?.type === "success" ? "#166534" : toast?.type === "warn" ? "#92400e" : "#991b1b";

  return (
    <div style={s.page}>
      {/* TOAST */}
      {toast && <div style={{ ...s.toast, background: toastBg }}>{toast.msg}</div>}

      {/* HEADER */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Company Creation Portal</h1>
          <p style={s.sub}>Review registrations and manage company access.</p>
        </div>
        <button style={s.logoutBtn} onClick={logout}>
          Sign Out
        </button>
      </div>

      {/* FILTER TABS */}
      <div style={s.tabs}>
        {["all", "pending", "approved", "denied"].map((tab) => (
          <button key={tab} style={{ ...s.tab, ...(filter === tab ? s.tabActive : {}) }} onClick={() => setFilter(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span
              style={{
                ...s.tabBadge,
                background: filter === tab ? "#fff" : "#e2e8f0",
                color: filter === tab ? "#4f46e5" : "#64748b",
              }}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          ↺ Refresh
        </button>
      </div>

      {/* CONTENT */}
      {loading && <div style={s.center}>Loading companies...</div>}
      {error && (
        <div style={s.errorBox}>
          {error}{" "}
          <button style={s.retryBtn} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && <div style={s.empty}>No companies match this filter.</div>}

      {!loading && !error && filtered.length > 0 && (
        <div style={s.grid}>
          {filtered.map((c) => {
            const st = c.registration_status || "approved";
            const sc = STATUS_COLORS[st] || STATUS_COLORS.approved;
            return (
              <div key={c.company_id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <div style={s.cardName}>{c.name}</div>
                    <code style={s.cardId}>{c.company_id}</code>
                  </div>
                  <span style={{ ...s.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                </div>

                <div style={s.cardMeta}>
                  {c.company_email && <div>✉ {c.company_email}</div>}
                  {c.company_phone && <div>✆ {c.company_phone}</div>}
                  {c.company_address && <div>⌖ {c.company_address}</div>}
                  <div>
                    👤 {c.employee_count ?? 0} user{c.employee_count !== 1 ? "s" : ""}
                  </div>
                </div>

                {c.registration_notes && <div style={s.cardNotes}>"{c.registration_notes}"</div>}

                <button style={s.reviewBtn} onClick={() => openReview(c)}>
                  {st === "pending" ? "Review & Decide →" : "Update Status →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* REVIEW MODAL */}
      {selected &&
        (() => {
          const st = selected.registration_status || "approved";
          const sc = STATUS_COLORS[st] || STATUS_COLORS.approved;
          return (
            <div style={s.overlay} onClick={closeReview}>
              <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                <button style={s.closeBtn} onClick={closeReview}>
                  ✕
                </button>

                <h2 style={s.modalTitle}>{selected.name}</h2>
                <code style={s.modalId}>{selected.company_id}</code>

                <div style={s.modalGrid}>
                  {selected.company_email && (
                    <div style={s.modalRow}>
                      <span style={s.modalLabel}>Email</span>
                      {selected.company_email}
                    </div>
                  )}
                  {selected.company_phone && (
                    <div style={s.modalRow}>
                      <span style={s.modalLabel}>Phone</span>
                      {selected.company_phone}
                    </div>
                  )}
                  {selected.company_address && (
                    <div style={s.modalRow}>
                      <span style={s.modalLabel}>Address</span>
                      {selected.company_address}
                    </div>
                  )}
                  <div style={s.modalRow}>
                    <span style={s.modalLabel}>Users</span>
                    {selected.employee_count ?? 0}
                  </div>
                  <div style={s.modalRow}>
                    <span style={s.modalLabel}>Status</span>
                    <span style={{ ...s.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                  </div>
                </div>

                <div style={s.userPanel}>
                  <div style={s.userPanelTitle}>Company Users</div>
                  {usersLoading && <div style={s.userPanelHint}>Loading users...</div>}
                  {!usersLoading && companyUsers.length === 0 && (
                    <div style={s.userPanelHint}>No users found for this company.</div>
                  )}
                  {!usersLoading && companyUsers.length > 0 && (
                    <div style={s.userList}>
                      {companyUsers.map((user) => (
                        <div key={user.id} style={s.userRow}>
                          <div>
                            <div style={s.userName}>{user.first_name} {user.last_name}</div>
                            <div style={s.userMeta}>@{user.username} · {user.role}</div>
                          </div>
                          <button
                            style={s.userEditBtn}
                            onClick={() => openCredentialEditor(user)}
                            disabled={credentialSaving}
                          >
                            Edit Login
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {editingUser && (
                    <div style={s.credentialBox}>
                      <div style={s.credentialTitle}>Update Login for {editingUser.first_name} {editingUser.last_name}</div>
                      <div style={s.credentialField}>
                        <label style={s.notesLabel}>Username</label>
                        <input
                          style={s.credentialInput}
                          value={credentialForm.username}
                          onChange={(e) => setCredentialForm((prev) => ({ ...prev, username: e.target.value }))}
                          disabled={credentialSaving}
                        />
                      </div>
                      <div style={s.credentialField}>
                        <label style={s.notesLabel}>New Password (optional)</label>
                        <input
                          type="password"
                          style={s.credentialInput}
                          value={credentialForm.password}
                          onChange={(e) => setCredentialForm((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Leave blank to keep current password"
                          disabled={credentialSaving}
                        />
                      </div>
                      <label style={s.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={credentialForm.force_password_reset}
                          onChange={(e) =>
                            setCredentialForm((prev) => ({ ...prev, force_password_reset: e.target.checked }))
                          }
                          disabled={credentialSaving}
                        />
                        Force password reset on next login
                      </label>
                      <div style={s.credentialActions}>
                        <button
                          style={{ ...s.approveBtn, opacity: credentialSaving ? 0.6 : 1 }}
                          onClick={saveCredentials}
                          disabled={credentialSaving}
                        >
                          {credentialSaving ? "Saving..." : "Save Login"}
                        </button>
                        <button
                          style={s.credentialCancelBtn}
                          onClick={cancelCredentialEditor}
                          disabled={credentialSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={s.notesLabel}>Internal Notes (optional)</label>
                  <textarea style={s.notesInput} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note about this decision..." disabled={saving} />
                </div>

                <div style={s.modalActions}>
                  <button style={{ ...s.approveBtn, opacity: saving ? 0.6 : 1 }} onClick={() => updateStatus("approved")} disabled={saving}>
                    {saving ? "Saving..." : "✓ Approve"}
                  </button>
                  <button style={{ ...s.denyBtn, opacity: saving ? 0.6 : 1 }} onClick={() => updateStatus("denied")} disabled={saving}>
                    {saving ? "Saving..." : "✕ Deny"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

const s = {
  page: { padding: "2rem", maxWidth: 1100, margin: "0 auto" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" },
  title: { fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" },
  sub: { color: "#64748b", fontSize: "0.875rem" },
  logoutBtn: {
    padding: "0.5rem 1rem",
    background: "none",
    border: "1px solid #cbd5e1",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#64748b",
  },
  tabs: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" },
  tab: {
    padding: "0.5rem 1rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.875rem",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  tabActive: { background: "#4f46e5", color: "#fff", borderColor: "#4f46e5" },
  tabBadge: { borderRadius: "9999px", padding: "0.1rem 0.5rem", fontSize: "0.75rem", fontWeight: 700 },
  refreshBtn: {
    marginLeft: "auto",
    padding: "0.5rem 1rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "0.85rem",
    color: "#475569",
    fontWeight: 600,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" },
  cardName: { fontWeight: 700, color: "#0f172a", fontSize: "1rem" },
  cardId: { fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.15rem", display: "block" },
  cardMeta: { display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" },
  cardNotes: { fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic", marginBottom: "0.75rem" },
  badge: { borderRadius: "9999px", padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" },
  reviewBtn: {
    marginTop: "auto",
    padding: "0.5rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#4f46e5",
    width: "100%",
  },
  center: { textAlign: "center", padding: "3rem", color: "#64748b" },
  empty: { textAlign: "center", padding: "3rem", color: "#94a3b8" },
  errorBox: { background: "#fee2e2", color: "#dc2626", padding: "1rem", borderRadius: "0.375rem", marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" },
  retryBtn: { background: "none", border: "1px solid #dc2626", color: "#dc2626", borderRadius: "0.25rem", padding: "0.25rem 0.75rem", cursor: "pointer", fontWeight: 600 },
  toast: {
    position: "fixed",
    top: "1.5rem",
    right: "1.5rem",
    color: "#fff",
    padding: "0.75rem 1.25rem",
    borderRadius: "0.5rem",
    fontWeight: 600,
    fontSize: "0.9rem",
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "1rem",
  },
  modal: {
    background: "#fff",
    borderRadius: "0.75rem",
    padding: "2rem",
    width: "100%",
    maxWidth: 520,
    position: "relative",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  closeBtn: { position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#94a3b8" },
  modalTitle: { fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.2rem" },
  modalId: { fontSize: "0.85rem", color: "#64748b", display: "block", marginBottom: "1.25rem" },
  modalGrid: { marginBottom: "1.25rem" },
  modalRow: { display: "flex", gap: "0.75rem", fontSize: "0.875rem", color: "#1e293b", marginBottom: "0.5rem", alignItems: "center" },
  modalLabel: { color: "#94a3b8", fontWeight: 600, minWidth: 80, fontSize: "0.8rem" },
  notesLabel: { fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", display: "block", marginBottom: "0.4rem" },
  notesInput: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  userPanel: {
    marginBottom: "1.25rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    padding: "0.9rem",
    background: "#f8fafc",
  },
  userPanelTitle: {
    fontWeight: 700,
    color: "#0f172a",
    fontSize: "0.9rem",
    marginBottom: "0.6rem",
  },
  userPanelHint: {
    fontSize: "0.85rem",
    color: "#64748b",
  },
  userList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  userRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.55rem 0.65rem",
    borderRadius: "0.4rem",
    background: "#fff",
    border: "1px solid #e2e8f0",
  },
  userName: {
    fontWeight: 600,
    color: "#1e293b",
    fontSize: "0.85rem",
  },
  userMeta: {
    fontSize: "0.78rem",
    color: "#64748b",
  },
  userEditBtn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#4f46e5",
    fontWeight: 600,
    borderRadius: "0.35rem",
    padding: "0.35rem 0.65rem",
    cursor: "pointer",
    fontSize: "0.78rem",
    whiteSpace: "nowrap",
  },
  credentialBox: {
    marginTop: "0.75rem",
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: "0.45rem",
    padding: "0.75rem",
  },
  credentialTitle: {
    fontWeight: 700,
    color: "#1e3a8a",
    fontSize: "0.83rem",
    marginBottom: "0.55rem",
  },
  credentialField: {
    marginBottom: "0.55rem",
  },
  credentialInput: {
    width: "100%",
    padding: "0.55rem 0.65rem",
    border: "1px solid #cbd5e1",
    borderRadius: "0.35rem",
    fontSize: "0.84rem",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.45rem",
    color: "#334155",
    fontSize: "0.82rem",
    marginBottom: "0.7rem",
  },
  credentialActions: {
    display: "flex",
    gap: "0.6rem",
  },
  credentialCancelBtn: {
    flex: 1,
    padding: "0.75rem",
    background: "#e2e8f0",
    color: "#334155",
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.95rem",
  },
  modalActions: { display: "flex", gap: "0.75rem" },
  approveBtn: { flex: 1, padding: "0.75rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" },
  denyBtn: { flex: 1, padding: "0.75rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" },
};
