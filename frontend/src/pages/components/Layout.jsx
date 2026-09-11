import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserGroupIcon, UsersIcon, CalendarDaysIcon, ArchiveBoxIcon, DocumentIcon, EllipsisHorizontalIcon, UserCircleIcon, ChartBarIcon, ShoppingCartIcon, SparklesIcon } from "@heroicons/react/24/outline";
import useStore from "../../services/useStore";
import useViewMode from "../../services/useViewMode";
import { applyButtonDimensions } from "../../constants/buttonTextSize";
import { chatAPI } from "../../services/api";
import Badge_PendingOrder from "./Badge_PendingOrder";

// All navigation items (shown in bottom-right expandable menu on mobile)
// Order: Profile, Reports, Inventory, Clients, Employees, Documents, Services, Sales, Schedule, Settings
const allNavigation = [
  { name: "Profile", href: "/profile", icon: UserCircleIcon },
  { name: "Reports", href: "/reports", icon: ChartBarIcon, permission: "reports:read" },
  { name: "Inventory", href: "/inventory", icon: ArchiveBoxIcon, permission: "inventory:read" },
  { name: "Clients", href: "/clients", icon: UserGroupIcon, permission: "clients:read" },
  { name: "Employees", href: "/employees", icon: UsersIcon, permission: "employees:read" },
  { name: "Documents", href: "/documents", icon: DocumentIcon, permission: "documents:read" },
  { name: "Services", href: "/services", icon: SparklesIcon, permission: "services:read" },
  { name: "Sales", href: "/sales", icon: ShoppingCartIcon, permission: "sales:read" },
  { name: "Schedule", href: "/schedule", icon: CalendarDaysIcon, permission: "schedule:read" },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

/** Bottom-right +Nav toggle and expanded menu share this layer (above page footers at 1050). */
const APP_NAV_Z_INDEX = 1100;

export default function Layout({ children }) {
  const [expandedMenuOpen, setExpandedMenuOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const unreadRequestInFlightRef = useRef(false);
  const location = useLocation();
  const { user, hasPermission, hasPageAccess, isOnline, setOnline } = useStore();
  const { isTrainingMode, buttonTextSize, uiScale } = useViewMode();

  const employeeUnreadTotal = Object.values(unreadCounts).reduce((total, count) => {
    const numericCount = Number(count) || 0;
    return total + numericCount;
  }, 0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("training-mode", isTrainingMode);
  }, [isTrainingMode]);

  useEffect(() => {
    applyButtonDimensions(buttonTextSize, isTrainingMode);
  }, [buttonTextSize, isTrainingMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-ui-scale", String(uiScale / 100));
    return () => {
      document.documentElement.style.removeProperty("--app-ui-scale");
    };
  }, [uiScale]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const update = () => {
      document.documentElement.style.setProperty("--vvp-height", `${window.visualViewport.height}px`);
    };
    window.visualViewport.addEventListener("resize", update);
    update();
    return () => {
      window.visualViewport.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  useEffect(() => {
    if (!hasPageAccess("employees")) return;
    if (location.pathname !== "/employees") return;

    let cancelled = false;

    const loadUnreadCounts = async () => {
      if (unreadRequestInFlightRef.current) return;
      unreadRequestInFlightRef.current = true;
      try {
        const res = await chatAPI.getUnreadCounts();
        const data = res?.data ?? res;
        if (!cancelled && data && typeof data === "object") {
          setUnreadCounts(data);
        }
      } catch {
        if (!cancelled) setUnreadCounts({});
      } finally {
        unreadRequestInFlightRef.current = false;
      }
    };

    loadUnreadCounts();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, hasPageAccess]);

  // Filter navigation items based on user permissions - show if user has ANY permission for the page
  const filteredNavigation = allNavigation.filter((item) => {
    if (!item.permission) return true; // Dashboard and Profile don't need specific permissions

    const [page, permission] = item.permission.split(":");

    return hasPermission(page, permission);
  });

  return (
    <div className="app-shell bg-body d-flex flex-column">
      {/* Offline banner */}
      {!isOnline && (
        <div className="align-items-center d-flex end-0 gap-2 justify-content-center position-absolute px-1 py-0 start-0 text-sm top-0" style={{ zIndex: 2000, backgroundColor: "#f59e0b", color: "#1c1917" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>You are offline — changes cannot be saved.</span>
        </div>
      )}

      {/* Main content - min-h-0 so children can use overflow without making page scroll */}
      <main className="app-shell-main d-flex flex-column flex-grow-1 min-h-0 overflow-hidden" style={!isOnline ? { paddingTop: "2rem" } : undefined}>
        {children}
      </main>

      {/* Navigation menu overlay */}
      {expandedMenuOpen && (
        <div className="h-100 position-absolute start-0 top-0 w-100" style={{ zIndex: APP_NAV_Z_INDEX }}>
          {/* Backdrop */}
          <div className="bg-dark bg-opacity-25 h-100 position-absolute start-0 top-0 w-100" onClick={() => setExpandedMenuOpen(false)} />

          {/* Menu positioned bottom-right */}
          <div className="app-nav-bottom-menu-panel position-absolute ps-0 rounded-3" style={{ minWidth: "1rem" }}>
            <div className="app-nav-bottom-menu d-flex flex-column gap-2">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                const showEmployeeBadge = item.name === "Employees" && employeeUnreadTotal > 0;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setExpandedMenuOpen(false)}
                    className={classNames(isActive ? "btn btn-primary" : "btn btn-outline-secondary", "d-flex align-items-center text-decoration-none position-relative", isTrainingMode ? "rounded-pill gap-1 ps-1 pe-1 justify-content-start" : "rounded-circle justify-content-center p-0")}
                    style={{
                      backgroundColor: isActive ? "var(--bs-primary)" : "var(--bs-tertiary-bg)",
                      color: isActive ? "var(--bs-white)" : "var(--bs-body-color)",
                      borderColor: isActive ? "var(--bs-primary)" : "var(--bs-border-color)",
                    }}
                    title={item.name}
                  >
                    <item.icon className="app-icon flex-shrink-0" />
                    {isTrainingMode && <span>{item.name}</span>}
                    {showEmployeeBadge && (
                      <span className="badge bg-danger position-absolute rounded-pill" style={{ top: -4, right: -4, fontSize: "0.6rem", minWidth: 16, padding: "2px 4px" }}>
                        {employeeUnreadTotal > 9 ? "9+" : employeeUnreadTotal}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation toggle — pill: training shows +Nav, compact shows ⋯ only */}
      <button
        type="button"
        onClick={() => setExpandedMenuOpen(!expandedMenuOpen)}
        title={expandedMenuOpen ? "Close menu" : "Open menu"}
        aria-label={expandedMenuOpen ? "Close menu" : "Open menu"}
        className={classNames(
          expandedMenuOpen ? "btn btn-primary" : "btn btn-outline-secondary",
          "btn-app-nav app-nav-bottom-toggle position-absolute shadow-lg d-flex align-items-center rounded-pill position-relative",
          isTrainingMode ? "ps-0 pe-0 justify-content-start" : "p-0 justify-content-center"
        )}
        style={{
          zIndex: APP_NAV_Z_INDEX,
          backgroundColor: expandedMenuOpen ? "var(--bs-primary)" : "var(--bs-tertiary-bg)",
          color: expandedMenuOpen ? "var(--bs-white)" : "var(--bs-body-color)",
          borderColor: expandedMenuOpen ? "var(--bs-primary)" : "var(--bs-border-color)",
        }}
      >
        {!isTrainingMode && <EllipsisHorizontalIcon className="app-icon flex-shrink-0" />}
        {isTrainingMode && (
          <span className="text-nowrap" style={{ fontSize: "var(--app-btn-label-font-size, 0.78rem)", lineHeight: 1, marginLeft: "-0.125rem" }}>
            Menu
          </span>
        )}
        <Badge_PendingOrder clientId={user?.client_id} />
      </button>
    </div>
  );
}
