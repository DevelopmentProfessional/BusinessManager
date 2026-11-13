// FILE: Modal_Reports_FinancialDashboard.jsx
// Dedicated modal wrapping Dashboard_Financial for financial controls
import React from "react";
import { CalculatorIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Dashboard_Financial from "../panels/Dashboard_Financial";
import Button_Toolbar from "../buttons/Button_Toolbar";

export default function Modal_Reports_FinancialDashboard({
  isOpen,
  onClose,
  onOpenForecast,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Financial Controls</div>
          <div className="component-header-center" />
          <div className="component-header-right" />
        </div>
        <div className="component-body">
          <div className="component-body-inner">
            <Dashboard_Financial />
          </div>
        </div>
        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar
              icon={CalculatorIcon}
              label="Forecast"
              onClick={() => {
                onClose();
                onOpenForecast?.();
              }}
              className="btn-outline-secondary"
              title="Open forecast calculator"
            />
          </div>
          <div className="component-footer-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Close"
              onClick={onClose}
              className="btn-outline-secondary"
              title="Close"
            />
          </div>
          <div className="component-footer-right" />
        </div>
      </div>
    </Modal>
  );
}
