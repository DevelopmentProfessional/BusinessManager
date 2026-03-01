/*
 * ============================================================
 * FILE: Chart_Report.jsx
 *
 * PURPOSE:
 *   A generic chart wrapper that renders one of four Chart.js chart types
 *   (Line, Bar, Pie, Doughnut) based on the `type` prop. It registers the
 *   required Chart.js components globally, provides sensible defaults, and
 *   handles loading and empty-data states gracefully.
 *
 * FUNCTIONAL PARTS:
 *   [1] Chart.js Registration — Registers all required Chart.js scales, elements,
 *       and plugins once at module load time
 *   [2] Default Options — Shared responsive/legend configuration baseline
 *   [3] Component Logic — Loading and empty-data guards, chart-type-specific
 *       option overrides (scales, legend position), and chart type dispatch
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from 'react';
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
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// ─── 1 CHART.JS REGISTRATION ───────────────────────────────────────────────────

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// ─── 2 DEFAULT OPTIONS ─────────────────────────────────────────────────────────

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
  },
};

// ─── 3 COMPONENT LOGIC ─────────────────────────────────────────────────────────

const Chart_Report = ({ data, type, title, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data || !data.datasets || data.datasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-lg">No data available</p>
          <p className="text-gray-400 text-sm">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  const chartOptions = {
    ...defaultOptions,
    plugins: {
      ...defaultOptions.plugins,
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
    },
  };

  // Add specific options for different chart types
  switch (type) {
    case 'line':
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        }
      };
      break;
    case 'bar':
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        }
      };
      break;
    case 'pie':
    case 'doughnut':
      // Remove scales for pie/doughnut charts
      delete chartOptions.scales;
      chartOptions.plugins.legend.position = 'bottom';
      break;
    default:
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        }
      };
  }

  // Render appropriate chart component based on type
  switch (type) {
    case 'line':
      return <Line data={data} options={chartOptions} />;
    case 'bar':
      return <Bar data={data} options={chartOptions} />;
    case 'pie':
      return <Pie data={data} options={chartOptions} />;
    case 'doughnut':
      return <Doughnut data={data} options={chartOptions} />;
    default:
      return <Line data={data} options={chartOptions} />;
  }
};

export default Chart_Report;
