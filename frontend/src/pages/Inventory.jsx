/*
 * ============================================================
 * FILE: Inventory.jsx
 *
 * PURPOSE:
 *   Displays and manages the business inventory list. Allows users to view,
 *   search, filter, create, edit, and delete inventory items (Products, Resources,
 *   Assets, Locations, and generic Items). Access is gated by role permissions.
 *
 * FUNCTIONAL PARTS:
 *   [1]  Imports              — React, router, icons, store, API, and component imports
 *   [2]  State & Refs         — Editing target, search term, type/stock filter toggles, scroll ref
 *   [3]  Lifecycle            — One-shot data fetch on mount; auto-scroll to bottom on data change
 *   [4]  Data Loading         — loadInventoryData fetches all inventory items from the API
 *   [5]  CRUD Handlers        — handleUpdateInventory, handleOpenBulkImport, handleSubmitUpdate,
 *                               handleBulkImportItems, handleDeleteItem
 *   [6]  Display Utilities    — getItemTypeLabel, getItemTypeColor, isLocationOrAsset,
 *                               isLowStock, getTypeFilterButtonClass, getStockFilterButtonClass,
 *                               getStockColor — helpers for rendering badges and filter buttons
 *   [7]  Derived Data         — filteredInventory memoized from search, type, and stock filters
 *   [8]  Render               — Header, error banner, upside-down scrollable table, footer
 *                               controls (search, Add, Type filter, Stock filter), and modals
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Copilot | Added type filter help popover trigger (`?`) in footer dropdown
 *   2026-03-19 | GitHub Copilot | Replaced single-add with spreadsheet-style bulk import modal flow
 * ============================================================
 */

// ─── 1 IMPORTS ─────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from 'react';
import useFetchOnce from '../services/useFetchOnce';
import usePagePermission from '../services/usePagePermission';
import useViewMode from '../services/useViewMode';
import PageLayout from './components/PageLayout';
import PageTableFooter from './components/PageTableFooter';
import PageTableRow from './components/PageTableRow';
import { ExclamationTriangleIcon, PlusIcon, CameraIcon, MagnifyingGlassIcon, TagIcon, CircleStackIcon, XMarkIcon, TruckIcon } from '@heroicons/react/24/outline';
import Modal_Discount_Rules from './components/Modal_Discount_Rules';
import Button_Toolbar from './components/Button_Toolbar';
import useStore from '../services/useStore';
import { inventoryAPI, featuresAPI } from '../services/api';
import Modal_Detail_Item from './components/Modal_Detail_Item';
import Gate_Permission from './components/Gate_Permission';
import Suppliers_Panel from './components/Suppliers_Panel';
import Modal_Bulk_Import_Items from './components/Modal_Bulk_Import_Items';
import Modal from './components/Modal';
import Form_Item from './components/Form_Item';

