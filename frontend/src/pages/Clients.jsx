/*
 * ============================================================
 * FILE: Clients.jsx
 *
 * PURPOSE:
 *   Displays the Clients page, which lists all client records with search and
 *   membership-tier filtering. Allows authorized users to create, view, edit,
 *   and delete clients, and to open a document template mailer for any client.
 *
 * FUNCTIONAL PARTS:
 *   [1] Imports — React, routing, store, API services, and UI components
 *   [2] State & Refs — local UI state for editing, search, tier filter, and template modal
 *   [3] Lifecycle Hooks — initial data load and auto-open-create-modal on ?new=1 query param
 *   [4] Data Loading — fetches client list and app settings from the API
 *   [5] CRUD Handlers — create, open (view/edit), update, and delete client operations
 *   [6] Utility Helpers — tier badge color, tier label, and tier filter button styling
 *   [7] Filtered Client List — memoized search + tier filter derivation
 *   [8] Render — page layout with scrollable client table, footer controls, and modals
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Copilot | Added per-option help popovers for tier filter options
 * ============================================================
 */

// ─── [1] IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useStore from "../services/useStore";
import { tierVariant } from "../utils/colorMapping";
import { S } from "../utils/strings";
import Badge from "./components/Badge";
import FilterDropdown from "./components/FilterDropdown";
import { clientsAPI, membershipsAPI, settingsAPI } from "../services/api";
import useFetchOnce from "../services/useFetchOnce";
import usePagePermission from "../services/usePagePermission";
import useViewMode from "../services/useViewMode";
import Modal from "./components/Modal";
import Form_Client from "./components/Form_Client";
import Modal_Detail_Client from "./components/Modal_Client_Detail";
import Gate_Permission from "./components/Gate_Permission";
import { PlusIcon, StarIcon, XMarkIcon, EnvelopeIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./components/Button_Toolbar";
import Modal_Template_Use from "./components/Modal_Template_Use";
import Modal_Bulk_Import_Sheet from "./components/Modal_Import_Sheet";
import PageLayout from "./components/Page_Layout";
import PageTableFooter from "./components/Page_Table_Footer";
import PageTableHeader from "./components/Page_Table_Header";
import PageTableRow from "./components/Page_Table_Row";

export default function Clients() {
  // ─── [2] STATE & REFS ───────────────────────────────────────────────────────
  const { clients, setClients, addClient, updateClient, removeClient, loading, setLoading, error, setError, clearError, isModalOpen, modalContent, openModal, closeModal, hasPermission, user } = useStore();

  usePagePermission("clients");

  const [editingClient, setEditingClient] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [isTierFilterOpen, setIsTierFilterOpen] = useState(false);
  const [showPageControls, setShowPageControls] = useState(false);
  const [showMembershipManager, setShowMembershipManager] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [editingMembershipId, setEditingMembershipId] = useState(null);
  const [membershipForm, setMembershipForm] = useState({ name: "", description: "", price: 0, billing_frequency: "monthly", lock_term_count: 0, lock_term_unit: "months", is_active: true });
  const { isTrainingMode } = useViewMode();
  const scrollRef = useRef(null);

  const tierFilterOptions = useMemo(() => {
    const dynamic = memberships.filter((m) => m.is_active !== false).map((membership) => ({
      value: String(membership.id),
      label: membership.name,
      description: `Shows clients subscribed to ${membership.name}.`,
    }));

    return [
      { value: "all", label: "All Subscriptions", description: "Shows all clients regardless of subscription." },
      { value: "none", label: "No Subscription", description: "Shows clients with no active subscriptions." },
      ...dynamic,
    ];
  }, [memberships]);

  // Template modal state
  const [templateClient, setTemplateClient] = useState(null);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // ─── [3] LIFECYCLE HOOKS ────────────────────────────────────────────────────
  useFetchOnce(() => {
    loadClients();
    loadMemberships();
    settingsAPI
      .getSettings()
      .then((res) => setAppSettings(res.data))
      .catch(() => {});
  });

  // Auto-open create modal when navigated with ?new=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "1") {
      setEditingClient(null);
      openModal("client-form");
      params.delete("new");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    }
  }, [location.search]);

  // ─── [4] DATA LOADING ───────────────────────────────────────────────────────
  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await clientsAPI.getAll();
      const clientsData = response?.data ?? response;
      if (Array.isArray(clientsData)) {
        setClients(clientsData);
        clearError();
      } else {
        console.error("Invalid clients data format:", clientsData);
        setError("Invalid data format received from server");
        setClients([]);
      }
    } catch (err) {
      setError("Failed to load clients");
      console.error("Error loading clients:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMemberships = async () => {
    try {
      const response = await membershipsAPI.getAll();
      const membershipData = response?.data ?? response;
      setMemberships(Array.isArray(membershipData) ? membershipData : []);
    } catch {
      setMemberships([]);
    }
  };

  // ─── [5] CRUD HANDLERS ──────────────────────────────────────────────────────
  const handleOpenTemplate = (client) => (e) => {
    e.stopPropagation();
    setTemplateClient(client);
    setIsTemplateOpen(true);
  };

  const handleCloseTemplate = () => {
    setIsTemplateOpen(false);
    setTemplateClient(null);
  };

  const handleCreateClient = () => {
    if (!hasPermission("clients", "write")) {
      setError("You do not have permission to create clients");
      return;
    }
    setEditingClient(null);
    openModal("client-form");
  };

  const handleOpenClient = (client) => {
    setEditingClient(client);
    openModal("client-detail");
  };

  const handleDeleteClient = async (clientId) => {
    if (!hasPermission("clients", "delete")) {
      setError("You do not have permission to delete clients");
      return;
    }
    try {
      await clientsAPI.delete(clientId);
      removeClient(clientId);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || "Failed to delete client";
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleSubmitCreate = async (clientData) => {
    try {
      const response = await clientsAPI.create(clientData);
      const newClient = response?.data ?? response;
      addClient(newClient);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || "Failed to create client";
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleBulkImportClients = async (names) => {
    for (const name of names) {
      const response = await clientsAPI.create({ name });
      const newClient = response?.data ?? response;
      addClient(newClient);
    }
    closeModal();
  };

  const handleBulkImportSheet = async (records) => {
    const result = await clientsAPI.bulkImport(records);
    await loadClients();
    setShowBulkImport(false);
    clearError();
    return result;
  };

  const handleUpdateClient = async (clientId, clientData) => {
    try {
      const response = await clientsAPI.update(clientId, clientData);
      const updatedClient = response?.data ?? response;
      updateClient(clientId, updatedClient);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || "Failed to update client";
      setError(errorMsg);
      console.error(err);
    }
  };

  const resetMembershipForm = () => {
    setEditingMembershipId(null);
    setMembershipForm({ name: "", description: "", price: 0, billing_frequency: "monthly", lock_term_count: 0, lock_term_unit: "months", is_active: true });
  };

  const handleSaveMembership = async () => {
    const payload = {
      ...membershipForm,
      name: String(membershipForm.name || "").trim(),
      price: Number(membershipForm.price || 0),
      lock_term_count: Number(membershipForm.lock_term_count || 0),
    };
    if (!payload.name) return;

    if (editingMembershipId) await membershipsAPI.update(editingMembershipId, payload);
    else await membershipsAPI.create(payload);

    await loadMemberships();
    await loadClients();
    resetMembershipForm();
  };

  const handleEditMembership = (membership) => {
    setEditingMembershipId(membership.id);
    setMembershipForm({
      name: membership.name || "",
      description: membership.description || "",
      price: membership.price || 0,
      billing_frequency: membership.billing_frequency || "monthly",
      lock_term_count: membership.lock_term_count || 0,
      lock_term_unit: membership.lock_term_unit || "months",
      is_active: membership.is_active !== false,
    });
  };

  const handleDeleteMembership = async (membershipId) => {
    await membershipsAPI.delete(membershipId);
    await loadMemberships();
    await loadClients();
    if (editingMembershipId === membershipId) resetMembershipForm();
  };

  // ─── [6] UTILITY HELPERS ────────────────────────────────────────────────────
  const getTierLabel = (client) => {
    if (Array.isArray(client.membership_names) && client.membership_names.length > 0) {
      if (client.membership_names.length === 1) return client.membership_names[0];
      return `${client.membership_names[0]} +${client.membership_names.length - 1}`;
    }
    if (client.membership_tier && String(client.membership_tier).toLowerCase() !== "none") {
      const normalized = String(client.membership_tier).trim();
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
    return "None";
  };

  const getTierFilterButtonClass = () => {
    if (tierFilter === "all") return "btn-app-secondary";
    if (tierFilter === "none") return "bg-gray-500 text-white";
    return "bg-primary-600 text-white";
  };

  // ─── [7] FILTERED CLIENT LIST ───────────────────────────────────────────────
  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (client.name || "").toLowerCase().includes(term);
        const matchesEmail = (client.email || "").toLowerCase().includes(term);
        const matchesPhone = (client.phone || "").toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // Subscription filter
      if (tierFilter !== "all") {
        const clientMembershipIds = Array.isArray(client.membership_ids) ? client.membership_ids.map((id) => String(id)) : [];
        if (tierFilter === "none") {
          if (clientMembershipIds.length > 0) return false;
        } else if (!clientMembershipIds.includes(String(tierFilter))) {
          return false;
        }
      }

      return true;
    });
  }, [clients, searchTerm, tierFilter]);

  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && filteredClients.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredClients.length]);

  // ─── [8] RENDER ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "16rem" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Clients"
      error={error}
      headerRight={
        <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center" style={{ width: "3rem", height: "3rem" }} title="Page Controls" onClick={() => setShowPageControls(true)}>
          <Cog6ToothIcon style={{ width: 18, height: 18 }} />
        </button>
      }
    >
      <PageTableHeader columns={[{ label: "Client" }, { label: "Subscription", width: 120 }, { label: "Notify", width: 56 }]} />

      {/* Container_Scrollable rows – grow upwards from bottom */}
      <div ref={scrollRef} className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar" style={{ background: "var(--bs-body-bg)" }}>
        {filteredClients.length > 0 ? (
          <table className="table table-borderless table-hover mb-0 w-100">
            <colgroup>
              <col />
              <col style={{ width: "80px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <tbody>
              {filteredClients.map((client, index) => (
                <PageTableRow key={client.id || index} onClick={() => handleOpenClient(client)}>
                  {/* Name + contact */}
                  <td className="main-page-table-data">
                    <div className="fw-medium text-truncate">{client.name}</div>
                    <div className="small text-muted text-truncate">{client.email || client.phone || "No contact"}</div>
                  </td>

                  {/* Membership + template */}
                  <td className="main-page-table-data">
                    <div className="d-flex align-items-center gap-1">
                      <Badge variant={tierVariant(client.membership_tier || "none")} pill label={getTierLabel(client)} />
                    </div>
                  </td>
                  <td className="main-page-table-data p-0 text-center">
                    <button
                      type="button"
                      onClick={handleOpenTemplate(client)}
                      className="btn btn-sm border-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded d-flex align-items-center justify-content-center"
                      style={{ width: "2.5rem", height: "2.5rem", margin: "0 auto" }}
                      title="Use template"
                    >
                      <EnvelopeIcon className="h-6 w-6" />
                    </button>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">{S.noResults}</div>
        )}
      </div>

      {/* Fixed bottom – headers + controls */}
      <PageTableFooter searchTerm={searchTerm} onSearch={setSearchTerm} searchPlaceholder="Search by name, email, or phone...">
        <Gate_Permission page="clients" permission="write">
          <Button_Toolbar icon={PlusIcon} label="Add Client" onClick={handleCreateClient} className="btn-app-primary" />
          <Button_Toolbar icon={PlusIcon} label="Bulk" onClick={() => setShowBulkImport(true)} className="btn-app-secondary" />
        </Gate_Permission>

        {/* Clear Filters Button */}
        {tierFilter !== "all" && <Button_Toolbar icon={XMarkIcon} label="Clear Filter" onClick={() => setTierFilter("all")} className="btn-app-danger" />}

        {/* Tier Filter */}
        <FilterDropdown
          icon={StarIcon}
          label="Filter Subscription"
          value={tierFilter}
          onChange={setTierFilter}
          isOpen={isTierFilterOpen}
          setIsOpen={setIsTierFilterOpen}
          activeClass={getTierFilterButtonClass()}
          showHelp={isTrainingMode}
          options={tierFilterOptions}
        />
      </PageTableFooter>

      {/* Client Detail Modal (for viewing/editing) */}
      <Modal_Detail_Client isOpen={isModalOpen && modalContent === "client-detail"} onClose={closeModal} client={editingClient} onUpdate={handleUpdateClient} onDelete={handleDeleteClient} canDelete={hasPermission("clients", "delete")} memberships={memberships} />

      {/* Create Client Modal (bottom-sheet form) */}
      <Modal isOpen={isModalOpen && modalContent === "client-form"} onClose={closeModal} noPadding={true} fullScreen={true}>
        {isModalOpen && modalContent === "client-form" && <Form_Client client={null} onSubmit={handleSubmitCreate} onCancel={closeModal} error={error} onBulkImport={handleBulkImportClients} memberships={memberships} />}
      </Modal>

      <Modal isOpen={showPageControls} onClose={() => setShowPageControls(false)} title="Client Page Controls" centered={true}>
        <div className="d-flex flex-column gap-2">
          <div className="small text-muted">Use these controls to manage the Clients page view.</div>
          <div className="small">Subscription filter and search are available in the footer controls.</div>
          <div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => { setShowPageControls(false); setShowMembershipManager(true); }}>
              Manage Subscriptions
            </button>
          </div>
          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowPageControls(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showMembershipManager} onClose={() => { setShowMembershipManager(false); resetMembershipForm(); }} title="Manage Subscriptions" centered={true}>
        <div className="d-flex flex-column gap-3">
          <div className="border rounded p-2 d-flex flex-column gap-2">
            <input type="text" className="form-control form-control-sm" placeholder="Subscription name" value={membershipForm.name} onChange={(e) => setMembershipForm((p) => ({ ...p, name: e.target.value }))} />
            <textarea className="form-control form-control-sm" placeholder="Description" value={membershipForm.description} onChange={(e) => setMembershipForm((p) => ({ ...p, description: e.target.value }))} />
            <div className="d-flex gap-2">
              <input type="number" min="0" step="0.01" className="form-control form-control-sm" placeholder="Price" value={membershipForm.price} onChange={(e) => setMembershipForm((p) => ({ ...p, price: e.target.value }))} />
              <select className="form-select form-select-sm" value={membershipForm.billing_frequency} onChange={(e) => setMembershipForm((p) => ({ ...p, billing_frequency: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="d-flex gap-2">
              <input type="number" min="0" className="form-control form-control-sm" placeholder="Lock term" value={membershipForm.lock_term_count} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_count: e.target.value }))} />
              <select className="form-select form-select-sm" value={membershipForm.lock_term_unit} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_unit: e.target.value }))}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
            <label className="small d-flex align-items-center gap-2">
              <input type="checkbox" checked={membershipForm.is_active} onChange={(e) => setMembershipForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveMembership}>{editingMembershipId ? "Update" : "Create"}</button>
              {editingMembershipId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetMembershipForm}>Cancel Edit</button>}
            </div>
          </div>

          <div className="d-flex flex-column gap-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {memberships.map((membership) => (
              <div key={membership.id} className="border rounded p-2 d-flex justify-content-between align-items-start gap-2">
                <div className="small">
                  <div className="fw-semibold">{membership.name}</div>
                  <div className="text-muted">{`$${Number(membership.price || 0).toFixed(2)} / ${membership.billing_frequency || "monthly"}`}</div>
                  <div className="text-muted">{`Lock: ${membership.lock_term_count || 0} ${membership.lock_term_unit || "months"}`}</div>
                </div>
                <div className="d-flex gap-1">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleEditMembership(membership)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteMembership(membership.id)}>Delete</button>
                </div>
              </div>
            ))}
            {memberships.length === 0 && <div className="small text-muted">No subscriptions yet.</div>}
          </div>
        </div>
      </Modal>

      {/* Bulk Import Sheet Modal */}
      <Modal_Bulk_Import_Sheet
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImportSheet}
        title="Bulk Add Clients"
        entityLabel="client"
        fieldOptions={[
          { value: "name", label: "Name (required)" },
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
          { value: "address", label: "Address" },
          { value: "membership_tier", label: "Membership Tier" },
          { value: "notes", label: "Notes" },
        ]}
        defaultFieldSequence={["name", "email", "phone", "address", "membership_tier", "notes"]}
        buildRecord={(data) => {
          const errors = [];
          if (!data.name?.trim()) errors.push("Name is required.");
          const VALID_TIERS = new Set(["none", "bronze", "silver", "gold", "platinum"]);
          const tier = data.membership_tier ? String(data.membership_tier).trim().toLowerCase() : "none";
          return {
            record: errors.length
              ? null
              : {
                  name: data.name.trim(),
                  email: data.email || null,
                  phone: data.phone || null,
                  address: data.address || null,
                  notes: data.notes || null,
                  membership_tier: VALID_TIERS.has(tier) ? tier : "none",
                },
            errors,
          };
        }}
      />

      {/* Template Use Modal */}
      {isTemplateOpen && templateClient && <Modal_Template_Use page="clients" entity={templateClient} currentUser={user} settings={appSettings} onClose={handleCloseTemplate} />}
    </PageLayout>
  );
}
