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
 *   2026-05-26 | GitHub Copilot | Moved delete action to left table column and removed modal delete button wiring
 *   2026-07-24 | GitHub Copilot | Replaced row delete with selection-first bulk delete and paired edit/delete selected actions
 * ============================================================
 */

// ─── [1] IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useStore from "../services/useStore";
import { tierVariant } from "../utils/colorMapping";
import { S } from "../utils/strings";
import { showConfirm } from "../services/showConfirm";
import Badge from "./components/Badge";
import Dropdown_Filter from "./components/Dropdown_Filter";
import { clientsAPI, membershipsAPI, settingsAPI } from "../services/api";
import useFetchOnce from "../services/useFetchOnce";
import usePagePermission from "../services/usePagePermission";
import useViewMode from "../services/useViewMode";
import Modal from "./components/Modal";
import PageControlsModal from "./components/Page_ControlsModal";
import Form_Client from "./components/Form_Client";
import Modal_Detail_Client from "./components/Modal_ClientDetail";
import Gate_Permission from "./components/Gate_Permission";
import { PlusIcon, StarIcon, XMarkIcon, EnvelopeIcon, Cog6ToothIcon, TicketIcon, PencilIcon, CheckCircleIcon, XCircleIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./components/Button_Toolbar";
import Modal_TemplateUse from "./components/Modal_TemplateUse";
import Modal_Bulk_Import_Sheet from "./components/Modal_ImportSheet";
import Modal_MultiEdit from "./components/Modal_MultiEdit";
import PageLayout from "./components/Page_Layout";
import PageTableFooter from "./components/Page_TableFooter";
import PageTableHeader from "./components/Page_TableHeader";
import PageTableRow from "./components/Page_TableRow";
import Toggle_MultiSelectIcon from "./components/Toggle_MultiSelectIcon";

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectionMode = selectedIds.size > 0;
  const [showMultiEdit, setShowMultiEdit] = useState(false);
  const [multiSaving, setMultiSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [internalActionCounts, setInternalActionCounts] = useState({});
  const [portalActionCounts, setPortalActionCounts] = useState({});

  const multiEditFields = useMemo(() => {
    const membershipOptions = memberships
      .filter((membership) => membership.is_active !== false)
      .map((membership) => ({
        value: String(membership.id ?? membership.key),
        label: membership.name || "Unnamed Membership",
      }));

    return [
      {
        key: "membership_tier",
        label: "Membership Tier",
        type: "select",
        options: [{ value: "none", label: "None" }, ...membershipOptions],
      },
      { key: "notes", label: "Notes", type: "text", placeholder: "Add a note to all selected clients..." },
    ];
  }, [memberships]);

  const tierFilterOptions = useMemo(() => {
    const dynamic = memberships
      .filter((m) => m.is_active !== false)
      .map((membership) => ({
        value: String(membership.id),
        label: membership.name,
        description: `Shows clients subscribed to ${membership.name}.`,
      }));

    return [{ value: "all", label: "All Subscriptions", description: "Shows all clients regardless of subscription." }, { value: "none", label: "No Subscription", description: "Shows clients with no active subscriptions." }, ...dynamic];
  }, [memberships]);

  // Template modal state
  const [templateClient, setTemplateClient] = useState(null);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // ─── [3] LIFECYCLE HOOKS ────────────────────────────────────────────────────
  useFetchOnce(() => {
    // Skip the network round-trip if preloadStoreData (App.jsx) already populated
    // the store — avoids two concurrent GET /isud/clients requests on every page visit.
    if (clients.length === 0) loadClients();
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
        loadPurchaseHistoryCounts(clientsData);
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

  // Statuses that require internal staff action (red badge)
  const INTERNAL_ACTION_STATUSES = new Set(["ordered", "processing"]);
  // Statuses that require client action on the portal (yellow badge)
  const PORTAL_ACTION_STATUSES = new Set(["payment_pending", "ready_for_pickup"]);

  const loadPurchaseHistoryCounts = async (clientsList) => {
    const results = await Promise.all(
      clientsList.map(async (client) => {
        try {
          const portalRes = await clientsAPI.getPortalOrders(client.id).catch(() => ({ data: [] }));
          const orders = Array.isArray(portalRes?.data) ? portalRes.data : [];
          const internal = orders.filter((o) => INTERNAL_ACTION_STATUSES.has(o.status)).length;
          const portal = orders.filter((o) => PORTAL_ACTION_STATUSES.has(o.status)).length;
          return [client.id, internal, portal];
        } catch {
          return [client.id, 0, 0];
        }
      })
    );

    const internalCounts = {};
    const portalCounts = {};
    for (const [id, internal, portal] of results) {
      internalCounts[id] = internal;
      portalCounts[id] = portal;
    }
    setInternalActionCounts(internalCounts);
    setPortalActionCounts(portalCounts);
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
    if (!(await showConfirm("Are you sure you want to delete this client?"))) return;
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

  const handleDeleteSelectedClients = async () => {
    if (selectedIds.size === 0) return;
    if (!hasPermission("clients", "delete")) {
      setError("You do not have permission to delete clients");
      return;
    }
    if (!(await showConfirm(`Delete ${selectedIds.size} selected client${selectedIds.size !== 1 ? "s" : ""}?`))) return;

    try {
      await Promise.all([...selectedIds].map((id) => clientsAPI.delete(id)));
      await loadClients();
      if (editingClient && selectedIds.has(editingClient.id)) {
        setEditingClient(null);
        closeModal();
      }
      clearSelectionCl();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || "Failed to delete selected clients";
      setError(errorMsg);
      console.error(err);
    }
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

  const toggleSelectCl = (id) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allVisibleSelectedCl = filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));
  const handleSelectAllCl = () => {
    if (allVisibleSelectedCl) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c) => c.id)));
    }
  };
  const clearSelectionCl = () => {
    setSelectedIds(new Set());
  };

  const handleMultiEditSave = async (updates) => {
    setMultiSaving(true);
    try {
      await Promise.all([...selectedIds].map((id) => clientsAPI.update(id, updates)));
      await loadClients();
      setShowMultiEdit(false);
      clearSelectionCl();
    } catch {
      setError("Failed to update some clients");
    } finally {
      setMultiSaving(false);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const sortedAndFiltered = useMemo(() => {
    let sorted = [...filteredClients];
    if (sortColumn) {
      sorted.sort((a, b) => {
        let aVal, bVal;
        if (sortColumn === "name") {
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
        } else if (sortColumn === "email") {
          aVal = (a.email || "").toLowerCase();
          bVal = (b.email || "").toLowerCase();
        }
        if (aVal === bVal) return 0;
        const cmp = aVal < bVal ? -1 : 1;
        return sortAsc ? cmp : -cmp;
      });
    }
    return sorted;
  }, [filteredClients, sortColumn, sortAsc]);

  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && filteredClients.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredClients.length]);

  // ─── [8] RENDER ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="align-items-center d-flex justify-content-center">
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
      contentGravity="bottom"
      headerRight={
        <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex justify-content-center" title="Page Controls" onClick={() => setShowPageControls(true)}>
          <Cog6ToothIcon style={{ width: 18, height: 18 }} />
        </button>
      }
    >
      {/* Container_Scrollable rows – grow upwards from bottom (header sits above footer, like Employees) */}
      <div ref={scrollRef} className="bg-white d-flex dark:bg-gray-900 flex-column-reverse flex-grow-1 min-h-0 no-scrollbar overflow-auto" style={{ background: "var(--bs-body-bg)" }}>
        {sortedAndFiltered.length > 0 ? (
          <table className="mb-0 table table-borderless table-hover w-100">
            <colgroup>
              <col style={{ width: "56px" }} />
              <col />
              <col style={{ width: "120px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <tbody>
              {sortedAndFiltered.map((client, index) => (
                <PageTableRow key={client.id || index} onClick={() => !selectionMode && handleOpenClient(client)}>
                  <td style={{ width: "56px" }} onClick={(e) => e.stopPropagation()}>
                    <Toggle_MultiSelectIcon selected={selectedIds.has(client.id)} onToggle={() => toggleSelectCl(client.id)} title="Select client" />
                  </td>

                  {/* Name + contact */}
                  <td className="main-page-table-data" style={{ position: "relative", overflow: "visible" }}>
                    {/* Red badge — top-left, straddles left border, shown only when > 0 */}
                    {internalActionCounts[client.id] > 0 && (
                      <span
                        className="badge bg-danger rounded-circle"
                        style={{ position: "absolute", left: "-9px", top: "4px", minWidth: "18px", height: "18px", fontSize: "0.6rem", lineHeight: "18px", padding: 0, zIndex: 2, textAlign: "center" }}
                        title="Pending internal staff action"
                      >
                        {internalActionCounts[client.id]}
                      </span>
                    )}
                    {/* Yellow badge — bottom-left, straddles left border, shown only when > 0 */}
                    {portalActionCounts[client.id] > 0 && (
                      <span
                        className="badge rounded-circle"
                        style={{ position: "absolute", left: "-9px", bottom: "4px", minWidth: "18px", height: "18px", fontSize: "0.6rem", lineHeight: "18px", padding: 0, backgroundColor: "#f59e0b", zIndex: 2, textAlign: "center" }}
                        title="Pending client portal action"
                      >
                        {portalActionCounts[client.id]}
                      </span>
                    )}
                    <div className="fw-medium text-truncate">{client.name}</div>
                    <div className="small text-muted text-truncate">{client.email || client.phone || "No contact"}</div>
                  </td>

                  {/* Membership + template */}
                  <td className="main-page-table-data">
                    <div className="ui-flex-center-gap-1">
                      <Badge variant={tierVariant(client.membership_tier || "none")} pill label={getTierLabel(client)} />
                    </div>
                  </td>
                  <td className="main-page-table-data p-0 text-center">
                    <button type="button" onClick={handleOpenTemplate(client)} className="align-items-center border-0 btn btn-sm d-flex dark:hover:bg-blue-900/20 hover:bg-blue-50 justify-content-center rounded text-blue-600" title="Use template">
                      <EnvelopeIcon className="h-6 w-6" />
                    </button>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center text-muted">{S.noResults}</div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="align-items-center border-top d-flex flex-shrink-0 position-relative px-1 py-1" style={{ background: "rgba(var(--app-active-color-rgb),0.08)", borderColor: "rgba(var(--app-active-color-rgb),0.2)" }}>
          <div className="ui-flex-center-gap-2">
            <span className="fw-semibold ui-text-sm" style={{ color: "var(--app-active-color)" }}>
              {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <button type="button" className="btn btn-circle btn-primary" title="Edit selected clients" onClick={() => setShowMultiEdit(true)}>
              <PencilSquareIcon style={{ width: 14, height: 14 }} />
            </button>
            <Gate_Permission page="clients" permission="delete">
              <button type="button" className="btn btn-circle btn-outline-danger" title="Delete selected clients" onClick={handleDeleteSelectedClients}>
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            </Gate_Permission>
          </div>
          <button type="button" className="btn btn-circle btn-outline-secondary position-absolute" style={{ left: "50%", transform: "translateX(-50%)" }} title="Clear selection" onClick={clearSelectionCl}>
            <XMarkIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
      <PageTableHeader
        columns={[
          { label: <Toggle_MultiSelectIcon selected={allVisibleSelectedCl} onToggle={handleSelectAllCl} title="Select all visible clients" />, width: 56, className: "p-0 text-center" },
          { label: "Client", className: "text-start ps-0", sortKey: "name" },
          { label: "Subs", width: 120, className: "text-start ps-0", sortKey: "email" },
          { label: "Notify", width: 56, className: "text-start ps-0" },
        ]}
        sortColumn={sortColumn}
        sortAsc={sortAsc}
        onSort={handleSort}
      />

      {/* Fixed bottom – headers + controls */}
      <PageTableFooter
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search by name, email, or phone..."
        addButton={
          <Gate_Permission page="clients" permission="write">
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={handleCreateClient} className="btn-app-primary" title="Add client" />
          </Gate_Permission>
        }
      >
        <Gate_Permission page="clients" permission="write">
          <Button_Toolbar icon={PlusIcon} label="Bulk" onClick={() => setShowBulkImport(true)} className="btn-app-secondary" />
        </Gate_Permission>

        {/* Clear Filters Button */}
        {tierFilter !== "all" && <Button_Toolbar icon={XMarkIcon} label="Clear" onClick={() => setTierFilter("all")} className="btn-app-danger" title="Clear subscription filter" />}

        {/* Tier Filter */}
        <Dropdown_Filter icon={StarIcon} label="Subs" title="Filter by subscription" value={tierFilter} onChange={setTierFilter} isOpen={isTierFilterOpen} setIsOpen={setIsTierFilterOpen} activeClass={getTierFilterButtonClass()} showHelp={isTrainingMode} options={tierFilterOptions} />
      </PageTableFooter>

      {/* Client Detail Modal (for viewing/editing) */}
      <Modal_Detail_Client isOpen={isModalOpen && modalContent === "client-detail"} onClose={closeModal} client={editingClient} onUpdate={handleUpdateClient} memberships={memberships} />

      {/* Create Client Modal (bottom-sheet form) */}
      <Modal isOpen={isModalOpen && modalContent === "client-form"} onClose={closeModal} noPadding={true} fullScreen={true} contentGravity="top">
        {isModalOpen && modalContent === "client-form" && <Form_Client client={null} onSubmit={handleSubmitCreate} onCancel={closeModal} error={error} onBulkImport={handleBulkImportClients} memberships={memberships} />}
      </Modal>

      <PageControlsModal isOpen={showPageControls} onClose={() => setShowPageControls(false)} title="Client Page Controls">
        <div className="ui-small-muted">Use these controls to manage the Clients page view.</div>
        <div className="small">Subscription filter and search are available in the footer controls.</div>
        <Button_Toolbar
          icon={TicketIcon}
          label="Subs"
          onClick={() => {
            setShowPageControls(false);
            setShowMembershipManager(true);
          }}
          className="btn-primary"
          title="Manage subscriptions"
        />
      </PageControlsModal>

      <Modal
        isOpen={showMembershipManager}
        onClose={() => {
          setShowMembershipManager(false);
          resetMembershipForm();
        }}
        title="Manage Subscriptions"
        centered={true}
        contentGravity="top"
      >
        <div className="d-flex flex-column gap-3">
          <div className="border d-flex flex-column gap-2 p-0 rounded">
            <input type="text" className="form-control ui-control-sm" placeholder="Subscription name" value={membershipForm.name} onChange={(e) => setMembershipForm((p) => ({ ...p, name: e.target.value }))} />
            <textarea className="form-control ui-control-sm" placeholder="Description" value={membershipForm.description} onChange={(e) => setMembershipForm((p) => ({ ...p, description: e.target.value }))} />
            <div className="d-flex gap-2">
              <input type="number" min="0" step="0.01" className="form-control ui-control-sm" placeholder="Price" value={membershipForm.price} onChange={(e) => setMembershipForm((p) => ({ ...p, price: e.target.value }))} />
              <select className="form-select ui-control-sm" value={membershipForm.billing_frequency} onChange={(e) => setMembershipForm((p) => ({ ...p, billing_frequency: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="d-flex gap-2">
              <input type="number" min="0" className="form-control ui-control-sm" placeholder="Lock term" value={membershipForm.lock_term_count} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_count: e.target.value }))} />
              <select className="form-select ui-control-sm" value={membershipForm.lock_term_unit} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_unit: e.target.value }))}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
            <label className="align-items-center d-flex gap-2 small">
              <input type="checkbox" checked={membershipForm.is_active} onChange={(e) => setMembershipForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
            <div className="d-flex gap-2">
              <button type="button" className="align-items-center btn btn-primary btn-sm d-flex gap-2" onClick={handleSaveMembership}>
                <CheckCircleIcon className="ui-icon-4" />
                <span>{editingMembershipId ? "Update" : "Create"}</span>
              </button>
              {editingMembershipId && (
                <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2" onClick={resetMembershipForm}>
                  <XCircleIcon className="ui-icon-4" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          </div>

          <div className="d-flex flex-column gap-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {memberships.map((membership) => (
              <div key={membership.id} className="align-items-start border d-flex gap-2 justify-content-between p-0 rounded">
                <div className="small">
                  <div className="fw-semibold">{membership.name}</div>
                  <div className="text-muted">{`$${Number(membership.price || 0).toFixed(2)} / ${membership.billing_frequency || "monthly"}`}</div>
                  <div className="text-muted">{`Lock: ${membership.lock_term_count || 0} ${membership.lock_term_unit || "months"}`}</div>
                </div>
                <div className="d-flex gap-1">
                  <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-flex gap-2" onClick={() => handleEditMembership(membership)}>
                    <PencilIcon className="ui-icon-4" />
                    <span>Edit</span>
                  </button>
                  <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex gap-2" onClick={() => handleDeleteMembership(membership.id)}>
                    <XMarkIcon className="ui-icon-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
            {memberships.length === 0 && <div className="ui-small-muted">No subscriptions yet.</div>}
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
      {isTemplateOpen && templateClient && <Modal_TemplateUse page="clients" entity={templateClient} currentUser={user} settings={appSettings} onClose={handleCloseTemplate} />}

      <Modal_MultiEdit
        isOpen={showMultiEdit}
        onClose={() => setShowMultiEdit(false)}
        title={`Edit ${selectedIds.size} Client${selectedIds.size !== 1 ? "s" : ""}`}
        fields={multiEditFields}
        selectedItems={clients.filter((c) => selectedIds.has(c.id))}
        onSave={handleMultiEditSave}
        saving={multiSaving}
      />
    </PageLayout>
  );
}
