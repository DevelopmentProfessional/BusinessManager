/*
 * ============================================================
 * FILE: Modal_Forecast_Calculator.jsx
 *
 * PURPOSE:
 *   Financial forecasting tool ("Forecaster") that projects revenue, profit,
 *   and expenses over time (month/year/decade). Base revenue and expenses are
 *   calculated from detailed cost/revenue components rather than direct inputs.
 *   Users fill in granular parameters (COGS, marketing, customer metrics, etc.)
 *   and the system derives total projections.
 *
 * FUNCTIONAL PARTS:
 *   [1] State Management — inputs for all financial components, time period selection
 *   [2] Calculation Engine — derives base values from components, applies growth/factors
 *   [3] Chart Generation — displays projections as interactive charts
 *   [4] Parameter Sections — organized input groups for better UX
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-14 | Cascade | Removed header close button, moved view controls to footer, and wrapped summary tags in collapsible section
 *   2026-03-14 | Copilot | Remapped footer ranges: Year now shows 12 monthly points; Decade now shows 10 yearly points
 *   2026-03-09 | Claude  | Initial creation - comprehensive forecast calculator
 *   2026-03-09 | Claude  | Restructured to calculate base values from components
 *   2026-03-09 | Claude  | Recorded latest UI adjustments
 * ============================================================
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  XMarkIcon, CalculatorIcon,
  ChevronDownIcon, ChevronUpIcon
} from '@heroicons/react/24/outline';
import Modal from './Modal';
import Button_Toolbar from './Button_Toolbar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Modal_Forecast_Calculator({ isOpen, onClose }) {
  // ─── TIME PERIOD SETTINGS ───────────────────────────────────────────────
  const [timeView, setTimeView] = useState('month'); // month (12 monthly points), year (10 yearly points)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [revenueGrowthRate, setRevenueGrowthRate] = useState(5); // % per period
  const [discountRate, setDiscountRate] = useState(10); // % for NPV calculations
  const [initialInvestment, setInitialInvestment] = useState(0); // $ for ROI/break-even

  // ─── REVENUE COMPONENTS (Calculate base revenue from these) ─────────────
  const [productPrice, setProductPrice] = useState(100);
  const [unitsPerPeriod, setUnitsPerPeriod] = useState(100);
  const [serviceRevenue, setServiceRevenue] = useState(0);
  const [recurringRevenue, setRecurringRevenue] = useState(0);

  // ─── COLLAPSIBLE SECTIONS ───────────────────────────────────────────────
  const [showRevenueSection, setShowRevenueSection] = useState(false);
  const [showCostSection, setShowCostSection] = useState(false);
  const [showMarketingSection, setShowMarketingSection] = useState(false);
  const [showCustomerSection, setShowCustomerSection] = useState(false);
  const [showEconomicSection, setShowEconomicSection] = useState(false);
  const [showOperationalSection, setShowOperationalSection] = useState(false);
  const [showSummarySection, setShowSummarySection] = useState(false);
  const [showAdvancedSection, setShowAdvancedSection] = useState(false);
  const [showRiskSection, setShowRiskSection] = useState(false);

  // Cost of Goods Sold (COGS) & Shipping
  const [cogsPerUnit, setCogsPerUnit] = useState(0);
  const [unitsPerBatch, setUnitsPerBatch] = useState(100);
  const [shippingPerBatch, setShippingPerBatch] = useState(0);
  const [batchFrequency, setBatchFrequency] = useState(1); // per period

  // Marketing Parameters
  const [marketingBudget, setMarketingBudget] = useState(0);
  const [costPerThousandViews, setCostPerThousandViews] = useState(10);
  const [engagementToSaleRate, setEngagementToSaleRate] = useState(2); // %
  const [avgRevenuePerSale, setAvgRevenuePerSale] = useState(100);

  // Customer Behavior
  const [walkInCustomersPerPeriod, setWalkInCustomersPerPeriod] = useState(0);
  const [walkInConversionRate, setWalkInConversionRate] = useState(30); // %
  const [customerBuyBackRate, setCustomerBuyBackRate] = useState(0); // %
  const [buyBackFrequency, setBuyBackFrequency] = useState(3); // periods until buyback
  const [customerRetentionRate, setCustomerRetentionRate] = useState(85); // %

  // Economic Factors
  const [inflationRate, setInflationRate] = useState(3); // % per year
  const [depreciationRate, setDepreciationRate] = useState(0); // % per year

  // Phase 2: Advanced Revenue/Cost Factors
  const [seasonalityEnabled, setSeasonalityEnabled] = useState(false);
  const [seasonalityMultipliers, setSeasonalityMultipliers] = useState([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]); // 12 months
  const [cac, setCac] = useState(0); // Customer Acquisition Cost
  const [avgCustomerLifetimeMonths, setAvgCustomerLifetimeMonths] = useState(12);
  const [churnRate, setChurnRate] = useState(5); // % per period for recurring revenue
  const [capexItems, setCapexItems] = useState([]); // [{amount, period, depreciationYears, label}]
  const [variableLaborCostPercent, setVariableLaborCostPercent] = useState(0); // % of revenue

  // CapEx input states
  const [newCapexAmount, setNewCapexAmount] = useState('');
  const [newCapexPeriod, setNewCapexPeriod] = useState(0);
  const [newCapexDepYears, setNewCapexDepYears] = useState(5);
  const [newCapexLabel, setNewCapexLabel] = useState('');

  // Operational Costs
  const [oneTimePayments, setOneTimePayments] = useState([]); // [{amount, period, label}]
  const [recurringPayments, setRecurringPayments] = useState([]); // [{amount, frequency, label}]
  const [fixedMonthlyCosts, setFixedMonthlyCosts] = useState(0);

  // New payment inputs (temporary states)
  const [newOneTimeAmount, setNewOneTimeAmount] = useState('');
  const [newOneTimePeriod, setNewOneTimePeriod] = useState(0);
  const [newOneTimeLabel, setNewOneTimeLabel] = useState('');
  const [newRecurringAmount, setNewRecurringAmount] = useState('');
  const [newRecurringFreq, setNewRecurringFreq] = useState(1);
  const [newRecurringLabel, setNewRecurringLabel] = useState('');

  // Phase 3: Risk & Scenario Modeling
  const [scenarioEnabled, setScenarioEnabled] = useState(false);
  const [variancePercent, setVariancePercent] = useState(20); // +/- % for best/worst case
  const [monteCarloEnabled, setMonteCarloEnabled] = useState(false);
  const [monteCarloRuns, setMonteCarloRuns] = useState(100);
  const [sensitivityEnabled, setSensitivityEnabled] = useState(false);

  // Phase 4: Export & Reporting
  const [showExportSection, setShowExportSection] = useState(false);
  const [scenarioName, setScenarioName] = useState('Default Scenario');
  const [exportStatus, setExportStatus] = useState('');
  const [auditTrail, setAuditTrail] = useState([]);
  const importInputRef = useRef(null);
  const chartRef = useRef(null);
  const lastAuditSnapshotRef = useRef('');

  // ─── CALCULATION ENGINE ─────────────────────────────────────────────────
  const forecastData = useMemo(() => {
    const isMonthlyView = timeView === 'month';
    const periods = isMonthlyView ? 12 : 10;
    const labels = [];
    const revenueData = [];
    const expensesData = [];
    const profitData = [];
    const cumulativeProfitData = [];
    const cashFlowData = [];

    let cumulativeProfit = 0;
    let cumulativeCashFlow = -initialInvestment; // Start with negative initial investment
    let cumulativeCustomers = 0;
    let breakEvenPeriod = null;
    let npv = -initialInvestment; // NPV starts with initial investment

    const [startYear, startMonth] = startDate.split('-').map(Number);

    // Calculate base revenue from components
    const baseRevenue = (productPrice * unitsPerPeriod) + serviceRevenue + recurringRevenue;

    // Calculate base expenses from components
    let baseExpenses = 0;
    if (showCostSection) {
      baseExpenses += (cogsPerUnit * unitsPerBatch * batchFrequency) + (shippingPerBatch * batchFrequency);
    }
    if (showMarketingSection) {
      baseExpenses += marketingBudget;
    }
    if (showOperationalSection) {
      baseExpenses += fixedMonthlyCosts;
    }

    for (let i = 0; i < periods; i++) {
      // Generate label based on time view
      let label = '';
      if (isMonthlyView) {
        const date = new Date(startYear, startMonth - 1 + i, 1);
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        label = `${startYear + i}`;
      }
      labels.push(label);

      // Calculate growth factor considering time view
      const periodsPerYear = isMonthlyView ? 12 : 1;
      const growthMultiplier = Math.pow(1 + revenueGrowthRate / 100, i / periodsPerYear);

      // Base revenue with growth from components
      let periodRevenue = baseRevenue * growthMultiplier;

      // Phase 2: Apply seasonality multiplier (if enabled and viewing by month)
      if (seasonalityEnabled && isMonthlyView) {
        const monthIndex = (startMonth - 1 + i) % 12;
        periodRevenue *= seasonalityMultipliers[monthIndex];
      }

      // Phase 2: Apply churn rate to recurring revenue
      if (recurringRevenue > 0 && churnRate > 0 && i > 0) {
        const churnDecay = Math.pow(1 - churnRate / 100, i / periodsPerYear);
        periodRevenue *= churnDecay;
      }

      // Marketing contribution (if enabled)
      if (showMarketingSection && marketingBudget > 0) {
        const impressions = (marketingBudget / costPerThousandViews) * 1000;
        const engagements = impressions * (engagementToSaleRate / 100);
        const marketingRevenue = engagements * avgRevenuePerSale;
        periodRevenue += marketingRevenue;
      }

      // Walk-in customers (if enabled)
      if (showCustomerSection && walkInCustomersPerPeriod > 0) {
        const walkInSales = walkInCustomersPerPeriod * (walkInConversionRate / 100);
        periodRevenue += walkInSales * avgRevenuePerSale;
        cumulativeCustomers += walkInSales;
      }

      // Customer buy-back (if enabled and past initial buy period)
      if (showCustomerSection && customerBuyBackRate > 0 && i >= buyBackFrequency) {
        const buyBackCustomers = cumulativeCustomers * (customerBuyBackRate / 100);
        periodRevenue += buyBackCustomers * avgRevenuePerSale * 0.8; // Assuming lower avg on buyback
      }

      // Apply customer retention decay
      if (showCustomerSection && customerRetentionRate < 100) {
        const retentionFactor = Math.pow(customerRetentionRate / 100, i);
        periodRevenue *= (0.5 + 0.5 * retentionFactor); // Never drop below 50%
      }

      // Calculate expenses from components
      let periodExpenses = 0;

      // Base costs from operational section
      if (showOperationalSection) {
        periodExpenses += fixedMonthlyCosts;
      }

      // COGS (if enabled)
      if (showCostSection && cogsPerUnit > 0) {
        const totalUnits = unitsPerBatch * batchFrequency;
        const cogsCost = cogsPerUnit * totalUnits;
        const shippingCost = shippingPerBatch * batchFrequency;
        periodExpenses += cogsCost + shippingCost;
      }

      // Marketing costs
      if (showMarketingSection) {
        periodExpenses += marketingBudget;
      }

      // One-time payments
      if (showOperationalSection) {
        oneTimePayments.forEach(payment => {
          if (payment.period === i) {
            periodExpenses += Number(payment.amount) || 0;
          }
        });
      }

      // Recurring payments
      if (showOperationalSection) {
        recurringPayments.forEach(payment => {
          if (i % (Number(payment.frequency) || 1) === 0) {
            periodExpenses += Number(payment.amount) || 0;
          }
        });
      }

      // Phase 2: Customer Acquisition Cost (CAC)
      if (showAdvancedSection && cac > 0 && showCustomerSection && walkInCustomersPerPeriod > 0) {
        const newCustomers = walkInCustomersPerPeriod * (walkInConversionRate / 100);
        periodExpenses += newCustomers * cac;
      }

      // Phase 2: CapEx depreciation expense
      if (showAdvancedSection && capexItems.length > 0) {
        capexItems.forEach(capex => {
          if (i >= capex.period) {
            const periodsSinceCapex = i - capex.period;
            const depreciationPeriods = capex.depreciationYears * periodsPerYear;
            if (periodsSinceCapex < depreciationPeriods) {
              periodExpenses += capex.amount / depreciationPeriods;
            }
          }
        });
      }

      // Phase 2: Variable labor costs (scales with revenue)
      if (showAdvancedSection && variableLaborCostPercent > 0) {
        periodExpenses += periodRevenue * (variableLaborCostPercent / 100);
      }

      // Apply inflation (if enabled)
      if (showEconomicSection && inflationRate > 0) {
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, i / periodsPerYear);
        periodExpenses *= inflationMultiplier;
      }

      // Apply depreciation to reduce certain costs over time (simplified)
      if (showEconomicSection && depreciationRate > 0) {
        const depreciationFactor = Math.pow(1 - depreciationRate / 100, i / periodsPerYear);
        periodExpenses *= (0.7 + 0.3 * depreciationFactor); // Min 70% of original
      }

      // Calculate profit
      const periodProfit = periodRevenue - periodExpenses;
      cumulativeProfit += periodProfit;

      // Calculate cash flow (profit adjusted for initial investment timing)
      const periodCashFlow = periodProfit;
      cumulativeCashFlow += periodCashFlow;

      // NPV calculation: Discount each period's cash flow to present value
      const discountFactor = Math.pow(1 + discountRate / 100, i / periodsPerYear);
      const discountedCashFlow = periodCashFlow / discountFactor;
      npv += discountedCashFlow;

      // Detect break-even point (first period where cumulative cash flow becomes positive)
      if (breakEvenPeriod === null && cumulativeCashFlow > 0) {
        breakEvenPeriod = i;
      }

      revenueData.push(Math.round(periodRevenue));
      expensesData.push(Math.round(periodExpenses));
      profitData.push(Math.round(periodProfit));
      cumulativeProfitData.push(Math.round(cumulativeProfit));
      cashFlowData.push(Math.round(cumulativeCashFlow));
    }

    // Phase 3: Scenario modeling - calculate best/worst case if enabled
    const scenarioDatasets = [];
    if (scenarioEnabled) {
      const varianceMultiplier = variancePercent / 100;
      
      // Best case scenario (higher revenue, lower costs)
      const bestCaseProfit = [];
      let bestCumProfit = 0;
      for (let i = 0; i < periods; i++) {
        const bestRevenue = revenueData[i] * (1 + varianceMultiplier);
        const bestExpense = expensesData[i] * (1 - varianceMultiplier * 0.5); // Costs don't vary as much
        const bestProfit = bestRevenue - bestExpense;
        bestCumProfit += bestProfit;
        bestCaseProfit.push(Math.round(bestCumProfit));
      }
      
      // Worst case scenario (lower revenue, higher costs)
      const worstCaseProfit = [];
      let worstCumProfit = 0;
      for (let i = 0; i < periods; i++) {
        const worstRevenue = revenueData[i] * (1 - varianceMultiplier);
        const worstExpense = expensesData[i] * (1 + varianceMultiplier * 0.5);
        const worstProfit = worstRevenue - worstExpense;
        worstCumProfit += worstProfit;
        worstCaseProfit.push(Math.round(worstCumProfit));
      }
      
      scenarioDatasets.push(
        {
          label: 'Best Case',
          data: bestCaseProfit,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 2
        },
        {
          label: 'Worst Case',
          data: worstCaseProfit,
          borderColor: 'rgb(220, 38, 38)',
          backgroundColor: 'rgba(220, 38, 38, 0.05)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 2
        }
      );
    }

    return {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Expenses',
          data: expensesData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Profit',
          data: profitData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Cumulative Profit',
          data: cumulativeProfitData,
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Cumulative Cash Flow',
          data: cashFlowData,
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.3
        },
        ...scenarioDatasets
      ],
      baseRevenue,
      baseExpenses,
      npv: Math.round(npv),
      breakEvenPeriod,
      roi: initialInvestment > 0 ? ((cumulativeProfit / initialInvestment) * 100).toFixed(1) : null
    };
  }, [
    timeView, startDate, revenueGrowthRate, discountRate, initialInvestment,
    productPrice, unitsPerPeriod, serviceRevenue, recurringRevenue,
    showRevenueSection, showCostSection, cogsPerUnit, unitsPerBatch, shippingPerBatch, batchFrequency,
    showMarketingSection, marketingBudget, costPerThousandViews, engagementToSaleRate, avgRevenuePerSale,
    showCustomerSection, walkInCustomersPerPeriod, walkInConversionRate, customerBuyBackRate, buyBackFrequency, customerRetentionRate,
    showEconomicSection, inflationRate, depreciationRate,
    showOperationalSection, oneTimePayments, recurringPayments, fixedMonthlyCosts,
    showAdvancedSection, seasonalityEnabled, seasonalityMultipliers, cac, churnRate, capexItems, variableLaborCostPercent,
    scenarioEnabled, variancePercent
  ]);

  // Phase 3: Monte Carlo Simulation
  const monteCarloResults = useMemo(() => {
    if (!monteCarloEnabled) return null;
    
    const mcBaseRevenue = forecastData.baseRevenue || 0;
    const mcBaseExpenses = forecastData.baseExpenses || 0;
    const expenseRatio = mcBaseExpenses / Math.max(mcBaseRevenue, 1);

    const results = [];
    const random = (base, variance) => base * (1 + (Math.random() * 2 - 1) * (variance / 100));
    
    for (let run = 0; run < monteCarloRuns; run++) {
      let totalProfit = 0;
      const adjustedGrowth = random(revenueGrowthRate, variancePercent);
      const adjustedPrice = random(productPrice, variancePercent);
      const adjustedUnits = random(unitsPerPeriod, variancePercent);
      
      // Simple projection with randomized parameters
      const isMonthlyView = timeView === 'month';
      const periods = isMonthlyView ? 12 : 10;
      for (let i = 0; i < periods; i++) {
        const periodsPerYear = isMonthlyView ? 12 : 1;
        const growthMult = Math.pow(1 + adjustedGrowth / 100, i / periodsPerYear);
        const revenue = (adjustedPrice * adjustedUnits) * growthMult;
        const expenses = revenue * expenseRatio * random(1, variancePercent * 0.5);
        totalProfit += (revenue - expenses);
      }
      results.push(totalProfit);
    }
    
    results.sort((a, b) => a - b);
    return {
      min: Math.round(results[0]),
      p10: Math.round(results[Math.floor(results.length * 0.1)]),
      p25: Math.round(results[Math.floor(results.length * 0.25)]),
      median: Math.round(results[Math.floor(results.length * 0.5)]),
      p75: Math.round(results[Math.floor(results.length * 0.75)]),
      p90: Math.round(results[Math.floor(results.length * 0.9)]),
      max: Math.round(results[results.length - 1]),
      mean: Math.round(results.reduce((a, b) => a + b, 0) / results.length)
    };
  }, [
    monteCarloEnabled,
    monteCarloRuns,
    variancePercent,
    revenueGrowthRate,
    productPrice,
    unitsPerPeriod,
    timeView,
    forecastData.baseRevenue,
    forecastData.baseExpenses
  ]);

  // Phase 3: Sensitivity Analysis
  const sensitivityAnalysis = useMemo(() => {
    if (!sensitivityEnabled) return null;
    
    const baseFinalProfit = forecastData.datasets[3].data[forecastData.datasets[3].data.length - 1];

    const safeFinalProfit = Math.abs(baseFinalProfit) < 1 ? 1 : baseFinalProfit;
    const sensitivityBaseRevenue = forecastData.baseRevenue || 0;
    
    return [
      { paramName: 'Product Price', impact: ((productPrice * 0.01 * unitsPerPeriod * 10) / safeFinalProfit * 100).toFixed(2) },
      { paramName: 'Units Per Period', impact: ((unitsPerPeriod * 0.01 * productPrice * 10) / safeFinalProfit * 100).toFixed(2) },
      { paramName: 'Growth Rate', impact: ((revenueGrowthRate * 0.01 * sensitivityBaseRevenue * 10) / safeFinalProfit * 100).toFixed(2) },
      { paramName: 'COGS', impact: ((cogsPerUnit * 0.01 * unitsPerBatch * batchFrequency * 10) / safeFinalProfit * 100 * -1).toFixed(2) },
      { paramName: 'Fixed Costs', impact: ((fixedMonthlyCosts * 0.01 * 10) / safeFinalProfit * 100 * -1).toFixed(2) }
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  }, [
    sensitivityEnabled,
    forecastData,
    productPrice,
    unitsPerPeriod,
    revenueGrowthRate,
    cogsPerUnit,
    unitsPerBatch,
    batchFrequency,
    fixedMonthlyCosts
  ]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 10,
          font: { size: 11 }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  // Summary metrics
  const summary = useMemo(() => {
    const lastPeriodRevenue = forecastData.datasets[0].data[forecastData.datasets[0].data.length - 1];
    const lastPeriodProfit = forecastData.datasets[2].data[forecastData.datasets[2].data.length - 1];
    const finalCumulativeProfit = forecastData.datasets[3].data[forecastData.datasets[3].data.length - 1];
    const avgProfit = forecastData.datasets[2].data.reduce((a, b) => a + b, 0) / forecastData.datasets[2].data.length;
    const finalCashFlow = forecastData.datasets[4].data[forecastData.datasets[4].data.length - 1];

    return {
      lastPeriodRevenue,
      lastPeriodProfit,
      finalCumulativeProfit,
      avgProfit,
      finalCashFlow,
      npv: forecastData.npv,
      roi: forecastData.roi,
      breakEvenPeriod: forecastData.breakEvenPeriod
    };
  }, [forecastData]);

  const assumptionsSnapshot = useMemo(() => {
    return {
      scenarioName,
      timeView,
      startDate,
      revenueGrowthRate,
      discountRate,
      initialInvestment,
      productPrice,
      unitsPerPeriod,
      serviceRevenue,
      recurringRevenue,
      cogsPerUnit,
      marketingBudget,
      fixedMonthlyCosts,
      inflationRate,
      depreciationRate,
      churnRate,
      variableLaborCostPercent,
      variancePercent,
      oneTimePaymentsCount: oneTimePayments.length,
      recurringPaymentsCount: recurringPayments.length,
      capexItemsCount: capexItems.length,
      generatedAt: new Date().toISOString()
    };
  }, [
    scenarioName,
    timeView,
    startDate,
    revenueGrowthRate,
    discountRate,
    initialInvestment,
    productPrice,
    unitsPerPeriod,
    serviceRevenue,
    recurringRevenue,
    cogsPerUnit,
    marketingBudget,
    fixedMonthlyCosts,
    inflationRate,
    depreciationRate,
    churnRate,
    variableLaborCostPercent,
    variancePercent,
    oneTimePayments,
    recurringPayments,
    capexItems
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const compact = JSON.stringify({
      scenarioName,
      timeView,
      startDate,
      revenueGrowthRate,
      discountRate,
      initialInvestment,
      productPrice,
      unitsPerPeriod,
      cogsPerUnit,
      marketingBudget,
      fixedMonthlyCosts,
      inflationRate,
      churnRate,
      variancePercent
    });
    if (compact === lastAuditSnapshotRef.current) return;
    lastAuditSnapshotRef.current = compact;

    setAuditTrail(prev => {
      const next = [
        ...prev,
        {
          at: new Date().toISOString(),
          note: `Updated assumptions: growth ${revenueGrowthRate}%, discount ${discountRate}%, price $${productPrice}`
        }
      ];
      return next.slice(-25);
    });
  }, [
    isOpen,
    scenarioName,
    timeView,
    startDate,
    revenueGrowthRate,
    discountRate,
    initialInvestment,
    productPrice,
    unitsPerPeriod,
    cogsPerUnit,
    marketingBudget,
    fixedMonthlyCosts,
    inflationRate,
    churnRate,
    variancePercent
  ]);

  // Add one-time payment
  const addOneTimePayment = () => {
    if (newOneTimeAmount && newOneTimeLabel) {
      setOneTimePayments([...oneTimePayments, {
        amount: parseFloat(newOneTimeAmount),
        period: parseInt(newOneTimePeriod),
        label: newOneTimeLabel
      }]);
      setNewOneTimeAmount('');
      setNewOneTimePeriod(0);
      setNewOneTimeLabel('');
    }
  };

  // Add recurring payment
  const addRecurringPayment = () => {
    if (newRecurringAmount && newRecurringLabel) {
      setRecurringPayments([...recurringPayments, {
        amount: parseFloat(newRecurringAmount),
        frequency: parseInt(newRecurringFreq),
        label: newRecurringLabel
      }]);
      setNewRecurringAmount('');
      setNewRecurringFreq(1);
      setNewRecurringLabel('');
    }
  };

  // Remove payment handlers
  const removeOneTimePayment = (index) => {
    setOneTimePayments(oneTimePayments.filter((_, i) => i !== index));
  };

  const removeRecurringPayment = (index) => {
    setRecurringPayments(recurringPayments.filter((_, i) => i !== index));
  };

  const downloadFile = (filename, mimeType, content) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportForecastCsv = () => {
    const rows = [
      ['Period', ...forecastData.labels],
      ['Revenue', ...forecastData.datasets[0].data],
      ['Expenses', ...forecastData.datasets[1].data],
      ['Profit', ...forecastData.datasets[2].data],
      ['Cumulative Profit', ...forecastData.datasets[3].data],
      ['Cumulative Cash Flow', ...forecastData.datasets[4].data]
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`forecaster-${stamp}.csv`, 'text/csv;charset=utf-8;', csv);
    setExportStatus('CSV exported');
  };

  const exportScenarioJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assumptions: assumptionsSnapshot,
      inputs: {
        timeView,
        startDate,
        revenueGrowthRate,
        discountRate,
        initialInvestment,
        productPrice,
        unitsPerPeriod,
        serviceRevenue,
        recurringRevenue,
        cogsPerUnit,
        unitsPerBatch,
        shippingPerBatch,
        batchFrequency,
        marketingBudget,
        costPerThousandViews,
        engagementToSaleRate,
        avgRevenuePerSale,
        walkInCustomersPerPeriod,
        walkInConversionRate,
        customerBuyBackRate,
        buyBackFrequency,
        customerRetentionRate,
        inflationRate,
        depreciationRate,
        fixedMonthlyCosts,
        oneTimePayments,
        recurringPayments,
        seasonalityEnabled,
        seasonalityMultipliers,
        cac,
        avgCustomerLifetimeMonths,
        churnRate,
        capexItems,
        variableLaborCostPercent,
        scenarioEnabled,
        variancePercent,
        monteCarloEnabled,
        monteCarloRuns,
        sensitivityEnabled
      },
      outputs: {
        summary,
        forecast: {
          labels: forecastData.labels,
          revenue: forecastData.datasets[0].data,
          expenses: forecastData.datasets[1].data,
          profit: forecastData.datasets[2].data,
          cumulativeProfit: forecastData.datasets[3].data,
          cumulativeCashFlow: forecastData.datasets[4].data
        },
        monteCarloResults,
        sensitivityAnalysis
      },
      auditTrail
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`forecaster-scenario-${stamp}.json`, 'application/json;charset=utf-8;', JSON.stringify(payload, null, 2));
    setExportStatus('Scenario JSON exported');
  };

  const exportPdfReport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const chartImage = chartRef.current?.toBase64Image?.() || '';

    const summaryRows = [
      ['Total Profit', `$${summary.finalCumulativeProfit.toLocaleString()}`],
      ['Avg Profit/Period', `$${Math.round(summary.avgProfit).toLocaleString()}`],
      ['Final Revenue', `$${summary.lastPeriodRevenue.toLocaleString()}`],
      ['Final Profit', `$${summary.lastPeriodProfit.toLocaleString()}`],
      ['NPV', `$${summary.npv.toLocaleString()}`],
      ['Cash Flow', `$${summary.finalCashFlow.toLocaleString()}`],
      ['ROI', summary.roi !== null ? `${summary.roi}%` : 'N/A'],
      ['Break-even', summary.breakEvenPeriod !== null ? `Period ${summary.breakEvenPeriod + 1}` : 'N/A']
    ];

    const periodRows = forecastData.labels.map((label, idx) => {
      const revenue = forecastData.datasets[0].data[idx] ?? 0;
      const expenses = forecastData.datasets[1].data[idx] ?? 0;
      const profit = forecastData.datasets[2].data[idx] ?? 0;
      const cumProfit = forecastData.datasets[3].data[idx] ?? 0;
      const cashFlow = forecastData.datasets[4].data[idx] ?? 0;
      return `<tr><td>${label}</td><td>${revenue.toLocaleString()}</td><td>${expenses.toLocaleString()}</td><td>${profit.toLocaleString()}</td><td>${cumProfit.toLocaleString()}</td><td>${cashFlow.toLocaleString()}</td></tr>`;
    }).join('');

    const assumptionsRows = [
      ['Scenario', assumptionsSnapshot.scenarioName],
      ['View', assumptionsSnapshot.timeView],
      ['Start Date', assumptionsSnapshot.startDate],
      ['Growth Rate', `${assumptionsSnapshot.revenueGrowthRate}%`],
      ['Discount Rate', `${assumptionsSnapshot.discountRate}%`],
      ['Initial Investment', `$${Number(assumptionsSnapshot.initialInvestment).toLocaleString()}`],
      ['Product Price', `$${Number(assumptionsSnapshot.productPrice).toLocaleString()}`],
      ['Units / Period', Number(assumptionsSnapshot.unitsPerPeriod).toLocaleString()],
      ['Inflation', `${assumptionsSnapshot.inflationRate}%`],
      ['Churn', `${assumptionsSnapshot.churnRate}%`]
    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

    const reportHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Forecaster Report - ${stamp}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #111827; }
    h1, h2 { margin: 0 0 10px 0; }
    .meta { margin-bottom: 18px; color: #4b5563; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
    th { background: #f3f4f6; }
    .chart { margin: 14px 0; border: 1px solid #d1d5db; padding: 8px; }
    .chart img { max-width: 100%; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Forecaster Report</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} | Scenario: ${scenarioName}</div>
  <div class="grid">
    <div>
      <h2>Summary</h2>
      <table>
        <tbody>
          ${summaryRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div>
      <h2>Assumptions</h2>
      <table>
        <tbody>
          ${assumptionsRows}
        </tbody>
      </table>
    </div>
  </div>
  <div class="chart">
    <h2>Projection Chart</h2>
    ${chartImage ? `<img src="${chartImage}" alt="Projection chart" />` : '<div>Chart image unavailable</div>'}
  </div>
  <h2>Period Breakdown</h2>
  <table>
    <thead>
      <tr><th>Period</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Cumulative Profit</th><th>Cumulative Cash Flow</th></tr>
    </thead>
    <tbody>
      ${periodRows}
    </tbody>
  </table>
  <div class="no-print" style="margin-top: 14px; font-size: 12px; color: #6b7280;">
    Use Print and choose "Save as PDF" to export this report.
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      setExportStatus('Popup blocked: allow popups to export PDF report');
      return;
    }
    win.document.open();
    win.document.write(reportHtml);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
    setExportStatus('PDF report opened (use Save as PDF in print dialog)');
  };

  const importScenarioJson = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const inputs = parsed?.inputs || {};

      setTimeView(inputs.timeView ?? timeView);
      setStartDate(inputs.startDate ?? startDate);
      setRevenueGrowthRate(Number(inputs.revenueGrowthRate ?? revenueGrowthRate));
      setDiscountRate(Number(inputs.discountRate ?? discountRate));
      setInitialInvestment(Number(inputs.initialInvestment ?? initialInvestment));
      setProductPrice(Number(inputs.productPrice ?? productPrice));
      setUnitsPerPeriod(Number(inputs.unitsPerPeriod ?? unitsPerPeriod));
      setServiceRevenue(Number(inputs.serviceRevenue ?? serviceRevenue));
      setRecurringRevenue(Number(inputs.recurringRevenue ?? recurringRevenue));
      setCogsPerUnit(Number(inputs.cogsPerUnit ?? cogsPerUnit));
      setUnitsPerBatch(Number(inputs.unitsPerBatch ?? unitsPerBatch));
      setShippingPerBatch(Number(inputs.shippingPerBatch ?? shippingPerBatch));
      setBatchFrequency(Number(inputs.batchFrequency ?? batchFrequency));
      setMarketingBudget(Number(inputs.marketingBudget ?? marketingBudget));
      setCostPerThousandViews(Number(inputs.costPerThousandViews ?? costPerThousandViews));
      setEngagementToSaleRate(Number(inputs.engagementToSaleRate ?? engagementToSaleRate));
      setAvgRevenuePerSale(Number(inputs.avgRevenuePerSale ?? avgRevenuePerSale));
      setWalkInCustomersPerPeriod(Number(inputs.walkInCustomersPerPeriod ?? walkInCustomersPerPeriod));
      setWalkInConversionRate(Number(inputs.walkInConversionRate ?? walkInConversionRate));
      setCustomerBuyBackRate(Number(inputs.customerBuyBackRate ?? customerBuyBackRate));
      setBuyBackFrequency(Number(inputs.buyBackFrequency ?? buyBackFrequency));
      setCustomerRetentionRate(Number(inputs.customerRetentionRate ?? customerRetentionRate));
      setInflationRate(Number(inputs.inflationRate ?? inflationRate));
      setDepreciationRate(Number(inputs.depreciationRate ?? depreciationRate));
      setFixedMonthlyCosts(Number(inputs.fixedMonthlyCosts ?? fixedMonthlyCosts));
      setOneTimePayments(Array.isArray(inputs.oneTimePayments) ? inputs.oneTimePayments : oneTimePayments);
      setRecurringPayments(Array.isArray(inputs.recurringPayments) ? inputs.recurringPayments : recurringPayments);
      setSeasonalityEnabled(Boolean(inputs.seasonalityEnabled ?? seasonalityEnabled));
      setSeasonalityMultipliers(Array.isArray(inputs.seasonalityMultipliers) ? inputs.seasonalityMultipliers : seasonalityMultipliers);
      setCac(Number(inputs.cac ?? cac));
      setAvgCustomerLifetimeMonths(Number(inputs.avgCustomerLifetimeMonths ?? avgCustomerLifetimeMonths));
      setChurnRate(Number(inputs.churnRate ?? churnRate));
      setCapexItems(Array.isArray(inputs.capexItems) ? inputs.capexItems : capexItems);
      setVariableLaborCostPercent(Number(inputs.variableLaborCostPercent ?? variableLaborCostPercent));
      setScenarioEnabled(Boolean(inputs.scenarioEnabled ?? scenarioEnabled));
      setVariancePercent(Number(inputs.variancePercent ?? variancePercent));
      setMonteCarloEnabled(Boolean(inputs.monteCarloEnabled ?? monteCarloEnabled));
      setMonteCarloRuns(Number(inputs.monteCarloRuns ?? monteCarloRuns));
      setSensitivityEnabled(Boolean(inputs.sensitivityEnabled ?? sensitivityEnabled));

      setScenarioName(parsed?.assumptions?.scenarioName || 'Imported Scenario');
      setExportStatus('Scenario imported');
      setAuditTrail(prev => ([...prev, { at: new Date().toISOString(), note: `Imported scenario: ${file.name}` }]).slice(-25));
    } catch (error) {
      setExportStatus('Import failed: invalid JSON');
    } finally {
      event.target.value = '';
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        
        {/* Header */}
        <div className="flex-shrink-0 px-3 py-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center">
          <div className="d-flex align-items-center gap-2">
            <CalculatorIcon className="h-5 w-5 text-blue-600" />
            <h5 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Forecaster</h5>
          </div>
        </div>

        {/* Main Content: Chart (pinned) + Scrollable Inputs */}
        <div className="flex-grow-1 d-flex flex-column px-3 py-2" style={{ minHeight: 0 }}>

          {/* Chart */}
          <div className="flex-shrink-0 mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3" style={{ height: '300px' }}>
            <Line ref={chartRef} data={forecastData} options={chartOptions} />
          </div>

          {/* Summary Cards (Accordion) */}
          <div className="flex-shrink-0 mb-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setShowSummarySection((prev) => !prev)}
              className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
            >
              <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Forecast Summary</span>
              {showSummarySection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {showSummarySection && (
              <div className="p-2 border-top border-gray-200 dark:border-gray-700 d-flex gap-2 flex-wrap">
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-green-700 dark:text-green-300">${summary.finalCumulativeProfit.toLocaleString()}</div>
                  <div className="text-xs text-green-600 dark:text-green-400">Total Profit</div>
                </div>
                <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-blue-700 dark:text-blue-300">${Math.round(summary.avgProfit).toLocaleString()}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Avg Profit/Period</div>
                </div>
                <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-purple-700 dark:text-purple-300">${summary.lastPeriodRevenue.toLocaleString()}</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">Final Revenue</div>
                </div>
                <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-orange-700 dark:text-orange-300">${summary.lastPeriodProfit.toLocaleString()}</div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">Final Profit</div>
                </div>
                <div className="flex-1 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-cyan-700 dark:text-cyan-300">${summary.npv.toLocaleString()}</div>
                  <div className="text-xs text-cyan-600 dark:text-cyan-400">NPV ({discountRate}%)</div>
                </div>
                <div className="flex-1 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                  <div className="text-sm fw-bold text-teal-700 dark:text-teal-300">${summary.finalCashFlow.toLocaleString()}</div>
                  <div className="text-xs text-teal-600 dark:text-teal-400">Cash Flow</div>
                </div>
                {summary.roi !== null && (
                  <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                    <div className="text-sm fw-bold text-indigo-700 dark:text-indigo-300">{summary.roi}%</div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">ROI</div>
                  </div>
                )}
                {summary.breakEvenPeriod !== null && (
                  <div className="flex-1 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg px-2 py-1" style={{ minWidth: '8rem' }}>
                    <div className="text-sm fw-bold text-pink-700 dark:text-pink-300">Period {summary.breakEvenPeriod + 1}</div>
                    <div className="text-xs text-pink-600 dark:text-pink-400">Break-even</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scrollable Inputs */}
          <div className="flex-grow-1 overflow-auto no-scrollbar" style={{ minHeight: 0 }}>

            {/* Parameters */}
            <div className="row g-2">
            
            {/* Calculated Base Values Display */}
            <div className="col-12">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <h6 className="text-sm fw-bold text-blue-700 dark:text-blue-300 mb-2">Calculated Base Values</h6>
                <div className="row g-2">
                  <div className="col-md-4">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Base Revenue (from components)</div>
                    <div className="text-lg fw-bold text-green-600 dark:text-green-400">
                      ${forecastData.baseRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Base Expenses (from components)</div>
                    <div className="text-lg fw-bold text-red-600 dark:text-red-400">
                      ${forecastData.baseExpenses.toLocaleString()}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-xs mb-1">Revenue Growth Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={revenueGrowthRate}
                      onChange={(e) => setRevenueGrowthRate(parseFloat(e.target.value) || 0)}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-xs mb-1">Discount Rate (% for NPV)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-xs mb-1">Initial Investment ($)</label>
                    <input
                      type="number"
                      step="100"
                      value={initialInvestment}
                      onChange={(e) => setInitialInvestment(parseFloat(e.target.value) || 0)}
                      className="form-control form-control-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Components Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowRevenueSection(!showRevenueSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Revenue Components</span>
                  {showRevenueSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showRevenueSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Product Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={productPrice}
                          onChange={(e) => setProductPrice(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Units Sold per Period</label>
                        <input
                          type="number"
                          value={unitsPerPeriod}
                          onChange={(e) => setUnitsPerPeriod(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Service Revenue ($)</label>
                        <input
                          type="number"
                          value={serviceRevenue}
                          onChange={(e) => setServiceRevenue(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Recurring Revenue ($)</label>
                        <input
                          type="number"
                          value={recurringRevenue}
                          onChange={(e) => setRecurringRevenue(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Total: ${((productPrice * unitsPerPeriod) + serviceRevenue + recurringRevenue).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cost of Goods / Shipping Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowCostSection(!showCostSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Cost of Goods & Shipping</span>
                  {showCostSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showCostSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">COGS per Unit ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cogsPerUnit}
                          onChange={(e) => setCogsPerUnit(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Units per Batch</label>
                        <input
                          type="number"
                          value={unitsPerBatch}
                          onChange={(e) => setUnitsPerBatch(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Shipping per Batch ($)</label>
                        <input
                          type="number"
                          value={shippingPerBatch}
                          onChange={(e) => setShippingPerBatch(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Batches per Period</label>
                        <input
                          type="number"
                          value={batchFrequency}
                          onChange={(e) => setBatchFrequency(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Marketing Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowMarketingSection(!showMarketingSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Marketing & Advertising</span>
                  {showMarketingSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showMarketingSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Marketing Budget/Period ($)</label>
                        <input
                          type="number"
                          value={marketingBudget}
                          onChange={(e) => setMarketingBudget(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Cost per 1000 Views ($)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={costPerThousandViews}
                          onChange={(e) => setCostPerThousandViews(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Engagement → Sale Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={engagementToSaleRate}
                          onChange={(e) => setEngagementToSaleRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Avg Revenue per Sale ($)</label>
                        <input
                          type="number"
                          value={avgRevenuePerSale}
                          onChange={(e) => setAvgRevenuePerSale(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Behavior Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowCustomerSection(!showCustomerSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Customer Behavior</span>
                  {showCustomerSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showCustomerSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Walk-in Customers/Period</label>
                        <input
                          type="number"
                          value={walkInCustomersPerPeriod}
                          onChange={(e) => setWalkInCustomersPerPeriod(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-xs mb-1">Walk-in Conversion Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={walkInConversionRate}
                          onChange={(e) => setWalkInConversionRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label text-xs mb-1">Buy-back Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={customerBuyBackRate}
                          onChange={(e) => setCustomerBuyBackRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label text-xs mb-1">Buy-back Frequency</label>
                        <input
                          type="number"
                          value={buyBackFrequency}
                          onChange={(e) => setBuyBackFrequency(parseFloat(e.target.value) || 1)}
                          className="form-control form-control-sm"
                          placeholder="periods"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label text-xs mb-1">Retention Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={customerRetentionRate}
                          onChange={(e) => setCustomerRetentionRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Economic Factors Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowEconomicSection(!showEconomicSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Economic Factors</span>
                  {showEconomicSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showEconomicSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-xs mb-1">Inflation Rate (% per year)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={inflationRate}
                          onChange={(e) => setInflationRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-xs mb-1">Depreciation Rate (% per year)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={depreciationRate}
                          onChange={(e) => setDepreciationRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Operational Costs Section */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowOperationalSection(!showOperationalSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Operational Costs</span>
                  {showOperationalSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showOperationalSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    
                    {/* Fixed Monthly Costs */}
                    <div className="mb-3">
                      <label className="form-label text-xs mb-1">Fixed Monthly Costs ($)</label>
                      <input
                        type="number"
                        value={fixedMonthlyCosts}
                        onChange={(e) => setFixedMonthlyCosts(parseFloat(e.target.value) || 0)}
                        className="form-control form-control-sm"
                        placeholder="Rent, utilities, salaries..."
                      />
                    </div>

                    {/* One-time Payments */}
                    <div className="mb-3">
                      <label className="form-label text-xs fw-bold mb-1">One-Time Payments</label>
                      <div className="row g-2 mb-2">
                        <div className="col-md-4">
                          <input
                            type="text"
                            value={newOneTimeLabel}
                            onChange={(e) => setNewOneTimeLabel(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Label (e.g., Equipment)"
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="number"
                            value={newOneTimeAmount}
                            onChange={(e) => setNewOneTimeAmount(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="number"
                            value={newOneTimePeriod}
                            onChange={(e) => setNewOneTimePeriod(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Period #"
                          />
                        </div>
                        <div className="col-md-2">
                          <button
                            onClick={addOneTimePayment}
                            className="btn btn-primary btn-sm w-100"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {oneTimePayments.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                          {oneTimePayments.map((payment, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center text-xs mb-1">
                              <span>{payment.label}: ${payment.amount.toLocaleString()} @ Period {payment.period}</span>
                              <button
                                onClick={() => removeOneTimePayment(idx)}
                                className="btn btn-link btn-sm p-0 text-danger"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recurring Payments */}
                    <div>
                      <label className="form-label text-xs fw-bold mb-1">Recurring Payments</label>
                      <div className="row g-2 mb-2">
                        <div className="col-md-5">
                          <input
                            type="text"
                            value={newRecurringLabel}
                            onChange={(e) => setNewRecurringLabel(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Label (e.g., Software License)"
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="number"
                            value={newRecurringAmount}
                            onChange={(e) => setNewRecurringAmount(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="number"
                            value={newRecurringFreq}
                            onChange={(e) => setNewRecurringFreq(e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Every N"
                          />
                        </div>
                        <div className="col-md-2">
                          <button
                            onClick={addRecurringPayment}
                            className="btn btn-primary btn-sm w-100"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {recurringPayments.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                          {recurringPayments.map((payment, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center text-xs mb-1">
                              <span>{payment.label}: ${payment.amount.toLocaleString()} / {payment.frequency} periods</span>
                              <button
                                onClick={() => removeRecurringPayment(idx)}
                                className="btn btn-link btn-sm p-0 text-danger"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Factors Section (Phase 2) */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowAdvancedSection(!showAdvancedSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Advanced Factors</span>
                  {showAdvancedSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showAdvancedSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      
                      {/* Seasonality */}
                      <div className="col-12">
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            checked={seasonalityEnabled}
                            onChange={(e) => setSeasonalityEnabled(e.target.checked)}
                            className="form-check-input"
                            id="seasonalityCheck"
                          />
                          <label className="form-check-label text-xs" htmlFor="seasonalityCheck">
                            Enable Seasonality (Monthly Multipliers)
                          </label>
                        </div>
                      </div>

                      {seasonalityEnabled && (
                        <div className="col-12">
                          <label className="form-label text-xs mb-1">Monthly Multipliers (Jan-Dec)</label>
                          <div className="d-flex gap-1 flex-wrap">
                            {seasonalityMultipliers.map((mult, idx) => (
                              <input
                                key={idx}
                                type="number"
                                step="0.1"
                                value={mult}
                                onChange={(e) => {
                                  const newMults = [...seasonalityMultipliers];
                                  newMults[idx] = parseFloat(e.target.value) || 1.0;
                                  setSeasonalityMultipliers(newMults);
                                }}
                                className="form-control form-control-sm"
                                style={{ width: '4rem' }}
                                placeholder={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][idx]}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CAC & LTV */}
                      <div className="col-md-4">
                        <label className="form-label text-xs mb-1">Customer Acquisition Cost (CAC $)</label>
                        <input
                          type="number"
                          step="1"
                          value={cac}
                          onChange={(e) => setCac(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label text-xs mb-1">Avg Customer Lifetime (months)</label>
                        <input
                          type="number"
                          step="1"
                          value={avgCustomerLifetimeMonths}
                          onChange={(e) => setAvgCustomerLifetimeMonths(parseFloat(e.target.value) || 12)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label text-xs mb-1">LTV Estimate</label>
                        <div className="form-control form-control-sm bg-light text-muted">
                          ${Math.round(avgRevenuePerSale * (avgCustomerLifetimeMonths / 12)).toLocaleString()}
                        </div>
                      </div>

                      {/* Churn Rate */}
                      <div className="col-md-6">
                        <label className="form-label text-xs mb-1">Churn Rate (% per period)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={churnRate}
                          onChange={(e) => setChurnRate(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>

                      {/* Variable Labor Cost */}
                      <div className="col-md-6">
                        <label className="form-label text-xs mb-1">Variable Labor Cost (% of Revenue)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={variableLaborCostPercent}
                          onChange={(e) => setVariableLaborCostPercent(parseFloat(e.target.value) || 0)}
                          className="form-control form-control-sm"
                        />
                      </div>

                      {/* CapEx Manager */}
                      <div className="col-12">
                        <label className="form-label text-xs mb-2 fw-bold">Capital Expenditures (CapEx)</label>
                        <div className="row g-2 mb-2">
                          <div className="col-md-3">
                            <input
                              type="number"
                              placeholder="Amount ($)"
                              value={newCapexAmount}
                              onChange={(e) => setNewCapexAmount(e.target.value)}
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-md-2">
                            <input
                              type="number"
                              placeholder="Period"
                              value={newCapexPeriod}
                              onChange={(e) => setNewCapexPeriod(parseInt(e.target.value) || 0)}
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-md-2">
                            <input
                              type="number"
                              placeholder="Dep. Years"
                              value={newCapexDepYears}
                              onChange={(e) => setNewCapexDepYears(parseInt(e.target.value) || 5)}
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-md-3">
                            <input
                              type="text"
                              placeholder="Label"
                              value={newCapexLabel}
                              onChange={(e) => setNewCapexLabel(e.target.value)}
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-md-2">
                            <button
                              onClick={() => {
                                if (newCapexAmount && newCapexLabel) {
                                  setCapexItems([...capexItems, {
                                    amount: parseFloat(newCapexAmount),
                                    period: newCapexPeriod,
                                    depreciationYears: newCapexDepYears,
                                    label: newCapexLabel
                                  }]);
                                  setNewCapexAmount('');
                                  setNewCapexPeriod(0);
                                  setNewCapexDepYears(5);
                                  setNewCapexLabel('');
                                }
                              }}
                              className="btn btn-primary btn-sm w-100"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        {capexItems.length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                            {capexItems.map((capex, idx) => (
                              <div key={idx} className="d-flex justify-content-between align-items-center text-xs mb-1">
                                <span>{capex.label}: ${capex.amount.toLocaleString()} @ Period {capex.period} ({capex.depreciationYears}yr dep.)</span>
                                <button
                                  onClick={() => {
                                    const newItems = capexItems.filter((_, i) => i !== idx);
                                    setCapexItems(newItems);
                                  }}
                                  className="btn btn-link btn-sm p-0 text-danger"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Risk & Scenario Modeling Section (Phase 3) */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowRiskSection(!showRiskSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Risk & Scenario Modeling</span>
                  {showRiskSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showRiskSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      
                      {/* Scenario Bands */}
                      <div className="col-12">
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            checked={scenarioEnabled}
                            onChange={(e) => setScenarioEnabled(e.target.checked)}
                            className="form-check-input"
                            id="scenarioCheck"
                          />
                          <label className="form-check-label text-xs" htmlFor="scenarioCheck">
                            Enable Best/Worst Case Scenarios
                          </label>
                        </div>
                      </div>
                      
                      {scenarioEnabled && (
                        <div className="col-md-6">
                          <label className="form-label text-xs mb-1">Variance (±%)</label>
                          <input
                            type="number"
                            step="1"
                            value={variancePercent}
                            onChange={(e) => setVariancePercent(parseFloat(e.target.value) || 20)}
                            className="form-control form-control-sm"
                          />
                        </div>
                      )}

                      {/* Monte Carlo Simulation */}
                      <div className="col-12">
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            checked={monteCarloEnabled}
                            onChange={(e) => setMonteCarloEnabled(e.target.checked)}
                            className="form-check-input"
                            id="monteCarloCheck"
                          />
                          <label className="form-check-label text-xs" htmlFor="monteCarloCheck">
                            Run Monte Carlo Simulation
                          </label>
                        </div>
                      </div>
                      
                      {monteCarloEnabled && (
                        <>
                          <div className="col-md-6">
                            <label className="form-label text-xs mb-1">Simulation Runs</label>
                            <input
                              type="number"
                              step="10"
                              value={monteCarloRuns}
                              onChange={(e) => setMonteCarloRuns(parseInt(e.target.value) || 100)}
                              className="form-control form-control-sm"
                            />
                          </div>
                          {monteCarloResults && (
                            <div className="col-12">
                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                                <div className="text-xs fw-bold mb-2">Monte Carlo Results ({monteCarloRuns} runs)</div>
                                <div className="row g-2 text-xs">
                                  <div className="col-4">Min: ${monteCarloResults.min.toLocaleString()}</div>
                                  <div className="col-4">P25: ${monteCarloResults.p25.toLocaleString()}</div>
                                  <div className="col-4">Median: ${monteCarloResults.median.toLocaleString()}</div>
                                  <div className="col-4">Mean: ${monteCarloResults.mean.toLocaleString()}</div>
                                  <div className="col-4">P75: ${monteCarloResults.p75.toLocaleString()}</div>
                                  <div className="col-4">Max: ${monteCarloResults.max.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Sensitivity Analysis */}
                      <div className="col-12">
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            checked={sensitivityEnabled}
                            onChange={(e) => setSensitivityEnabled(e.target.checked)}
                            className="form-check-input"
                            id="sensitivityCheck"
                          />
                          <label className="form-check-label text-xs" htmlFor="sensitivityCheck">
                            Show Sensitivity Analysis
                          </label>
                        </div>
                      </div>
                      
                      {sensitivityEnabled && sensitivityAnalysis && (
                        <div className="col-12">
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <div className="text-xs fw-bold mb-2">Sensitivity: Impact of 1% Change on Final Profit</div>
                            <div className="text-xs">
                              {sensitivityAnalysis.map((item, idx) => (
                                <div key={idx} className="d-flex justify-content-between mb-1">
                                  <span>{item.paramName}:</span>
                                  <span className={item.impact > 0 ? 'text-success' : 'text-danger'}>
                                    {item.impact > 0 ? '+' : ''}{item.impact}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reporting & Export Section (Phase 4) */}
            <div className="col-12">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setShowExportSection(!showExportSection)}
                  className="w-100 btn btn-link text-start d-flex align-items-center justify-content-between p-2 text-decoration-none"
                >
                  <span className="text-sm fw-semibold text-gray-700 dark:text-gray-300">Reporting & Export</span>
                  {showExportSection ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
                {showExportSection && (
                  <div className="p-3 border-top border-gray-200 dark:border-gray-700">
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-xs mb-1">Scenario Name</label>
                        <input
                          type="text"
                          value={scenarioName}
                          onChange={(e) => setScenarioName(e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6 d-flex align-items-end gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={exportForecastCsv}
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={exportScenarioJson}
                        >
                          Export Scenario JSON
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-dark btn-sm"
                          onClick={exportPdfReport}
                        >
                          Export PDF Report
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => importInputRef.current?.click()}
                        >
                          Import Scenario
                        </button>
                        <input
                          ref={importInputRef}
                          type="file"
                          accept="application/json"
                          onChange={importScenarioJson}
                          style={{ display: 'none' }}
                        />
                      </div>

                      {exportStatus && (
                        <div className="col-12">
                          <div className="text-xs text-gray-600 dark:text-gray-300">Status: {exportStatus}</div>
                        </div>
                      )}

                      <div className="col-12">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                          <div className="text-xs fw-bold mb-2">Assumptions Snapshot</div>
                          <div className="row g-2 text-xs">
                            <div className="col-md-3">View: {assumptionsSnapshot.timeView}</div>
                            <div className="col-md-3">Growth: {assumptionsSnapshot.revenueGrowthRate}%</div>
                            <div className="col-md-3">Discount: {assumptionsSnapshot.discountRate}%</div>
                            <div className="col-md-3">Initial Investment: ${Number(assumptionsSnapshot.initialInvestment).toLocaleString()}</div>
                            <div className="col-md-3">Base Price: ${Number(assumptionsSnapshot.productPrice).toLocaleString()}</div>
                            <div className="col-md-3">Units/Period: {Number(assumptionsSnapshot.unitsPerPeriod).toLocaleString()}</div>
                            <div className="col-md-3">Inflation: {assumptionsSnapshot.inflationRate}%</div>
                            <div className="col-md-3">Churn: {assumptionsSnapshot.churnRate}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                          <div className="text-xs fw-bold mb-2">Audit Trail (Latest 10)</div>
                          <div className="text-xs" style={{ maxHeight: '10rem', overflowY: 'auto' }}>
                            {auditTrail.length === 0 && <div className="text-muted">No changes tracked yet.</div>}
                            {auditTrail.slice(-10).reverse().map((entry, idx) => (
                              <div key={idx} className="mb-1">
                                <span className="text-gray-500">{new Date(entry.at).toLocaleString()}:</span> {entry.note}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn ${timeView === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setTimeView('month')}
                >
                  Year
                </button>
                <button
                  type="button"
                  className={`btn ${timeView === 'year' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setTimeView('year')}
                >
                  Decade
                </button>
              </div>
            </div>

            <div className="flex-grow-1 d-flex justify-content-center">
              <Button_Toolbar
                icon={XMarkIcon}
                label="Close"
                onClick={onClose}
                className="btn-outline-secondary"
              />
            </div>

            <div style={{ width: '6rem' }} />
          </div>
        </div>

      </div>
    </Modal>
  );
}
