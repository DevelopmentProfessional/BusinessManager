import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { ExclamationTriangleIcon, PlusIcon, CameraIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { inventoryAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Item from './components/Form_Item';
import Modal_Detail_Item from './components/Modal_Detail_Item';
import Gate_Permission from './components/Gate_Permission';

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

  const handleSubmitNewItem = async (itemData, { initialQuantity, pendingPhoto = null }) => {
    try {
      // Create inventory item directly (inventory now contains all product fields)
      const inventoryData = {
        ...itemData,
        quantity: Number.isFinite(initialQuantity) ? initialQuantity : 0,
      };
      const result = await inventoryAPI.create(inventoryData);
      // Upload captured photo if one was taken
      const newItemId = result?.data?.id;
      if (pendingPhoto && newItemId) {
        const file = new File([pendingPhoto], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await inventoryAPI.uploadImageFile(newItemId, file, true);
      }
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
  <div className="d-flex flex-column overflow-hidden bg-body" style={{ height: '100dvh' }}>

    {/* Header - always visible via flex-shrink-0 */}
    <div className="flex-shrink-0 border-bottom p-3 bg-body" style={{ zIndex: 5 }}>
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

      {/* Container_Scrollable rows – grow upwards from bottom */}
      <div
        ref={scrollRef}
        className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white no-scrollbar"
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
                <tr
                  key={inv.id || index}
                  className="align-middle border-bottom"
                  style={{ height: '56px', cursor: 'pointer' }}
                  onClick={() => handleUpdateInventory(inv)}
                >
                  {/* Name */}
                  <td className="px-1">
                    <div className="fw-medium" style={{ wordBreak: 'break-word' }}>
                      {inv.name}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-1">
                    <span className={`badge rounded-pill ${getItemTypeColor(inv.type)}`}>
                      {getItemTypeLabel(inv.type)}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="text-center px-1">
                    <span className={`badge rounded-pill ${getStockColor(inv)}`}>
                      {inv.quantity}
                    </span>
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
      <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
        {/* Column Headers */}
        <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <colgroup>
            <col />
            <col style={{ width: '80px' }} />
            <col style={{ width: '50px' }} />
          </colgroup>
          <tfoot>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th>Item</th>
              <th>Type</th>
              <th className="text-center">Stock</th>
            </tr>
          </tfoot>
        </table>

        {/* Controls */}
        <div className="p-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Search row */}
          <div className="position-relative w-100 mb-2">
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
              className="app-search-input form-control ps-5 w-100 rounded-pill"
            />
          </div>

          {/* Controls row - Add, Type, Stock */}
          <div className="d-flex align-items-center gap-2 mb-1">
            <Gate_Permission page="inventory" permission="write">
              <button
                type="button"
                onClick={handleCreateItem}
                className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                style={{ width: '3rem', height: '3rem' }}
                title="Add item"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </Gate_Permission>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select form-select-sm rounded-pill"
              style={{ width: 'fit-content', minWidth: '100px' }}
            >
              <option value="all">Types</option>
              <option value="PRODUCT">Products</option>
              <option value="RESOURCE">Resources</option>
              <option value="ASSET">Assets</option>
              <option value="LOCATION">Locations</option>
              <option value="ITEM">Items</option>
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="form-select form-select-sm rounded-pill"
              style={{ width: 'fit-content', minWidth: '100px' }}>
              <option value="all">Stock</option>
              <option value="low">Low Stock</option>
              <option value="ok">In Stock</option>
            </select>
          </div>
        </div>
      </div>
    </div>

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
      existingSkus={inventory.map(i => i.sku).filter(Boolean)}
    />

    <Modal isOpen={isModalOpen && modalContent === 'item-form'} onClose={closeModal}>
      {isModalOpen && modalContent === 'item-form' && (
        <Form_Item
          showInitialQuantity
          onSubmitWithExtras={handleSubmitNewItem}
          onSubmit={(data) => handleSubmitNewItem(data, { initialQuantity: 0 })}
          onCancel={closeModal}
          showScanner
          existingSkus={inventory.map(i => i.sku).filter(Boolean)}
        />
      )}
    </Modal>

  </div>
);
}
