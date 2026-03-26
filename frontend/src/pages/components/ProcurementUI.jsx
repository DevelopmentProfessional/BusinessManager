/**
 * ============================================================
 * FILE: ProcurementUI.jsx
 *
 * PURPOSE:
 *   Procurement order management component for suppliers.
 *   Create, view, and manage purchase orders with suppliers.
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import api, { inventoryAPI } from '../../services/api';

const ProcurementUI = ({ supplierId, onPOCreated }) => {
  const [showModal, setShowModal] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: supplierId,
    line_items: [{ inventory_id: '', quantity_ordered: 1, unit_price: 0 }],
    expected_delivery_date: '',
    notes: '',
  });

  useEffect(() => {
    loadPurchaseOrders();
    loadInventoryItems();
  }, [supplierId]);

  const loadPurchaseOrders = async () => {
    try {
      const response = await api.get(`/purchase-orders?supplier_id=${supplierId}`);
      setPurchaseOrders(response?.data ?? []);
    } catch (error) {
      console.error('Failed to load POs:', error);
    }
  };

  const loadInventoryItems = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventoryItems(response?.data ?? response ?? []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  };

  const handleAddLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        { inventory_id: '', quantity_ordered: 1, unit_price: 0 },
      ],
    });
  };

  const handleRemoveLineItem = (index) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index),
    });
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...formData.line_items];
    updated[index] = {
      ...updated[index],
      [field]: field === 'quantity_ordered' || field === 'unit_price' ? parseFloat(value) : value,
    };
    setFormData({ ...formData, line_items: updated });
  };

  const calculateLineTotal = (item) => {
    return (item.quantity_ordered || 0) * (item.unit_price || 0);
  };

  const calculatePOTotal = () => {
    return formData.line_items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const handleCreatePO = async () => {
    try {
      setLoading(true);
      const payload = {
        supplier_id: formData.supplier_id,
        expected_delivery_date: formData.expected_delivery_date,
        items: formData.line_items.map(item => ({
          inventory_id: item.inventory_id,
          quantity: item.quantity_ordered,
          unit_price: item.unit_price,
        })),
      };

      const response = await api.post('/purchase-orders', payload);
      const newPO = response?.data;
      setPurchaseOrders([newPO, ...purchaseOrders]);
      setShowModal(false);
      setFormData({
        supplier_id: supplierId,
        line_items: [{ inventory_id: '', quantity_ordered: 1, unit_price: 0 }],
        expected_delivery_date: '',
        notes: '',
      });
      onPOCreated?.();
    } catch (error) {
      console.error('Failed to create PO:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPO = async (poId) => {
    try {
      await api.put(`/purchase-orders/${poId}/send`);
      loadPurchaseOrders();
    } catch (error) {
      console.error('Failed to send PO:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      received: 'bg-purple-100 text-purple-800',
      invoiced: 'bg-orange-100 text-orange-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4 bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">📋 Procurement Orders</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Create PO
        </button>
      </div>

      {/* Purchase Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-900">PO Number</th>
              <th className="px-4 py-2 text-left font-medium text-gray-900">Order Date</th>
              <th className="px-4 py-2 text-right font-medium text-gray-900">Total</th>
              <th className="px-4 py-2 text-center font-medium text-gray-900">Status</th>
              <th className="px-4 py-2 text-right font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  No purchase orders yet. Create one to get started.
                </td>
              </tr>
            ) : (
              purchaseOrders.map(po => (
                <tr key={po.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-900">{po.po_number}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(po.order_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    ${po.total_amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(po.status)}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {po.status === 'draft' && (
                      <button
                        onClick={() => handleSendPO(po.id)}
                        className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Send to supplier"
                      >
                        <PaperAirplaneIcon className="w-4 h-4" />
                        Send
                      </button>
                    )}
                    {po.status === 'confirmed' && (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckIcon className="w-4 h-4" />
                        Confirmed
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create PO Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Create Purchase Order</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-900">Line Items</label>
                  <button
                    onClick={handleAddLineItem}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.line_items.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <label className="text-xs font-medium text-gray-700 block mb-1">Item</label>
                          <select
                            value={item.inventory_id}
                            onChange={e => handleLineItemChange(idx, 'inventory_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select item...</option>
                            {inventoryItems.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs font-medium text-gray-700 block mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity_ordered}
                            onChange={e => handleLineItemChange(idx, 'quantity_ordered', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="text-xs font-medium text-gray-700 block mb-1">Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => handleLineItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div className="col-span-2 text-right">
                          <p className="text-xs font-medium text-gray-700 mb-1">Total</p>
                          <p className="font-bold text-gray-900">
                            ${calculateLineTotal(item).toFixed(2)}
                          </p>
                        </div>

                        {formData.line_items.length > 1 && (
                          <div className="col-span-1">
                            <button
                              onClick={() => handleRemoveLineItem(idx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PO Total */}
              <div className="border-t pt-4 bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Purchase Order Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${calculatePOTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special instructions, payment terms, etc."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-6 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePO}
                  disabled={loading || formData.line_items.some(i => !i.inventory_id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create PO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementUI;
