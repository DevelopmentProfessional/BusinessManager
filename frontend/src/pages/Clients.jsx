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
import { clientsAPI, settingsAPI } from "../services/api";
import useFetchOnce from "../services/useFetchOnce";
import usePagePermission from "../services/usePagePermission";
import useViewMode from "../services/useViewMode";
import Modal from "./components/Modal";
import Form_Client from "./components/Form_Client";
import Modal_Detail_Client from "./components/Modal_Client_Detail";
import Gate_Permission from "./components/Gate_Permission";
import { PlusIcon, StarIcon, XMarkIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
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
  const { isTrainingMode } = useViewMode();
  const scrollRef = useRef(null);

  const tierFilterOptions = [
    { value: "all",      label: "All Tiers",      description: "Shows all clients regardless of membership tier." },
    { value: "NONE",     label: "No Membership",  description: "Shows clients without any membership tier assigned." },
    { value: "BRONZE",   label: "Bronze",          description: "Shows only clients assigned to the Bronze tier." },
    { value: "SILVER",   label: "Silver",          description: "Shows only clients assigned to the Silver tier." },
    { value: "GOLD",     label: "Gold",            description: "Shows only clients assigned to the Gold tier." },
    { value: "PLATINUM", label: "Platinum",        description: "Shows only clients assigned to the Platinum tier." },
  ];

  // Template modal state
  const [templateClient, setTemplateClient] = useState(null);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // ─── [3] LIFECYCLE HOOKS ────────────────────────────────────────────────────
  useFetchOnce(() => {
    loadClients();
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

  // ─── [6] UTILITY HELPERS ────────────────────────────────────────────────────
  const getTierLabel = (tier) => {
    const labels = { NONE: "None", BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };
    return labels[(tier || "NONE").toUpperCase()] || tier || "None";
  };

  const getTierFilterButtonClass = () => {
    if (tierFilter === "all") return "btn-app-secondary";
    if (tierFilter === "PLATINUM") return "bg-purple-600 text-white";
    if (tierFilter === "GOLD") return "bg-yellow-500 text-white";
    if (tierFilter === "SILVER") return "bg-gray-400 text-white";
    if (tierFilter === "BRONZE") return "bg-orange-600 text-white";
    return "bg-gray-500 text-white"; // NONE
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

      // Tier filter
      if (tierFilter !== "all") {
        const clientTier = (client.membership_tier || "NONE").toUpperCase();
        if (clientTier !== tierFilter) return false;
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
    <PageLayout title="Clients" error={error}>
      <PageTableHeader columns={[{ label: "Client" }, { label: "Membership", width: 80 }, { label: "Notify", width: 56 }]} />

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
                      <Badge variant={tierVariant(client.membership_tier)} pill label={getTierLabel(client.membership_tier)} />
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
          label="Filter Tier"
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
      <Modal_Detail_Client isOpen={isModalOpen && modalContent === "client-detail"} onClose={closeModal} client={editingClient} onUpdate={handleUpdateClient} onDelete={handleDeleteClient} canDelete={hasPermission("clients", "delete")} />

      {/* Create Client Modal (bottom-sheet form) */}
      <Modal isOpen={isModalOpen && modalContent === "client-form"} onClose={closeModal} noPadding={true} fullScreen={true}>
        {isModalOpen && modalContent === "client-form" && <Form_Client client={null} onSubmit={handleSubmitCreate} onCancel={closeModal} error={error} onBulkImport={handleBulkImportClients} />}
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
