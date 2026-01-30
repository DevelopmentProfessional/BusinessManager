import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { ExclamationTriangleIcon, PencilIcon, PlusIcon, CameraIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { inventoryAPI, itemsAPI } from '../services/api';
import Modal from './components/Modal';
import BarcodeScanner from './components/BarcodeScanner';
import ItemForm from './components/ItemForm';
import PermissionGate from './components/PermissionGate';
import CSVImportButton from './components/CSVImportButton';
import IconButton from './components/IconButton';

function InventoryUpdateForm({ inventoryItem, onSubmit, onCancel }) {
  const [quantity, setQuantity] = useState(inventoryItem?.quantity || 0);
  const [minStockLevel, setMinStockLevel] = useState(inventoryItem?.min_stock_level || 10);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(inventoryItem.item_id, { 
      quantity: parseInt(quantity),
      min_stock_level: parseInt(minStockLevel)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Update Inventory
        </h3>
      </div>

      <div className="flex gap-1">
        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
          Current Quantity
        </label>
        <input
          type="number"
          id="quantity"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="input-field mt-1"
          placeholder="Enter current quantity"
        />
      </div>

      <div className="flex gap-1">
        <label htmlFor="minStockLevel" className="block text-sm font-medium text-gray-700">
          Minimum Stock Level
        </label>
        <input
          type="number"
          id="minStockLevel"
          min="0"
          value={minStockLevel}
          onChange={(e) => setMinStockLevel(e.target.value)}
          className="input-field mt-1"
          placeholder="Enter minimum stock level"
        />
      </div>

      <div className="flex justify-start space-x-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Update Inventory
        </button>
      </div>
    </form>
  );
}

export default function Inventory() {
  const { 
    inventory, setInventory, items, setItems,
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

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, itemsRes] = await Promise.all([
        inventoryAPI.getAll(),
        itemsAPI.getAll()
      ]);

      // Handle both direct data and response.data formats
      const inventoryData = inventoryRes?.data ?? inventoryRes;
      const itemsData = itemsRes?.data ?? itemsRes;

      if (Array.isArray(inventoryData)) {
        setInventory(inventoryData);
      } else {
        console.error('Invalid inventory data format:', inventoryData);
        setInventory([]);
      }

      if (Array.isArray(itemsData)) {
        setItems(itemsData);
      } else {
        console.error('Invalid items data format:', itemsData);
        setItems([]);
      }

      clearError();
    } catch (err) {
      setError('Failed to load inventory data');
      console.error('Error loading inventory:', err);
      setInventory([]);
      setItems([]);
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
    const exists = items.some((p) => (p?.sku || '').trim() === scanned && scanned.length > 0);
    if (exists) {
      closeModal();
      setError(`Item with SKU "${scanned}" already exists in the database.`);
      return;
    }
    // Otherwise open item form prefilled with scanned code
    clearError();
    openModal('item-form');
  };

  const handleSubmitUpdate = async (itemId, updateData) => {
    try {
      await inventoryAPI.update(itemId, updateData.quantity, { min_stock_level: updateData.min_stock_level });
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
      const resp = await itemsAPI.create(itemData);
      // Upsert initial inventory quantity
      await inventoryAPI.update(resp.data.id, Number.isFinite(initialQuantity) ? initialQuantity : 0);
      await loadInventoryData();
      closeModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to save item';
      setError(String(detail));
      console.error('Item create error:', err?.response || err);
    }
  };

  const getItemName = (itemId) => {
    const item = items.find(p => p.id === itemId);
    return item ? item.name : 'Unknown Item';
  };

  const getItemSku = (itemId) => {
    const item = items.find(p => p.id === itemId);
    return item ? item.sku : 'N/A';
  };

  const getItemType = (itemId) => {
    const item = items.find(p => p.id === itemId);
    return item?.type || 'PRODUCT';
  };

  const getItemTypeLabel = (type) => {
    const labels = { PRODUCT: 'Product', RESOURCE: 'Resource', ASSET: 'Asset', product: 'Product', resource: 'Resource', asset: 'Asset' };
    return labels[type] || type || 'Product';
  };

  const getItemTypeColor = (type) => {
    const upperType = (type || '').toUpperCase();
    if (upperType === 'RESOURCE') return 'bg-blue-100 text-blue-800';
    if (upperType === 'ASSET') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800'; // PRODUCT
  };

  const isLowStock = (item) => item.quantity <= item.min_stock_level;

  const handleDeleteItem = async (itemId) => {
    if (!hasPermission('inventory', 'delete')) {
      setError('You do not have permission to delete items');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this item? This will also remove its inventory record.')) return;
    try {
      await itemsAPI.delete(itemId);
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
        // Create item with CSV data
        const itemData = {
          name: record.name,
          sku: record.sku || '',
          description: record.description || '',
          price: parseFloat(record.price) || 0,
          type: (record.type || 'PRODUCT').toUpperCase(),
        };
        
        const resp = await itemsAPI.create(itemData);
        
        // Set initial inventory quantity if provided
        const initialQty = parseInt(record.quantity) || parseInt(record.initial_quantity) || 0;
        const minStock = parseInt(record.min_stock_level) || parseInt(record.min_stock) || 10;
        
        if (resp?.data?.id) {
          await inventoryAPI.update(resp.data.id, initialQty, minStock);
        }
        
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
      const item = items.find(p => p.id === inv.item_id);
      if (!item) return false;

      // Search filter (name or SKU)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(term);
        const matchesSku = (item.sku || '').toLowerCase().includes(term);
        if (!matchesName && !matchesSku) return false;
      }

      // Type filter
      if (typeFilter !== 'all') {
        const itemType = (item.type || 'PRODUCT').toUpperCase();
        if (itemType !== typeFilter) return false;
      }

      // Stock filter
      if (stockFilter === 'low' && !isLowStock(inv)) return false;
      if (stockFilter === 'ok' && isLowStock(inv)) return false;

      return true;
    });
  }, [inventory, items, searchTerm, typeFilter, stockFilter]);

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
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 mb-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
      </div>

      {error && (
        <div className="flex-shrink-0 mt-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Low Stock Alert */}
      {inventory.filter(isLowStock).length > 0 && (
        <div className="flex-shrink-0 mt-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            <span className="font-medium text-sm">
              {inventory.filter(isLowStock).length} item(s) are running low on stock!
            </span>
          </div>
        </div>
      )}

      {/* Upside-down table container - rows start at bottom, grow upwards */}
      <div className="mt-2 flex-1 min-h-0 flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

        {/* Scrollable table body - flex-direction: column-reverse makes rows grow upward */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col-reverse bg-white dark:bg-gray-900"
        >
          {filteredInventory.length > 0 ? (
            <table className="w-full border-collapse table-fixed mt-auto">
              <tbody>
                {filteredInventory.map((inv, index) => (
                  <tr
                    key={inv.item_id || index}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    style={{ height: '56px' }}
                  >
                    {/* Delete button */}
                    <td className="w-12 px-2 text-center">
                      <PermissionGate page="inventory" permission="delete">
                        <IconButton
                          icon={TrashIcon}
                          label="Delete"
                          onClick={() => handleDeleteItem(inv.item_id)}
                          variant="danger"
                          className="!p-1.5"
                        />
                      </PermissionGate>
                    </td>
                    {/* Item name */}
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {getItemName(inv.item_id)}
                      </div>
                    </td>
                    {/* SKU */}
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {getItemSku(inv.item_id)}
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className={`px-2 py-1 text-xs rounded-full ${getItemTypeColor(getItemType(inv.item_id))}`}>
                        {getItemTypeLabel(getItemType(inv.item_id))}
                      </span>
                    </td>
                    {/* Stock quantity */}
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-medium ${isLowStock(inv) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {inv.quantity}
                      </span>
                    </td>
                    {/* Min stock level */}
                    <td className="px-3 py-2 text-center hidden sm:table-cell">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {inv.min_stock_level}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        isLowStock(inv)
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      }`}>
                        {isLowStock(inv) ? 'Low' : 'OK'}
                      </span>
                    </td>
                    {/* Edit button */}
                    <td className="w-12 px-2 text-center">
                      <PermissionGate page="inventory" permission="write">
                        <IconButton
                          icon={PencilIcon}
                          label="Edit"
                          onClick={() => handleUpdateInventory(inv)}
                          variant="ghost"
                          className="!p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        />
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 mt-auto">
              No inventory items found
            </div>
          )}
        </div>

        {/* Sticky footer with headers and controls */}
        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {/* Column Headers */}
          <table className="w-full border-collapse table-fixed">
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="w-12 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center"></th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-left">Item</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-left hidden sm:table-cell">SKU</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-left hidden md:table-cell">Type</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center">Stock</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center hidden sm:table-cell">Min</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center">Status</th>
                <th className="w-12 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center"></th>
              </tr>
            </tfoot>
          </table>

          {/* Controls Row */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[180px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Types</option>
                <option value="PRODUCT">Products</option>
                <option value="RESOURCE">Resources</option>
                <option value="ASSET">Assets</option>
              </select>

              {/* Stock Filter */}
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Stock</option>
                <option value="low">Low Stock</option>
                <option value="ok">In Stock</option>
              </select>

              {/* Results count */}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredInventory.length}/{inventory.length}
              </span>

              {/* Action Buttons */}
              <PermissionGate page="inventory" permission="write">
                <div className="flex items-center gap-2 ml-auto">
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
                  />
                  <button
                    type="button"
                    onClick={handleCreateItem}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 transition-all font-medium text-sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenScanner}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 transition-all font-medium text-sm"
                  >
                    <CameraIcon className="h-4 w-4" />
                    Scan
                  </button>
                </div>
              </PermissionGate>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Inventory Update */}
      <Modal isOpen={isModalOpen && modalContent === 'inventory-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'inventory-form' && editingInventory && (
          <InventoryUpdateForm
            inventoryItem={editingInventory}
            onSubmit={handleSubmitUpdate}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Modal: Barcode Scanner */}
      <Modal isOpen={isModalOpen && modalContent === 'barcode-scan'} onClose={closeModal} title="Scan Barcode">
        {isModalOpen && modalContent === 'barcode-scan' && (
          <BarcodeScanner
            onDetected={(code) => handleDetectedBarcode(code)}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Modal: Add Item (prefilled with scanned code) */}
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
