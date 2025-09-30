import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ExclamationTriangleIcon, PencilIcon, PlusIcon, CameraIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { inventoryAPI, itemsAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';
import BarcodeScanner from '../components/BarcodeScanner';
import ItemForm from '../components/ItemForm';
import PermissionGate from '../components/PermissionGate';

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
  usePermissionRefresh();

  // Check permissions at page level
  if (!hasPermission('inventory', 'read') && 
      !hasPermission('inventory', 'write') && 
      !hasPermission('inventory', 'delete') && 
      !hasPermission('inventory', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingInventory, setEditingInventory] = useState(null);
  const [scannedCode, setScannedCode] = useState('');

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

      setInventory(inventoryRes.data);
      setItems(itemsRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load inventory data');
      console.error(err);
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

  const isLowStock = (item) => item.quantity <= item.min_stock_level;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <PermissionGate page="inventory" permission="write">
            <button
              type="button"
              onClick={handleCreateItem}
              className="btn-primary inline-flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Item
            </button>
          </PermissionGate>
          <PermissionGate page="inventory" permission="write">
            <button
              type="button"
              onClick={handleOpenScanner}
              className="btn-secondary inline-flex items-center"
            >
              <CameraIcon className="h-5 w-5 mr-2" />
              Scan
            </button>
          </PermissionGate>
        </div>
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

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={inventory}
          columns={[
            { key: 'item', title: 'Item', render: (_, item) => getItemName(item.item_id) },
            { key: 'sku', title: 'SKU', render: (_, item) => getItemSku(item.item_id) },
            { key: 'quantity', title: 'Stock' },
            { key: 'min_stock_level', title: 'Min' },
            { key: 'status', title: 'Status', render: (_, item) => (isLowStock(item) ? 'Low' : 'OK') },
            { key: 'location', title: 'Location', render: (v) => v || '-' },
          ]}
          onEdit={(item) => handleUpdateInventory(item)}
          editPermission={{ page: 'inventory', permission: 'write' }}
          emptyMessage="No inventory items found"
        />
        {/* No primary add action on Inventory; updates are per-row */}
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
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
                  {inventory.map((item) => (
                    <tr key={item.id} className={isLowStock(item) ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getItemName(item.item_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getItemSku(item.item_id)}
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
                        <PermissionGate page="inventory" permission="write">
                          <button
                            onClick={() => handleUpdateInventory(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {inventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No inventory items found. Add items to start tracking inventory.</p>
                </div>
              )}
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
