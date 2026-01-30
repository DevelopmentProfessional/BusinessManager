import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { ExclamationTriangleIcon, PencilIcon, PlusIcon, CameraIcon, TrashIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { inventoryAPI, itemsAPI } from '../services/api';
import Modal from './components/Modal';
import MobileTable from './components/MobileTable';
import BarcodeScanner from './components/BarcodeScanner';
import ItemForm from './components/ItemForm';
import PermissionGate from './components/PermissionGate';
import CSVImportButton from './components/CSVImportButton';

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Update Inventory
        </h3>
      </div>

      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
          Current Quantity *
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

      <div>
        <label htmlFor="minStockLevel" className="block text-sm font-medium text-gray-700">
          Minimum Stock Level *
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

      <div className="flex justify-end space-x-3 pt-4">
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Low Stock Alert */}
      {inventory.filter(isLowStock).length > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">
              {inventory.filter(isLowStock).length} item(s) are running low on stock!
            </span>
          </div>
        </div>
      )}

      {/* Mobile Search and Filter Bar */}
      <div className="mt-4 flex flex-col gap-3 md:hidden">
        {/* Search Input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="PRODUCT">Products</option>
            <option value="RESOURCE">Resources</option>
            <option value="ASSET">Assets</option>
          </select>
        </div>

        {/* Stock Filter */}
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="all">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="ok">In Stock</option>
        </select>

        {/* Results count */}
        <div className="text-sm text-gray-500">
          Showing {filteredInventory.length} of {inventory.length} items
        </div>
      </div>

      {/* Mobile view - fills space, MobileTable scrolls inside */}
      <div className="mt-4 md:hidden flex-1 min-h-0 flex flex-col">
        <MobileTable
          data={filteredInventory}
          columns={[
            { key: 'item', title: 'Item', render: (_, item) => getItemName(item.item_id) },
            { key: 'sku', title: 'SKU', render: (_, item) => getItemSku(item.item_id) },
            { key: 'type', title: 'Type', render: (_, item) => (
              <span className={`px-2 py-1 text-xs rounded-full ${getItemTypeColor(getItemType(item.item_id))}`}>
                {getItemTypeLabel(getItemType(item.item_id))}
              </span>
            )},
            { key: 'quantity', title: 'Stock' },
            { key: 'min_stock_level', title: 'Min' },
            { key: 'status', title: 'Status', render: (_, item) => (isLowStock(item) ? 'Low' : 'OK') },
            { key: 'location', title: 'Location', render: (v) => v || '-' },
          ]}
          onEdit={(item) => handleUpdateInventory(item)}
          onDelete={(item) => handleDeleteItem(item.item_id)}
          editPermission={{ page: 'inventory', permission: 'write' }}
          deletePermission={{ page: 'inventory', permission: 'delete' }}
          emptyMessage="No inventory items found"
        />
      </div>

      {/* Desktop table - scrolls inside, page does not */}
      <div className="mt-4 hidden md:flex flex-1 flex-col min-h-0 overflow-auto">
        <div className="-mx-4 -my-2 sm:-mx-6 lg:-mx-8 flex-1 min-h-0">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {/* Desktop Search, Filters, and Action Buttons - Inside Table Container */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left side: Search and Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                      />
                    </div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2">
                      <FunnelIcon className="h-4 w-4 text-gray-400" />
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                      >
                        <option value="all">All Types</option>
                        <option value="PRODUCT">Products</option>
                        <option value="RESOURCE">Resources</option>
                        <option value="ASSET">Assets</option>
                      </select>
                    </div>

                    {/* Stock Filter */}
                    <select
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    >
                      <option value="all">All Stock</option>
                      <option value="low">Low Stock</option>
                      <option value="ok">In Stock</option>
                    </select>

                    {/* Results count */}
                    <span className="text-sm text-gray-500">
                      {filteredInventory.length} of {inventory.length} items
                    </span>
                  </div>

                  {/* Right side: Action Buttons */}
                  <PermissionGate page="inventory" permission="write">
                    <div className="flex items-center gap-2">
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
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium text-sm"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Item
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium text-sm"
                      >
                        <CameraIcon className="h-4 w-4" />
                        Scan
                      </button>
                    </div>
                  </PermissionGate>
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className={isLowStock(item) ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getItemName(item.item_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getItemSku(item.item_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getItemTypeColor(getItemType(item.item_id))}`}>
                          {getItemTypeLabel(getItemType(item.item_id))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.min_stock_level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          isLowStock(item)
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isLowStock(item) ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <PermissionGate page="inventory" permission="write">
                            <button
                              onClick={() => handleUpdateInventory(item)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit inventory"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                          </PermissionGate>
                          <PermissionGate page="inventory" permission="delete">
                            <button
                              onClick={() => handleDeleteItem(item.item_id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete item"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredInventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {inventory.length === 0 
                      ? 'No inventory items found. Add items to start tracking inventory.'
                      : 'No items match your current filters.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Bottom Center (Mobile) */}
      <PermissionGate page="inventory" permission="write">
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30 flex gap-2 md:hidden">
          <button
            type="button"
            onClick={handleCreateItem}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2 transition-all font-medium text-sm"
          >
            <PlusIcon className="h-5 w-5" />
            Add Item
          </button>
          <button
            type="button"
            onClick={handleOpenScanner}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2 transition-all font-medium text-sm"
          >
            <CameraIcon className="h-5 w-5" />
            Scan
          </button>
        </div>
      </PermissionGate>

      
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
