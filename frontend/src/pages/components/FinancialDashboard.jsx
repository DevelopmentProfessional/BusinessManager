/**
 * ============================================================
 * FILE: FinancialDashboard.jsx
 *
 * PURPOSE:
 *   Comprehensive financial controls dashboard for decision making.
 *   Shows AR, AP, GL, cash position, KPIs.
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { CurrencyDollarIcon, ExclamationTriangleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import api from "../../services/api";

const FinancialDashboard = () => {
  const [arData, setArData] = useState(null);
  const [apData, setApData] = useState(null);
  const [inventoryCosts, setInventoryCosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      const [arRes, apRes, icRes] = await Promise.all([api.get("/accounts-receivable"), api.get("/accounts-payable"), api.get("/inventory-costs?low_stock_only=true")]);

      setArData(arRes?.data ?? null);
      setApData(apRes?.data ?? null);
      setInventoryCosts(icRes?.data ?? null);
    } catch (error) {
      console.error("Failed to load financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading financial data...</div>;

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cash Position */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Cash Position</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${((arData?.total_outstanding || 0) - (apData?.total_payable || 0)).toFixed(2)}</p>
            </div>
            <CurrencyDollarIcon className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">AR - AP</p>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total AR</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${(arData?.total_outstanding || 0).toFixed(2)}</p>
            </div>
            <ArrowTrendingUpIcon className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Money owed TO you</p>
        </div>

        {/* Accounts Payable */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total AP</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${(apData?.total_payable || 0).toFixed(2)}</p>
            </div>
            <ArrowTrendingDownIcon className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Money you OWE</p>
        </div>
      </div>

      {/* AR Aging */}
      {arData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accounts Receivable Aging</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Current", count: arData.by_age?.current || 0, color: "bg-green-100 text-green-700" },
              { label: "30 Days", count: arData.by_age?.["30_days"] || 0, color: "bg-yellow-100 text-yellow-700" },
              { label: "60 Days", count: arData.by_age?.["60_days"] || 0, color: "bg-orange-100 text-orange-700" },
              { label: "90+ Days", count: arData.by_age?.["90_plus"] || 0, color: "bg-red-100 text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`${item.color} rounded-lg p-4 text-center`}>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
          {arData.by_age?.["90_plus"] > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{arData.by_age["90_plus"]} invoices are 90+ days overdue. Consider collections action.</p>
            </div>
          )}
        </div>
      )}

      {/* AP Aging */}
      {apData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accounts Payable Aging</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Current", count: apData.by_age?.current || 0, color: "bg-green-100 text-green-700" },
              { label: "30 Days", count: apData.by_age?.["30_days"] || 0, color: "bg-yellow-100 text-yellow-700" },
              { label: "60 Days", count: apData.by_age?.["60_days"] || 0, color: "bg-orange-100 text-orange-700" },
              { label: "90+ Days", count: apData.by_age?.["90_plus"] || 0, color: "bg-red-100 text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`${item.color} rounded-lg p-4 text-center`}>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alerting */}
      {inventoryCosts && inventoryCosts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
            Low Stock Items - Action Needed
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Reorder Point</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Qty to Order</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Days Until Empty</th>
                </tr>
              </thead>
              <tbody>
                {inventoryCosts.map((item) => (
                  <tr key={item.inventory_id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{item.inventory_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded ${item.current_quantity <= item.reorder_point ? "bg-red-100 text-red-700 font-bold" : "bg-gray-100 text-gray-700"}`}>{item.current_quantity}</span>
                    </td>
                    <td className="px-4 py-3">{item.reorder_point}</td>
                    <td className="px-4 py-3 font-medium">{item.reorder_quantity}</td>
                    <td className="px-4 py-3">{item.estimated_days_until_stockout?.toFixed(1) || "N/A"} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">Create Invoice</button>
          <button className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">Create Purchase Order</button>
          <button className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">View GL Transactions</button>
          <button className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">Send Dunning Email</button>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
