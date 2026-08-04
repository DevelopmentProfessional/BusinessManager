/**
 * ============================================================
 * FILE: Dashboard_Financial.jsx
 *
 * PURPOSE:
 *   Comprehensive financial controls dashboard for decision making.
 *   Shows AR, AP, GL, cash position, KPIs.
 * ============================================================
 */

import React, { useEffect, useState } from "react";
import { CurrencyDollarIcon, ExclamationTriangleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import api from "../../services/api";

const Dashboard_Financial = () => {
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

  if (loading) return <div className="p-1 text-center">Loading financial data...</div>;

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="gap-4 grid grid-cols-1 md:grid-cols-3">
        {/* Cash Position */}
        <div className="bg-white border-blue-600 border-l-4 p-1 rounded-lg shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Cash Position</p>
              <p className="font-bold mt-2 text-3xl text-gray-900">${((arData?.total_outstanding || 0) - (apData?.total_payable || 0)).toFixed(2)}</p>
            </div>
            <CurrencyDollarIcon className="h-8 text-blue-600 w-8" />
          </div>
          <p className="mt-2 text-gray-500 text-xs">AR - AP</p>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-white border-green-600 border-l-4 p-1 rounded-lg shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total AR</p>
              <p className="font-bold mt-2 text-3xl text-gray-900">${(arData?.total_outstanding || 0).toFixed(2)}</p>
            </div>
            <ArrowTrendingUpIcon className="h-8 text-green-600 w-8" />
          </div>
          <p className="mt-2 text-gray-500 text-xs">Money owed TO you</p>
        </div>

        {/* Accounts Payable */}
        <div className="bg-white border-l-4 border-red-600 p-1 rounded-lg shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total AP</p>
              <p className="font-bold mt-2 text-3xl text-gray-900">${(apData?.total_payable || 0).toFixed(2)}</p>
            </div>
            <ArrowTrendingDownIcon className="h-8 text-red-600 w-8" />
          </div>
          <p className="mt-2 text-gray-500 text-xs">Money you OWE</p>
        </div>
      </div>

      {/* AR Aging */}
      {arData && (
        <div className="bg-white p-1 rounded-lg shadow">
          <h3 className="font-semibold mb-4 text-gray-900 text-lg">Accounts Receivable Aging</h3>
          <div className="gap-4 grid grid-cols-4">
            {[
              { label: "Current", count: arData.by_age?.current || 0, color: "bg-green-100 text-green-700" },
              { label: "30 Days", count: arData.by_age?.["30_days"] || 0, color: "bg-yellow-100 text-yellow-700" },
              { label: "60 Days", count: arData.by_age?.["60_days"] || 0, color: "bg-orange-100 text-orange-700" },
              { label: "90+ Days", count: arData.by_age?.["90_plus"] || 0, color: "bg-red-100 text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`${item.color} rounded-lg p-1 text-center`}>
                <p className="font-bold text-2xl">{item.count}</p>
                <p className="font-medium text-sm">{item.label}</p>
              </div>
            ))}
          </div>
          {arData.by_age?.["90_plus"] > 0 && (
            <div className="bg-red-50 border border-red-200 flex gap-2 mt-4 p-1 rounded-lg">
              <ExclamationTriangleIcon className="flex-shrink-0 h-5 text-red-600 w-5" />
              <p className="text-red-800 text-sm">{arData.by_age["90_plus"]} invoices are 90+ days overdue. Consider collections action.</p>
            </div>
          )}
        </div>
      )}

      {/* AP Aging */}
      {apData && (
        <div className="bg-white p-1 rounded-lg shadow">
          <h3 className="font-semibold mb-4 text-gray-900 text-lg">Accounts Payable Aging</h3>
          <div className="gap-4 grid grid-cols-4">
            {[
              { label: "Current", count: apData.by_age?.current || 0, color: "bg-green-100 text-green-700" },
              { label: "30 Days", count: apData.by_age?.["30_days"] || 0, color: "bg-yellow-100 text-yellow-700" },
              { label: "60 Days", count: apData.by_age?.["60_days"] || 0, color: "bg-orange-100 text-orange-700" },
              { label: "90+ Days", count: apData.by_age?.["90_plus"] || 0, color: "bg-red-100 text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`${item.color} rounded-lg p-1 text-center`}>
                <p className="font-bold text-2xl">{item.count}</p>
                <p className="font-medium text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alerting */}
      {inventoryCosts && inventoryCosts.length > 0 && (
        <div className="bg-white p-1 rounded-lg shadow">
          <h3 className="flex font-semibold gap-2 items-center mb-4 text-gray-900 text-lg">
            <ExclamationTriangleIcon className="h-5 text-orange-600 w-5" />
            Low Stock Items - Action Needed
          </h3>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="font-medium px-1 py-0 text-gray-600 text-left">Item</th>
                  <th className="font-medium px-1 py-0 text-gray-600 text-left">Qty</th>
                  <th className="font-medium px-1 py-0 text-gray-600 text-left">Reorder Point</th>
                  <th className="font-medium px-1 py-0 text-gray-600 text-left">Qty to Order</th>
                  <th className="font-medium px-1 py-0 text-gray-600 text-left">Days Until Empty</th>
                </tr>
              </thead>
              <tbody>
                {inventoryCosts.map((item) => (
                  <tr key={item.inventory_id} className="border-b hover:bg-gray-50">
                    <td className="px-1 py-1">{item.inventory_name}</td>
                    <td className="px-1 py-1">
                      <span className={`px-0 py-1 rounded ${item.current_quantity <= item.reorder_point ? "bg-red-100 text-red-700 font-bold" : "bg-gray-100 text-gray-700"}`}>{item.current_quantity}</span>
                    </td>
                    <td className="px-1 py-1">{item.reorder_point}</td>
                    <td className="font-medium px-1 py-1">{item.reorder_quantity}</td>
                    <td className="px-1 py-1">{item.estimated_days_until_stockout?.toFixed(1) || "N/A"} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 p-1 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-900">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button className="bg-white border border-blue-300 hover:bg-blue-50 px-1 py-0 rounded-lg text-blue-700">Invoice</button>
          <button className="bg-white border border-blue-300 hover:bg-blue-50 px-1 py-0 rounded-lg text-blue-700">Order</button>
          <button className="bg-white border border-blue-300 hover:bg-blue-50 px-1 py-0 rounded-lg text-blue-700">Ledger</button>
          <button className="bg-white border border-blue-300 hover:bg-blue-50 px-1 py-0 rounded-lg text-blue-700">Remind</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard_Financial;
