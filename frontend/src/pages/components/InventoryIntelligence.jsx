/**
 * ============================================================
 * FILE: InventoryIntelligence.jsx
 *
 * PURPOSE:
 *   Drop-up insights panel for the Inventory page.
 *   Receives the already-loaded inventory array as a prop and
 *   computes all metrics locally — no separate API call needed.
 * ============================================================
 */

import React, { useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

/* ─── sub-components ────────────────────────────────────────── */

const Kpi = ({ label, value, color }) => {
  const colorMap = { red: "text-red-600", amber: "text-amber-600", green: "text-green-600" };
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</div>
      <div className={`text-lg font-bold leading-tight mt-0.5 ${colorMap[color] || "text-gray-900 dark:text-gray-100"}`}>{value}</div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</div>
    {children}
  </div>
);

const AbcCard = ({ label, subtitle, value, note, color }) => {
  const colorMap = {
    red: "bg-red-50   dark:bg-red-900/20   text-red-700   dark:text-red-300   border-red-200   dark:border-red-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  };
  return (
    <div className={`rounded-lg p-2 border text-center ${colorMap[color]}`}>
      <div className="font-bold text-sm">{label}</div>
      <div className="text-xs opacity-75">{subtitle}</div>
      <div className="text-xs font-semibold mt-0.5">{value}</div>
      <div className="text-xs opacity-60 mt-0.5">{note}</div>
    </div>
  );
};

/* ─── TYPE badge palette (matches Inventory.jsx) ────────────── */
const TYPE_COLORS = {
  PRODUCT: "bg-gray-100  text-gray-700  dark:bg-gray-700  dark:text-gray-300",
  RESOURCE: "bg-blue-100  text-blue-700  dark:bg-blue-900/40 dark:text-blue-300",
  ASSET: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  LOCATION: "bg-teal-100  text-teal-700  dark:bg-teal-900/40 dark:text-teal-300",
  BUNDLE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  MIX: "bg-pink-100  text-pink-700  dark:bg-pink-900/40 dark:text-pink-300",
  ITEM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

/* ─── helpers ────────────────────────────────────────────────── */
const NON_STOCK_TYPES = new Set(["LOCATION", "ASSET"]);

const fmtUSD = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* ─── main component ─────────────────────────────────────────── */
const InventoryIntelligence = ({ inventory = [], onClose }) => {
  const metrics = useMemo(() => {
    if (!inventory.length) return null;

    const isStockable = (i) => !NON_STOCK_TYPES.has((i.type || "PRODUCT").toUpperCase());

    // Stock health
    const outOfStock = inventory.filter((i) => isStockable(i) && i.quantity === 0);
    const lowStock = inventory.filter((i) => isStockable(i) && i.quantity > 0 && i.quantity <= i.min_stock_level);
    const healthy = inventory.filter((i) => isStockable(i) && i.quantity > i.min_stock_level);

    // Value metrics
    const totalValue = inventory.reduce((s, i) => s + (i.quantity || 0) * (i.price || 0), 0);
    const totalCost = inventory.reduce((s, i) => s + (i.quantity || 0) * (i.cost || 0), 0);

    // Margin (items where both price > 0 and cost > 0)
    const withBoth = inventory.filter((i) => (i.price || 0) > 0 && (i.cost || 0) > 0);
    const avgMargin = withBoth.length ? (withBoth.reduce((s, i) => s + (i.price - i.cost) / i.price, 0) / withBoth.length) * 100 : null;

    // Data-quality flags
    const missingPrice = inventory.filter((i) => (i.type || "PRODUCT").toUpperCase() === "PRODUCT" && !(i.price > 0));
    const missingSku = inventory.filter((i) => !i.sku);
    const missingCost = inventory.filter((i) => isStockable(i) && !(i.cost > 0));

    // By type
    const byType = {};
    inventory.forEach((i) => {
      const t = (i.type || "PRODUCT").toUpperCase();
      if (!byType[t]) byType[t] = { count: 0, value: 0 };
      byType[t].count++;
      byType[t].value += (i.quantity || 0) * (i.price || 0);
    });

    // By category (top 6)
    const byCat = {};
    inventory.forEach((i) => {
      const c = i.category || "—";
      byCat[c] = (byCat[c] || 0) + 1;
    });
    const topCategories = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // ABC analysis by total value (qty × price)
    const sorted = [...inventory].map((i) => ({ ...i, totalVal: (i.quantity || 0) * (i.price || 0) })).sort((a, b) => b.totalVal - a.totalVal);
    const n = sorted.length;
    const aEnd = Math.max(1, Math.ceil(n * 0.2));
    const bEnd = Math.max(aEnd, Math.ceil(n * 0.8));
    const aItems = sorted.slice(0, aEnd);
    const bItems = sorted.slice(aEnd, bEnd);
    const cItems = sorted.slice(bEnd);
    const aValue = aItems.reduce((s, i) => s + i.totalVal, 0);
    const bValue = bItems.reduce((s, i) => s + i.totalVal, 0);
    const cValue = cItems.reduce((s, i) => s + i.totalVal, 0);

    // Stock coverage ratio (avg qty / min_stock_level for items that have a min set)
    const withMin = inventory.filter((i) => isStockable(i) && i.min_stock_level > 0);
    const avgCoverage = withMin.length ? (withMin.reduce((s, i) => s + i.quantity / i.min_stock_level, 0) / withMin.length) * 100 : null;

    // Top value items (A-items, up to 5)
    const topValueItems = aItems.slice(0, 5);

    // Urgent reorders — sorted by qty / min ratio (lowest first)
    const reorders = inventory
      .filter((i) => isStockable(i) && i.quantity <= i.min_stock_level)
      .sort((a, b) => {
        const ra = a.quantity / Math.max(a.min_stock_level, 1);
        const rb = b.quantity / Math.max(b.min_stock_level, 1);
        return ra - rb;
      })
      .slice(0, 6);

    return {
      total: inventory.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      healthy: healthy.length,
      totalValue,
      totalCost,
      avgMargin,
      missingPrice: missingPrice.length,
      missingSku: missingSku.length,
      missingCost: missingCost.length,
      byType,
      topCategories,
      abc: {
        aCount: aItems.length,
        aValue,
        bCount: bItems.length,
        bValue,
        cCount: cItems.length,
        cValue,
      },
      avgCoverage,
      topValueItems,
      reorders,
    };
  }, [inventory]);

  if (!metrics) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4" style={{ width: 340 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Inventory Insights</span>
          <button onClick={onClose}>
            <XMarkIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <p className="text-sm text-gray-500">No inventory data loaded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-y-auto" style={{ width: 360, maxHeight: "72vh" }}>
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 py-2.5 z-10">
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Inventory Insights</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* ── KPIs ── */}
        <Section title="Overview">
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Total Items" value={metrics.total} />
            <Kpi label="In Stock" value={metrics.healthy} color="green" />
            <Kpi label="Low Stock" value={metrics.lowStock} color={metrics.lowStock > 0 ? "amber" : "green"} />
            <Kpi label="Out of Stock" value={metrics.outOfStock} color={metrics.outOfStock > 0 ? "red" : "green"} />
            <Kpi label="Inventory Value" value={fmtUSD(metrics.totalValue)} />
            {metrics.totalCost > 0 ? <Kpi label="Cost Basis" value={fmtUSD(metrics.totalCost)} /> : <Kpi label="Items w/ Cost" value={`${metrics.total - metrics.missingCost} / ${metrics.total}`} />}
            {metrics.avgMargin !== null && <Kpi label="Avg Margin" value={`${metrics.avgMargin.toFixed(1)}%`} color={metrics.avgMargin >= 30 ? "green" : "amber"} />}
            {metrics.avgCoverage !== null && <Kpi label="Stock Coverage" value={`${metrics.avgCoverage.toFixed(0)}%`} color={metrics.avgCoverage >= 100 ? "green" : "amber"} />}
          </div>
        </Section>

        {/* ── Data Quality ── */}
        {(metrics.missingPrice > 0 || metrics.missingSku > 0 || metrics.missingCost > 0) && (
          <Section title="Data Quality">
            <div className="space-y-1">
              {metrics.missingPrice > 0 && (
                <div className="flex justify-between text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded px-2 py-1">
                  <span>Products without a price</span>
                  <span className="font-semibold">{metrics.missingPrice}</span>
                </div>
              )}
              {metrics.missingSku > 0 && (
                <div className="flex justify-between text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded px-2 py-1">
                  <span>Items missing a SKU</span>
                  <span className="font-semibold">{metrics.missingSku}</span>
                </div>
              )}
              {metrics.missingCost > 0 && (
                <div className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded px-2 py-1">
                  <span>Items missing cost (for margin)</span>
                  <span className="font-semibold">{metrics.missingCost}</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── By Type ── */}
        <Section title="By Type">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(metrics.byType).map(([type, d]) => (
              <span key={type} className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}>
                {type.charAt(0) + type.slice(1).toLowerCase()}: {d.count}
                {d.value > 0 && <span className="opacity-60 ml-1">· {fmtUSD(d.value)}</span>}
              </span>
            ))}
          </div>
        </Section>

        {/* ── Top Categories ── */}
        {metrics.topCategories.length > 1 && (
          <Section title="Top Categories">
            <div className="space-y-1">
              {metrics.topCategories.map(([cat, count]) => {
                const pct = Math.round((count / metrics.total) * 100);
                return (
                  <div key={cat} className="flex items-center gap-2 text-xs">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden h-1.5">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 truncate" style={{ maxWidth: 120 }}>
                      {cat}
                    </span>
                    <span className="font-medium text-gray-500 flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── ABC Analysis ── */}
        <Section title="ABC Analysis (by value)">
          <div className="grid grid-cols-3 gap-1.5 mb-1">
            <AbcCard label="A" subtitle={`${metrics.abc.aCount} items`} value={fmtUSD(metrics.abc.aValue)} note="Top 20% — strict control" color="red" />
            <AbcCard label="B" subtitle={`${metrics.abc.bCount} items`} value={fmtUSD(metrics.abc.bValue)} note="Mid 60% — monitor" color="amber" />
            <AbcCard label="C" subtitle={`${metrics.abc.cCount} items`} value={fmtUSD(metrics.abc.cValue)} note="Bottom 20% — low priority" color="green" />
          </div>
        </Section>

        {/* ── Top Value Items ── */}
        {metrics.topValueItems.length > 0 && (
          <Section title="Highest Value Items">
            <div className="space-y-1">
              {metrics.topValueItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                  <span className="truncate mr-2">{item.name}</span>
                  <span className="font-medium flex-shrink-0 text-blue-600 dark:text-blue-400">{fmtUSD(item.totalVal)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Reorder List ── */}
        {metrics.reorders.length > 0 && (
          <Section title="Needs Reorder">
            <div className="space-y-1">
              {metrics.reorders.map((item) => {
                const pct = item.min_stock_level > 0 ? Math.round((item.quantity / item.min_stock_level) * 100) : 100;
                return (
                  <div key={item.id} className="text-xs bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
                    <div className="flex justify-between text-red-800 dark:text-red-200">
                      <span className="truncate mr-2 font-medium">{item.name}</span>
                      <span className="flex-shrink-0">
                        {item.quantity} / {item.min_stock_level}
                      </span>
                    </div>
                    <div className="mt-1 bg-red-200 dark:bg-red-800 rounded-full overflow-hidden h-1">
                      <div className={`h-full rounded-full ${pct === 0 ? "bg-gray-400" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

export default InventoryIntelligence;
