/*
 * ============================================================
 * FILE: Form_Service.jsx
 *
 * PURPOSE:
 *   Multi-tab create/edit form for a service record. The Details tab
 *   captures core fields (name, category, price, duration, image).
 *   When editing, additional tabs allow managing the service's linked
 *   resources, assets, employees, and locations via live API calls.
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants          — TABS array
 *   [2] State              — form fields; lookup data (inventory, employees);
 *                            relationship lists (resources, assets, employees,
 *                            locations); image state; "add row" state
 *   [3] Effects            — populate form on edit; load inventory and employee
 *                            lookups; load service relations when service.id exists
 *   [4] Derived Data       — filtered inventory sets (locationItems, resourceItems,
 *                            assetItems); linked-ID sets; name resolver helpers
 *   [5] Handlers: Core     — handleChange, handlePhotoCapture, handleSubmit
 *   [6] Handlers: Relations — add/remove/update for resources, assets, employees,
 *                            and locations; shared error-wrapping utility
 *   [7] Render: Header     — title ("Add Service" / "Edit Service")
 *   [8] Render: Details Tab — image preview/capture panel, core fields form
 *   [9] Render: Relation Tabs — Resources, Assets, Employees, Locations tabs
 *                              (each with scrollable list + sticky add row)
 *  [10] Render: Footer     — tab navigation bar (edit mode only), Cancel, and Save action buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-06-13 | GitHub Copilot | Added initialName support for global create-from-search service modal
 *   2026-07-31 | GitHub Copilot | Added editable service add-ons (name, price delta, default quantity)
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon, PlusIcon, SparklesIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import { inventoryAPI, employeesAPI, serviceRelationsAPI, serviceRecipeAPI } from "../../services/api";
import Widget_Camera from "./Widget_Camera";
import Modal_BulkImport from "./Modal_ImportBulk";
import Dropdown_Custom from "./Dropdown_Custom";
import useStore from "../../services/useStore";

// ─── 1 CONSTANTS ───────────────────────────────────────────────────────────────
const TABS = ["details", "resources", "assets", "employees", "locations"];

// ─── 2 STATE ───────────────────────────────────────────────────────────────────
export default function Form_Service({ service, initialName = "", onSubmit, onCancel, onBulkImport = null }) {
  const { openAddInventoryModal, addInventory } = useStore();
  const [createdFromSearchContext, setCreatedFromSearchContext] = useState(null); // "resource", "asset", or "location"

  const [activeTab, setActiveTab] = useState("details");

  // ── Basic form fields ────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: initialName || "",
    description: "",
    category: "",
    price: "",
    duration_minutes: "60",
    image_url: "",
  });
  const [serviceAddons, setServiceAddons] = useState([]);

  // ── Lookup data ──────────────────────────────────────────────────
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(true);

  // ── Relationship state ───────────────────────────────────────────
  const [resources, setResources] = useState([]);
  const [assets, setAssets] = useState([]);
  const [svcEmployees, setSvcEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [relLoading, setRelLoading] = useState(false);

  // ── Image state ──────────────────────────────────────────────────
  const [addImageMode, setAddImageMode] = useState(null); // null | 'url' | 'camera'
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState(null);

  // ── Recipe state ─────────────────────────────────────────────────
  const [recipe, setRecipe] = useState(null); // null = not loaded or doesn't exist yet

  // ── "Add" row state ──────────────────────────────────────────────
  const [newResource, setNewResource] = useState({ inventory_id: "", quantity: "1", consumption_rate_pct: "" });
  const [newAsset, setNewAsset] = useState({ inventory_id: "" });
  const [newEmployee, setNewEmployee] = useState({ user_id: "" });
  const [newLocation, setNewLocation] = useState({ inventory_id: "" });
  const [tabError, setTabError] = useState("");
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // ─── 3 EFFECTS ───────────────────────────────────────────────────────────────
  // Populate form when editing
  useEffect(() => {
    if (service) {
      let parsedAddons = [];
      try {
        const raw = service.addons_json;
        const decoded = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(decoded)) {
          parsedAddons = decoded.map((addon, index) => ({
            id: addon?.id || `addon-${index + 1}`,
            name: String(addon?.name || ""),
            price_delta: Number(addon?.price_delta || 0),
            default_quantity: Math.max(0, parseInt(addon?.default_quantity ?? 0, 10) || 0),
            linked_inventory_id: addon?.linked_inventory_id || "",
            consume_quantity_per_unit: Math.max(0, Number(addon?.consume_quantity_per_unit || 0)),
            is_billable: addon?.is_billable !== false,
            consume_inventory: Boolean(addon?.consume_inventory),
          }));
        }
      } catch {
        parsedAddons = [];
      }
      setFormData({
        name: service.name || "",
        description: service.description || "",
        category: service.category || "",
        price: service.price?.toString() || "",
        duration_minutes: service.duration_minutes?.toString() || "60",
        image_url: service.image_url || "",
      });
      setServiceAddons(parsedAddons);
    } else {
      setServiceAddons([]);
    }
  }, [service]);

  useEffect(() => {
    if (!service && initialName) {
      setFormData((prev) => ({ ...prev, name: initialName }));
    }
  }, [service, initialName]);

  // Load lookups once
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [invRes, empRes] = await Promise.all([inventoryAPI.getAll(), employeesAPI.getAll()]);
        if (!cancelled) {
          setInventory(invRes?.data ?? invRes ?? []);
          setEmployees(empRes?.data ?? empRes ?? []);
        }
      } catch (err) {
        console.error("Form_Service: failed to load lookups", err);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load relations when service id is available
  useEffect(() => {
    if (!service?.id) return;
    let cancelled = false;
    const load = async () => {
      setRelLoading(true);
      try {
        const [resRes, assRes, empRes, locRes, recRes] = await Promise.all([serviceRelationsAPI.getResources(service.id), serviceRelationsAPI.getAssets(service.id), serviceRelationsAPI.getEmployees(service.id), serviceRelationsAPI.getLocations(service.id), serviceRecipeAPI.get(service.id)]);
        if (!cancelled) {
          setResources(resRes?.data ?? resRes ?? []);
          setAssets(assRes?.data ?? assRes ?? []);
          setSvcEmployees(empRes?.data ?? empRes ?? []);
          setLocations(locRes?.data ?? locRes ?? []);
          const recipeList = recRes?.data ?? recRes ?? [];
          setRecipe(Array.isArray(recipeList) && recipeList.length > 0 ? recipeList[0] : null);
        }
      } catch (err) {
        console.error("Form_Service: failed to load relations", err);
      } finally {
        if (!cancelled) setRelLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [service?.id]);

  // ── Derived data ─────────────────────────────────────────────────
  const locationItems = inventory.filter((i) => i.type === "location");
  const resourceItems = inventory.filter((i) => ["resource", "product", "item"].includes(i.type));
  const assetItems = inventory.filter((i) => i.type === "asset");

  const linkedResourceIds = new Set(resources.map((r) => r.inventory_id));
  const linkedAssetIds = new Set(assets.map((a) => a.inventory_id));
  const linkedEmployeeIds = new Set(svcEmployees.map((e) => e.user_id));
  const linkedLocationIds = new Set(locations.map((l) => l.inventory_id));

  const inventoryName = (id) => inventory.find((i) => i.id === id)?.name ?? "—";
  const employeeName = (id) => {
    const e = employees.find((e) => e.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };
  const employeeColor = (id) => employees.find((e) => e.id === id)?.color ?? "#6b7280";

  // ── Handlers ─────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoCapture = (blob) => {
    setIsCameraOpen(false);
    setAddImageMode(null);
    if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
    setPendingPhoto(blob);
    const url = URL.createObjectURL(blob);
    setPendingPhotoUrl(url);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedAddons = serviceAddons
      .map((addon, index) => ({
        id: addon.id || `addon-${index + 1}`,
        name: String(addon.name || "").trim(),
        price_delta: Number(addon.price_delta || 0),
        default_quantity: Math.max(0, parseInt(addon.default_quantity ?? 0, 10) || 0),
        linked_inventory_id: addon.linked_inventory_id || null,
        consume_quantity_per_unit: Math.max(0, Number(addon.consume_quantity_per_unit || 0)),
        is_billable: addon.is_billable !== false,
        consume_inventory: Boolean(addon.consume_inventory),
      }))
      .filter((addon) => addon.name.length > 0);

    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      duration_minutes: parseInt(formData.duration_minutes),
      addons_json: cleanedAddons.length > 0 ? JSON.stringify(cleanedAddons) : null,
    };
    if (!submitData.image_url) delete submitData.image_url;
    if (!submitData.category) delete submitData.category;
    onSubmit(submitData, pendingPhoto || null);
  };

  const wrap = async (fn) => {
    setTabError("");
    try {
      await fn();
    } catch (err) {
      setTabError(err?.response?.data?.detail || err?.message || "Operation failed");
    }
  };

  const addServiceAddonRow = () => {
    setServiceAddons((prev) => [...prev, { id: `addon-${Date.now()}`, name: "", price_delta: 0, default_quantity: 0, linked_inventory_id: "", consume_quantity_per_unit: 0, is_billable: true, consume_inventory: false }]);
  };

  const updateServiceAddonRow = (index, field, value) => {
    setServiceAddons((prev) =>
      prev.map((addon, rowIndex) => {
        if (rowIndex !== index) return addon;
        if (field === "price_delta") return { ...addon, price_delta: Number(value || 0) };
        if (field === "default_quantity") return { ...addon, default_quantity: Math.max(0, parseInt(value || 0, 10) || 0) };
        if (field === "consume_quantity_per_unit") return { ...addon, consume_quantity_per_unit: Math.max(0, Number(value || 0)) };
        if (field === "is_billable") return { ...addon, is_billable: Boolean(value) };
        if (field === "consume_inventory") return { ...addon, consume_inventory: Boolean(value) };
        return { ...addon, [field]: value };
      })
    );
  };

  const removeServiceAddonRow = (index) => {
    setServiceAddons((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  // ── Create-from-search handlers ──────────────────────────────────
  const handleCreateInventoryFromSearch = (context) => (searchText) => {
    setCreatedFromSearchContext(context);
    openAddInventoryModal((newItem) => {
      // Auto-select and add the created inventory to the appropriate context
      if (context === "resource") {
        setNewResource((prev) => ({ ...prev, inventory_id: newItem.id }));
        // Re-fetch inventory to get fresh data
        inventoryAPI.getAll().then((res) => setInventory(res?.data ?? res ?? []));
      } else if (context === "asset") {
        setNewAsset((prev) => ({ ...prev, inventory_id: newItem.id }));
        inventoryAPI.getAll().then((res) => setInventory(res?.data ?? res ?? []));
      } else if (context === "location") {
        setNewLocation((prev) => ({ ...prev, inventory_id: newItem.id }));
        inventoryAPI.getAll().then((res) => setInventory(res?.data ?? res ?? []));
      }
      setCreatedFromSearchContext(null);
    }, searchText);
  };

  const handleAddResource = () =>
    wrap(async () => {
      if (!newResource.inventory_id) {
        setTabError("Select an item first");
        return;
      }
      const rate = newResource.consumption_rate_pct !== "" ? parseFloat(newResource.consumption_rate_pct) : null;
      const res = await serviceRelationsAPI.addResource(service.id, newResource.inventory_id, parseFloat(newResource.quantity) || 1, rate);
      setResources((prev) => [...prev, res.data]);
      setNewResource({ inventory_id: "", quantity: "1", consumption_rate_pct: "" });
    });
  const handleRemoveResource = (id) =>
    wrap(async () => {
      await serviceRelationsAPI.removeResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    });
  const handleUpdateResourceQty = async (id, quantity) => {
    try {
      await serviceRelationsAPI.updateResource(id, parseFloat(quantity) || 1);
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: parseFloat(quantity) || 1 } : r)));
    } catch (err) {
      console.error("Failed to update quantity", err);
    }
  };
  const handleUpdateResourceRate = async (id, rate) => {
    try {
      const val = rate !== "" ? parseFloat(rate) : null;
      await serviceRelationsAPI.updateResourceRate(id, val);
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, consumption_rate_pct: val } : r)));
    } catch (err) {
      console.error("Failed to update consumption rate", err);
    }
  };

  // ── Recipe handlers ───────────────────────────────────────────────
  const handleRecipeToggle = async (isProduced) => {
    if (!service?.id) return;
    try {
      if (!recipe) {
        const res = await serviceRecipeAPI.create({ service_id: service.id, is_produced: isProduced, batch_size: 1 });
        setRecipe(res.data);
      } else {
        const res = await serviceRecipeAPI.update(recipe.id, { is_produced: isProduced });
        setRecipe(res.data);
      }
    } catch (err) {
      console.error("Failed to update recipe toggle", err);
    }
  };

  const handleRecipeField = async (field, value) => {
    if (!service?.id) return;
    try {
      const parsed = field === "batch_size" ? parseInt(value) || 1 : parseFloat(value) || null;
      if (!recipe) {
        const res = await serviceRecipeAPI.create({ service_id: service.id, is_produced: false, batch_size: 1, [field]: parsed });
        setRecipe(res.data);
      } else {
        const res = await serviceRecipeAPI.update(recipe.id, { [field]: parsed });
        setRecipe(res.data);
      }
    } catch (err) {
      console.error("Failed to update recipe field", err);
    }
  };

  const handleUpdateAssetDuration = async (id, durationMinutes) => {
    try {
      const val = durationMinutes !== "" ? parseFloat(durationMinutes) : null;
      await serviceRelationsAPI.updateAssetDuration(id, val);
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, asset_duration_minutes: val } : a)));
    } catch (err) {
      console.error("Failed to update asset duration", err);
    }
  };

  const handleAddAsset = () =>
    wrap(async () => {
      if (!newAsset.inventory_id) {
        setTabError("Select an asset first");
        return;
      }
      const res = await serviceRelationsAPI.addAsset(service.id, newAsset.inventory_id);
      setAssets((prev) => [...prev, res.data]);
      setNewAsset({ inventory_id: "" });
    });
  const handleRemoveAsset = (id) =>
    wrap(async () => {
      await serviceRelationsAPI.removeAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    });

  const handleAddEmployee = () =>
    wrap(async () => {
      if (!newEmployee.user_id) {
        setTabError("Select an employee first");
        return;
      }
      const res = await serviceRelationsAPI.addEmployee(service.id, newEmployee.user_id);
      setSvcEmployees((prev) => [...prev, res.data]);
      setNewEmployee({ user_id: "" });
    });
  const handleRemoveEmployee = (id) =>
    wrap(async () => {
      await serviceRelationsAPI.removeEmployee(id);
      setSvcEmployees((prev) => prev.filter((e) => e.id !== id));
    });

  const handleAddLocation = () =>
    wrap(async () => {
      if (!newLocation.inventory_id) {
        setTabError("Select a location first");
        return;
      }
      const res = await serviceRelationsAPI.addLocation(service.id, newLocation.inventory_id);
      setLocations((prev) => [...prev, res.data]);
      setNewLocation({ inventory_id: "" });
    });
  const handleRemoveLocation = (id) =>
    wrap(async () => {
      await serviceRelationsAPI.removeLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
    });

  // ── Layout: flex column filling the modal body ───────────────────
  return (
    <div className="ui-page-shell">
      {/* Header */}
      <div className="align-items-center bg-white border-bottom border-gray-200 d-flex dark:bg-gray-900 dark:border-gray-700 flex-shrink-0 justify-content-between p-0">
        <h6 className="ui-heading-strong">{service ? "Edit Service" : "Add Service"}</h6>
        {!service && onBulkImport && (
          <button type="button" title="Bulk Import" onClick={() => setIsBulkImportOpen(true)} className="btn btn-sm dark:text-gray-400 p-1 text-gray-500" style={{ lineHeight: 1 }}>
            <ArrowUpTrayIcon style={{ width: 18, height: 18 }} />
          </button>
        )}
      </div>

      {isBulkImportOpen && (
        <Modal_BulkImport
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          entityLabel="Services"
          onImport={async (rows) => {
            await onBulkImport(rows.map((r) => r.name));
            setIsBulkImportOpen(false);
          }}
        />
      )}

      {/* Camera modal */}
      {isCameraOpen && <Widget_Camera onCapture={handlePhotoCapture} onClose={() => setIsCameraOpen(false)} />}

      {/* ── Tab content area – no scroll here, each tab manages its own ── */}
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        {/* Tab error */}
        {tabError && <div className="alert alert-danger flex-shrink-0 mb-0 mt-2 mx-3 px-0 py-1 small">{tabError}</div>}

        {/* ── Details ── */}
        {activeTab === "details" && (
          <div className="bg-white dark:bg-gray-900 dark:text-gray-100 flex-grow-1 min-h-0 no-scrollbar overflow-auto text-gray-900">
            <div className="d-flex flex-column px-1" style={{ minHeight: "100%", justifyContent: "flex-end" }}>
              <form id="service-details-form" onSubmit={handleSubmit}>
                {/* Top Section: Image (left) + Core fields (right) */}
                <div className="d-flex gap-3 mb-2" style={{ minHeight: "180px" }}>
                  {/* Image area */}
                  <div className="flex-shrink-0" style={{ width: "45%" }}>
                    {/* Preview */}
                    <div className="ui-pos-rel" style={{ borderRadius: "8px", overflow: "hidden", background: "var(--bs-secondary-bg)", width: "100%", aspectRatio: "1" }}>
                      {pendingPhotoUrl ? (
                        <img src={pendingPhotoUrl} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : formData.image_url ? (
                        <img
                          src={formData.image_url}
                          alt={formData.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", color: "#adb5bd", position: "absolute", top: 0, left: 0 }}>
                          <SparklesIcon className="h-16 w-16" />
                        </div>
                      )}
                    </div>
                    {/* Camera button */}
                    <div className="align-items-center d-flex gap-1 mt-1">
                      {addImageMode === null && (
                        <button type="button" onClick={() => setAddImageMode("camera")} className="align-items-center btn btn-outline-secondary d-flex flex-shrink-0 justify-content-center" title="Add photo">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z" />
                            <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Camera/URL panel */}
                    {addImageMode !== null && (
                      <div className="bg-light border dark:bg-gray-800 dark:border-gray-700 mt-1 p-0 rounded">
                        <div className="align-items-center d-flex gap-2 mb-2">
                          <div className="btn-group btn-group-sm">
                            <button type="button" className={`btn ${addImageMode === "camera" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setAddImageMode("camera")} style={{ fontSize: "0.72rem", padding: "2px 10px" }}>
                              Camera
                            </button>
                            <button type="button" className={`btn ${addImageMode === "url" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setAddImageMode("url")} style={{ fontSize: "0.72rem", padding: "2px 10px" }}>
                              URL
                            </button>
                          </div>
                          <button type="button" onClick={() => setAddImageMode(null)} className="btn btn-link btn-sm ms-auto p-0" style={{ fontSize: "0.75rem", color: "#6c757d", lineHeight: 1 }}>
                            ✕
                          </button>
                        </div>
                        {addImageMode === "camera" && (
                          <button type="button" onClick={() => setIsCameraOpen(true)} className="align-items-center btn btn-outline-primary btn-sm d-flex gap-1" style={{ fontSize: "0.8rem" }}>
                            {pendingPhotoUrl ? "Retake" : "Cam"}
                          </button>
                        )}
                        {addImageMode === "url" && (
                          <div className="d-flex gap-1">
                            <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} onKeyDown={(e) => e.key === "Enter" && setAddImageMode(null)} placeholder="https://..." className="form-control ui-control-sm" style={{ fontSize: "0.8rem" }} />
                            <button type="button" onClick={() => setAddImageMode(null)} className="btn btn-primary btn-sm flex-shrink-0">
                              OK
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Core fields on the right */}
                  <div className="d-flex flex-column flex-grow-1 gap-1">
                    <div className="form-floating">
                      <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} className="form-control ui-control-sm" placeholder="Service Name" />
                      <label htmlFor="name">Name *</label>
                    </div>
                    <div className="form-floating">
                      <input type="text" id="category" name="category" value={formData.category} onChange={handleChange} className="form-control ui-control-sm" placeholder="Category" />
                      <label htmlFor="category">Category</label>
                    </div>
                    <div className="form-floating">
                      <input type="number" id="price" name="price" required min="0" step="0.01" value={formData.price} onChange={handleChange} className="form-control ui-control-sm" placeholder="0.00" />
                      <label htmlFor="price">Price *</label>
                    </div>
                    <div className="form-floating">
                      <input type="number" id="duration_minutes" name="duration_minutes" required min="1" value={formData.duration_minutes} onChange={handleChange} className="form-control ui-control-sm" placeholder="60" />
                      <label htmlFor="duration_minutes">Duration (min) *</label>
                    </div>
                  </div>
                </div>

                {/* Description at the bottom */}
                <div className="form-floating ui-form-floating-mb2">
                  <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="border-0 form-control form-control-sm" placeholder="Description" />
                  <label htmlFor="description">Description</label>
                </div>

                <div className="border mb-3 rounded" style={{ fontSize: "0.85rem" }}>
                  <div className="align-items-center bg-light border-bottom d-flex dark:bg-gray-800 justify-content-between px-1 py-0 rounded-top">
                    <span className="dark:text-gray-200 fw-semibold text-gray-800">Service Add-ons</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addServiceAddonRow}>
                      <PlusIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div className="p-1">
                    {serviceAddons.length === 0 ? (
                      <div className="fst-italic small text-muted">No add-ons yet. Add items like broken nail repair or extra sauce.</div>
                    ) : (
                      <table className="mb-0 table table-sm">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th style={{ width: 96 }}>Price +/-</th>
                            <th style={{ width: 88 }}>Default Qty</th>
                            <th style={{ width: 170 }}>Linked Resource</th>
                            <th style={{ width: 110 }}>Consume / svc</th>
                            <th style={{ width: 86 }}>Billable</th>
                            <th style={{ width: 86 }}>Consume</th>
                            <th style={{ width: 52 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {serviceAddons.map((addon, index) => (
                            <tr key={addon.id || index} className="align-middle">
                              <td>
                                <input type="text" className="form-control ui-control-sm" value={addon.name} onChange={(e) => updateServiceAddonRow(index, "name", e.target.value)} placeholder="e.g. Broken nail" />
                              </td>
                              <td>
                                <input type="number" step="0.01" className="form-control ui-control-sm" value={addon.price_delta} onChange={(e) => updateServiceAddonRow(index, "price_delta", e.target.value)} />
                              </td>
                              <td>
                                <input type="number" min="0" step="1" className="form-control ui-control-sm" value={addon.default_quantity} onChange={(e) => updateServiceAddonRow(index, "default_quantity", e.target.value)} />
                              </td>
                              <td>
                                <select className="form-select ui-control-sm" value={addon.linked_inventory_id || ""} onChange={(e) => updateServiceAddonRow(index, "linked_inventory_id", e.target.value)}>
                                  <option value="">None</option>
                                  {resourceItems.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                      {inv.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input type="number" min="0" step="0.01" className="form-control ui-control-sm" value={addon.consume_quantity_per_unit || 0} onChange={(e) => updateServiceAddonRow(index, "consume_quantity_per_unit", e.target.value)} />
                              </td>
                              <td className="text-center">
                                <input type="checkbox" checked={addon.is_billable !== false} onChange={(e) => updateServiceAddonRow(index, "is_billable", e.target.checked)} />
                              </td>
                              <td className="text-center">
                                <input type="checkbox" checked={Boolean(addon.consume_inventory)} onChange={(e) => updateServiceAddonRow(index, "consume_inventory", e.target.checked)} />
                              </td>
                              <td>
                                <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex justify-content-center" onClick={() => removeServiceAddonRow(index)}>
                                  <XMarkIcon style={{ width: 16, height: 16 }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </form>

              {/* ── Recipe Section (edit mode only) ── */}
              {service?.id && (
                <div className="border mb-3 rounded" style={{ fontSize: "0.85rem" }}>
                  {/* Toggle header */}
                  <div className="align-items-center bg-light border-bottom d-flex dark:bg-gray-800 justify-content-between px-1 py-0 rounded-top">
                    <span className="dark:text-gray-200 fw-semibold text-gray-800">Recipe / Production</span>
                    <div className="form-check form-switch mb-0">
                      <input className="form-check-input" type="checkbox" id="recipe-toggle" checked={recipe?.is_produced ?? false} onChange={(e) => handleRecipeToggle(e.target.checked)} />
                      <label className="form-check-label small text-muted" htmlFor="recipe-toggle">
                        {recipe?.is_produced ? "Manufactured" : "Purchased / Delivered"}
                      </label>
                    </div>
                  </div>

                  {recipe?.is_produced && (
                    <div className="pb-1 pt-0 px-1">
                      {/* Batch fields */}
                      <div className="d-flex gap-2 mb-3">
                        <div className="flex-grow-1">
                          <label className="form-label mb-1 small text-muted">Batch Size (units)</label>
                          <input type="number" min="1" step="1" className="form-control ui-control-sm" defaultValue={recipe?.batch_size ?? 1} onBlur={(e) => handleRecipeField("batch_size", e.target.value)} />
                        </div>
                        <div className="flex-grow-1">
                          <label className="form-label mb-1 small text-muted">Batch Duration (min)</label>
                          <input type="number" min="0" step="1" className="form-control ui-control-sm" defaultValue={recipe?.batch_duration_minutes ?? ""} placeholder="—" onBlur={(e) => handleRecipeField("batch_duration_minutes", e.target.value)} />
                        </div>
                      </div>

                      {/* Resources consumed */}
                      <div className="mb-2">
                        <div className="fw-semibold mb-1 small text-muted">Resources consumed per batch</div>
                        {resources.length === 0 ? (
                          <div className="fst-italic small text-muted">No resources linked — add them in the Resources tab.</div>
                        ) : (
                          <table className="mb-0 table table-sm" style={{ fontSize: "0.8rem" }}>
                            <thead>
                              <tr>
                                <th>Resource</th>
                                <th style={{ width: 80 }}>Qty / batch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resources.map((r) => (
                                <tr key={r.id} className="align-middle">
                                  <td className="text-truncate" style={{ maxWidth: 160 }}>
                                    {inventoryName(r.inventory_id)}
                                  </td>
                                  <td>
                                    <input type="number" min="0" step="0.01" className="form-control ui-control-sm" defaultValue={r.quantity} onBlur={(e) => handleUpdateResourceQty(r.id, e.target.value)} style={{ width: 72 }} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Assets used */}
                      <div>
                        <div className="fw-semibold mb-1 small text-muted">Assets used per batch</div>
                        {assets.length === 0 ? (
                          <div className="fst-italic small text-muted">No assets linked — add them in the Assets tab.</div>
                        ) : (
                          <table className="mb-0 table table-sm" style={{ fontSize: "0.8rem" }}>
                            <thead>
                              <tr>
                                <th>Asset</th>
                                <th style={{ width: 96 }}>Duration (min)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assets.map((a) => (
                                <tr key={a.id} className="align-middle">
                                  <td className="text-truncate" style={{ maxWidth: 160 }}>
                                    {inventoryName(a.inventory_id)}
                                  </td>
                                  <td>
                                    <input type="number" min="0" step="1" className="form-control ui-control-sm" defaultValue={a.asset_duration_minutes ?? ""} placeholder="—" onBlur={(e) => handleUpdateAssetDuration(a.id, e.target.value)} style={{ width: 80 }} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Resources ── */}
        {activeTab === "resources" && service && (
          <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 overflow-hidden text-gray-900">
            {/* Scrollable list - top-aligned for form-style editing */}
            <div className="d-flex flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-0 px-1">
              {relLoading ? (
                <div className="py-1 text-center">
                  <div className="spinner-border spinner-border-sm" />
                </div>
              ) : resources.length === 0 ? (
                <div className="fst-italic py-0 small text-muted">No resources linked yet.</div>
              ) : (
                <table className="mb-0 table table-sm">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}></th>
                      <th>Item</th>
                      <th style={{ width: 80 }}>Qty</th>
                      <th style={{ width: 88 }}>Rate %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr key={r.id} className="align-middle">
                        <td>
                          <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex justify-content-center" onClick={() => handleRemoveResource(r.id)}>
                            <XMarkIcon style={{ width: 18, height: 18 }} />
                          </button>
                        </td>
                        <td className="text-truncate" style={{ maxWidth: 140 }}>
                          {inventoryName(r.inventory_id)}
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" className="form-control ui-control-sm" defaultValue={r.quantity} onBlur={(e) => handleUpdateResourceQty(r.id, e.target.value)} style={{ width: 72 }} />
                        </td>
                        <td>
                          <input type="number" min="0" max="100" step="0.1" className="form-control ui-control-sm" defaultValue={r.consumption_rate_pct ?? ""} onBlur={(e) => handleUpdateResourceRate(r.id, e.target.value)} placeholder="—" style={{ width: 72 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Sticky add row */}
            <div className="border-gray-200 border-top dark:border-gray-700 flex-shrink-0 px-1 py-0">
              <div className="ui-flex-center-gap-2">
                <Dropdown_Custom
                  name="inventory_id"
                  value={newResource.inventory_id}
                  onChange={(e) => setNewResource((prev) => ({ ...prev, inventory_id: e.target.value }))}
                  options={resourceItems.filter((i) => !linkedResourceIds.has(i.id)).map((i) => ({ value: i.id, label: i.name }))}
                  placeholder="Select item"
                  searchable
                  footerSearch
                  onCreateFromSearch={handleCreateInventoryFromSearch("resource")}
                  createButtonTitle="Add item"
                  className="flex-grow-1"
                />
                <input type="number" min="0.01" step="0.01" className="form-control ui-control-sm" style={{ width: 64 }} value={newResource.quantity} onChange={(e) => setNewResource((prev) => ({ ...prev, quantity: e.target.value }))} placeholder="Qty" />
                <input type="number" min="0" max="100" step="0.1" className="form-control ui-control-sm" style={{ width: 72 }} value={newResource.consumption_rate_pct} onChange={(e) => setNewResource((prev) => ({ ...prev, consumption_rate_pct: e.target.value }))} placeholder="Rate %" />
                <button type="button" className="align-items-center btn btn-primary btn-sm d-flex justify-content-center" onClick={handleAddResource}>
                  <PlusIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Assets ── */}
        {activeTab === "assets" && service && (
          <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 overflow-hidden text-gray-900">
            {/* Scrollable list - top-aligned for form-style editing */}
            <div className="d-flex flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-0 px-1">
              {relLoading ? (
                <div className="py-1 text-center">
                  <div className="spinner-border spinner-border-sm" />
                </div>
              ) : assets.length === 0 ? (
                <div className="fst-italic py-0 small text-muted">No assets linked yet.</div>
              ) : (
                <table className="mb-0 table table-sm">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}></th>
                      <th>Asset</th>
                      <th style={{ width: 96 }}>Duration (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="align-middle">
                        <td>
                          <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex justify-content-center" onClick={() => handleRemoveAsset(a.id)}>
                            <XMarkIcon style={{ width: 18, height: 18 }} />
                          </button>
                        </td>
                        <td className="text-truncate" style={{ maxWidth: 140 }}>
                          {inventoryName(a.inventory_id)}
                        </td>
                        <td>
                          <input type="number" min="0" step="1" className="form-control ui-control-sm" defaultValue={a.asset_duration_minutes ?? ""} onBlur={(e) => handleUpdateAssetDuration(a.id, e.target.value)} placeholder="—" style={{ width: 80 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Sticky add row */}
            <div className="border-gray-200 border-top dark:border-gray-700 flex-shrink-0 px-1 py-0">
              <div className="ui-flex-center-gap-2">
                <Dropdown_Custom
                  name="inventory_id"
                  value={newAsset.inventory_id}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, inventory_id: e.target.value }))}
                  options={assetItems.filter((i) => !linkedAssetIds.has(i.id)).map((i) => ({ value: i.id, label: i.name }))}
                  placeholder="Select asset"
                  searchable
                  footerSearch
                  onCreateFromSearch={handleCreateInventoryFromSearch("asset")}
                  createButtonTitle="Add asset"
                  className="flex-grow-1"
                />
                <button type="button" className="align-items-center btn btn-primary btn-sm d-flex justify-content-center" onClick={handleAddAsset}>
                  <PlusIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Employees ── */}
        {activeTab === "employees" && service && (
          <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 overflow-hidden text-gray-900">
            {/* Scrollable list - top-aligned for form-style editing */}
            <div className="d-flex flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-0 px-1">
              {relLoading ? (
                <div className="py-1 text-center">
                  <div className="spinner-border spinner-border-sm" />
                </div>
              ) : svcEmployees.length === 0 ? (
                <div className="fst-italic py-0 small text-muted">No employees linked yet.</div>
              ) : (
                <ul className="list-group list-group-flush mb-0">
                  {svcEmployees.map((se) => (
                    <li key={se.id} className="align-items-center d-flex gap-2 list-group-item px-0">
                      <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex flex-shrink-0 justify-content-center" onClick={() => handleRemoveEmployee(se.id)}>
                        <XMarkIcon style={{ width: 18, height: 18 }} />
                      </button>
                      <span className="flex-shrink-0 rounded-circle" style={{ width: 10, height: 10, backgroundColor: employeeColor(se.user_id), display: "inline-block" }} />
                      <span className="text-truncate">{employeeName(se.user_id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Sticky add row */}
            <div className="border-gray-200 border-top dark:border-gray-700 flex-shrink-0 px-1 py-0">
              <div className="ui-flex-center-gap-2">
                <select className="flex-grow-1 form-select form-select-sm" value={newEmployee.user_id} onChange={(e) => setNewEmployee({ user_id: e.target.value })}>
                  <option value="">— Select employee —</option>
                  {employees
                    .filter((e) => e.is_active && !linkedEmployeeIds.has(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                      </option>
                    ))}
                </select>
                <button type="button" className="align-items-center btn btn-primary btn-sm d-flex justify-content-center" onClick={handleAddEmployee}>
                  <PlusIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Locations ── */}
        {activeTab === "locations" && service && (
          <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 overflow-hidden text-gray-900">
            {/* Scrollable list - top-aligned for form-style editing */}
            <div className="d-flex flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-0 px-1">
              {relLoading ? (
                <div className="py-1 text-center">
                  <div className="spinner-border spinner-border-sm" />
                </div>
              ) : locations.length === 0 ? (
                <div className="fst-italic py-0 small text-muted">No locations linked yet.</div>
              ) : (
                <ul className="list-group list-group-flush mb-0">
                  {locations.map((loc) => (
                    <li key={loc.id} className="align-items-center d-flex gap-2 list-group-item px-0">
                      <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex flex-shrink-0 justify-content-center" onClick={() => handleRemoveLocation(loc.id)}>
                        <XMarkIcon style={{ width: 18, height: 18 }} />
                      </button>
                      <span className="text-truncate">{inventoryName(loc.inventory_id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Sticky add row */}
            <div className="border-gray-200 border-top dark:border-gray-700 flex-shrink-0 px-1 py-0">
              <div className="ui-flex-center-gap-2">
                <Dropdown_Custom
                  name="inventory_id"
                  value={newLocation.inventory_id}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, inventory_id: e.target.value }))}
                  options={locationItems.filter((i) => !linkedLocationIds.has(i.id)).map((i) => ({ value: i.id, label: i.name }))}
                  placeholder="Select location"
                  searchable
                  footerSearch
                  onCreateFromSearch={handleCreateInventoryFromSearch("location")}
                  createButtonTitle="Add location"
                  className="flex-grow-1"
                />
                <button type="button" className="align-items-center btn btn-primary btn-sm d-flex justify-content-center" onClick={handleAddLocation}>
                  <PlusIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer (sticky, always visible) ──────────────────────── */}
      <div className="app-form-footer app-standard-footer bg-white border-gray-200 border-top dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        {/* Row 1: Tab navigation — only when editing */}
        {service && (
          <div className="d-flex flex-nowrap gap-1 overflow-auto pb-1 pt-0 px-0">
            {TABS.map((tab) => {
              const count = tab === "resources" ? resources.length : tab === "assets" ? assets.length : tab === "employees" ? svcEmployees.length : tab === "locations" ? locations.length : 0;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`btn btn-sm flex-shrink-0 ${activeTab === tab ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: "0.72rem", lineHeight: 1.1 }}
                  onClick={() => {
                    setActiveTab(tab);
                    setTabError("");
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {count > 0 && (
                    <span className={`badge ms-1 ${activeTab === tab ? "bg-white text-primary" : "bg-secondary"}`} style={{ fontSize: "0.6rem" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Row 2: Actions */}
        <div className="app-footer-padding app-standard-footer">
          <Footer_Actions
            start={activeTab === "details" ? <Button_Toolbar icon={CheckIcon} label={service ? "Save" : "Add"} type="submit" form="service-details-form" className="btn-outline-secondary" title={service ? "Save service" : "Create service"} /> : null}
            center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" title="Cancel" />}
          />
        </div>
      </div>
    </div>
  );
}
