/*
 * ============================================================
 * FILE: Modal_Chart_Sales.jsx
 *
 * PURPOSE:
 *   Displays a Chart.js line chart of daily sales for the current month
 *   inside a custom overlay modal. Uses randomly generated mock data to
 *   populate the chart until real sales data is wired in.
 *
 * FUNCTIONAL PARTS:
 *   [1] Mock Data Generator — Builds random daily sales values for every day in the current month
 *   [2] Chart Configuration — Responsive Chart.js options (labels, axes, dollar tick formatting)
 *   [3] Modal Component — Conditional overlay rendering the chart and a Close button
 *   [4] Inline Styles — Style objects for overlay, modal container, chart wrapper, and button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import { eachDayOfInterval, startOfMonth, endOfMonth, format } from "date-fns";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// ─── 1 MOCK DATA GENERATOR ─────────────────────────────────────────────────
// Generate mock data for the current month
const generateMockData = () => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const days = eachDayOfInterval({ start, end });

  const labels = days.map((day) => format(day, "d"));
  const data = days.map(() => Math.floor(Math.random() * 2000) + 500); // Random sales between 500 and 2500

  return {
    labels,
    datasets: [
      {
        label: "Daily Sales",
        data,
        fill: false,
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  };
};

// ─── 2 CHART CONFIGURATION ─────────────────────────────────────────────────
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
    },
    title: {
      display: true,
      text: `Sales for ${format(new Date(), "MMMM yyyy")}`,
      font: {
        size: 18,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: function (value) {
          return "$" + value;
        },
      },
    },
  },
};

// ─── 3 MODAL COMPONENT ─────────────────────────────────────────────────────
const Modal_Chart_Sales = ({ isOpen, onClose }) => {
  const chartData = generateMockData();

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding>
      <div className="component">
        <div className="component-header">
          <div className="component-header-left">Sales Chart</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>
        <div className="component-body">
          <div className="component-body-inner component-body-inner--flush">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
        <div className="component-footer">
          <div className="component-footer-left"></div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn btn-circle btn-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
};

export default Modal_Chart_Sales;
