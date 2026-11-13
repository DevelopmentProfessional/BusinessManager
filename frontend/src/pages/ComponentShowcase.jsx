import React, { useState, useEffect, useMemo, useCallback, Component } from "react";
import { createPortal } from "react-dom";
import useStore from "../services/useStore";
import useDarkMode from "../services/useDarkMode";
import useViewMode from "../services/useViewMode";

// ─── Heroicons for Buttons and Mock UI ──────────────────────────────────────────
import {
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  FunnelIcon,
  Squares2X2Icon,
  EyeIcon,
  UserIcon,
  ClockIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// ─── DIRECT COMPONENT REFERENCES (Original .jsx files) ─────────────────────────
// Buttons
import Button_App from "./components/Button_App";
import Button_Icon from "./components/Button_Icon";
import Button_AddMobile from "./components/Button_AddMobile";
import Button_InsuranceDocument from "./components/Button_InsuranceDocument";
import Button_Toolbar from "./components/Button_Toolbar";

// Badges
import Badge from "./components/Badge";
import Badge_Status from "./components/Badge_Status";
import Badge_PendingOrder from "./components/Badge_PendingOrder";

// Dropdowns & Selection Filters
import Dropdown_Custom from "./components/Dropdown_Custom";
import Dropdown_Filter from "./components/Dropdown_Filter";
import Dropup_ScheduleFilter from "./components/Dropup_ScheduleFilter";
import Filter_CatalogCheckboxes from "./components/Filter_CatalogCheckboxes";
import Filter_SourceToggle from "./components/Filter_SourceToggle";
import Toggle_MultiSelectIcon from "./components/Toggle_MultiSelectIcon";

// Tables & Layout Footers
import PageTableHeader from "./components/Page_TableHeader";
import PageTableFooter from "./components/Page_TableFooter";
import PageTableRow from "./components/Page_TableRow";
import TableSettingsControls from "./components/TableSettingsControls";
import Inventory_RowDetail from "./components/Inventory_RowDetail";
import Footer_Actions from "./components/Footer_Actions";
import Footer_Action from "./components/Footer_Action";
import Footer_Settings from "./components/Footer_Settings";

// Core Data Forms
import Form_Client from "./components/Form_Client";
import Form_Item from "./components/Form_Item";
import Form_Service from "./components/Form_Service";
import Form_Schedule from "./components/Form_Schedule";
import Form_Employee from "./components/Form_Employee";

// Panels
import Panel_General from "./components/Panel_General";
import Panel_Features from "./components/Panel_Features";
import Suppliers_Panel from "./components/Panel_Suppliers";
import Panel_WageHistory from "./components/Panel_WageHistory";
import Panel_Database from "./components/Panel_Database";

// Widgets & Specialized UI
import Widget_Attendance from "./components/Widget_Attendance";
import Widget_Signature from "./components/Widget_Signature";
import Chat_Employee from "./components/Chat_Employee";
import Dashboard_Financial from "./components/Dashboard_Financial";
import Chart_Report from "./components/Chart_Report";

// Modals
import Modal, { ModalContainerContext } from "./components/Modal";
import Modal_DiscountRules from "./components/Modal_DiscountRules";
import Modal_RolesManage from "./components/Modal_RolesManage";
import Modal_InsurancePlans from "./components/Modal_InsurancePlans";
import Modal_Wages from "./components/Modal_Wages";
import Modal_ClientDetail from "./components/Modal_ClientDetail";
import Modal_ItemDetail from "./components/Modal_ItemDetail";
import Modal_EmployeePay from "./components/Modal_EmployeePay";
import Modal_EmployeeRequests from "./components/Modal_EmployeeRequests";
import Modal_ForecastCalculator from "./components/Modal_ForecastCalculator";
import Modal_ColorPicker from "./components/Modal_ColorPicker";
import Modal_StartupPage from "./components/Modal_StartupPage";
import Modal_UserPermissions from "./components/Modal_UserPermissions";
import Modal_UserCreate from "./components/Modal_UserCreate";
import Modal_SettingsSchedule from "./components/Modal_SettingsSchedule";
import Modal_Signature from "./components/Modal_Signature";

// ─── ERROR BOUNDARY FOR INDIVIDUAL CARDS ─────────────────────────────────────────
class CardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.warn(`[ComponentShowcase] Error in ${this.props.componentName}:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-warning p-2 small mb-0">
          <div className="fw-semibold">Failed to render {this.props.componentName}</div>
          <div className="text-muted text-break">{this.state.error?.message || "Unknown error"}</div>
          <button
            type="button"
            className="btn btn-xs btn-outline-warning mt-2 app-compact-exempt"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry Render
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── IFRAME SANDBOX (Acts as an isolated mini-page/viewport) ──────────────────
function IFrameSandbox({ children, height = "460px" }) {
  const [mountNode, setMountNode] = useState(null);

  const handleRef = useCallback((iframe) => {
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.head.innerHTML = "";
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });

    doc.body.className = (document.body.className || "") + " bg-body text-body m-0 p-2";
    doc.body.style.overflow = "auto";
    doc.body.style.minHeight = "100%";

    setMountNode(doc.body);
  }, []);

  return (
    <iframe
      ref={handleRef}
      style={{
        width: "100%",
        height,
        border: "none",
        display: "block",
        background: "transparent",
      }}
      title="Component Frame"
    >
      {mountNode && createPortal(children, mountNode)}
    </iframe>
  );
}

// ─── CARD WRAPPER (Border + Body only, acts as a self-contained window) ──────────
function ComponentCard({ title, category, width = "480px", height = "auto", sandbox = false, children }) {
  return (
    <div
      className="card border shadow-sm bg-body flex-shrink-0"
      style={{
        width,
        minWidth: "320px",
        maxWidth: "100%",
        position: "relative",
      }}
    >
      <div className="card-body p-2 d-flex flex-column" style={height !== "auto" ? { height } : undefined}>
        <div className="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom text-muted small fw-bold flex-shrink-0">
          <span className="text-truncate">{title}</span>
          <span className="badge bg-secondary-subtle text-secondary small ms-2">{category}</span>
        </div>
        <div className="component-card-content flex-grow-1 min-h-0 overflow-auto position-relative p-1">
          <CardErrorBoundary componentName={title}>
            {sandbox ? (
              <IFrameSandbox height={height !== "auto" ? "100%" : "440px"}>
                {children}
              </IFrameSandbox>
            ) : (
              children
            )}
          </CardErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ─── PREDEFINED MOCK DATA & VARIABLES ──────────────────────────────────────────
const noop = () => {};

const mockEmployee = {
  id: "emp-001",
  username: "jdoe",
  first_name: "Jane",
  last_name: "Doe",
  email: "jane.doe@company.com",
  phone: "(555) 123-4567",
  role: "MANAGER",
  hire_date: "2024-01-15",
  is_active: true,
  reports_to: "Alex Smith",
  supervisor: "Alex Smith",
  role_id: "role-mgr",
  status_id: "status-active",
  iod_number: "IOD-9921",
  location: "Main Office - Suite 400",
  department_id: "dept-ops",
  employment_type: "salary",
  salary: 85000,
  hourly_rate: 45.0,
  pay_frequency: "biweekly",
  insurance_plan: "Gold PPO Comprehensive",
  vacation_days: 15,
  vacation_days_used: 3,
  sick_days: 10,
  sick_days_used: 1,
  signature_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};

const mockEmployeesList = [
  mockEmployee,
  {
    id: "emp-002",
    username: "asmith",
    first_name: "Alex",
    last_name: "Smith",
    email: "alex.smith@company.com",
    role: "ADMIN",
    is_active: true,
  },
  {
    id: "emp-003",
    username: "bwalker",
    first_name: "Brian",
    last_name: "Walker",
    email: "brian.walker@company.com",
    role: "EMPLOYEE",
    is_active: true,
  },
];

const mockClient = {
  id: "client-001",
  name: "Acme Corporation",
  email: "billing@acme.com",
  phone: "(555) 987-6543",
  address: "100 Innovation Way, Austin, TX 78701",
  notes: "Key enterprise client. Preferred contact via email.",
  membership_tier: "gold",
  membership_since: "2023-05-10",
  membership_expires: "2027-05-10",
  membership_points: 1250,
  membership_ids: ["gold-01"],
};

const mockClientsList = [
  mockClient,
  {
    id: "client-002",
    name: "Beta Solutions LLC",
    email: "info@betasolutions.com",
    phone: "(555) 234-5678",
    membership_tier: "silver",
  },
];

const mockItem = {
  id: "item-001",
  name: "Premium Ergonomic Office Chair",
  sku: "CHAIR-ERG-001",
  price: 299.99,
  cost: 140.0,
  description: "High-adjustability mesh office chair with lumbar support.",
  type: "PRODUCT",
  image_url: "",
  location: "Warehouse B - Shelf 12",
  min_quantity: 5,
  quantity: 24,
  reorder_quantity: 10,
  category: "Furniture",
};

const mockInventoryList = [
  mockItem,
  {
    id: "item-002",
    name: "Adjustable Standing Desk 60x30",
    sku: "DESK-ADJ-002",
    price: 499.0,
    cost: 260.0,
    type: "PRODUCT",
    quantity: 12,
    category: "Furniture",
  },
];

const mockService = {
  id: "svc-001",
  name: "Deep Tissue Physical Therapy",
  category: "Therapy",
  price: 120.0,
  duration: 60,
  description: "Targeted full-body deep tissue therapy session with certified specialist.",
  is_active: true,
  image_url: "",
};

const mockServicesList = [
  mockService,
  {
    id: "svc-002",
    name: "Consultation & Initial Assessment",
    category: "Consultation",
    price: 75.0,
    duration: 30,
  },
];

const mockAppointment = {
  id: "apt-001",
  appointment_type: "one_time",
  client_id: "client-001",
  client_name: "Acme Corporation",
  service_id: "svc-001",
  service_name: "Deep Tissue Physical Therapy",
  employee_id: "emp-001",
  employee_name: "Jane Doe",
  start_time: "2026-11-15T10:00:00",
  duration: 60,
  status: "confirmed",
  notes: "First session of quarterly corporate package.",
  is_paid: true,
};

const mockDropdownOptions = [
  { value: "option1", label: "Executive Dashboard", description: "Top-level KPI summary and forecast metrics" },
  { value: "option2", label: "Operations Detail", description: "Granular queue and workflow activity status" },
  { value: "option3", label: "Compliance & Audit", description: "Read-only audit trail and permission logs" },
  { value: "option4", label: "Billing & Invoices", description: "Outstanding receivables and payment gateways" },
];

const mockTableColumns = [
  { label: "Item Name", sortKey: "name", width: 200 },
  { label: "SKU", sortKey: "sku", width: 120 },
  { label: "Price", sortKey: "price", width: 100 },
  { label: "Stock", sortKey: "quantity", width: 80 },
  { label: "Status", width: 100 },
];

const mockPaySlips = [
  {
    id: "slip-001",
    pay_period_start: "2026-10-01",
    pay_period_end: "2026-10-15",
    gross_pay: 3269.23,
    net_pay: 2480.12,
    status: "paid",
  },
  {
    id: "slip-002",
    pay_period_start: "2026-09-16",
    pay_period_end: "2026-09-30",
    gross_pay: 3269.23,
    net_pay: 2480.12,
    status: "paid",
  },
];

const mockInsurancePlans = [
  { id: "plan-1", name: "Gold PPO Comprehensive", is_active: true, deductible: 500 },
  { id: "plan-2", name: "Silver HDHP Basic", is_active: true, deductible: 1500 },
];

const mockRoles = [
  { id: "role-admin", name: "Admin", description: "Full system administration access" },
  { id: "role-mgr", name: "Manager", description: "Team and operational management" },
  { id: "role-emp", name: "Employee", description: "Standard user access" },
];

// ─── MAIN COMPONENT SHOWCASE PAGE ───────────────────────────────────────────────
export default function ComponentShowcase() {
  const [cardSize, setCardSize] = useState("standard");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownValue, setDropdownValue] = useState("option1");
  const [multiSelectValues, setMultiSelectValues] = useState(["option1", "option2"]);

  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { isTrainingMode, toggleTrainingMode } = useViewMode();

  // Populate Zustand store with rich mock data on mount if empty
  useEffect(() => {
    const state = useStore.getState();
    if (!state.user) {
      useStore.setState({
        user: {
          id: "emp-001",
          username: "jdoe",
          first_name: "Jane",
          last_name: "Doe",
          email: "jane.doe@company.com",
          role: "ADMIN",
          is_active: true,
          startup_page: "schedule",
        },
        permissions: [
          "admin",
          "clients:read",
          "clients:write",
          "employees:read",
          "employees:write",
          "inventory:read",
          "inventory:write",
          "services:read",
          "services:write",
          "schedule:read",
          "schedule:write",
          "sales:read",
          "sales:write",
          "reports:read",
          "documents:read",
          "documents:write",
        ],
        clients: mockClientsList,
        services: mockServicesList,
        employees: mockEmployeesList,
        inventory: mockInventoryList,
        appointments: [mockAppointment],
        authReady: true,
      });
    }
  }, []);

  const CATEGORIES = [
    { id: "all", label: "All Components" },
    { id: "buttons", label: "Buttons" },
    { id: "badges", label: "Badges" },
    { id: "dropdowns", label: "Dropdowns & Filters" },
    { id: "forms", label: "Forms" },
    { id: "tables", label: "Tables & Layout" },
    { id: "panels", label: "Panels" },
    { id: "widgets", label: "Widgets & Media" },
    { id: "modals", label: "Modals" },
  ];

  // Helper to determine if a card should be visible
  const isCardVisible = (cardTitle, cardCategory) => {
    if (categoryFilter !== "all" && cardCategory.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return cardTitle.toLowerCase().includes(q) || cardCategory.toLowerCase().includes(q);
    }
    return true;
  };

  return (
    <ModalContainerContext.Provider value="inline">
      <div className="bg-light dark:bg-gray-900 min-vh-100 text-body">
        <style>{`
          .component-card-content {
            position: relative !important;
            contain: paint layout !important;
            transform: scale(1);
          }
          .component-card-content [style*="position: fixed"],
          .component-card-content [style*="position:fixed"],
          .component-card-content .fixed,
          .component-card-content .app-modal-layer,
          .component-card-content .app-modal {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            z-index: 5 !important;
          }
          .component-card-content [style*="100vw"] {
            width: 100% !important;
          }
          .component-card-content [style*="100vh"] {
            height: 100% !important;
          }
          .component-card-content .bg-opacity-75,
          .component-card-content .transition-opacity {
            display: none !important;
          }
        `}</style>
        {/* ── STICKY CONTROL TOOLBAR ── */}
        <header className="sticky-top bg-body border-bottom shadow-sm px-3 py-2 z-30">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          {/* Title & Stats */}
          <div className="d-flex align-items-center gap-2">
            <h1 className="h6 mb-0 fw-bold d-flex align-items-center gap-1">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Component Showcase
            </h1>
            <span className="badge bg-primary-subtle text-primary small">
              Live Reference (Auto-Updates)
            </span>
          </div>

          {/* Search Input */}
          <div className="d-flex align-items-center gap-1" style={{ maxWidth: "260px" }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-body border-end-0">
                <MagnifyingGlassIcon className="h-4 w-4 text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Filter components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm app-compact-exempt"
                  onClick={() => setSearchTerm("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Card Size Selector */}
          <div className="d-flex align-items-center gap-1">
            <span className="small text-muted me-1">Card Size:</span>
            {[
              { id: "compact", label: "Compact (360px)" },
              { id: "standard", label: "Standard (480px)" },
              { id: "wide", label: "Wide (620px)" },
            ].map((size) => (
              <button
                key={size.id}
                type="button"
                className={`btn btn-xs app-compact-exempt ${cardSize === size.id ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setCardSize(size.id)}
              >
                {size.label}
              </button>
            ))}
          </div>

          {/* Mode Toggles */}
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 app-compact-exempt"
              onClick={toggleDarkMode}
              title="Toggle Dark/Light Mode"
            >
              {isDarkMode ? <SunIcon className="h-4 w-4 text-warning" /> : <MoonIcon className="h-4 w-4" />}
              <span className="small">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm d-flex align-items-center gap-1 app-compact-exempt ${isTrainingMode ? "btn-info text-white" : "btn-outline-secondary"}`}
              onClick={toggleTrainingMode}
              title="Toggle Button Training Mode (Full vs Compact Labels)"
            >
              <span className="small">{isTrainingMode ? "Training On" : "Training Off"}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="d-flex flex-wrap gap-1 mt-2 pt-1 border-top">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`btn btn-xs rounded-pill app-compact-exempt ${categoryFilter === cat.id ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── THE ALL-COMPONENTS D-FLEX CONTAINER ── */}
      <main className="d-flex flex-wrap gap-3 align-items-start p-3 w-100">
        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: BUTTONS
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Button_App (Variants)", "Buttons") && (
          <ComponentCard title="Button_App.jsx (Variants)" category="Buttons" width="380px">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button_App icon={PlusIcon} label="Primary Action" variant="primary" onClick={noop} />
              <Button_App icon={CheckIcon} label="Secondary" variant="secondary" onClick={noop} />
              <Button_App icon={TrashIcon} label="Danger" variant="danger" onClick={noop} />
              <Button_App icon={XMarkIcon} label="Cancel" variant="cancel" onClick={noop} />
              <Button_App icon={PencilSquareIcon} label="Ghost Variant" variant="ghost" onClick={noop} />
              <Button_App icon={Cog6ToothIcon} label="Disabled Button" variant="primary" disabled onClick={noop} />
              <Button_App icon={ClockIcon} label="With Badge" variant="primary" badge="5" onClick={noop} />
              <Button_App icon={EyeIcon} label="Compact Mode" variant="secondary" compact onClick={noop} />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Button_Icon.jsx", "Buttons") && (
          <ComponentCard title="Button_Icon.jsx" category="Buttons" width="320px">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button_Icon icon={PlusIcon} title="Add Item" onClick={noop} />
              <Button_Icon icon={PencilSquareIcon} title="Edit Record" variant="secondary" onClick={noop} />
              <Button_Icon icon={TrashIcon} title="Delete" variant="danger" onClick={noop} />
              <Button_Icon icon={ArrowPathIcon} title="Refresh Data" variant="ghost" onClick={noop} />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Button_AddMobile.jsx", "Buttons") && (
          <ComponentCard title="Button_AddMobile.jsx" category="Buttons" width="320px">
            <div className="p-2 bg-light dark:bg-gray-800 rounded d-flex justify-content-center">
              <Button_AddMobile onClick={noop} title="Add New Transaction" />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Button_InsuranceDocument.jsx", "Buttons") && (
          <ComponentCard title="Button_InsuranceDocument.jsx" category="Buttons" width="360px">
            <div className="d-flex flex-wrap gap-2">
              <Button_InsuranceDocument planId="plan-1" onOpenViewer={noop} onOpenUpload={noop} />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Footer_Actions.jsx", "Buttons") && (
          <ComponentCard title="Footer_Actions.jsx" category="Buttons" width="440px">
            <Footer_Actions
              start={<Button_App icon={CheckIcon} label="Save" variant="primary" onClick={noop} />}
              center={<Button_App icon={XMarkIcon} label="Cancel" variant="cancel" onClick={noop} />}
              end={<Button_App icon={TrashIcon} label="Delete" variant="danger" onClick={noop} />}
            />
          </ComponentCard>
        )}

        {isCardVisible("Footer_Action.jsx", "Buttons") && (
          <ComponentCard title="Footer_Action.jsx" category="Buttons" width="380px">
            <Footer_Action
              primaryLabel="Confirm Changes"
              onPrimary={noop}
              secondaryLabel="Dismiss"
              onSecondary={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Footer_Settings.jsx", "Buttons") && (
          <ComponentCard title="Footer_Settings.jsx" category="Buttons" width="400px">
            <Footer_Settings onSave={noop} onClose={noop} saving={false} />
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: BADGES
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Badge.jsx (Variants)", "Badges") && (
          <ComponentCard title="Badge.jsx (Color Variants)" category="Badges" width="360px">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Badge variant="gray" label="Default Gray" />
              <Badge variant="green" label="Success Green" />
              <Badge variant="red" label="Danger Red" />
              <Badge variant="blue" label="Info Blue" />
              <Badge variant="yellow" label="Warning Yellow" />
              <Badge variant="purple" label="Tier Purple" />
              <Badge variant="cyan" label="Cyan Tag" />
              <Badge variant="green" pill label="Pill Variant" />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Badge_Status.jsx", "Badges") && (
          <ComponentCard title="Badge_Status.jsx" category="Badges" width="360px">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Badge_Status status="active" />
              <Badge_Status status="pending" />
              <Badge_Status status="completed" />
              <Badge_Status status="cancelled" />
              <Badge_Status status="in_progress" />
              <Badge_Status status="paid" />
              <Badge_Status status="unpaid" />
            </div>
          </ComponentCard>
        )}

        {isCardVisible("Badge_PendingOrder.jsx", "Badges") && (
          <ComponentCard title="Badge_PendingOrder.jsx" category="Badges" width="320px">
            <div className="d-flex flex-wrap gap-2">
              <Badge_PendingOrder count={3} />
              <Badge_PendingOrder count={12} />
            </div>
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: DROPDOWNS & FILTERS
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Dropdown_Custom.jsx (Single)", "Dropdowns") && (
          <ComponentCard title="Dropdown_Custom.jsx (Single Select)" category="Dropdowns" width="380px">
            <Dropdown_Custom
              label="Selected View"
              options={mockDropdownOptions}
              value={dropdownValue}
              onChange={setDropdownValue}
              placeholder="Select an option..."
            />
          </ComponentCard>
        )}

        {isCardVisible("Dropdown_Custom.jsx (Multi)", "Dropdowns") && (
          <ComponentCard title="Dropdown_Custom.jsx (Multi-Select)" category="Dropdowns" width="380px">
            <Dropdown_Custom
              label="Permissions / Roles"
              options={mockDropdownOptions}
              value={multiSelectValues}
              onChange={setMultiSelectValues}
              multiSelect={true}
              placeholder="Pick multiple..."
            />
          </ComponentCard>
        )}

        {isCardVisible("Dropdown_Filter.jsx", "Dropdowns") && (
          <ComponentCard title="Dropdown_Filter.jsx" category="Dropdowns" width="320px">
            <Dropdown_Filter
              label="Status Filter"
              options={[
                { value: "all", label: "All Records" },
                { value: "active", label: "Active Only" },
                { value: "archived", label: "Archived Only" },
              ]}
              value="active"
              onChange={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Filter_SourceToggle.jsx", "Dropdowns") && (
          <ComponentCard title="Filter_SourceToggle.jsx" category="Dropdowns" width="340px">
            <Filter_SourceToggle
              value="all"
              onChange={noop}
              options={[
                ["all", "All Items"],
                ["internal", "In-House"],
                ["vendor", "Vendor"],
              ]}
            />
          </ComponentCard>
        )}

        {isCardVisible("Filter_CatalogCheckboxes.jsx", "Dropdowns") && (
          <ComponentCard title="Filter_CatalogCheckboxes.jsx" category="Dropdowns" width="360px">
            <Filter_CatalogCheckboxes
              categories={["Furniture", "Equipment", "Supplies", "Retail Products"]}
              selected={["Furniture", "Equipment"]}
              onChange={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Toggle_MultiSelectIcon.jsx", "Dropdowns") && (
          <ComponentCard title="Toggle_MultiSelectIcon.jsx" category="Dropdowns" width="320px">
            <div className="d-flex gap-3 align-items-center">
              <Toggle_MultiSelectIcon isActive={true} onClick={noop} title="Multi-select Active" />
              <Toggle_MultiSelectIcon isActive={false} onClick={noop} title="Multi-select Inactive" />
            </div>
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: TABLES & STRUCTURAL LAYOUT
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Page_TableHeader.jsx", "Tables") && (
          <ComponentCard title="Page_TableHeader.jsx" category="Tables" width="560px">
            <PageTableHeader
              columns={mockTableColumns}
              sortColumn="name"
              sortAsc={true}
              onSort={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Page_TableFooter.jsx", "Tables") && (
          <ComponentCard title="Page_TableFooter.jsx" category="Tables" width="560px">
            <PageTableFooter
              searchTerm="Chairs"
              onSearch={noop}
              searchPlaceholder="Search inventory items..."
              addButton={<Button_App icon={PlusIcon} label="Add Item" variant="primary" onClick={noop} />}
            >
              <Button_App icon={FunnelIcon} label="Filter" variant="secondary" onClick={noop} />
              <Button_App icon={ArrowPathIcon} label="Refresh" variant="ghost" onClick={noop} />
            </PageTableFooter>
          </ComponentCard>
        )}

        {isCardVisible("Inventory_RowDetail.jsx", "Tables") && (
          <ComponentCard title="Inventory_RowDetail.jsx" category="Tables" width="440px">
            <table className="table table-borderless mb-0">
              <tbody>
                <tr>
                  <Inventory_RowDetail
                    item={mockItem}
                    featureNames={["Black Mesh", "Lumbar Support", "Adjustable Armrests"]}
                    showPrice={true}
                    showCost={true}
                    showCategory={true}
                  />
                </tr>
              </tbody>
            </table>
          </ComponentCard>
        )}

        {isCardVisible("TableSettingsControls.jsx", "Tables") && (
          <ComponentCard title="TableSettingsControls.jsx" category="Tables" width="380px">
            <TableSettingsControls
              pageKey="inventory"
              availableColumns={["sku", "price", "cost", "quantity", "location", "category"]}
            />
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: FORMS (The Big Core Forms)
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Form_Client.jsx", "Forms") && (
          <ComponentCard title="Form_Client.jsx" category="Forms" width="560px" height="520px">
            <Form_Client
              client={mockClient}
              onSubmit={noop}
              onCancel={noop}
              memberships={["Bronze", "Silver", "Gold", "Platinum"]}
            />
          </ComponentCard>
        )}

        {isCardVisible("Form_Item.jsx", "Forms") && (
          <ComponentCard title="Form_Item.jsx" category="Forms" width="560px" height="520px">
            <Form_Item
              item={mockItem}
              onSubmit={noop}
              onCancel={noop}
              existingSkus={["SKU-001", "SKU-002"]}
            />
          </ComponentCard>
        )}

        {isCardVisible("Form_Service.jsx", "Forms") && (
          <ComponentCard title="Form_Service.jsx" category="Forms" width="560px" height="520px">
            <Form_Service
              service={mockService}
              onSubmit={noop}
              onCancel={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Form_Schedule.jsx", "Forms") && (
          <ComponentCard title="Form_Schedule.jsx" category="Forms" width="560px" height="520px">
            <Form_Schedule
              appointment={mockAppointment}
              onSubmit={noop}
              onCancel={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Form_Employee.jsx", "Forms") && (
          <ComponentCard title="Form_Employee.jsx (2000+ Lines Multi-Tab)" category="Forms" width="620px" height="540px">
            <Form_Employee
              employee={mockEmployee}
              employees={mockEmployeesList}
              onSubmit={noop}
              onCancel={noop}
            />
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: PANELS
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Panel_General.jsx", "Panels") && (
          <ComponentCard title="Panel_General.jsx (Settings)" category="Panels" width="520px" height="520px">
            <Panel_General
              user={mockEmployee}
              companyInfo={{ company_name: "My Enterprise Business", phone: "(555) 000-1122" }}
              localBranding={{ companyName: "My Enterprise Business", tagline: "Management System" }}
              notifications={{ email: true, sms: false, push: true }}
              portalBranding={{ portal_title: "Client Portal" }}
              stripeSettings={{ enabled: false }}
              openAccordions={{ info: true, company: false, branding: false, notifications: false }}
              toggleAccordion={noop}
              handleBrandingChange={noop}
              handleNotificationChange={noop}
              handleCompanyInfoChange={noop}
              onSave={noop}
              onClose={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Panel_WageHistory.jsx", "Panels") && (
          <ComponentCard title="Panel_WageHistory.jsx" category="Panels" width="460px" height="520px">
            <Panel_WageHistory
              paySlips={mockPaySlips}
              paySlipsLoading={false}
              setSelectedSlip={noop}
              maxHeight="320px"
            />
          </ComponentCard>
        )}

        {isCardVisible("Panel_Features.jsx", "Panels") && (
          <ComponentCard title="Panel_Features.jsx (FeatureSection)" category="Panels" width="480px" height="520px">
            <Panel_Features
              inventoryId="item-001"
              onStockChange={noop}
              onPriceRangeChange={noop}
            />
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: WIDGETS & MEDIA
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Widget_Attendance.jsx", "Widgets") && (
          <ComponentCard title="Widget_Attendance.jsx" category="Widgets" width="380px" height="auto">
            <Widget_Attendance compact={false} />
          </ComponentCard>
        )}

        {isCardVisible("Widget_Signature.jsx", "Widgets") && (
          <ComponentCard title="Widget_Signature.jsx" category="Widgets" width="460px" height="auto">
            <Widget_Signature
              onSave={noop}
              onCancel={noop}
              width={400}
              height={140}
            />
          </ComponentCard>
        )}

        {isCardVisible("Chat_Employee.jsx", "Widgets") && (
          <ComponentCard title="Chat_Employee.jsx" category="Widgets" width="480px" height="480px" sandbox={true}>
            <Chat_Employee
              employee={mockEmployee}
              currentEmployee={mockEmployeesList[1]}
              onClose={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Dashboard_Financial.jsx", "Widgets") && (
          <ComponentCard title="Dashboard_Financial.jsx" category="Widgets" width="560px" height="520px">
            <Dashboard_Financial />
          </ComponentCard>
        )}

        {isCardVisible("Chart_Report.jsx", "Widgets") && (
          <ComponentCard title="Chart_Report.jsx" category="Widgets" width="480px" height="auto">
            <Chart_Report
              title="Monthly Sales Distribution"
              labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
              datasets={[
                {
                  label: "Revenue ($)",
                  data: [12000, 19000, 15000, 22000, 28000, 31000],
                  borderColor: "rgba(59, 130, 246, 1)",
                  backgroundColor: "rgba(59, 130, 246, 0.2)",
                },
              ]}
            />
          </ComponentCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: MODALS & DIALOGS (Contained Inline Previews)
        ═══════════════════════════════════════════════════════════════════ */}
        {isCardVisible("Modal_DiscountRules.jsx", "Modals") && (
          <ComponentCard title="Modal_DiscountRules.jsx" category="Modals" width="520px" height="520px" sandbox={true}>
            <Modal_DiscountRules isOpen={true} onClose={noop} />
          </ComponentCard>
        )}

        {isCardVisible("Modal_RolesManage.jsx", "Modals") && (
          <ComponentCard title="Modal_RolesManage.jsx" category="Modals" width="520px" height="520px" sandbox={true}>
            <Modal_RolesManage
              isOpen={true}
              onClose={noop}
              availableRoles={mockRoles}
              newRole={{ name: "", description: "" }}
              setNewRole={noop}
              editingRole={null}
              setEditingRole={noop}
              pages={["clients", "inventory", "sales", "schedule", "employees", "reports"]}
              permissions={["read", "write", "delete", "admin"]}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_InsurancePlans.jsx", "Modals") && (
          <ComponentCard title="Modal_InsurancePlans.jsx" category="Modals" width="520px" height="520px" sandbox={true}>
            <Modal_InsurancePlans
              isOpen={true}
              onClose={noop}
              insurancePlans={mockInsurancePlans}
              newPlan={{ name: "", deductible: "" }}
              setNewPlan={noop}
              editingPlan={null}
              setEditingPlan={noop}
              onSave={noop}
              onDelete={noop}
              onToggle={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_Wages.jsx", "Modals") && (
          <ComponentCard title="Modal_Wages.jsx" category="Modals" width="520px" height="520px" sandbox={true}>
            <Modal_Wages
              employees={mockEmployeesList}
              onClose={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_ClientDetail.jsx", "Modals") && (
          <ComponentCard title="Modal_ClientDetail.jsx" category="Modals" width="540px" height="520px" sandbox={true}>
            <Modal_ClientDetail
              isOpen={true}
              onClose={noop}
              client={mockClient}
              onUpdate={noop}
              onDelete={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_ItemDetail.jsx", "Modals") && (
          <ComponentCard title="Modal_ItemDetail.jsx" category="Modals" width="540px" height="520px" sandbox={true}>
            <Modal_ItemDetail
              isOpen={true}
              onClose={noop}
              item={mockItem}
              onUpdate={noop}
              onDelete={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_EmployeePay.jsx", "Modals") && (
          <ComponentCard title="Modal_EmployeePay.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_EmployeePay
              isOpen={true}
              onClose={noop}
              employee={mockEmployee}
              onSuccess={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_EmployeeRequests.jsx", "Modals") && (
          <ComponentCard title="Modal_EmployeeRequests.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_EmployeeRequests
              isOpen={true}
              onClose={noop}
              allRequests={[]}
              requestTypeFilter="all"
              setRequestTypeFilter={noop}
              requestTimeFilter="all"
              setRequestTimeFilter={noop}
              requestsLoading={false}
              employees={mockEmployeesList}
              onRequestAction={noop}
              loadRequests={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_ForecastCalculator.jsx", "Modals") && (
          <ComponentCard title="Modal_ForecastCalculator.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_ForecastCalculator
              isOpen={true}
              onClose={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_ColorPicker.jsx", "Modals") && (
          <ComponentCard title="Modal_ColorPicker.jsx" category="Modals" width="380px" height="380px" sandbox={true}>
            <Modal_ColorPicker
              isOpen={true}
              onClose={noop}
              currentColor="#3b82f6"
              onSelectColor={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_StartupPage.jsx", "Modals") && (
          <ComponentCard title="Modal_StartupPage.jsx" category="Modals" width="400px" height="380px" sandbox={true}>
            <Modal_StartupPage
              isOpen={true}
              onClose={noop}
              currentStartupPage="schedule"
              onSelectStartupPage={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_UserPermissions.jsx", "Modals") && (
          <ComponentCard title="Modal_UserPermissions.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_UserPermissions
              isOpen={true}
              onClose={noop}
              userPermissions={[
                { id: "p1", page: "clients", permission: "read", granted: true },
                { id: "p2", page: "inventory", permission: "write", granted: true },
                { id: "p3", page: "sales", permission: "delete", granted: false },
              ]}
              newPermission={{ page: "", permission: "" }}
              setNewPermission={noop}
              onCreatePermission={noop}
              onDeletePermission={noop}
              onUpdatePermission={noop}
              onScheduleWriteSelfOnlyToggle={noop}
              onScheduleWriteAllToggle={noop}
              pages={["clients", "inventory", "sales", "schedule", "employees", "reports"]}
              permissions={["read", "write", "delete", "admin"]}
              isDarkMode={false}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_UserCreate.jsx", "Modals") && (
          <ComponentCard title="Modal_UserCreate.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_UserCreate
              isOpen={true}
              onClose={noop}
              onUserCreated={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_SettingsSchedule.jsx", "Modals") && (
          <ComponentCard title="Modal_SettingsSchedule.jsx" category="Modals" width="480px" height="520px" sandbox={true}>
            <Modal_SettingsSchedule
              isOpen={true}
              onClose={noop}
            />
          </ComponentCard>
        )}

        {isCardVisible("Modal_Signature.jsx", "Modals") && (
          <ComponentCard title="Modal_Signature.jsx" category="Modals" width="480px" height="420px" sandbox={true}>
            <Modal_Signature
              isOpen={true}
              onClose={noop}
              onSave={noop}
            />
          </ComponentCard>
        )}
      </main>
    </div>
  </ModalContainerContext.Provider>
  );
}
