/**
 * ============================================================
 * FILE: InventoryIntelligence.jsx
 *
 * PURPOSE:
 *   Integrated inventory insights component for the inventory
 *   page. Shows stock levels, reorder recommendations, ABC analysis.
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const InventoryIntelligence = ({ onCreatePO }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadInventoryInsights();
  }, []);
  
  const loadInventoryInsights = async () => {
    try {
      const response = await api.get('/inventory-costs?low_stock_only=false');
      setInsights(response?.data ?? []);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Categorize by value/turnover (ABC analysis)
  const abcAnalysis = () => {
    const sorted = [...insights].sort((a, b) => {
      const aValue = (a.current_quantity * (a.actual_cost || 0));
      const bValue = (b.current_quantity * (b.actual_cost || 0));
      return bValue - aValue;
    });
    
    const total = sorted.length;
    const aItems = sorted.slice(0, Math.ceil(total * 0.2)); // Top 20%
    const bItems = sorted.slice(Math.ceil(total * 0.2), Math.ceil(total * 0.8)); // Middle 60%
    const cItems = sorted.slice(Math.ceil(total * 0.8)); // Bottom 20%
    
    return { aItems, bItems, cItems };
  };
  
  const { aItems, bItems, cItems } = abcAnalysis();
  
  const lowStockCount = insights.filter(i => i.should_reorder).length;
  const totalInventoryValue = insights.reduce((sum, i) => sum + (i.current_quantity * (i.actual_cost || 0)), 0);
  
  return (
    <div className="space-y-6 bg-white rounded-lg shadow-lg p-6 mt-6 border-t-4 border-blue-600">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">📊 Inventory Intelligence</h3>
        <button
          onClick={loadInventoryInsights}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          Refresh
        </button>
      </div>
      
      {loading ? (
        <p className="text-gray-600">Loading inventory insights...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{insights.length}</p>
            </div>
            
            <div className={`bg-gradient-to-br ${lowStockCount > 0 ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100'} rounded-lg p-4`}>
              <p className="text-gray-600 text-sm">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{lowStockCount}</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${totalInventoryValue.toFixed(0)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Avg Stock Level</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(insights.reduce((sum, i) => sum + i.current_quantity, 0) / insights.length).toFixed(0)}
              </p>
            </div>
          </div>
          
          {/* Low Stock Alert */}
          {lowStockCount > 0 && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
              <div className="flex gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">{lowStockCount} items need reordering</p>
                  <p className="text-sm text-red-800">Expected stockouts in:</p>
                  <ul className="text-sm text-red-800 mt-1 ml-4 list-disc">
                    {insights
                      .filter(i => i.should_reorder && i.estimated_days_until_stockout)
                      .slice(0, 3)
                      .map(i => (
                        <li key={i.inventory_id}>
                          <strong>{i.inventory_name}</strong>: {i.estimated_days_until_stockout.toFixed(0)} days
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* ABC Analysis */}
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">ABC Inventory Analysis</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-red-50 p-3 rounded">
                <p className="text-red-700 font-bold text-lg">A Items</p>
                <p className="text-gray-600 text-sm">{aItems.length} critical items (20%)</p>
                <p className="text-xs text-gray-600 mt-1">Highest value - strict control</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <p className="text-yellow-700 font-bold text-lg">B Items</p>
                <p className="text-gray-600 text-sm">{bItems.length} important items (60%)</p>
                <p className="text-xs text-gray-600 mt-1">Medium value - regular monitoring</p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-green-700 font-bold text-lg">C Items</p>
                <p className="text-gray-600 text-sm">{cItems.length} standard items (20%)</p>
                <p className="text-xs text-gray-600 mt-1">Lower value - loose control</p>
              </div>
            </div>
          </div>
          
          {/* Reorder Recommendations */}
          {insights.filter(i => i.should_reorder).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">📦 Reorder Recommendations</h4>
              <div className="space-y-2">
                {insights
                  .filter(i => i.should_reorder)
                  .slice(0, 5)
                  .map(item => (
                    <div key={item.inventory_id} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.inventory_name}</p>
                        <p className="text-sm text-gray-600">
                          Current: {item.current_quantity} | Reorder: {item.reorder_quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => onCreatePO?.(item.inventory_id)}
                        className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Create PO
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* Detailed Stock Levels */}
          <details className="border rounded-lg">
            <summary className="p-4 cursor-pointer font-semibold text-gray-900 flex items-center gap-2 hover:bg-gray-50">
              <ChevronDownIcon className="w-5 h-5" />
              View All Stock Levels
            </summary>
            <div className="border-t p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-center px-3 py-2 font-medium">Current</th>
                      <th className="text-center px-3 py-2 font-medium">Reorder Point</th>
                      <th className="text-center px-3 py-2 font-medium">Reorder Qty</th>
                      <th className="text-center px-3 py-2 font-medium">Days Until Stock Out</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.map(item => (
                      <tr key={item.inventory_id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{item.inventory_name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-white font-bold ${
                            item.current_quantity <= item.reorder_point ? 'bg-red-600' : 'bg-green-600'
                          }`}>
                            {item.current_quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{item.reorder_point}</td>
                        <td className="px-3 py-2 text-center font-medium">{item.reorder_quantity}</td>
                        <td className="px-3 py-2 text-center">
                          {item.estimated_days_until_stockout
                            ? `${item.estimated_days_until_stockout.toFixed(1)} days`
                            : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.should_reorder
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {item.should_reorder ? '⚠️ Low' : '✓ OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default InventoryIntelligence;
