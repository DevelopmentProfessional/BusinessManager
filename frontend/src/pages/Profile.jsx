/*
 * ============================================================
 * FILE: Profile.jsx
 *
 * PURPOSE:
 *   Orchestrator for the logged-in user's personal hub page. Owns all state and
 *   handler logic; delegates panel rendering to dedicated Panel_* components in
 *   frontend/src/pages/components/.
 *
 * FUNCTIONAL PARTS:
 *   [1]  Imports
 *   [2]  Module-level style injection — accordion pop-up animation CSS, no-scrollbar rules
 *   [3]  Module-level constants — DB_ENVIRONMENTS map, statusColor helper, AlignIcons
 *   [4]  State declarations
 *   [5]  Layout measurement effects
 *   [6]  Settings load effects
 *   [7]  Database / import effects
 *   [8]  Settings handlers
 *   [9]  CSV import handlers
 *   [10] User sync helpers
 *   [11] Payroll load effect
 *   [12] Leave request effects & handlers
 *   [13] Action handlers
 *   [14] Performance tracking effect
 *   [15] Render helpers
 *   [16] Render — panel components, leave management panel, footer tabs, modals
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-05-15 | Copilot | Shortened leave-management action labels for compact training-mode layouts
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Reduced Profile footer tab width and side padding
 *   2026-03-07 | Claude  | Fixed compact-mode footer centering and training toggle width
 *   2026-03-28 | Claude  | Refactored: extracted panel JSX into Panel_* components
 * ============================================================
 */

// ─── 1 IMPORTS ──────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../services/useStore";
import useDarkMode from "../services/useDarkMode";
import useViewMode from "../services/useViewMode";
import Button_Toolbar from "./components/Button_Toolbar";
import { getMobileEnvironment } from "../services/mobileEnvironment";
import { logComponentLoad, finalizePerformanceReport, getPerformanceSessionActive } from "../services/performanceTracker";
import { UserIcon, CogIcon, PlusCircleIcon, CheckCircleIcon, CircleStackIcon, ChevronDownIcon, CurrencyDollarIcon, HeartIcon } from "@heroicons/react/24/outline";
import { documentsAPI, employeesAPI, leaveRequestsAPI, onboardingRequestsAPI, offboardingRequestsAPI, settingsAPI, schemaAPI, payrollAPI, adminAPI, insurancePlansAPI } from "../services/api";
import Button_Insurance_Document from "./components/Button_Insurance_Document";
import { runAppSync } from "../services/appSync";
import Modal_Signature from "./components/Modal_Signature";
import useBranding from "../services/useBranding";
import { applyActiveColorTheme } from "../services/activeColorTheme";
import Panel_Settings from "./components/Panel_Settings";
import Panel_General from "./components/Panel_General";
import Panel_Wage_History from "./components/Panel_Wage_History";
import Panel_Database from "./components/Panel_Database";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

// ─── Inline alignment icons for the footer-align triple toggle ───────────────
const AlignLeftIcon = ({ className = "app-icon flex-shrink-0" }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <rect x="2" y="3" width="16" height="2.5" rx="1.25" />
    <rect x="2" y="8.75" width="11" height="2.5" rx="1.25" />
    <rect x="2" y="14.5" width="14" height="2.5" rx="1.25" />
  </svg>
);
const AlignCenterIcon = ({ className = "app-icon flex-shrink-0" }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <rect x="2" y="3" width="16" height="2.5" rx="1.25" />
    <rect x="4.5" y="8.75" width="11" height="2.5" rx="1.25" />
    <rect x="3" y="14.5" width="14" height="2.5" rx="1.25" />
  </svg>
);
const AlignRightIcon = ({ className = "app-icon flex-shrink-0" }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <rect x="2" y="3" width="16" height="2.5" rx="1.25" />
    <rect x="7" y="8.75" width="11" height="2.5" rx="1.25" />
    <rect x="4" y="14.5" width="14" height="2.5" rx="1.25" />
  </svg>
);

// ─── 2 MODULE-LEVEL STYLE INJECTION ──────────────────────────────────────────
const accordionStyles = `
  @keyframes popUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .accordion-popup {
    animation: popUp 0.3s ease-out;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  .accordion-popup::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .accordion-popup * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  .accordion-popup *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .profile-page * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  .profile-page *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
`;

if (typeof document !== "undefined") {
  if (!document.head.querySelector("style[data-accordion-popup]")) {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = accordionStyles;
    styleSheet.setAttribute("data-accordion-popup", "true");
    document.head.appendChild(styleSheet);
  }
}

if (typeof document !== "undefined") {
  if (!document.head.querySelector("style[data-profile-no-scrollbar]")) {
    const styleSheet = document.createElement("style");
    styleSheet.setAttribute("data-profile-no-scrollbar", "true");
    styleSheet.textContent = `
      .profile-page * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      .profile-page *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `;
    document.head.appendChild(styleSheet);
  }
}

// ─── 3 MODULE-LEVEL CONSTANTS & HELPERS ──────────────────────────────────────
const DB_ENVIRONMENTS = {
  production: { name: "Production", description: "Live production database" },
};

const statusColor = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "rejected") return "danger";
  if (s === "pending") return "warning";
  return "secondary";
};

const sortLeaveRequestsDesc = (requests) =>
  [...requests].sort((a, b) => {
    const ta = Date.parse(a.start_date || "") || 0;
    const tb = Date.parse(b.start_date || "") || 0;
    return tb - ta;
  });

