import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { ExclamationTriangleIcon, PencilIcon, PlusIcon, CameraIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { inventoryAPI } from '../services/api';
import Modal from './components/Modal';
import BarcodeScanner from './components/BarcodeScanner';
import ItemForm from './components/ItemForm';
import ItemDetailModal from './components/ItemDetailModal';
import PermissionGate from './components/PermissionGate';
import CSVImportButton from './components/CSVImportButton';
import IconButton from './components/IconButton';

export default function Inventory() {
  const { 
    inventory, setInventory,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook

  // Check permissions at page level
  if (!hasPermission('inventory', 'read') &&
      !hasPermission('inventory', 'write') &&
      !hasPermission('inventory', 'delete') &&
      !hasPermission('inventory', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingInventory, setEditingInventory] = useState(null);
  const [scannedCode, setScannedCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'PRODUCT', 'RESOURCE', 'ASSET'
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'ok'
  const scrollRef = useRef(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const inventoryRes = await inventoryAPI.getAll();

      // Handle both direct data and response.data formats
      const inventoryData = inventoryRes?.data ?? inventoryRes;

      if (Array.isArray(inventoryData)) {
        setInventory(inventoryData);
      } else {
        console.error('Invalid inventory data format:', inventoryData);
        setInventory([]);
      }

      clearError();
    } catch (err) {
      setError('Failed to load inventory data');
      console.error('Error loading inventory:', err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInventory = (inventoryItem) => {
    if (!hasPermission('inventory', 'write')) {
      setError('You do not have permission to update inventory');
      return;
    }
    setEditingInventory(inventoryItem);
    openModal('inventory-form');
  };

  const handleCreateItem = () => {
    if (!hasPermission('inventory', 'write')) {
      setError('You do not have permission to create items');
      return;
    }
    setScannedCode('');
    openModal('item-form');
  };

  const handleOpenScanner = () => {
    setScannedCode('');
    openModal('barcode-scan');
  };

  const handleDetectedBarcode = (code) => {
    const scanned = String(code || '').trim();
    setScannedCode(scanned);
    // If item already exists, show notification instead of opening the modal
    const exists = inventory.some((p) => (p?.sku || '').trim() === scanned && scanned.length > 0);
    if (exists) {
      closeModal();
      setError(`Item with SKU "${scanned}" already exists in the database.`);
      return;
    }
    // Otherwise open item form prefilled with scanned code
    clearError();
    openModal('item-form');
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

  const handleSubmitNewItem = async (itemData, { initialQuantity }) => {
    try {
      // Create inventory item directly (inventory now contains all product fields)
      const inventoryData = {
        ...itemData,
        quantity: Number.isFinite(initialQuantity) ? initialQuantity : 0,
      };
      await inventoryAPI.create(inventoryData);
      await loadInventoryData();
      closeModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to save item';
      setError(String(detail));
      console.error('Inventory create error:', err?.response || err);
    }
  }; 

  const getItemTypeLabel = (type) => {
    const labels = { 
      PRODUCT: 'Product', RESOURCE: 'Resource', ASSET: 'Asset', LOCATION: 'Location', ITEM: 'Item',
      product: 'Product', resource: 'Resource', asset: 'Asset', location: 'Location', item: 'Item'
    };
    return labels[type] || type || 'Product';
  };

  const getItemTypeColor = (type) => {
    const upperType = (type || '').toUpperCase();
    if (upperType === 'RESOURCE') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    if (upperType === 'ASSET') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    if (upperType === 'LOCATION') return 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300';
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

  // Get stock status color (uses the former status badge colors)
  const getStockColor = (item) => {
    if (isLowStock(item)) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
  };

  const handleDeleteItem = async (inventoryId) => {
    if (!hasPermission('inventory', 'delete')) {
      setError('You do not have permission to delete items');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await inventoryAPI.delete(inventoryId);
      await loadInventoryData();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to delete item';
      setError(String(detail));
    }
  };

  const handleCSVImport = async (records) => {
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const record of records) {
      try {
        // Create inventory item directly with all fields
        const inventoryData = {
          name: record.name,
          sku: record.sku || '',
          description: record.description || '',
          price: parseFloat(record.price) || 0,
          type: (record.type || 'PRODUCT').toUpperCase(),
          quantity: parseInt(record.quantity) || parseInt(record.initial_quantity) || 0,
          min_stock_level: parseInt(record.min_stock_level) || parseInt(record.min_stock) || 10,
          location: record.location || null,
        };
        
        await inventoryAPI.create(inventoryData);
        success++;
      } catch (err) {
        failed++;
        const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
        errors.push(`Row ${success + failed}: ${record.name || 'Unknown'} - ${detail}`);
      }
    }

    return { success, failed, errors };
  };

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

return (
  <div className="d-flex flex-column vh-100 overflow-hidden bg-body">

    {/* Header */}
    <div className="flex-shrink-0 border-bottom p-3">
      <h1 className="h-4 mb-0 fw-bold text-body-emphasis">Inventory</h1>
    </div>

    {/* Error / Low Stock Alerts */}
    {error && (
      <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0">
        {error}
      </div>
    )}

    {inventory.filter(item => isLowStock(item) && !isLocationOrAsset(item)).length > 0 && (
      <div className="flex-shrink-0 alert alert-warning border-0 rounded-0 m-0 d-flex align-items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/>
          <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
        </svg>
        <span className="fw-medium">
          {inventory.filter(item => isLowStock(item) && !isLocationOrAsset(item)).length} item(s) are running low on stock!
        </span>
      </div>
    )}

    {/* Main upside-down table container */}
    <div className="flex-grow-1 d-flex flex-column overflow-hidden">

      {/* Scrollable rows – grow upwards from bottom */}
      <div
        ref={scrollRef}
        className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white"
        style={{ background: 'var(--bs-body-bg)' }}
      >
        {filteredInventory.length > 0 ? (
          <table className="table table-borderless table-hover mb-0 table-fixed">
            <colgroup>
              <col style={{ width: '60px' }} />
              <col />
              <col style={{ width: '140px', maxWidth: '140px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '60px' }} />
            </colgroup>
            <tbody>
              {filteredInventory.map((inv, index) => (
                <tr
                  key={inv.id || index}
                  className="align-middle border-bottom"
                  style={{ height: '56px' }}
                >
                  {/* Delete */}
                  <td className="text-center px-2">
                    <PermissionGate page="inventory" permission="delete">
                      <button
                        onClick={() => handleDeleteItem(inv.id)}
                        className="btn btn-sm btn-outline-danger border-0 p-1"
                        title="Delete"
                      >
                        ×
                      </button>
                    </PermissionGate>
                  </td>

                  {/* Name */}
                  <td className="px-3">
                    <div className="fw-medium text-truncate" style={{ maxWidth: '100%' }}>
                      {inv.name}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3">
                    <span className={`badge rounded-pill ${getItemTypeColor(inv.type)}`}>
                      {getItemTypeLabel(inv.type)}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="text-center px-3">
                    <span className={`badge rounded-pill ${getStockColor(inv)}`}>
                      {inv.quantity}
                    </span>
                  </td>

                  {/* Edit */}
                  <td className="text-center px-2">
                    <PermissionGate page="inventory" permission="write">
                      <button
                        onClick={() => handleUpdateInventory(inv)}
                        className="btn btn-sm btn-outline-primary border-0 p-1"
                        title="Edit"
                      >
                        ✎
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
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
      <div className="flex-shrink-0 bg-light border-top shadow-sm" style={{ zIndex: 10 }}>
        {/* Column Headers */}
        <table className="table table-borderless mb-0 bg-light">
          <colgroup>
            <col style={{ width: '60px' }} />
            <col />
            <col style={{ width: '140px', maxWidth: '140px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '60px' }} />
          </colgroup>
          <tfoot>
            <tr className="bg-secondary-subtle">
              <th className="text-center"></th>
              <th>Item</th>
              <th>Type</th>
              <th className="text-center">Stock</th>
              <th className="text-center"></th>
            </tr>
          </tfoot>
        </table>

        {/* Controls */}
        <div className="p-2 border-top">
          {/* Filters row */}
          <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
            <div className="flex-grow-1 position-relative" style={{ minWidth: '180px' }}>
              <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control ps-5"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
              style={{ maxWidth: '160px' }}
            >
              <option value="all">All Types</option>
              <option value="PRODUCT">Products</option>
              <option value="RESOURCE">Resources</option>
              <option value="ASSET">Assets</option>
              <option value="LOCATION">Locations</option>
              <option value="ITEM">Items</option>
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="form-select"
              style={{ maxWidth: '140px' }}
            >
              <option value="all">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="ok">In Stock</option>
            </select>

            <span className="text-muted small ms-2">
              {filteredInventory.length} / {inventory.length}
            </span>
          </div>

          {/* Action buttons – far left */}
          <PermissionGate page="inventory" permission="write">
            <div className="d-flex gap-2">
              <div className="btn-group">
                <CSVImportButton
                  entityName="Items"
                  onImport={handleCSVImport}
                  onComplete={loadInventoryData}
                  requiredFields={['name']}
                  fieldMapping={{
                    'item name': 'name',
                    'product name': 'name',
                    'item': 'name',
                    'product': 'name',
                    'stock': 'quantity',
                    'qty': 'quantity',
                    'min stock': 'min_stock_level',
                    'minimum stock': 'min_stock_level',
                  }}
                  className="btn btn-outline-secondary"
                />
                <button
                  type="button"
                  onClick={handleCreateItem}
                  className="btn btn-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
                  </svg>
                  Add
                </button>
                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="btn btn-outline-secondary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                    <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                    <path d="M3 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
                  </svg>
                  Scan
                </button>
              </div>
            </div>
          </PermissionGate>
        </div>
      </div>
    </div>

    {/* Modals remain unchanged */}
    <ItemDetailModal
      isOpen={isModalOpen && modalContent === 'inventory-form'}
      onClose={closeModal}
      item={editingInventory}
      itemType={editingInventory?.type || 'product'}
      mode="inventory"
      onUpdateInventory={handleSubmitUpdate}
    />

    <Modal isOpen={isModalOpen && modalContent === 'barcode-scan'} onClose={closeModal} title="Scan Barcode">
      {isModalOpen && modalContent === 'barcode-scan' && (
        <BarcodeScanner
          onDetected={(code) => handleDetectedBarcode(code)}
          onCancel={closeModal}
        />
      )}
    </Modal>

    <Modal isOpen={isModalOpen && modalContent === 'item-form'} onClose={closeModal}>
      {isModalOpen && modalContent === 'item-form' && (
        <ItemForm
          initialSku={scannedCode}
          showInitialQuantity
          onSubmitWithExtras={handleSubmitNewItem}
          onSubmit={(data) => handleSubmitNewItem(data, { initialQuantity: 0 })}
          onCancel={closeModal}
        />
      )}
    </Modal>

  </div>
);
}
