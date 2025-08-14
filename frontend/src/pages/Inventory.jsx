import React, { useEffect, useState } from 'react';
import { ExclamationTriangleIcon, PencilIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { inventoryAPI, productsAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';

function InventoryUpdateForm({ inventoryItem, onSubmit, onCancel }) {
  const [quantity, setQuantity] = useState(inventoryItem?.quantity || 0);
  const [minStockLevel, setMinStockLevel] = useState(inventoryItem?.min_stock_level || 10);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(inventoryItem.product_id, { 
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
    inventory, setInventory, products, setProducts,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingInventory, setEditingInventory] = useState(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, productsRes] = await Promise.all([
        inventoryAPI.getAll(),
        productsAPI.getAll()
      ]);

      setInventory(inventoryRes.data);
      setProducts(productsRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load inventory data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInventory = (inventoryItem) => {
    setEditingInventory(inventoryItem);
    openModal('inventory-form');
  };

  const handleSubmitUpdate = async (productId, updateData) => {
    try {
      await inventoryAPI.update(productId, updateData.quantity);
      // Reload inventory to get updated data
      loadInventoryData();
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to update inventory');
      console.error(err);
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  const getProductSku = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.sku : 'N/A';
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
            { key: 'product', title: 'Product', render: (_, item) => getProductName(item.product_id) },
            { key: 'sku', title: 'SKU', render: (_, item) => getProductSku(item.product_id) },
            { key: 'quantity', title: 'Stock' },
            { key: 'min_stock_level', title: 'Min' },
            { key: 'status', title: 'Status', render: (_, item) => (isLowStock(item) ? 'Low' : 'OK') },
            { key: 'location', title: 'Location', render: (v) => v || '-' },
          ]}
          onEdit={(item) => handleUpdateInventory(item)}
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
                      Product
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
                        {getProductName(item.product_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getProductSku(item.product_id)}
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
                        <button
                          onClick={() => handleUpdateInventory(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {inventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No inventory items found. Add products to start tracking inventory.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Inventory Update Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && editingInventory && (
          <InventoryUpdateForm
            inventoryItem={editingInventory}
            onSubmit={handleSubmitUpdate}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