function LeaveRequestsTable({ requests, emptyMessage }) {
  if (!requests.length) {
    return <p className="text-muted small mb-0">{emptyMessage}</p>;
  }
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
      <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
        <thead className="table-light">
          <tr>
            <th>Type</th>
            <th>From</th>
            <th>To</th>
            <th>Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>{req.leave_type === "vacation" ? "🏖️ Vacation" : "🤒 Sick"}</td>
              <td>{req.start_date}</td>
              <td>{req.end_date}</td>
              <td>{req.days_requested ?? "—"}</td>
              <td>
                <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: "0.7rem" }}>
                  {req.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, setUser, hasPermission, refetchPermissions, refreshUserPermissions } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { isTrainingMode, toggleViewMode, buttonTextSize, cycleButtonTextSize, footerAlign, setFooterAlign, uiScale, setUiScale, cycleUiScale } = useViewMode();
  const footerJustify = footerAlign === "center" ? "justify-content-center" : footerAlign === "right" ? "justify-content-end" : "justify-content-start";
  const FooterAlignIcon = footerAlign === "center" ? AlignCenterIcon : footerAlign === "right" ? AlignRightIcon : AlignLeftIcon;
  const [isMobile, setIsMobile] = useState(() => getMobileEnvironment().isMobileViewport);

  const cycleFooterAlign = useCallback(() => {
    const next = footerAlign === "left" ? "center" : footerAlign === "center" ? "right" : "left";
    setFooterAlign(next);
  }, [footerAlign, setFooterAlign]);

  // ─── 4 STATE DECLARATIONS ──────────────────────────────────────────────────
  // Admin-only: Check/Start Database button state
  const [dbCheckLoading, setDbCheckLoading] = useState(false);
  const [dbCheckStatus, setDbCheckStatus] = useState("");

  // Admin-only: Check/Start Database handler
  const handleCheckStartDatabase = async () => {
    setDbCheckLoading(true);
    setDbCheckStatus("");
    try {
      const res = await adminAPI.checkOrStartDatabase();
      setDbCheckStatus(res?.data?.message || "Database is running.");
    } catch (err) {
      setDbCheckStatus("Error: " + (err?.response?.data?.detail || err?.message || "Failed to check/start database."));
    } finally {
      setDbCheckLoading(false);
    }
  };
  useEffect(() => {
    if (getPerformanceSessionActive()) logComponentLoad("Profile Component");
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentDbEnvironment = user?.db_environment === "production" ? "production" : "production";
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState("");
  const [dbError, setDbError] = useState("");
  const [installMessage, setInstallMessage] = useState("");
  const [installError, setInstallError] = useState("");
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [employeeColor, setEmployeeColor] = useState(user?.color || "#3B82F6");
  const [pendingColor, setPendingColor] = useState(user?.color || "#3B82F6");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorUpdating, setColorUpdating] = useState(false);
  const [colorMessage, setColorMessage] = useState("");
  const [openAccordion, setOpenAccordion] = useState("");
  const [meSectionOpen, setMeSectionOpen] = useState("profile");
  const [leaveManagementOpen, setLeaveManagementOpen] = useState(false);

  const [vacationRequests, setVacationRequests] = useState([]);
  const [sickRequests, setSickRequests] = useState([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveModalType, setLeaveModalType] = useState("vacation");
  const [leaveForm, setLeaveForm] = useState({ start_date: "", end_date: "", notes: "" });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [insurancePlans, setInsurancePlans] = useState([]);

  const [paySlips, setPaySlips] = useState([]);
  const [paySlipsLoading, setPaySlipsLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const row1Ref = useRef(null);
  const [row1Height, setRow1Height] = useState(80);

  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);

  const { branding, updateBranding } = useBranding();
  const [localBranding, setLocalBranding] = useState(branding);

  const [brandingLogoUploading, setBrandingLogoUploading] = useState(false);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [logoPickerLoading, setLogoPickerLoading] = useState(false);
  const [logoPickerError, setLogoPickerError] = useState("");
  const [logoPickerDocs, setLogoPickerDocs] = useState([]);

  const [dbSettings, setDbSettings] = useState({ connectionString: "", apiBaseUrl: "", onlyofficeUrl: "" });

  const [scheduleSettings, setScheduleSettings] = useState({
    start_of_day: "06:00",
    end_of_day: "21:00",
    attendance_check_in_required: true,
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: true,
    sunday_enabled: true,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [companyInfo, setCompanyInfo] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    tax_rate: 0,
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const [openAccordions, setOpenAccordions] = useState({
    application: true,
    companyInfo: false,
    branding: false,
    clientPortal: false,
    notifications: false,
  });

  const [portalBranding, setPortalBranding] = useState({
    portal_hero_title: "",
    portal_hero_subtitle: "",
    portal_hero_tagline: "",
    portal_hero_bg_color: "#4f46e5",
    portal_hero_text_color: "#ffffff",
    portal_hero_image_url: "",
    portal_banner_text: "",
    portal_banner_color: "#4f46e5",
    portal_show_hero: true,
    portal_show_banner: false,
    portal_footer_text: "",
    portal_primary_color: "#4f46e5",
    portal_secondary_color: "#0ea5e9",
  });
  const [portalBrandingLoading, setPortalBrandingLoading] = useState(false);
  const [heroImageUploading, setHeroImageUploading] = useState(false);

  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableColumns, setTableColumns] = useState([]);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvFileInputRef = useRef(null);

  const [notifications, setNotifications] = useState({
    emailEnabled: true,
    pushEnabled: false,
    appointmentReminders: true,
    dailyDigest: false,
  });

  useEffect(() => {
    const savedColor = user?.color || "#3B82F6";
    setEmployeeColor(savedColor);
    if (!colorPickerOpen) setPendingColor(savedColor);
  }, [user?.color, colorPickerOpen]);

  // ─── 5 LAYOUT MEASUREMENT EFFECTS ────────────────────────────────────────
  useEffect(() => {
    if (!row1Ref.current) return;
    const update = () => setRow1Height(row1Ref.current.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(row1Ref.current);
    return () => obs.disconnect();
  }, []);

  // ─── 6 SETTINGS LOAD EFFECTS ─────────────────────────────────────────────
  useEffect(() => {
    setLocalBranding(branding);
  }, [branding]);

  useEffect(() => {
    if (!user?.id) return;
    insurancePlansAPI
      .getAll()
      .then((res) => {
        const data = res?.data ?? res ?? [];
        setInsurancePlans(Array.isArray(data) ? data : []);
      })
      .catch(() => setInsurancePlans([]));
  }, [user?.id]);

  useEffect(() => {
    const handleResize = () => setIsMobile(getMobileEnvironment().isMobileViewport);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const savedDb = localStorage.getItem("app_db_settings");
    if (savedDb) {
      try {
        setDbSettings(JSON.parse(savedDb));
      } catch {
        /* ignore */
      }
    } else {
      setDbSettings({ connectionString: "", apiBaseUrl: import.meta.env.VITE_API_URL || "", onlyofficeUrl: import.meta.env.VITE_ONLYOFFICE_URL || "" });
    }
    const savedNotif = localStorage.getItem("app_notifications");
    if (savedNotif) {
      try {
        setNotifications(JSON.parse(savedNotif));
      } catch {
        /* ignore */
      }
    }
    const loadSchedule = async () => {
      try {
        const res = await settingsAPI.getScheduleSettings();
        if (res.data) {
          setScheduleSettings({
            start_of_day: res.data.start_of_day || "06:00",
            end_of_day: res.data.end_of_day || "21:00",
            attendance_check_in_required: res.data.attendance_check_in_required ?? false,
            monday_enabled: res.data.monday_enabled ?? true,
            tuesday_enabled: res.data.tuesday_enabled ?? true,
            wednesday_enabled: res.data.wednesday_enabled ?? true,
            thursday_enabled: res.data.thursday_enabled ?? true,
            friday_enabled: res.data.friday_enabled ?? true,
            saturday_enabled: res.data.saturday_enabled ?? true,
            sunday_enabled: res.data.sunday_enabled ?? true,
          });
          setCompanyInfo({
            company_name: res.data.company_name || "",
            company_email: res.data.company_email || "",
            company_phone: res.data.company_phone || "",
            company_address: res.data.company_address || "",
            tax_rate: res.data.tax_rate ?? 0,
          });
          setPortalBranding((prev) => ({
            ...prev,
            portal_hero_title: res.data.portal_hero_title || "",
            portal_hero_subtitle: res.data.portal_hero_subtitle || "",
            portal_hero_tagline: res.data.portal_hero_tagline || "",
            portal_hero_bg_color: res.data.portal_hero_bg_color || "#4f46e5",
            portal_hero_text_color: res.data.portal_hero_text_color || "#ffffff",
            portal_hero_image_url: res.data.portal_hero_image_url || "",
            portal_banner_text: res.data.portal_banner_text || "",
            portal_banner_color: res.data.portal_banner_color || "#4f46e5",
            portal_show_hero: res.data.portal_show_hero !== false,
            portal_show_banner: res.data.portal_show_banner || false,
            portal_footer_text: res.data.portal_footer_text || "",
            portal_primary_color: res.data.portal_primary_color || "#4f46e5",
            portal_secondary_color: res.data.portal_secondary_color || "#0ea5e9",
          }));
        }
      } catch {
        /* silently degrade */
      }
    };
    loadSchedule();
  }, []);

  // ─── 7 DATABASE / IMPORT EFFECTS ─────────────────────────────────────────
  useEffect(() => {
    if (openAccordion === "database" && availableTables.length === 0) loadTables();
  }, [openAccordion]);

  useEffect(() => {
    if (selectedTable) loadTableColumns(selectedTable);
  }, [selectedTable]);

  // ─── 8 SETTINGS HANDLERS ─────────────────────────────────────────────────
  const toNumber = (value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const HelpIcon = ({ id, text }) => (
    <div className="relative inline-block ml-1">
      <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors" onClick={() => setActiveTooltip(activeTooltip === id ? null : id)} onMouseEnter={() => setActiveTooltip(id)} onMouseLeave={() => setActiveTooltip(null)} />
      {activeTooltip === id && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg max-w-xs text-center">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );

  const toggleAccordion = (id) => setOpenAccordions((prev) => ({ ...prev, [id]: !prev[id] }));

  const uploadDocumentAsCompanyLogo = async (doc) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const response = await fetch(documentsAPI.fileUrl(doc.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch document (${response.status})`);
    }
    const blob = await response.blob();
    const filename = doc.original_filename || `logo-${doc.id}.png`;
    const file = new File([blob], filename, {
      type: blob.type || doc.content_type || "image/png",
    });
    await settingsAPI.uploadCompanyLogo(file);
  };

  const handleSaveBranding = async () => {
    setBrandingLogoUploading(true);
    setSettingsError("");
    try {
      // Backward-compatible bridge: if an existing local branding document is selected,
      // sync it into company logo_data so the client portal can render it.
      if (localBranding.logoDocumentId) {
        const selectedDoc = logoPickerDocs.find((d) => String(d.id) === String(localBranding.logoDocumentId)) || { id: localBranding.logoDocumentId, original_filename: `logo-${localBranding.logoDocumentId}.png`, content_type: "image/png" };
        await uploadDocumentAsCompanyLogo(selectedDoc);
      }

      updateBranding(localBranding);
      setSettingsSuccess("Branding saved!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to save branding", err);
      setSettingsError("Failed to save branding.");
    } finally {
      setBrandingLogoUploading(false);
    }
  };
  const handleBrandingChange = (field, value) => setLocalBranding((prev) => ({ ...prev, [field]: value }));

  const isImageDocument = (doc) => {
    const ct = String(doc?.content_type || "").toLowerCase();
    const name = String(doc?.original_filename || "").toLowerCase();
    return ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  };

  const loadLogoPickerDocs = async () => {
    setLogoPickerLoading(true);
    setLogoPickerError("");
    try {
      const res = await documentsAPI.getAll();
      const docs = Array.isArray(res.data) ? res.data : [];
      setLogoPickerDocs(docs.filter(isImageDocument));
    } catch (err) {
      console.warn("Failed to load documents for logo picker", err);
      setLogoPickerDocs([]);
      setLogoPickerError("Failed to load images.");
    } finally {
      setLogoPickerLoading(false);
    }
  };

  const handleUploadBrandingLogo = async (file) => {
    if (!file) return;
    setBrandingLogoUploading(true);
    setSettingsError("");
    try {
      await settingsAPI.uploadCompanyLogo(file);
      setLocalBranding((prev) => ({
        ...prev,
        logoDocumentId: null,
        logoUrl: URL.createObjectURL(file),
      }));
      setSettingsSuccess("Company logo uploaded!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      console.error("Branding logo upload failed", err);
      setSettingsError("Failed to upload logo.");
    } finally {
      setBrandingLogoUploading(false);
    }
  };

  const handleSelectLogoFromDocuments = async (doc) => {
    if (!doc?.id) return;
    setBrandingLogoUploading(true);
    setSettingsError("");
    try {
      await uploadDocumentAsCompanyLogo(doc);
      setLocalBranding((prev) => ({ ...prev, logoDocumentId: doc.id, logoUrl: "" }));
      setLogoPickerOpen(false);
      setSettingsSuccess("Company logo updated from document!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      console.error("Selecting branding logo from documents failed", err);
      setSettingsError("Failed to set logo from document.");
    } finally {
      setBrandingLogoUploading(false);
    }
  };

  const handleSaveDbSettings = () => {
    localStorage.setItem("app_db_settings", JSON.stringify(dbSettings));
    setSettingsSuccess("Connection settings saved!");
    setTimeout(() => setSettingsSuccess(""), 3000);
  };
  const handleDbSettingsChange = (field, value) => setDbSettings((prev) => ({ ...prev, [field]: value }));

  const handleSaveNotifications = () => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
    setSettingsSuccess("Notification settings saved!");
    setTimeout(() => setSettingsSuccess(""), 3000);
  };
  const handleNotificationChange = (field, value) => setNotifications((prev) => ({ ...prev, [field]: value }));

  const handleScheduleSettingsChange = (field, value) => setScheduleSettings((prev) => ({ ...prev, [field]: value }));

  const handleSaveScheduleSettings = async () => {
    setScheduleLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      await settingsAPI.updateScheduleSettings(scheduleSettings);
      setSettingsSuccess("Schedule settings saved!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || "Failed to save schedule settings");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCompanyInfoChange = (field, value) => setCompanyInfo((prev) => ({ ...prev, [field]: value }));

  const handleSaveCompanyInfo = async () => {
    setCompanyLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      await settingsAPI.updateSettings(companyInfo);
      setSettingsSuccess("Company info saved!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || "Failed to save company info");
    } finally {
      setCompanyLoading(false);
    }
  };

  const handlePortalBrandingChange = (field, value) => setPortalBranding((prev) => ({ ...prev, [field]: value }));

  const handleSavePortalBranding = async () => {
    setPortalBrandingLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      await settingsAPI.updateSettings(portalBranding);
      setSettingsSuccess("Client portal settings saved!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || "Failed to save portal settings");
    } finally {
      setPortalBrandingLoading(false);
    }
  };

  const handleSaveGeneralPanel = async () => {
    const tasks = [];
    if (openAccordions.companyInfo) tasks.push(handleSaveCompanyInfo());
    if (openAccordions.branding) tasks.push(handleSaveBranding());
    if (openAccordions.notifications) tasks.push(handleSaveNotifications());
    if (openAccordions.clientPortal) tasks.push(handleSavePortalBranding());
    if (tasks.length > 0) await Promise.all(tasks);
  };

  const handleUploadHeroImage = async (file) => {
    if (!file) return;
    setHeroImageUploading(true);
    setSettingsError("");
    try {
      const res = await documentsAPI.upload(file, "Portal hero image");
      const doc = res?.data;
      if (doc?.id) {
        const url = documentsAPI.fileUrl(doc.id);
        setPortalBranding((prev) => ({ ...prev, portal_hero_image_url: url }));
      }
    } catch {
      setSettingsError("Failed to upload hero image.");
    } finally {
      setHeroImageUploading(false);
    }
  };

  const resetPortalBrandingDefaults = () => {
    setPortalBranding({
      portal_hero_title: companyInfo.company_name || "",
      portal_hero_subtitle: "Browse our products and services",
      portal_hero_tagline: "",
      portal_hero_bg_color: "#4f46e5",
      portal_hero_text_color: "#ffffff",
      portal_hero_image_url: "",
      portal_banner_text: "",
      portal_banner_color: "#4f46e5",
      portal_show_hero: true,
      portal_show_banner: false,
      portal_footer_text: "",
      portal_primary_color: "#4f46e5",
      portal_secondary_color: "#0ea5e9",
    });
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      await Promise.allSettled([refreshUserPermissions?.(), refetchPermissions?.(), syncCurrentUser()]);
      setSettingsSuccess("App data refreshed. Reloading...");
      await runAppSync();
    } catch {
      setSettingsError("App refresh failed. Please try again.");
    } finally {
      setSyncLoading(false);
    }
  };

  // ─── 9 CSV IMPORT HANDLERS ───────────────────────────────────────────────
  const loadTables = async () => {
    try {
      const res = await schemaAPI.getTables();
      setAvailableTables(res.data || []);
    } catch {
      /* silently degrade */
    }
  };

  const loadTableColumns = async (tableName) => {
    try {
      const res = await schemaAPI.getTableColumns(tableName);
      setTableColumns(res.data || []);
      setColumnMapping({});
      setCsvData(null);
      setCsvHeaders([]);
      setImportResult(null);
    } catch {
      setTableColumns([]);
    }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], data: [] };
    const headers = parseCSVLine(lines[0]);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });
        data.push(row);
      }
    }
    return { headers, data };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, data } = parseCSV(e.target.result);
      setCsvHeaders(headers);
      setCsvData(data);
      const autoMapping = {};
      headers.forEach((header) => {
        const norm = header.toLowerCase().replace(/\s+/g, "_");
        const match = tableColumns.find((col) => col.name.toLowerCase() === norm || col.display_name.toLowerCase() === header.toLowerCase());
        if (match) autoMapping[header] = match.name;
      });
      setColumnMapping(autoMapping);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleColumnMappingChange = (csvHeader, dbColumn) => {
    setColumnMapping((prev) => ({ ...prev, [csvHeader]: dbColumn || undefined }));
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) {
      setSettingsError("No data to import");
      return;
    }
    setImportLoading(true);
    setSettingsError("");
    setImportResult(null);
    try {
      const transformedData = csvData
        .map((row) => {
          const newRow = {};
          Object.entries(columnMapping).forEach(([csvH, dbCol]) => {
            if (dbCol && row[csvH] !== undefined) newRow[dbCol] = row[csvH];
          });
          return newRow;
        })
        .filter((row) => Object.keys(row).length > 0);
      const res = await schemaAPI.bulkImport(selectedTable, transformedData);
      setImportResult(res.data);
      if (res.data.imported > 0) {
        setSettingsSuccess(`Imported ${res.data.imported} records!`);
        setTimeout(() => setSettingsSuccess(""), 5000);
      }
    } catch (err) {
      setSettingsError(err.response?.data?.detail || "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setCsvData(null);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportResult(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
  };

  // ─── 10 USER SYNC HELPER ─────────────────────────────────────────────────
  const syncCurrentUser = async () => {
    if (!user?.id) return;
    try {
      const response = await employeesAPI.getUserData(user.id);
      const refreshedUser = response?.data ?? response;
      if (!refreshedUser || typeof refreshedUser !== "object") return;
      const mergedUser = { ...user, ...refreshedUser };
      setUser(mergedUser);
      if (localStorage.getItem("user")) localStorage.setItem("user", JSON.stringify(mergedUser));
      if (sessionStorage.getItem("user")) sessionStorage.setItem("user", JSON.stringify(mergedUser));
    } catch {
      /* silently degrade */
    }
  };

  useEffect(() => {
    if (!user?.id || user?.color) return;
    syncCurrentUser();
  }, [user?.id, user?.color]);

  // ─── 11 PAYROLL LOAD EFFECT ───────────────────────────────────────────────
  useEffect(() => {
    if (meSectionOpen !== "wage" || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setPaySlipsLoading(true);
      try {
        const res = await payrollAPI.getByEmployee(user.id);
        if (!cancelled) setPaySlips(Array.isArray(res?.data) ? res.data : []);
      } catch {
        /* silently degrade */
      } finally {
        if (!cancelled) setPaySlipsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [meSectionOpen, user?.id]);

  // ─── 12 LEAVE REQUEST EFFECTS & HANDLERS ─────────────────────────────────
  useEffect(() => {
    if ((meSectionOpen !== "benefits" && !leaveManagementOpen) || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setLeaveRequestsLoading(true);
      try {
        await syncCurrentUser();
        const [vacRes, sickRes] = await Promise.all([leaveRequestsAPI.getByUser(user.id, "vacation"), leaveRequestsAPI.getByUser(user.id, "sick")]);
        if (cancelled) return;
        setVacationRequests(Array.isArray(vacRes?.data) ? vacRes.data : []);
        setSickRequests(Array.isArray(sickRes?.data) ? sickRes.data : []);
      } catch {
        /* silently degrade */
      } finally {
        if (!cancelled) setLeaveRequestsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [meSectionOpen, leaveManagementOpen, user?.id]);

  const refreshLeaveRequests = async () => {
    if (!user?.id) return;
    setLeaveRequestsLoading(true);
    try {
      const [vacRes, sickRes] = await Promise.all([leaveRequestsAPI.getByUser(user.id, "vacation"), leaveRequestsAPI.getByUser(user.id, "sick")]);
      setVacationRequests(Array.isArray(vacRes?.data) ? vacRes.data : []);
      setSickRequests(Array.isArray(sickRes?.data) ? sickRes.data : []);
    } catch {
      /* silently degrade */
    } finally {
      setLeaveRequestsLoading(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    setLeaveSubmitting(true);
    setLeaveError("");
    try {
      const isLeave = leaveModalType === "vacation" || leaveModalType === "sick";
      if (isLeave) {
        const start = new Date(leaveForm.start_date);
        const end = new Date(leaveForm.end_date);
        if (end < start) {
          setLeaveError("End date must be on or after start date.");
          setLeaveSubmitting(false);
          return;
        }
        const daysRequested = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (leaveModalType === "vacation") {
          const remaining = Math.max(0, toNumber(user.vacation_days) - toNumber(user.vacation_days_used));
          if (daysRequested > remaining) {
            setLeaveError(`You only have ${remaining} vacation day(s) remaining.`);
            setLeaveSubmitting(false);
            return;
          }
        } else {
          const remaining = Math.max(0, toNumber(user.sick_days) - toNumber(user.sick_days_used));
          if (daysRequested > remaining) {
            setLeaveError(`You only have ${remaining} sick day(s) remaining.`);
            setLeaveSubmitting(false);
            return;
          }
        }
        await leaveRequestsAPI.create({ user_id: user.id, supervisor_id: user.reports_to || null, leave_type: leaveModalType, start_date: leaveForm.start_date, end_date: leaveForm.end_date, days_requested: daysRequested, notes: leaveForm.notes || null, status: "pending" });
        await refreshLeaveRequests();
      } else if (leaveModalType === "onboarding") {
        await onboardingRequestsAPI.create({ user_id: user.id, supervisor_id: user.reports_to || null, request_date: leaveForm.start_date || null, notes: leaveForm.notes || null, status: "pending" });
      } else if (leaveModalType === "offboarding") {
        await offboardingRequestsAPI.create({ user_id: user.id, supervisor_id: user.reports_to || null, request_date: leaveForm.start_date || null, notes: leaveForm.notes || null, status: "pending" });
      }
      setShowLeaveModal(false);
      setLeaveForm({ start_date: "", end_date: "", notes: "" });
    } catch (err) {
      setLeaveError(err?.response?.data?.detail || "Failed to submit request.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // ─── 13 ACTION HANDLERS ───────────────────────────────────────────────────
  const handleSwitchEnvironment = async (env) => {
    if (env === currentDbEnvironment || !user?.id) return;
    setDbLoading(true);
    setDbMessage("");
    setDbError("");
    try {
      await employeesAPI.updateUser(user.id, { db_environment: env });
      setUser({ ...user, db_environment: env });
      setDbMessage(`Database preference updated to ${DB_ENVIRONMENTS[env]?.name || env}.`);
      setTimeout(() => setDbMessage(""), 3000);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "Failed to update database preference";
      setDbError(detail);
      setTimeout(() => setDbError(""), 5000);
    } finally {
      setDbLoading(false);
    }
  };

  const handleColorChange = async (newColor) => {
    setEmployeeColor(newColor);
    applyActiveColorTheme(newColor);
    setColorUpdating(true);
    setColorMessage("");
    try {
      await employeesAPI.updateUser(user.id, { color: newColor });
      const updatedUser = { ...user, color: newColor };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
      setColorMessage("Theme color updated!");
      setTimeout(() => setColorMessage(""), 2000);
      return true;
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "Failed to update color";
      setColorMessage(detail);
      const fallbackColor = user?.color || "#3B82F6";
      setEmployeeColor(fallbackColor);
      applyActiveColorTheme(fallbackColor);
      setTimeout(() => setColorMessage(""), 3000);
      return false;
    } finally {
      setColorUpdating(false);
    }
  };

  const handleColorSave = async () => {
    const ok = await handleColorChange(pendingColor);
    if (ok) setColorPickerOpen(false);
  };

  // ─── 14 PERFORMANCE TRACKING EFFECT ──────────────────────────────────────
  useEffect(() => {
    if (getPerformanceSessionActive()) {
      const trackedSections = ["Employee Information Section", "Theme Settings Section", "Database Environment Section", "Install App Section", "Access Token Section"];
      const checkSections = () => {
        const checkInterval = setInterval(() => {
          trackedSections.forEach((section) => {
            if (getPerformanceSessionActive()) logComponentLoad(section);
          });
          clearInterval(checkInterval);
        }, 100);
      };
      checkSections();
      const rafId = requestAnimationFrame(() => {
        setTimeout(() => {
          finalizePerformanceReport();
        }, 300);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [user]);

  // ─── 15 RENDER HELPERS ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="container-fluid py-1">
        <div className="card">
          <div className="card-body text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h2 className="h5 mb-2">Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "danger";
      case "manager":
        return "warning";
      case "employee":
        return "primary";
      case "viewer":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const vacTotal = toNumber(user.vacation_days);
  const vacUsed = toNumber(user.vacation_days_used);
  const vacRemaining = Math.max(0, vacTotal - vacUsed);
  const sickTotal = toNumber(user.sick_days);
  const sickUsed = toNumber(user.sick_days_used);
  const sickRemaining = Math.max(0, sickTotal - sickUsed);

  const openLeaveModal = (type) => {
    const defaultType = type || (vacRemaining > 0 ? "vacation" : sickRemaining > 0 ? "sick" : "onboarding");
    setLeaveModalType(defaultType);
    setLeaveForm({ start_date: "", end_date: "", notes: "" });
    setLeaveError("");
    setShowLeaveModal(true);
  };

  const canAccessSettings = hasPermission("settings", "read");
  const canAccessGeneralSettings = ["manager", "admin"].includes((user?.role || "").toLowerCase());

  const totalFooterHeight = Math.max(row1Height, 80);
  const row1PanelBottom = totalFooterHeight;

  const [meSectionHeaderHeight, setMeSectionHeaderHeight] = useState(44);
  const meSectionBodyMaxHeight = `calc(var(--vvp-height, 100dvh) - ${row1PanelBottom}px - ${meSectionHeaderHeight}px - 24px)`;

  const meSectionHeaderRefs = useRef({});

  const scrollHeaderToBottom = useCallback((el) => {
    if (!el) return;
    setTimeout(() => {
      try {
        el.scrollIntoView({ block: "end" });
      } catch {
        /* ignore */
      }
    }, 0);
  }, []);

  const toggleMeSection = useCallback(
    (id) => {
      setMeSectionOpen((prev) => {
        const next = prev === id ? "" : id;
        scrollHeaderToBottom(meSectionHeaderRefs.current?.[id]);
        return next;
      });
    },
    [scrollHeaderToBottom]
  );

  useEffect(() => {
    const id = meSectionOpen;
    if (!id) return;
    const el = meSectionHeaderRefs.current?.[id];
    if (!el) return;
    const h = el.offsetHeight;
    if (h && Number.isFinite(h)) setMeSectionHeaderHeight(h);
  }, [meSectionOpen, row1PanelBottom]);

  const settingsPanelStyle = {
    position: "fixed",
    top: 0,
    bottom: `${totalFooterHeight}px`,
    left: 0,
    right: 0,
    width: "100%",
    height: `calc(var(--vvp-height, 100dvh) - ${totalFooterHeight}px)`,
    overflowY: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    backgroundColor: "var(--bs-body-bg)",
    zIndex: 1000,
    paddingTop: "1rem",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    paddingBottom: "0.25rem",
    display: "flex",
    flexDirection: "column",
  };

  /** General settings — opens upward from the profile footer (same pattern as me-section accordions). */
  const generalPanelStyle = {
    position: "fixed",
    bottom: `${row1PanelBottom}px`,
    left: 0,
    right: 0,
    maxHeight: `calc(var(--vvp-height, 100dvh) - ${row1PanelBottom}px)`,
    overflowY: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    backgroundColor: "var(--bs-body-bg)",
    zIndex: 1000,
    paddingLeft: "0.75rem",
    paddingRight: "0.75rem",
    paddingTop: "0.75rem",
    paddingBottom: "0.5rem",
    display: "flex",
    flexDirection: "column",
    borderTopLeftRadius: "0.75rem",
    borderTopRightRadius: "0.75rem",
    boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.12)",
  };

  // ─── 16 RENDER ───────────────────────────────────────────────────────────
  return (
    <div className="profile-page d-flex flex-column flex-grow-1 min-h-0 h-100 overflow-hidden" style={{ height: "var(--vvp-height, 100dvh)" }}>
      <div
        className="flex-grow-1 min-h-0 overflow-auto d-flex flex-column"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          backgroundColor: "var(--bs-body-bg)",
          paddingTop: "0.5rem",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
          paddingBottom: "0.5rem",
        }}
      >
        {openAccordion === "" && (
          <>
            <div style={{ flexGrow: 1, minHeight: 0 }} aria-hidden="true" />

            <div style={{ flexShrink: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="d-flex flex-column" style={{ gap: "0.75rem" }}>
                <div className="border rounded" style={{ background: "var(--bs-body-bg)" }}>
                  {meSectionOpen === "profile" && (
                    <div className="p-3" style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight: meSectionBodyMaxHeight, overflowY: "auto" }}>
                      <div className="row">
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <UserIcon className="w-4" />{" "}
                            <div className="fw-medium p-1">
                              {user.first_name} {user.last_name}
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>{user.role || "Employee"}</span>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <div className="fw-medium p-1">{user.email || "Not set"}</div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <div className="fw-medium p-1">{user.phone || "Not set"}</div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <div className="fw-medium p-1">{formatDate(user.hire_date)}</div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="flex wrap mb-1">
                            <div className="fw-medium p-1">{formatDate(user.last_login)}</div>
                          </div>
                        </div>
                      </div>
                      <hr className="my-2" />
                      <h6 className="fw-semibold mb-2">Details</h6>
                      <div className="row g-2">
                        <div className="col-sm-6">
                          <div className="text-muted small">Username</div>
                          <div className="fw-medium">{user.username || "Not set"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Employee ID</div>
                          <div className="fw-medium">{user.id || "N/A"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Location</div>
                          <div className="fw-medium">{user.location || "Not set"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">IOD Number</div>
                          <div className="fw-medium">{user.iod_number || "Not set"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Reports To</div>
                          <div className="fw-medium">{user.reports_to_name || user.reports_to || "Not set"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Active</div>
                          <div className="fw-medium">{user.is_active === false ? "No" : "Yes"}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div
                    ref={(el) => {
                      meSectionHeaderRefs.current.profile = el;
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-100 d-flex align-items-center justify-content-between px-3 py-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleMeSection("profile")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMeSection("profile");
                      }
                    }}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <UserIcon className="h-4 w-4" />
                      <span className="fw-semibold">Profile</span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4" style={{ transition: "transform 0.2s", transform: meSectionOpen === "profile" ? "rotate(180deg)" : "none" }} />
                  </div>
                </div>

                <div className="border rounded" style={{ background: "var(--bs-body-bg)" }}>
                  {meSectionOpen === "wage" && (
                    <Panel_Wage_History paySlips={paySlips} paySlipsLoading={paySlipsLoading} setSelectedSlip={setSelectedSlip} maxHeight={meSectionBodyMaxHeight} />
                  )}
                  <div
                    ref={(el) => {
                      meSectionHeaderRefs.current.wage = el;
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-100 d-flex align-items-center justify-content-between px-3 py-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleMeSection("wage")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMeSection("wage");
                      }
                    }}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <CurrencyDollarIcon className="h-4 w-4" />
                      <span className="fw-semibold">Wage</span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4" style={{ transition: "transform 0.2s", transform: meSectionOpen === "wage" ? "rotate(180deg)" : "none" }} />
                  </div>
                </div>

                <div className="border rounded" style={{ background: "var(--bs-body-bg)" }}>
                  {meSectionOpen === "benefits" && (
                    <div className="p-3" style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight: meSectionBodyMaxHeight, overflowY: "auto" }}>
                      <div className="row g-2 mb-3">
                        <div className="col-sm-6">
                          <div className="text-muted small">Salary</div>
                          <div className="fw-medium">{user.salary != null ? `$${Number(user.salary).toLocaleString()}` : "Not set"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Pay Frequency</div>
                          <div className="fw-medium" style={{ textTransform: "capitalize" }}>
                            {user.pay_frequency || "Not set"}
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Insurance Plan</div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-medium">{user.insurance_plan || "Not set"}</span>
                            {user.insurance_plan && <Button_Insurance_Document planId={insurancePlans.find((p) => p.name === user.insurance_plan)?.id} planName={user.insurance_plan} insurancePlans={insurancePlans} title="View your insurance plan document" />}
                          </div>
                        </div>
                      </div>

                      <div className="border-top pt-3">
                        <h6 className="fw-semibold mb-3">Leave Management</h6>

                        {leaveRequestsLoading ? (
                          <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm text-primary" role="status" />
                          </div>
                        ) : (
                          <>
                            <div className="row g-2 mb-3">
                              <div className="col-6">
                                <div className="bg-light rounded p-2 small">
                                  <div className="fw-semibold text-primary">Vacation Days</div>
                                  <div className="text-muted small mb-1">
                                    {vacUsed} / {vacTotal} used
                                  </div>
                                  <div className="progress">
                                    <div className="progress-bar bg-primary" style={{ width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%` }} />
                                  </div>
                                  <div className="text-muted small mt-1">{vacRemaining} remaining</div>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="bg-light rounded p-2 small">
                                  <div className="fw-semibold text-warning">Sick Days</div>
                                  <div className="text-muted small mb-1">
                                    {sickUsed} / {sickTotal} used
                                  </div>
                                  <div className="progress">
                                    <div className="progress-bar bg-warning" style={{ width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%` }} />
                                  </div>
                                  <div className="text-muted small mt-1">{sickRemaining} remaining</div>
                                </div>
                              </div>
                            </div>

                            <div className="mb-3">
                              <h6 className="small fw-semibold mb-2">Pending Requests</h6>
                              <LeaveRequestsTable requests={sortLeaveRequestsDesc([...vacationRequests, ...sickRequests].filter((r) => r.status === "pending"))} emptyMessage="No pending requests" />
                            </div>

                            <div className="mb-3">
                              <h6 className="small fw-semibold mb-2">History</h6>
                              <LeaveRequestsTable requests={sortLeaveRequestsDesc([...vacationRequests, ...sickRequests].filter((r) => r.status !== "pending"))} emptyMessage="No leave history yet" />
                            </div>

                            <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => openLeaveModal()}>
                              <PlusCircleIcon className="h-4 w-4 me-1" style={{ display: "inline" }} />
                              New
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    ref={(el) => {
                      meSectionHeaderRefs.current.benefits = el;
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-100 d-flex align-items-center justify-content-between px-3 py-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleMeSection("benefits")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMeSection("benefits");
                      }
                    }}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <HeartIcon className="h-4 w-4" />
                      <span className="fw-semibold">Benefits</span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4" style={{ transition: "transform 0.2s", transform: meSectionOpen === "benefits" ? "rotate(180deg)" : "none" }} />
                  </div>
                </div>

                <div className="border rounded" style={{ background: "var(--bs-body-bg)" }}>
                  {meSectionOpen === "settings" && (
                    <div className="p-2" style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight: meSectionBodyMaxHeight, overflowY: "auto" }}>
                      <Panel_Settings
                        embedded={true}
                        isMobile={isMobile}
                        row1PanelBottom={row1PanelBottom}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={toggleDarkMode}
                        employeeColor={employeeColor}
                        pendingColor={pendingColor}
                        setPendingColor={setPendingColor}
                        colorPickerOpen={colorPickerOpen}
                        setColorPickerOpen={setColorPickerOpen}
                        colorUpdating={colorUpdating}
                        colorMessage={colorMessage}
                        handleColorSave={handleColorSave}
                        FooterAlignIcon={FooterAlignIcon}
                        cycleFooterAlign={cycleFooterAlign}
                        user={user}
                        setSignatureModalOpen={setSignatureModalOpen}
                        isTrainingMode={isTrainingMode}
                        toggleViewMode={toggleViewMode}
                        buttonTextSize={buttonTextSize}
                        cycleButtonTextSize={cycleButtonTextSize}
                        handleLogout={handleLogout}
                        currentDbEnvironment={currentDbEnvironment}
                        dbLoading={dbLoading}
                        dbMessage={dbMessage}
                        dbError={dbError}
                        handleSwitchEnvironment={handleSwitchEnvironment}
                        DB_ENVIRONMENTS={DB_ENVIRONMENTS}
                        HelpIcon={HelpIcon}
                        onClose={() => setMeSectionOpen("")}
                        onSave={() => setMeSectionOpen("")}
                      />
                    </div>
                  )}
                  <div
                    ref={(el) => {
                      meSectionHeaderRefs.current.settings = el;
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-100 d-flex align-items-center justify-content-between px-3 py-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleMeSection("settings")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMeSection("settings");
                      }
                    }}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <CogIcon className="h-4 w-4" />
                      <span className="fw-semibold">Settings</span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4" style={{ transition: "transform 0.2s", transform: meSectionOpen === "settings" ? "rotate(180deg)" : "none" }} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {openAccordion === "general" && canAccessGeneralSettings && (
        <Panel_General
          panelStyle={generalPanelStyle}
          openAccordions={openAccordions}
          toggleAccordion={toggleAccordion}
          uiScale={uiScale}
          setUiScale={setUiScale}
          cycleUiScale={cycleUiScale}
          syncLoading={syncLoading}
          handleManualSync={handleManualSync}
          user={user}
          companyInfo={companyInfo}
          companyLoading={companyLoading}
          handleCompanyInfoChange={handleCompanyInfoChange}
          handleSaveCompanyInfo={handleSaveCompanyInfo}
          localBranding={localBranding}
          brandingLogoUploading={brandingLogoUploading}
          logoPickerOpen={logoPickerOpen}
          setLogoPickerOpen={setLogoPickerOpen}
          logoPickerLoading={logoPickerLoading}
          logoPickerError={logoPickerError}
          logoPickerDocs={logoPickerDocs}
          handleBrandingChange={handleBrandingChange}
          handleUploadBrandingLogo={handleUploadBrandingLogo}
          handleSelectLogoFromDocuments={handleSelectLogoFromDocuments}
          handleSaveBranding={handleSaveBranding}
          loadLogoPickerDocs={loadLogoPickerDocs}
          notifications={notifications}
          handleNotificationChange={handleNotificationChange}
          handleSaveNotifications={handleSaveNotifications}
          portalBranding={portalBranding}
          portalBrandingLoading={portalBrandingLoading}
          heroImageUploading={heroImageUploading}
          handlePortalBrandingChange={handlePortalBrandingChange}
          handleSavePortalBranding={handleSavePortalBranding}
          handleUploadHeroImage={handleUploadHeroImage}
          resetPortalBrandingDefaults={resetPortalBrandingDefaults}
          settingsSuccess={settingsSuccess}
          HelpIcon={HelpIcon}
          onCheckStartDatabase={handleCheckStartDatabase}
          dbCheckLoading={dbCheckLoading}
          dbCheckStatus={dbCheckStatus}
          onSave={handleSaveGeneralPanel}
          onClose={() => setOpenAccordion("")}
          saving={companyLoading || portalBrandingLoading || brandingLogoUploading}
        />
      )}

      {openAccordion === "database" && canAccessSettings && (
        <Panel_Database
          isMobile={isMobile}
          settingsPanelStyle={settingsPanelStyle}
          onClose={() => setOpenAccordion("")}
          availableTables={availableTables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          tableColumns={tableColumns}
          csvData={csvData}
          csvHeaders={csvHeaders}
          columnMapping={columnMapping}
          handleColumnMappingChange={handleColumnMappingChange}
          handleFileSelect={handleFileSelect}
          handleImport={handleImport}
          importLoading={importLoading}
          importResult={importResult}
          resetImport={resetImport}
          csvFileInputRef={csvFileInputRef}
          settingsError={settingsError}
          HelpIcon={HelpIcon}
        />
      )}

      {/* Leave Management Panel */}
      {leaveManagementOpen && (
        <div style={{ position: "fixed", bottom: `${row1PanelBottom}px`, left: 0, right: 0, maxHeight: "calc(100vh - 164px)", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", backgroundColor: "var(--bs-body-bg)", zIndex: 1000 }} className="accordion-popup">
          <div className="card border-0 rounded-0" style={{ minHeight: "200px" }}>
            <div className="card-body">
              <h6 className="card-title mb-3">Leave Management</h6>
              {leaveRequestsLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                </div>
              ) : (
                <>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <div className="bg-light rounded p-2 small">
                        <div className="fw-semibold text-primary">Vacation Days</div>
                        <div className="text-muted small mb-1">
                          {vacUsed} / {vacTotal} used
                        </div>
                        <div className="progress">
                          <div className="progress-bar bg-primary" style={{ width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%` }} />
                        </div>
                        <div className="text-muted small mt-1">{vacRemaining} remaining</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="bg-light rounded p-2 small">
                        <div className="fw-semibold text-warning">Sick Days</div>
                        <div className="text-muted small mb-1">
                          {sickUsed} / {sickTotal} used
                        </div>
                        <div className="progress">
                          <div className="progress-bar bg-warning" style={{ width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%` }} />
                        </div>
                        <div className="text-muted small mt-1">{sickRemaining} remaining</div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <h6 className="small fw-semibold mb-2">Pending Requests</h6>
                    <LeaveRequestsTable requests={sortLeaveRequestsDesc([...vacationRequests, ...sickRequests].filter((r) => r.status === "pending"))} emptyMessage="No pending requests" />
                  </div>
                  <div className="mb-3">
                    <h6 className="small fw-semibold mb-2">History</h6>
                    <LeaveRequestsTable requests={sortLeaveRequestsDesc([...vacationRequests, ...sickRequests].filter((r) => r.status !== "pending"))} emptyMessage="No leave history yet" />
                  </div>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm flex-grow-1" onClick={() => openLeaveModal()}>
                      <PlusCircleIcon className="h-4 w-4 me-1" style={{ display: "inline" }} />
                      Request
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setLeaveManagementOpen(false)}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {(canAccessSettings || canAccessGeneralSettings) && (
        <>
          {isMobile && <div className="app-footer-spacer" style={{ "--app-footer-h": `${row1Height}px` }} aria-hidden="true" />}

          {/* Footer Tabs */}
          <div
            ref={row1Ref}
            className="app-footer-search profile-footer-nav flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm"
            style={{
              zIndex: 1050,
              ...(isMobile
                ? {
                    position: "fixed",
                    bottom: "var(--keyboard-offset, 0px)",
                    left: 0,
                    right: 0,
                  }
                : null),
            }}
          >
            <div className="app-footer-padding bg-white dark:bg-gray-800">
              <div className="app-footer-stack">
                <div className="search-hide-on-focus app-footer-toolbar d-flex align-items-center w-100">
                  <div className={`d-flex align-items-center gap-1 flex-grow-1 min-w-0 ${footerJustify}`}>
                    {canAccessSettings && (
                      <Button_Toolbar
                        icon={CircleStackIcon}
                        label="Data"
                        onClick={() => setOpenAccordion(openAccordion === "database" ? "" : "database")}
                        className={`btn btn-sm ${isTrainingMode ? "ps-0 pe-1" : "p-0"} flex-shrink-0 d-flex align-items-center profile-footer-btn ${openAccordion === "database" ? "btn-primary" : "btn-outline-secondary"}`}
                        data-active={openAccordion === "database"}
                        title="Data"
                      />
                    )}
                    {canAccessGeneralSettings && (
                      <>
                        {/* don't add text to this button */}
                        <Button_Toolbar
                          icon={CogIcon}
                          label=""
                          onClick={() => setOpenAccordion(openAccordion === "general" ? "" : "general")}
                          className={`btn btn-sm p-0 flex-shrink-0 d-flex align-items-center profile-footer-btn profile-footer-general-btn ${openAccordion === "general" ? "btn-primary" : "btn-outline-secondary"}`}
                          data-active={openAccordion === "general"}
                          title="General"
                        />
                      </>
                    )}
                  </div>
                  <div className="flex-grow-1 min-w-0" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Signature Modal */}
      <Modal_Signature isOpen={signatureModalOpen} onClose={() => setSignatureModalOpen(false)} userId={user?.id} />

      {/* Request Modal */}
      {showLeaveModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLeaveModal(false);
              setLeaveError("");
            }
          }}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title mb-0">New Leave Request</h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowLeaveModal(false);
                    setLeaveError("");
                  }}
                />
              </div>
              <form onSubmit={handleLeaveSubmit}>
                <div className="modal-body py-3">
                  {leaveError && <div className="alert alert-danger py-1 small mb-2">{leaveError}</div>}
                  <div className="mb-2">
                    <label className="form-label small mb-1">Request Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={leaveModalType}
                      onChange={(e) => {
                        setLeaveModalType(e.target.value);
                        setLeaveForm({ start_date: "", end_date: "", notes: "" });
                        setLeaveError("");
                      }}
                    >
                      <option value="vacation">Vacation</option>
                      <option value="sick">Sick</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="offboarding">Offboarding</option>
                    </select>
                  </div>
                  {leaveModalType === "vacation" || leaveModalType === "sick" ? (
                    <>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Start Date</label>
                        <input type="date" className="form-control form-control-sm" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">End Date</label>
                        <input type="date" className="form-control form-control-sm" value={leaveForm.end_date} min={leaveForm.start_date || undefined} onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))} required />
                      </div>
                    </>
                  ) : (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Requested Date (optional)</label>
                      <input type="date" className="form-control form-control-sm" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} />
                    </div>
                  )}
                  <div className="mb-0">
                    <label className="form-label small mb-1">Notes (optional)</label>
                    <textarea className="form-control form-control-sm" rows="2" value={leaveForm.notes} onChange={(e) => setLeaveForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reason or additional info..." />
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setShowLeaveModal(false);
                      setLeaveError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={leaveSubmitting}>
                    {leaveSubmitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Pay Slip Detail Modal */}
      {selectedSlip && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSlip(null);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content" id="pay-slip-print-area">
              <div className="modal-header py-2">
                <h6 className="modal-title mb-0">Pay Slip</h6>
                <button type="button" className="btn-close" onClick={() => setSelectedSlip(null)} />
              </div>
              <div className="modal-body" style={{ fontSize: "0.85rem" }}>
                <div className="text-center mb-3">
                  <div className="fw-bold fs-6">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-muted small">{user?.role}</div>
                </div>
                <hr className="my-2" />
                <div className="row g-1 mb-2">
                  <div className="col-6 text-muted">Pay Period</div>
                  <div className="col-6 text-end">
                    {selectedSlip.pay_period_start ? new Date(selectedSlip.pay_period_start).toLocaleDateString() : "—"} – {selectedSlip.pay_period_end ? new Date(selectedSlip.pay_period_end).toLocaleDateString() : "—"}
                  </div>
                  <div className="col-6 text-muted">Type</div>
                  <div className="col-6 text-end" style={{ textTransform: "capitalize" }}>
                    {selectedSlip.employment_type || "—"}
                  </div>
                  {selectedSlip.employment_type === "hourly" && (
                    <>
                      <div className="col-6 text-muted">Hours</div>
                      <div className="col-6 text-end">{selectedSlip.hours_worked ?? "—"}</div>
                      <div className="col-6 text-muted">Rate</div>
                      <div className="col-6 text-end">${Number(selectedSlip.hourly_rate_snapshot ?? 0).toFixed(2)}/hr</div>
                    </>
                  )}
                  <div className="col-6 text-muted">Pay Frequency</div>
                  <div className="col-6 text-end" style={{ textTransform: "capitalize" }}>
                    {selectedSlip.pay_frequency || "—"}
                  </div>
                </div>
                <hr className="my-2" />
                <div className="row g-1">
                  <div className="col-6 text-muted">Gross Pay</div>
                  <div className="col-6 text-end">${Number(selectedSlip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  {selectedSlip.insurance_plan_name && (
                    <>
                      <div className="col-6 text-muted small">Insurance ({selectedSlip.insurance_plan_name})</div>
                      <div className="col-6 text-end text-danger small">-${Number(selectedSlip.insurance_deduction ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  {(selectedSlip.other_deductions ?? 0) > 0 && (
                    <>
                      <div className="col-6 text-muted small">Other Deductions</div>
                      <div className="col-6 text-end text-danger small">-${Number(selectedSlip.other_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  <div className="col-6 fw-bold border-top pt-1 mt-1">Net Pay</div>
                  <div className="col-6 fw-bold text-end border-top pt-1 mt-1 text-success">${Number(selectedSlip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                {selectedSlip.notes && <div className="mt-2 text-muted small">Notes: {selectedSlip.notes}</div>}
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    const el = document.getElementById("pay-slip-print-area");
                    if (el) {
                      const w = window.open("", "_blank");
                      w.document.write('<html><head><title>Pay Slip</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"></head><body class="p-3">' + el.innerHTML + "</body></html>");
                      w.document.close();
                      w.focus();
                      setTimeout(() => {
                        w.print();
                      }, 500);
                    }
                  }}
                >
                  Print
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedSlip(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
