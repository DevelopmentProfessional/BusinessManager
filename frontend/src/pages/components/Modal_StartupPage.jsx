// FILE: Modal_StartupPage.jsx
// Modal for configuring user's default startup / home landing page.
import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import {
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  SparklesIcon,
  ArchiveBoxIcon,
  UsersIcon,
  DocumentIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export const STARTUP_PAGE_OPTIONS = [
  { value: "schedule", label: "Schedule", description: "Calendar and appointments", icon: CalendarDaysIcon },
  { value: "clients", label: "Clients", description: "Client profiles and memberships", icon: UserGroupIcon },
  { value: "sales", label: "Sales", description: "Point of sale and transactions", icon: ShoppingCartIcon },
  { value: "services", label: "Services", description: "Service menu and pricing", icon: SparklesIcon },
  { value: "inventory", label: "Inventory", description: "Stock, products, and suppliers", icon: ArchiveBoxIcon },
  { value: "employees", label: "Employees", description: "Staff directory and hours", icon: UsersIcon },
  { value: "documents", label: "Documents", description: "Files, templates, and signing", icon: DocumentIcon },
  { value: "reports", label: "Reports", description: "Analytics, revenue, and KPIs", icon: ChartBarIcon },
];

export default function Modal_StartupPage({
  isOpen,
  onClose,
  currentStartupPage = "schedule",
  onSave,
  saving = false,
  message = "",
}) {
  const [selectedPage, setSelectedPage] = useState(currentStartupPage || "schedule");
  const [savingPage, setSavingPage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPage(currentStartupPage || "schedule");
      setSavingPage(null);
    }
  }, [isOpen, currentStartupPage]);

  const handleClose = () => {
    if (!saving && !savingPage) onClose();
  };

  const handleSelectOption = async (pageValue) => {
    if (saving || savingPage) return;
    setSelectedPage(pageValue);
    setSavingPage(pageValue);
    try {
      await onSave(pageValue);
    } catch {
      setSavingPage(null);
    }
  };

  const isBusy = saving || Boolean(savingPage);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} centered noPadding>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Startup Page</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <div className="d-flex flex-column gap-3">
              <p className="mb-0 ui-small-muted">
                Choose your default starting page. When you log in to BusinessManager, you will be taken directly to this screen.
              </p>

              <div className="d-flex flex-column gap-1">
                {STARTUP_PAGE_OPTIONS.map((opt) => {
                  const isSelected = selectedPage === opt.value;
                  const isThisSaving = savingPage === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectOption(opt.value)}
                      className={`align-items-center border d-flex gap-2 p-2 rounded text-start transition-all ${
                        isSelected
                          ? "border-primary bg-primary-subtle text-primary-emphasis"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                      style={{ cursor: isBusy ? "not-allowed" : "pointer" }}
                      disabled={isBusy}
                      aria-pressed={isSelected}
                    >
                      <div
                        className={`d-flex align-items-center justify-content-center rounded-circle p-1 flex-shrink-0 ${
                          isSelected ? "bg-primary text-white" : "bg-body-secondary text-secondary"
                        }`}
                        style={{ width: "2rem", height: "2rem" }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small">{opt.label}</div>
                        <div className="ui-small-muted" style={{ fontSize: "0.72rem" }}>
                          {opt.description}
                        </div>
                      </div>
                      {isThisSaving ? (
                        <span className="badge rounded-pill bg-primary text-white ms-auto flex-shrink-0 d-flex align-items-center gap-1" style={{ fontSize: "0.68rem" }}>
                          <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} /> Updating…
                        </span>
                      ) : isSelected ? (
                        <span className="badge rounded-pill bg-primary text-white ms-auto flex-shrink-0" style={{ fontSize: "0.68rem" }}>
                          Active
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {message && (
                <div className={`small mb-0 ${message.includes("Failed") || message.includes("Error") ? "text-danger" : "text-success"}`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="component-footer">
          <div className="component-footer-left">
            <button type="button" onClick={handleClose} disabled={isBusy} className="btn ui-btn-circle-outline-secondary btn-circle" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
