/*
 * ============================================================
 * FILE: Modal_History_Sales.jsx
 *
 * PURPOSE:
 *   Full-screen modal that displays a scrollable list of past sales transactions.
 *   Provides a sidebar with filter controls for transaction type, price range,
 *   and date range so the user can narrow the displayed history.
 *
 * FUNCTIONAL PARTS:
 *   [1] Header — title with transaction count badge
 *   [2] Scrollable Transaction List — renders each sale with date, client, items, total, and payment method
 *   [3] Footer — close/cancel button
 *   [4] Right Sidebar Filters — services/products toggle pills, price range inputs, date range inputs, clear button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React from 'react';
import Modal from './Modal';
import { ClockIcon } from '@heroicons/react/24/outline';

// ─── 1 COMPONENT DEFINITION & JSX RENDER ─────────────────────────────────
export default function Modal_History_Sales({
  isOpen,
  onClose,
  filteredHistory,
  historyFilters,
  setHistoryFilters,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      {/* ========== MAIN CONTAINER ========== */}
      <div className="flex flex-col md:flex-row h-full bg-white dark:bg-gray-900">
        {/* ========== LEFT CONTENT AREA (Header + Body + Footer) ========== */}
        <div className="flex-1 flex flex-col">
          {/* ========== HEADER SECTION ========== */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sales History</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">({filteredHistory.length})</span>
            </div>
          </div>

          {/* ========== SCROLLABLE BODY CONTENT ========== */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <ClockIcon className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No transactions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting filters or complete a sale.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredHistory.map((sale) => (
                  <div key={sale.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' '}
                          {new Date(sale.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {sale.client && (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{sale.client.name}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {sale.items.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">${sale.total.toFixed(2)}</div>
                      <div className="text-xs text-gray-400 capitalize">{sale.paymentMethod}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========== FOOTER WITH CANCEL BUTTON ========== */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-center">
            <button
              onClick={onClose}
              className="btn-app-cancel font-medium"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR (FILTERS) ========== */}
        <div className="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col gap-3 p-4">
            {/* ========== SERVICES & PRODUCTS FILTER ========== */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Filters</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryFilters((prev) => ({ ...prev, showServices: !prev.showServices }))}
                  aria-pressed={historyFilters.showServices}
                  className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                    historyFilters.showServices
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  Services
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilters((prev) => ({ ...prev, showProducts: !prev.showProducts }))}
                  aria-pressed={historyFilters.showProducts}
                  className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                    historyFilters.showProducts
                      ? 'bg-secondary-600 text-white border-secondary-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  Products
                </button>
              </div>
            </div>

            {/* ========== PRICE RANGE FILTER ========== */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Price Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={historyFilters.minPrice}
                  onChange={(e) => setHistoryFilters((prev) => ({ ...prev, minPrice: e.target.value }))}
                  placeholder="Min $"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={historyFilters.maxPrice}
                  onChange={(e) => setHistoryFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="Max $"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg- gray-800 text-sm"
                />
              </div>
            </div>

            {/* ========== DATE RANGE FILTER ========== */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Date Range</label>
              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  value={historyFilters.startDate}
                  onChange={(e) => setHistoryFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
                <input
                  type="date"
                  value={historyFilters.endDate}
                  onChange={(e) => setHistoryFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            </div>

            {/* ========== CLEAR FILTERS BUTTON ========== */}
            <button
              onClick={() => setHistoryFilters({ showServices: true, showProducts: true, minPrice: '', maxPrice: '', startDate: '', endDate: '' })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
