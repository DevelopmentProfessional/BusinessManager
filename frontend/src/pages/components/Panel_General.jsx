// FILE: Panel_General.jsx
// Renders the general settings panel for managers/admins: application info, company info, branding, notifications, and client portal branding.

import React from "react";
import { InformationCircleIcon, BriefcaseIcon, SwatchIcon, BellIcon, CheckCircleIcon, ArrowUpTrayIcon, ChevronDownIcon, Squares2X2Icon, ArrowPathIcon, MagnifyingGlassPlusIcon, CircleStackIcon, FolderIcon, XMarkIcon, XCircleIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Modal from "./Modal";
import Footer_Settings from "./Footer_Settings";
import { documentsAPI } from "../../services/api";
import Dropdown_Custom from "./Dropdown_Custom";

const APP_ZOOM_LEVELS = [90, 100, 110, 125, 150];

const SECTION_BODY_MAX_HEIGHT = "min(52vh, calc(var(--vvp-height, 100dvh) - 14rem))";

/** Profile-style accordion: content expands upward above the section header row. */
function SettingsSection({ open, onToggle, icon: Icon, iconClassName = "", title, titleExtra = null, children }) {
  return (
    <div className="border rounded" style={{ background: "var(--bs-body-bg)" }}>
      {open && (
        <div className="px-1 py-1" style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight: SECTION_BODY_MAX_HEIGHT, overflowY: "auto" }}>
          {children}
        </div>
      )}
      <button type="button" className="align-items-center bg-transparent border-0 d-flex justify-content-between px-1 py-0 text-start w-100" onClick={onToggle} aria-expanded={open}>
        <div className="align-items-center d-flex flex-wrap gap-2 min-w-0">
          {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${iconClassName}`} />}
          <span className="fw-semibold">{title}</span>
          {titleExtra}
        </div>
        <ChevronDownIcon className="flex-shrink-0 h-4 text-muted w-4" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
    </div>
  );
}

const Panel_General = ({
  panelStyle,
  openAccordions,
  toggleAccordion,
  uiScale,
  setUiScale,
  cycleUiScale,
  syncLoading,
  handleManualSync,
  user,
  companyInfo,
  companyLoading,
  handleCompanyInfoChange,
  handleSaveCompanyInfo,
  localBranding,
  brandingLogoUploading,
  logoPickerOpen,
  setLogoPickerOpen,
  logoPickerLoading,
  logoPickerError,
  logoPickerDocs,
  handleBrandingChange,
  handleUploadBrandingLogo,
  handleSelectLogoFromDocuments,
  handleSaveBranding,
  loadLogoPickerDocs,
  notifications,
  handleNotificationChange,
  handleSaveNotifications,
  portalBranding,
  portalBrandingLoading,
  heroImageUploading,
  handlePortalBrandingChange,
  handleSavePortalBranding,
  handleUploadHeroImage,
  resetPortalBrandingDefaults,
  stripeSettings,
  stripeSettingsLoading,
  stripeTestLoading,
  handleStripeSettingsChange,
  handleSaveStripeSettings,
  handleStripeTestCheckout,
  settingsSuccess,
  HelpIcon,
  onCheckStartDatabase,
  dbCheckLoading,
  dbCheckStatus,
  onSave,
  onClose,
  saving = false,
}) => (
  <div className="accordion-popup d-flex flex-column min-h-0" style={panelStyle}>
    <div className="d-flex flex-column flex-grow-1 gap-2 min-h-0 overflow-auto" style={{ paddingBottom: "0.5rem" }}>
      {settingsSuccess && (
        <div className="align-items-center bg-success-subtle border border-success-subtle d-flex gap-2 p-0 rounded small text-success">
          <CheckCircleIcon className="flex-shrink-0 h-4 w-4" />
          {settingsSuccess}
        </div>
      )}

      <SettingsSection open={openAccordions.application} onToggle={() => toggleAccordion("application")} icon={InformationCircleIcon} iconClassName="text-primary" title="Application">
        <div className="row ui-row-g2">
          <div className="col-6">
            <div className="align-items-center bg-light d-flex justify-content-between p-0 rounded">
              <span className="fw-medium small">Version</span>
              <span className="ui-small-muted">1.0.0</span>
            </div>
          </div>
          <div className="col-6">
            <div className="align-items-center bg-light d-flex justify-content-between p-0 rounded">
              <span className="fw-medium small">Environment</span>
              <span className="ui-small-muted">{import.meta.env.DEV ? "Development" : "Production"}</span>
            </div>
          </div>
          <div className="col-12">
            <div className="align-items-center bg-light d-flex flex-wrap gap-2 justify-content-between mb-2 p-0 rounded">
              <div className="ui-flex-center-gap-2">
                <MagnifyingGlassPlusIcon className="h-4 text-primary w-4" />
                <span className="fw-medium small">App Zoom</span>
              </div>
              <div className="align-items-center d-flex flex-wrap gap-2">
                <button type="button" onClick={cycleUiScale} className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2" title="Increase zoom to the next preset">
                  <MagnifyingGlassPlusIcon className="ui-icon-4" />
                  <span>{uiScale}%</span>
                </button>
                <Dropdown_Custom
                  value={uiScale}
                  onChange={(e) => setUiScale(Number(e.target.value))}
                  className="form-select ui-control-sm"
                  style={{ width: "7rem" }}
                  options={APP_ZOOM_LEVELS.map((zoomLevel) => ({ value: zoomLevel, label: `${zoomLevel}%` }))}
                />
              </div>
            </div>
            {/* Admin-only: Check/Start Database Button */}
            {user?.role === "admin" && (
              <div className="align-items-center d-flex gap-2 mt-2">
                <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-flex gap-2" onClick={onCheckStartDatabase} disabled={dbCheckLoading}>
                  <CircleStackIcon className="ui-icon-4" />
                  <span title="Check or start database">{dbCheckLoading ? "…" : "DB"}</span>
                </button>
                {dbCheckStatus && <span className={`small ${dbCheckStatus.startsWith("Error") ? "text-danger" : "text-success"}`}>{dbCheckStatus}</span>}
              </div>
            )}
            <button type="button" onClick={handleManualSync} disabled={syncLoading} className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2" title="Refresh cached app data and reload this device">
              <ArrowPathIcon className="ui-icon-4" />
              <span title="Refresh cached app data">{syncLoading ? "…" : "Sync"}</span>
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection open={openAccordions.companyInfo} onToggle={() => toggleAccordion("companyInfo")} icon={BriefcaseIcon} iconClassName="text-primary" title="Company Info">
        {user?.company_id && (
          <div className="align-items-center d-flex gap-2 mb-3 px-1">
            <span className="text-muted text-xs" style={{ whiteSpace: "nowrap" }}>
              Company ID
            </span>
            <span className="fw-bold px-1 py-1 rounded-pill text-sm" style={{ background: "var(--bs-primary-bg-subtle, #1e3a5f)", color: "var(--bs-primary, #6366f1)", border: "1px solid var(--bs-primary, #6366f1)", letterSpacing: "0.08em", fontFamily: "monospace" }}>
              {user.company_id}
            </span>
            <span className="text-muted text-xs">(used at login)</span>
          </div>
        )}
        <div className="gap-3 grid grid-cols-2 mb-4">
          <div className="form-floating">
            <input type="text" id="company_name" value={companyInfo.company_name} onChange={(e) => handleCompanyInfoChange("company_name", e.target.value)} className="form-control ui-control-sm" placeholder="Company Name" />
            <label htmlFor="company_name">Company Name</label>
          </div>
          <div className="form-floating">
            <input type="email" id="company_email" value={companyInfo.company_email} onChange={(e) => handleCompanyInfoChange("company_email", e.target.value)} className="form-control ui-control-sm" placeholder="Company Email" />
            <label htmlFor="company_email">Company Email</label>
          </div>
          <div className="form-floating">
            <input type="text" id="company_phone" value={companyInfo.company_phone} onChange={(e) => handleCompanyInfoChange("company_phone", e.target.value)} className="form-control ui-control-sm" placeholder="Company Phone" />
            <label htmlFor="company_phone">Company Phone</label>
          </div>
          <div className="form-floating">
            <input type="text" id="company_address" value={companyInfo.company_address} onChange={(e) => handleCompanyInfoChange("company_address", e.target.value)} className="form-control ui-control-sm" placeholder="Company Address" />
            <label htmlFor="company_address">Company Address</label>
          </div>
          <div className="form-floating">
            <input type="number" id="tax_rate" value={companyInfo.tax_rate} onChange={(e) => handleCompanyInfoChange("tax_rate", parseFloat(e.target.value) || 0)} className="form-control ui-control-sm" placeholder="Tax Rate" min="0" max="100" step="0.01" />
            <label htmlFor="tax_rate">Tax Rate (%)</label>
          </div>
        </div>
        <p className="mb-2 text-muted text-xs">e.g. 8.5 for 8.5%</p>
      </SettingsSection>

      <SettingsSection open={openAccordions.branding} onToggle={() => toggleAccordion("branding")} icon={SwatchIcon} title="Branding" iconClassName="text-purple-500">
        <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
          <div className="form-floating">
            <input type="text" id="companyName" value={localBranding.companyName} onChange={(e) => handleBrandingChange("companyName", e.target.value)} className="form-control ui-control-sm" placeholder="Company Name" />
            <label htmlFor="companyName">Company Name</label>
          </div>
          <div className="form-floating">
            <input type="text" id="tagline" value={localBranding.tagline} onChange={(e) => handleBrandingChange("tagline", e.target.value)} className="form-control ui-control-sm" placeholder="Tagline" />
            <label htmlFor="tagline">Tagline</label>
          </div>
        </div>
        <div className="border p-0 rounded">
          <div className="align-items-center d-flex flex-wrap gap-2 justify-content-between">
            <div className="fw-medium">Logo Image</div>
            <div className="ui-flex-center-gap-2">
              <label className={`btn btn-sm btn-outline-primary ${brandingLogoUploading ? "disabled" : ""}`}>
                <ArrowUpTrayIcon className="ui-icon-4" style={{ width: 16, height: 16, marginRight: 6 }} />
                {brandingLogoUploading ? "…" : "Upload"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUploadBrandingLogo(e.target.files?.[0] || null)} disabled={brandingLogoUploading} />
              </label>
              <button
                type="button"
                className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2"
                onClick={async () => {
                  setLogoPickerOpen(true);
                  await loadLogoPickerDocs();
                }}
              >
                <FolderIcon className="ui-icon-4" />
                <span>Pick</span>
              </button>
              <button
                type="button"
                className="align-items-center btn btn-outline-danger btn-sm d-flex gap-2"
                onClick={() => {
                  handleBrandingChange("logoDocumentId", null);
                  handleBrandingChange("logoUrl", "");
                }}
              >
                <XCircleIcon className="ui-icon-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="align-items-center d-flex flex-wrap gap-3 mt-2">
            {localBranding.logoDocumentId ? (
              <img src={documentsAPI.fileUrl(localBranding.logoDocumentId)} alt="Logo" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6, border: "1px solid var(--bs-border-color)" }} />
            ) : localBranding.logoUrl ? (
              <img src={localBranding.logoUrl} alt="Logo" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6, border: "1px solid var(--bs-border-color)" }} />
            ) : (
              <div className="ui-small-muted">No logo selected.</div>
            )}
            {localBranding.logoDocumentId && (
              <div className="ui-small-muted" style={{ wordBreak: "break-all" }}>
                Document ID: {String(localBranding.logoDocumentId)}
              </div>
            )}
          </div>
        </div>
        <div className="gap-3 grid grid-cols-3">
          {[
            { key: "primaryColor", label: "Primary", helpId: "primary-color", helpText: "Main buttons and links" },
            { key: "secondaryColor", label: "Secondary", helpId: "secondary-color", helpText: "Success states and highlights" },
            { key: "accentColor", label: "Accent", helpId: "accent-color", helpText: "Special elements and badges" },
          ].map(({ key, label, helpId, helpText }) => (
            <div key={key}>
              <label className="flex font-medium items-center mb-1 text-sm">
                {label} <HelpIcon id={helpId} text={helpText} />
              </label>
              <div className="ui-flex-items-gap-2">
                <input type="color" value={localBranding[key]} onChange={(e) => handleBrandingChange(key, e.target.value)} className="border cursor-pointer flex-shrink-0 rounded" />
                <input type="text" value={localBranding[key]} onChange={(e) => handleBrandingChange(key, e.target.value)} className="border flex-1 font-mono min-w-0 px-0 py-1 rounded text-xs" />
              </div>
            </div>
          ))}
        </div>
        <Modal
          isOpen={logoPickerOpen}
          onClose={() => setLogoPickerOpen(false)}
          title="Select Logo from Documents"
          centered={true}
          footer={
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="align-items-center btn btn-secondary d-flex gap-2" onClick={() => setLogoPickerOpen(false)}>
                <XMarkIcon className="ui-icon-4" />
                <span>Close</span>
              </button>
            </div>
          }
        >
          <div className="space-y-2">
            {logoPickerLoading && <div className="text-muted">Loading images...</div>}
            {logoPickerError && <div className="text-danger">{logoPickerError}</div>}
            {!logoPickerLoading && !logoPickerError && logoPickerDocs.length === 0 && <div className="text-muted">No image documents found.</div>}

            {!logoPickerLoading && logoPickerDocs.length > 0 && (
              <div className="gap-2 grid grid-cols-2 sm:grid-cols-3">
                {logoPickerDocs.map((doc) => (
                  <button key={doc.id} type="button" className="border hover:bg-gray-50 p-0 rounded text-start" onClick={() => handleSelectLogoFromDocuments(doc)} style={{ background: "var(--bs-body-bg)" }}>
                    <img src={documentsAPI.fileUrl(doc.id)} alt={doc.original_filename || "image"} style={{ width: "100%", height: 90, objectFit: "contain", background: "#fff", borderRadius: 6 }} />
                    <div className="mt-1 small text-truncate">{doc.original_filename || "(unnamed)"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      </SettingsSection>

      <SettingsSection open={openAccordions.notifications} onToggle={() => toggleAccordion("notifications")} icon={BellIcon} iconClassName="text-warning" title="Notifications">
        {[
          { key: "emailEnabled", label: "Email Notifications", helpId: "email-notif", helpText: "Receive updates via email" },
          { key: "appointmentReminders", label: "Appointment Reminders", helpId: "appt-reminders", helpText: "Get reminded before appointments" },
          { key: "dailyDigest", label: "Daily Digest", helpId: "daily-digest", helpText: "Receive a daily summary email" },
        ].map(({ key, label, helpId, helpText }) => (
          <div key={key} className="bg-gray-50 dark:bg-gray-900 flex items-center justify-between p-1 rounded-lg">
            <div className="flex items-center">
              <span className="font-medium text-sm">{label}</span>
              <HelpIcon id={helpId} text={helpText} />
            </div>
            <label className="cursor-pointer inline-flex items-center relative">
              <input type="checkbox" checked={notifications[key]} onChange={(e) => handleNotificationChange(key, e.target.checked)} className="peer sr-only" />
              <div className="after:absolute after:bg-white after:border after:content-[''] after:h-5 after:left-[2px] after:rounded-full after:top-[2px] after:transition-all after:w-5 bg-gray-200 h-6 peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 rounded-full w-11"></div>
            </label>
          </div>
        ))}
      </SettingsSection>

      {user?.role === "admin" && (
        <SettingsSection open={openAccordions.payments} onToggle={() => toggleAccordion("payments")} icon={CreditCardIcon} iconClassName="text-success" title="Payments (Stripe)">
          <div className="alert alert-info mb-2 py-1 small">Configure Stripe card payments here. Stripe checkout has no monthly fee by default; you only pay per successful transaction.</div>

          <div className="align-items-center d-flex gap-2 mb-2">
            <input id="stripe_enabled" type="checkbox" className="form-check-input m-0" checked={!!stripeSettings.stripe_enabled} onChange={(e) => handleStripeSettingsChange("stripe_enabled", e.target.checked)} />
            <label htmlFor="stripe_enabled" className="fw-medium small mb-0">
              Enable Stripe card payments
            </label>
          </div>

          <div className="form-floating ui-form-floating-mb2">
            <Dropdown_Custom
              id="stripe_mode"
              value={stripeSettings.stripe_mode || "test"}
              onChange={(e) => handleStripeSettingsChange("stripe_mode", e.target.value === "live" ? "live" : "test")}
              className="form-select ui-control-sm"
              options={[
                { value: "test", label: "Sandbox / Test Mode" },
                { value: "live", label: "Production / Live Mode" },
              ]}
            />
            <label htmlFor="stripe_mode">Active Payment Mode</label>
          </div>

          <div className="alert alert-secondary mb-2 py-1 small">
            Current mode: <span className="fw-semibold text-uppercase">{(stripeSettings.stripe_mode || "test") === "live" ? "LIVE" : "TEST"}</span>
          </div>

          <div className="border mb-2 p-1 rounded">
            <div className="fw-semibold mb-2 small">Test (Sandbox) Keys</div>
            <div className="form-floating ui-form-floating-mb2">
              <input
                type="text"
                id="stripe_test_publishable_key"
                value={stripeSettings.stripe_test_publishable_key || ""}
                onChange={(e) => handleStripeSettingsChange("stripe_test_publishable_key", e.target.value)}
                className="form-control ui-control-sm"
                placeholder="pk_test_..."
                autoComplete="off"
              />
              <label htmlFor="stripe_test_publishable_key">Test Publishable Key</label>
            </div>

            <div className="form-floating ui-form-floating-mb2">
              <input type="password" id="stripe_test_secret_key" value={stripeSettings.stripe_test_secret_key || ""} onChange={(e) => handleStripeSettingsChange("stripe_test_secret_key", e.target.value)} className="form-control ui-control-sm" placeholder="sk_test_..." autoComplete="new-password" />
              <label htmlFor="stripe_test_secret_key">Test Secret Key</label>
            </div>

            <div className="form-floating mb-0">
              <input
                type="password"
                id="stripe_test_webhook_secret"
                value={stripeSettings.stripe_test_webhook_secret || ""}
                onChange={(e) => handleStripeSettingsChange("stripe_test_webhook_secret", e.target.value)}
                className="form-control ui-control-sm"
                placeholder="whsec_..."
                autoComplete="new-password"
              />
              <label htmlFor="stripe_test_webhook_secret">Test Webhook Secret</label>
            </div>
          </div>

          <div className="border mb-2 p-1 rounded">
            <div className="fw-semibold mb-2 small">Live (Production) Keys</div>
            <div className="form-floating ui-form-floating-mb2">
              <input
                type="text"
                id="stripe_live_publishable_key"
                value={stripeSettings.stripe_live_publishable_key || ""}
                onChange={(e) => handleStripeSettingsChange("stripe_live_publishable_key", e.target.value)}
                className="form-control ui-control-sm"
                placeholder="pk_live_..."
                autoComplete="off"
              />
              <label htmlFor="stripe_live_publishable_key">Live Publishable Key</label>
            </div>

            <div className="form-floating ui-form-floating-mb2">
              <input type="password" id="stripe_live_secret_key" value={stripeSettings.stripe_live_secret_key || ""} onChange={(e) => handleStripeSettingsChange("stripe_live_secret_key", e.target.value)} className="form-control ui-control-sm" placeholder="sk_live_..." autoComplete="new-password" />
              <label htmlFor="stripe_live_secret_key">Live Secret Key</label>
            </div>

            <div className="form-floating mb-0">
              <input
                type="password"
                id="stripe_live_webhook_secret"
                value={stripeSettings.stripe_live_webhook_secret || ""}
                onChange={(e) => handleStripeSettingsChange("stripe_live_webhook_secret", e.target.value)}
                className="form-control ui-control-sm"
                placeholder="whsec_..."
                autoComplete="new-password"
              />
              <label htmlFor="stripe_live_webhook_secret">Live Webhook Secret</label>
            </div>
          </div>

          <Button_Toolbar icon={CheckCircleIcon} label={stripeSettingsLoading ? "Saving..." : "Save Payment Gateway Settings"} onClick={handleSaveStripeSettings} className="btn-success" disabled={stripeSettingsLoading} />

          {/* TEMPORARY TEST BLOCK (isolated for easy removal) */}
          <div className="alert alert-warning mb-0 mt-2 py-1">
            <div className="fw-semibold mb-1 small">Temporary Test Utilities</div>
            <button type="button" className="btn btn-outline-dark btn-sm" onClick={handleStripeTestCheckout} disabled={stripeTestLoading || stripeSettingsLoading}>
              {stripeTestLoading ? "Launching test..." : "Launch Checkout in Current Mode ($0.50)"}
            </button>
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        open={openAccordions.clientPortal}
        onToggle={() => toggleAccordion("clientPortal")}
        icon={Squares2X2Icon}
        iconClassName="text-indigo-500"
        title="Client Portal Page"
        titleExtra={
          <span className="badge bg-primary-subtle text-primary" style={{ fontSize: "0.65rem" }}>
            Branding
          </span>
        }
      >
        <div className="border mb-4 overflow-hidden rounded-xl" style={{ border: "1px solid var(--bs-border-color)" }}>
          <div style={{ fontSize: "0.68rem", padding: "4px 10px", background: "var(--bs-secondary-bg)", color: "var(--bs-secondary-color)", borderBottom: "1px solid var(--bs-border-color)" }}>Live Preview</div>
          {portalBranding.portal_show_hero && (
            <div
              style={{
                background: portalBranding.portal_hero_bg_color || "#4f46e5",
                padding: "20px 16px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              {portalBranding.portal_hero_image_url && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${portalBranding.portal_hero_image_url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.3 }} />}
              <div style={{ position: "relative" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: portalBranding.portal_hero_text_color || "#ffffff" }}>{portalBranding.portal_hero_title || companyInfo.company_name || "Your Business Name"}</div>
                {portalBranding.portal_hero_subtitle && <div style={{ fontSize: "0.72rem", color: `${portalBranding.portal_hero_text_color || "#ffffff"}bb`, marginTop: 4 }}>{portalBranding.portal_hero_subtitle}</div>}
                {portalBranding.portal_hero_tagline && <div style={{ fontSize: "0.65rem", fontStyle: "italic", color: `${portalBranding.portal_hero_text_color || "#ffffff"}88`, marginTop: 3 }}>{portalBranding.portal_hero_tagline}</div>}
              </div>
            </div>
          )}
          {portalBranding.portal_show_banner && portalBranding.portal_banner_text && <div style={{ background: portalBranding.portal_banner_color || "#4f46e5", color: "#fff", padding: "6px 12px", fontSize: "0.72rem", textAlign: "center" }}>{portalBranding.portal_banner_text}</div>}
          <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", padding: "8px 0" }}>
            {["Shop", "Cart", "Orders", "Account"].map((n) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: "0.6rem",
                  color: n === "Shop" ? portalBranding.portal_primary_color || "#4f46e5" : "#9ca3af",
                  fontWeight: n === "Shop" ? 700 : 400,
                  borderBottom: n === "Shop" ? `2px solid ${portalBranding.portal_primary_color || "#4f46e5"}` : "2px solid transparent",
                  paddingBottom: 4,
                }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        <div className="d-flex gap-3 mb-3">
          <label className="align-items-center cursor-pointer d-flex gap-2">
            <input type="checkbox" className="form-check-input m-0" checked={portalBranding.portal_show_hero} onChange={(e) => handlePortalBrandingChange("portal_show_hero", e.target.checked)} />
            <span className="fw-medium small">Show Hero Section</span>
          </label>
          <label className="align-items-center cursor-pointer d-flex gap-2">
            <input type="checkbox" className="form-check-input m-0" checked={portalBranding.portal_show_banner} onChange={(e) => handlePortalBrandingChange("portal_show_banner", e.target.checked)} />
            <span className="fw-medium small">Show Announcement Banner</span>
          </label>
        </div>

        {portalBranding.portal_show_hero && (
          <div className="border mb-3 p-1 rounded-xl" style={{ background: "var(--bs-tertiary-bg)" }}>
            <p className="fw-semibold mb-2 small text-muted text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>
              Hero Section
            </p>
            <div className="gap-2 grid grid-cols-2 mb-2">
              <div className="form-floating">
                <input type="text" className="form-control ui-control-sm" id="portal_hero_title" value={portalBranding.portal_hero_title} onChange={(e) => handlePortalBrandingChange("portal_hero_title", e.target.value)} placeholder="Title" />
                <label htmlFor="portal_hero_title">Headline</label>
              </div>
              <div className="form-floating">
                <input type="text" className="form-control ui-control-sm" id="portal_hero_subtitle" value={portalBranding.portal_hero_subtitle} onChange={(e) => handlePortalBrandingChange("portal_hero_subtitle", e.target.value)} placeholder="Subtitle" />
                <label htmlFor="portal_hero_subtitle">Subtitle</label>
              </div>
            </div>
            <div className="form-floating ui-form-floating-mb2">
              <input type="text" className="form-control ui-control-sm" id="portal_hero_tagline" value={portalBranding.portal_hero_tagline} onChange={(e) => handlePortalBrandingChange("portal_hero_tagline", e.target.value)} placeholder="Tagline (optional)" />
              <label htmlFor="portal_hero_tagline">Tagline (optional italic line)</label>
            </div>
            <div className="align-items-center d-flex flex-wrap gap-3 mb-2">
              <div className="ui-flex-center-gap-2">
                <label className="ui-small-muted">Background</label>
                <input type="color" value={portalBranding.portal_hero_bg_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_hero_bg_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
              </div>
              <div className="ui-flex-center-gap-2">
                <label className="ui-small-muted">Text</label>
                <input type="color" value={portalBranding.portal_hero_text_color || "#ffffff"} onChange={(e) => handlePortalBrandingChange("portal_hero_text_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
              </div>
            </div>
            <div className="ui-flex-center-gap-2">
              <div className="flex-grow-1 form-floating">
                <input type="url" className="form-control ui-control-sm" id="portal_hero_image_url" value={portalBranding.portal_hero_image_url} onChange={(e) => handlePortalBrandingChange("portal_hero_image_url", e.target.value)} placeholder="Hero image URL" />
                <label htmlFor="portal_hero_image_url">Hero Image URL</label>
              </div>
              <label className={`btn btn-sm btn-outline-primary flex-shrink-0 ${heroImageUploading ? "disabled" : ""}`} style={{ whiteSpace: "nowrap" }}>
                {heroImageUploading ? "…" : "Upload"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUploadHeroImage(e.target.files?.[0] || null)} disabled={heroImageUploading} />
              </label>
              {portalBranding.portal_hero_image_url && (
                <button type="button" className="btn btn-outline-danger btn-sm flex-shrink-0" onClick={() => handlePortalBrandingChange("portal_hero_image_url", "")}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {portalBranding.portal_show_banner && (
          <div className="border mb-3 p-1 rounded-xl" style={{ background: "var(--bs-tertiary-bg)" }}>
            <p className="fw-semibold mb-2 small text-muted text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>
              Announcement Banner
            </p>
            <div className="form-floating ui-form-floating-mb2">
              <input type="text" className="form-control ui-control-sm" id="portal_banner_text" value={portalBranding.portal_banner_text} onChange={(e) => handlePortalBrandingChange("portal_banner_text", e.target.value)} placeholder="Banner message" />
              <label htmlFor="portal_banner_text">Banner Message</label>
            </div>
            <div className="ui-flex-center-gap-2">
              <label className="ui-small-muted">Banner Color</label>
              <input type="color" value={portalBranding.portal_banner_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_banner_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
            </div>
          </div>
        )}

        <div className="border mb-3 p-1 rounded-xl" style={{ background: "var(--bs-tertiary-bg)" }}>
          <p className="fw-semibold mb-2 small text-muted text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>
            Colors & Footer
          </p>
          <div className="align-items-center d-flex flex-wrap gap-3 mb-3">
            <div className="ui-flex-center-gap-2">
              <label className="ui-small-muted">Primary</label>
              <input type="color" value={portalBranding.portal_primary_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_primary_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
              <span className="font-monospace small text-muted">{portalBranding.portal_primary_color || "#4f46e5"}</span>
            </div>
            <div className="ui-flex-center-gap-2">
              <label className="ui-small-muted">Secondary</label>
              <input type="color" value={portalBranding.portal_secondary_color || "#0ea5e9"} onChange={(e) => handlePortalBrandingChange("portal_secondary_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
              <span className="font-monospace small text-muted">{portalBranding.portal_secondary_color || "#0ea5e9"}</span>
            </div>
          </div>
          <div className="form-floating">
            <input type="text" className="form-control ui-control-sm" id="portal_footer_text" value={portalBranding.portal_footer_text} onChange={(e) => handlePortalBrandingChange("portal_footer_text", e.target.value)} placeholder="Footer text" />
            <label htmlFor="portal_footer_text">Footer Text</label>
          </div>
        </div>

        <Button_Toolbar icon={ArrowPathIcon} label="Reset" onClick={resetPortalBrandingDefaults} className="btn-outline-secondary" title="Reset to defaults" />
      </SettingsSection>
    </div>
    <Footer_Settings onSave={onSave} onClose={onClose} saving={saving || companyLoading || portalBrandingLoading} />
  </div>
);

export default Panel_General;
