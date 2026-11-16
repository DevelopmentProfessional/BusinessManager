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
 *   2026-11-08 | GitHub Copilot | Left-aligned chart legends for clean layout across mobile and desktop
 *   2026-11-16 | GitHub Copilot | Added optional filled, borderless chart styling
 * ============================================================
 */
import React from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";
import { EmptyState, LoadingSpinner } from "../feedback";

// ─── 1 CHART.JS REGISTRATION ───────────────────────────────────────────────────

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// ─── 2 DEFAULT OPTIONS ─────────────────────────────────────────────────────────

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      align: "start",
    },
  },
};

// ─── 3 COMPONENT LOGIC ─────────────────────────────────────────────────────────

const Chart_Report = ({ data, type, title, loading, filled = false }) => {
  if (loading) {
    return (
      <div className="align-items-center d-flex h-100 justify-content-center">
        <LoadingSpinner label="Loading chart" size="lg" />
      </div>
    );
  }

  if (!data || !data.datasets || data.datasets.length === 0) {
    return (
      <div className="align-items-center d-flex h-100 justify-content-center">
        <EmptyState title="No data available" description="Try adjusting your filters." className="justify-content-center" />
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
          weight: "bold",
        },
      },
    },
  };

  const chartData = filled
    ? {
        ...data,
        datasets: data.datasets.map((dataset) => ({
          ...dataset,
          borderWidth: 0,
          pointBorderWidth: 0,
          ...(type === "line" || type === "area" ? { fill: true } : {}),
        })),
      }
    : data;

  // Add specific options for different chart types
  switch (type) {
    case "line":
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        },
      };
      break;
    case "bar":
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        },
      };
      break;
    case "pie":
    case "doughnut":
      // Remove scales for pie/doughnut charts
      delete chartOptions.scales;
      chartOptions.plugins.legend.position = "bottom";
      chartOptions.plugins.legend.align = "start";
      break;
    default:
      chartOptions.scales = {
        y: {
          beginAtZero: true,
        },
      };
  }

  // Render appropriate chart component based on type
  const renderChart = () => {
    switch (type) {
      case "line":
        return <Line data={chartData} options={chartOptions} />;
      case "bar":
        return <Bar data={chartData} options={chartOptions} />;
      case "pie":
        return <Pie data={chartData} options={chartOptions} />;
      case "doughnut":
        return <Doughnut data={chartData} options={chartOptions} />;
      default:
        return <Line data={chartData} options={chartOptions} />;
    }
  };

  return <div className="app-chart-container h-full w-full">{renderChart()}</div>;
};

export default Chart_Report;