export default function Inventory() {
  // ─── 2 PERMISSION GUARD ──────────────────────────────────────────────────────
  const {
    inventory, setInventory,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook

  usePagePermission('inventory');

  // ─── 3 STATE & REFS ──────────────────────────────────────────────────────────
  const [editingInventory, setEditingInventory] = useState(null);
  const [featureSummary, setFeatureSummary] = useState({}); // { [inventory_id]: { feature_names, price_min, price_max } }
  const [showSuppliersPanel, setShowSuppliersPanel] = useState(false);
  const [showDiscountRules, setShowDiscountRules] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'PRODUCT', 'RESOURCE', 'ASSET'
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'ok'
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isStockFilterOpen, setIsStockFilterOpen] = useState(false);
  const [typeFilterHelpKey, setTypeFilterHelpKey] = useState(null);
  const [stockFilterHelpKey, setStockFilterHelpKey] = useState(null);
  const [deletingInventoryId, setDeletingInventoryId] = useState(null);
  const { isTrainingMode } = useViewMode();
  const scrollRef = useRef(null);
  const deleteInFlightRef = useRef(new Set());

  const typeFilterOptions = [
    {
      value: 'all',
      label: 'All Types',
      description: 'Shows every inventory item type together (Products, Resources, Assets, Locations, and Items). Use this to clear type filtering.',
    },
    {
      value: 'PRODUCT',
      label: 'Products',
      description: 'Shows sellable product records only. New inventory entries saved as Product appear when this filter is selected.',
    },
    {
      value: 'RESOURCE',
      label: 'Resources',
      description: 'Shows consumable/internal resource items used by the business. Use this to review stock for resources only.',
    },
    {
      value: 'ASSET',
      label: 'Assets',
      description: 'Shows long-term business assets (equipment/property style items). Asset entries appear here when this filter is active.',
    },
    {
      value: 'LOCATION',
      label: 'Locations',
      description: 'Shows location-type inventory records only. Use this when managing location entries separately from stock items.',
    },
    {
      value: 'ITEM',
      label: 'Items',
      description: 'Shows generic item records that are not categorized as Product, Resource, Asset, or Location.',
    },
    {
      value: 'BUNDLE',
      label: 'Bundles',
      description: 'Shows bundle items — pre-defined sets of products sold together at a fixed price. When a bundle is sold, each component product\'s stock decrements automatically.',
    },
    {
      value: 'MIX',
      label: 'Mixes',
      description: 'Shows mix items — client picks a fixed number of products from a predefined list (e.g. any 10 blankets). Supports per-product maximums and fixed or percentage pricing.',
    },
  ];

  const stockFilterOptions = [
    {
      value: 'all',
      label: 'All Stock',
      description: 'Shows every inventory record regardless of stock level.',
    },
    {
      value: 'low',
      label: 'Low Stock',
      description: 'Shows only items that are at or below minimum stock level.',
    },
    {
      value: 'ok',
      label: 'In Stock',
      description: 'Shows items currently above minimum stock level and considered stocked.',
    },
  ];

  // ─── 4 LIFECYCLE / EFFECTS ───────────────────────────────────────────────────
  useFetchOnce(() => loadInventoryData());

  // ─── 5 DATA LOADING ──────────────────────────────────────────────────────────
  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, summaryRes] = await Promise.all([
        inventoryAPI.getAll(),
        featuresAPI.getInventorySummary().catch(() => ({ data: {} })),
      ]);

      // Handle both direct data and response.data formats
      const inventoryData = inventoryRes?.data ?? inventoryRes;
      const summaryData = summaryRes?.data ?? summaryRes ?? {};

      if (Array.isArray(inventoryData)) {
        setInventory(inventoryData);
      } else {
        console.error('Invalid inventory data format:', inventoryData);
        setInventory([]);
      }

      setFeatureSummary(typeof summaryData === 'object' ? summaryData : {});
      clearError();
    } catch (err) {
      setError('Failed to load inventory data');
      console.error('Error loading inventory:', err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 6 CRUD HANDLERS ─────────────────────────────────────────────────────────
  const handleUpdateInventory = (inventoryItem) => {
    if (!hasPermission('inventory', 'write')) {
      setError('You do not have permission to update inventory');
      return;
    }
    setEditingInventory(inventoryItem);
    openModal('inventory-form');
  };

  const handleOpenBulkImport = () => {
    if (!hasPermission('inventory', 'write')) {
      setError('You do not have permission to import items');
      return;
    }
    setShowBulkImport(true);
  };

  const handleOpenAddItem = () => {
    if (!hasPermission('inventory', 'write')) {
      setError('You do not have permission to add items');
      return;
    }
    setShowAddItemModal(true);
  };

  const handleCreateInventory = async (createData) => {
    try {
      await inventoryAPI.create(createData);
      await loadInventoryData();
      setShowAddItemModal(false);
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to create inventory item';
      setError(String(detail));
    }
  };

  const handleSubmitUpdate = async (inventoryId, updateData) => {
    try {
      await inventoryAPI.update(inventoryId, updateData);
      // Reload inventory to get updated data
      loadInventoryData();
      closeModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to update inventory';
      setError(String(detail));
      console.error('Inventory update error:', err?.response || err);
    }
  };

  const handleBulkImportItems = async (rows) => {
    const res = await inventoryAPI.bulkImport(rows);
    await loadInventoryData();
    setShowBulkImport(false);
    clearError();
    return res?.data ?? res;
  };

  // ─── 7 DISPLAY UTILITIES ─────────────────────────────────────────────────────
  const getItemTypeLabel = (type) => {
    const labels = { 
      PRODUCT: 'Product', RESOURCE: 'Resource', ASSET: 'Asset', LOCATION: 'Location', ITEM: 'Item', BUNDLE: 'Bundle', MIX: 'Mix',
      product: 'Product', resource: 'Resource', asset: 'Asset', location: 'Location', item: 'Item'
    };
    return labels[type] || type || 'Product';
  };

  const getItemTypeColor = (type) => {
    const upperType = (type || '').toUpperCase();
    if (upperType === 'RESOURCE') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    if (upperType === 'ASSET') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    if (upperType === 'LOCATION') return 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300';
    if (upperType === 'BUNDLE') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    if (upperType === 'MIX') return 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300';
if (upperType === 'ITEM') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'; // PRODUCT
  };

  // Location and Asset items always have "OK" status
  const isLocationOrAsset = (item) => {
    const upperType = (item.type || '').toUpperCase();
    return upperType === 'LOCATION' || upperType === 'ASSET';
  };

  const isLowStock = (item) => {
    // Location and Asset items are always "OK"
    if (isLocationOrAsset(item)) return false;
    return item.quantity <= item.min_stock_level;
  };

  const getTypeFilterButtonClass = () => {
    if (typeFilter === 'all') return 'btn-app-secondary';
    if (typeFilter === 'RESOURCE') return 'bg-blue-600 text-white';
    if (typeFilter === 'ASSET') return 'bg-purple-600 text-white';
    if (typeFilter === 'LOCATION') return 'bg-teal-600 text-white';
    if (typeFilter === 'ITEM') return 'bg-orange-500 text-white';
    return 'bg-gray-600 text-white'; // PRODUCT
  };

  const getStockFilterButtonClass = () => {
    if (stockFilter === 'low') return 'bg-orange-700 text-white';
    if (stockFilter === 'ok') return 'bg-green-600 text-white';
    return 'btn-app-secondary';
  };

  // Get stock status color (uses the former status badge colors)
  const getStockColor = (item) => {
    if (isLowStock(item)) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
  };

  const getPriceDisplay = (item) => {
    const s = featureSummary[item.id];
    if (s?.price_min != null && s?.price_max != null) {
      return s.price_min === s.price_max
        ? `$${s.price_min.toFixed(2)}`
        : `$${s.price_min.toFixed(2)}–$${s.price_max.toFixed(2)}`;
    }
    return item.price != null ? `$${item.price.toFixed(2)}` : null;
  };

  const handleDeleteItem = async (inventoryId) => {
    if (deleteInFlightRef.current.has(inventoryId)) {
      return;
    }

    if (!hasPermission('inventory', 'delete')) {
      setError('You do not have permission to delete items');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this item?')) return;

    deleteInFlightRef.current.add(inventoryId);
    setDeletingInventoryId(inventoryId);

    try {
      await inventoryAPI.delete(inventoryId);
      await loadInventoryData();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to delete item';
      setError(String(detail));
    } finally {
      deleteInFlightRef.current.delete(inventoryId);
      setDeletingInventoryId((prev) => (prev === inventoryId ? null : prev));
    }
  };

  // ─── 8 DERIVED / FILTERED DATA ───────────────────────────────────────────────
  // Filtered inventory based on search, type, and stock filters
  const filteredInventory = useMemo(() => {
    return inventory.filter((inv) => {
      // Search filter (name or SKU) - inventory now has these fields directly
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (inv.name || '').toLowerCase().includes(term);
        const matchesSku = (inv.sku || '').toLowerCase().includes(term);
        if (!matchesName && !matchesSku) return false;
      }

      // Type filter
      if (typeFilter !== 'all') {
        const itemType = (inv.type || 'PRODUCT').toUpperCase();
        if (itemType !== typeFilter) return false;
      }

      // Stock filter
      if (stockFilter === 'low' && !isLowStock(inv)) return false;
      if (stockFilter === 'ok' && isLowStock(inv)) return false;

      return true;
    });
  }, [inventory, searchTerm, typeFilter, stockFilter]);

  // Scroll to bottom when data loads (to show newest items near footer)
  useEffect(() => {
    if (scrollRef.current && filteredInventory.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredInventory.length]);

  // ─── 9 RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

return (
  <PageLayout title="Inventory" error={error}>

      {/* Container_Scrollable rows – grow upwards from bottom */}
      <div
        ref={scrollRef}
        className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar"
        style={{ background: 'var(--bs-body-bg)' }}
      >
        {filteredInventory.length > 0 ? (
          <table className="table table-borderless table-hover mb-0 table-fixed">
            <colgroup>
              <col />
              <col style={{ width: '80px' }} />
              <col style={{ width: '50px' }} />
            </colgroup>
            <tbody>
              {filteredInventory.map((inv, index) => (
                <PageTableRow
                  key={inv.id || index}
                  onClick={() => handleUpdateInventory(inv)}
                >
                  {/* Name */}
                  <td className="main-page-table-data">
                    <div className="fw-medium" style={{ wordBreak: 'break-word' }}>
                      {inv.name}
                    </div>
                    {inv.supplier_name && (
                      <div className="small text-muted">{inv.supplier_name}</div>
                    )}
                    {/* Price display (range if features affect price, otherwise fixed) */}
                    {getPriceDisplay(inv) && (
                      <div className="small text-primary fw-semibold">{getPriceDisplay(inv)}</div>
                    )}
                    {/* Feature name tags */}
                    {featureSummary[inv.id]?.feature_names?.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {featureSummary[inv.id].feature_names.map(name => (
                          <span key={name} className="badge bg-secondary-subtle text-secondary-emphasis"
                                style={{ fontSize: '0.62rem', fontWeight: 500 }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Type */}
                  <td className="main-page-table-data">
                    <span className={`badge rounded-pill ${getItemTypeColor(inv.type)}`}>
                      {getItemTypeLabel(inv.type)}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="main-page-table-data text-center">
                    <span className={`badge rounded-pill ${getStockColor(inv)}`}>
                      {inv.quantity}
                    </span>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
            No inventory items found
          </div>
        )}
      </div>

      {/* Fixed bottom – headers + controls */}
      <PageTableFooter
        columns={[{ label: 'Item' }, { label: 'Type', width: 80 }, { label: 'Stock', width: 50 }]}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search by name or SKU..."
        beforeSearch={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button_Toolbar
              icon={TruckIcon}
              label="Suppliers"
              onClick={() => setShowSuppliersPanel(true)}
              className="btn-app-secondary"
            />
            <Button_Toolbar
              icon={TagIcon}
              label="Discounts"
              onClick={() => setShowDiscountRules(true)}
              className="btn-app-secondary"
            />
          </div>
        }
      >
        <Gate_Permission page="inventory" permission="write">
          <Button_Toolbar
            icon={PlusIcon}
            label="Add"
            onClick={handleOpenAddItem}
            className="btn-app-primary"
          />

          <Button_Toolbar
            icon={PlusIcon}
            label="Bulk"
            onClick={handleOpenBulkImport}
            className="btn-app-secondary"
          />
        </Gate_Permission>

        {/* Type Filter */}
        <div className="position-relative">
          <Button_Toolbar
            icon={TagIcon}
            label="Type"
            onClick={() => {
              const nextOpen = !isTypeFilterOpen;
              setIsTypeFilterOpen(nextOpen);
              if (!nextOpen) setTypeFilterHelpKey(null);
            }}
            className={`border-0 shadow-lg transition-all ${getTypeFilterButtonClass()}`}
            data-active={typeFilter !== 'all'}
          />
          {isTypeFilterOpen && (
            <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px' }}>
              {typeFilterOptions.map((option, index) => {
                const isLast = index === typeFilterOptions.length - 1;
                const isSelected = typeFilter === option.value;
                const isHelpOpen = typeFilterHelpKey === option.value;

                return (
                  <div key={option.value} className={`d-flex align-items-center gap-1 ${isLast ? '' : 'mb-1'}`}>
                    <button
                      onClick={() => {
                        setTypeFilter(option.value);
                        setIsTypeFilterOpen(false);
                        setTypeFilterHelpKey(null);
                      }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      {option.label}
                    </button>

                    {isTrainingMode && (
                      <div className="position-relative flex-shrink-0">
                        <button
                          type="button"
                          aria-label={`${option.label} help`}
                          className="btn btn-sm text-gray-600 dark:text-gray-300 d-flex align-items-center justify-content-center"
                          style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700 }}
                          onMouseEnter={() => setTypeFilterHelpKey(option.value)}
                          onMouseLeave={() => setTypeFilterHelpKey((prev) => (prev === option.value ? null : prev))}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTypeFilterHelpKey((prev) => (prev === option.value ? null : option.value));
                          }}
                        >
                          ?
                        </button>

                        {isHelpOpen && (
                          <div
                            className="position-absolute start-50 bottom-100 mb-2 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-start"
                            style={{ width: '260px', maxWidth: 'calc(100vw - 1rem)', transform: 'translateX(-55%)' }}
                            onMouseEnter={() => setTypeFilterHelpKey(option.value)}
                            onMouseLeave={() => setTypeFilterHelpKey((prev) => (prev === option.value ? null : prev))}
                          >
                            <div className="fw-semibold text-gray-900 dark:text-gray-100 mb-1">{option.label}</div>
                            <div className="small text-gray-700 dark:text-gray-300">{option.description}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stock Filter */}
        <div className="position-relative">
          <Button_Toolbar
            icon={CircleStackIcon}
            label="Stock"
            onClick={() => {
              const nextOpen = !isStockFilterOpen;
              setIsStockFilterOpen(nextOpen);
              if (!nextOpen) setStockFilterHelpKey(null);
            }}
            className={`border-0 shadow-lg transition-all ${getStockFilterButtonClass()}`}
            data-active={stockFilter !== 'all'}
          />
          {isStockFilterOpen && (
            <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '180px' }}>
              {stockFilterOptions.map((option, index) => {
                const isLast = index === stockFilterOptions.length - 1;
                const isSelected = stockFilter === option.value;
                const isHelpOpen = stockFilterHelpKey === option.value;

                return (
                  <div key={option.value} className={`d-flex align-items-center gap-1 ${isLast ? '' : 'mb-1'}`}>
                    <button
                      onClick={() => {
                        setStockFilter(option.value);
                        setIsStockFilterOpen(false);
                        setStockFilterHelpKey(null);
                      }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      {option.label}
                    </button>

                    {isTrainingMode && (
                      <div className="position-relative flex-shrink-0">
                        <button
                          type="button"
                          aria-label={`${option.label} help`}
                          className="btn btn-sm text-gray-600 dark:text-gray-300 d-flex align-items-center justify-content-center"
                          style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700 }}
                          onMouseEnter={() => setStockFilterHelpKey(option.value)}
                          onMouseLeave={() => setStockFilterHelpKey((prev) => (prev === option.value ? null : prev))}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setStockFilterHelpKey((prev) => (prev === option.value ? null : option.value));
                          }}
                        >
                          ?
                        </button>

                        {isHelpOpen && (
                          <div
                            className="position-absolute start-50 bottom-100 mb-2 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-start"
                            style={{ width: '260px', maxWidth: 'calc(100vw - 1rem)', transform: 'translateX(-55%)' }}
                            onMouseEnter={() => setStockFilterHelpKey(option.value)}
                            onMouseLeave={() => setStockFilterHelpKey((prev) => (prev === option.value ? null : prev))}
                          >
                            <div className="fw-semibold text-gray-900 dark:text-gray-100 mb-1">{option.label}</div>
                            <div className="small text-gray-700 dark:text-gray-300">{option.description}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {(typeFilter !== 'all' || stockFilter !== 'all') && (
          <Button_Toolbar
            icon={XMarkIcon}
            label="Clear"
            onClick={() => { setTypeFilter('all'); setStockFilter('all'); }}
            className="btn-app-danger"
          />
        )}
      </PageTableFooter>

    <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)} fullScreen noPadding>
      <Form_Item
        item={null}
        showInitialQuantity
        showScanner
        existingSkus={inventory.map(i => i.sku).filter(Boolean)}
        onCancel={() => setShowAddItemModal(false)}
        onSubmit={handleCreateInventory}
      />
    </Modal>

    {/* Modals remain unchanged */}
    <Modal_Detail_Item
      isOpen={isModalOpen && modalContent === 'inventory-form'}
      onClose={closeModal}
      item={editingInventory}
      itemType={editingInventory?.type || 'product'}
      mode="inventory"
      onUpdateInventory={handleSubmitUpdate}
      onDelete={handleDeleteItem}
      canDelete={hasPermission('inventory', 'delete')}
      isDeleting={deletingInventoryId === editingInventory?.id}
      existingSkus={inventory.map(i => i.sku).filter(Boolean)}
    />

    <Modal_Bulk_Import_Items
      isOpen={showBulkImport}
      onClose={() => setShowBulkImport(false)}
      onImport={handleBulkImportItems}
      existingSkus={inventory.map(i => i.sku).filter(Boolean)}
    />

    <Suppliers_Panel
      isOpen={showSuppliersPanel}
      onClose={() => setShowSuppliersPanel(false)}
    />

    <Modal_Discount_Rules
      isOpen={showDiscountRules}
      onClose={() => setShowDiscountRules(false)}
    />

  </PageLayout>
);
}
