// FILE: Panel_General.jsx
// Renders the general settings panel for managers/admins: application info, company info, branding, notifications, and client portal branding.

import React from "react";
import {
  CogIcon,
  InformationCircleIcon,
  BriefcaseIcon,
  SwatchIcon,
  BellIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ArrowPathIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Modal from "./Modal";
import { documentsAPI } from "../../services/api";

const APP_ZOOM_LEVELS = [90, 100, 110, 125, 150];

const Panel_General = ({
  isMobile,
  settingsPanelStyle,
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
  settingsSuccess,
  HelpIcon,
}) => (
  <div className="accordion-popup" style={settingsPanelStyle}>
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, width: "100%", overflowY: "auto", minHeight: 0 }}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CogIcon className="h-5 w-5" /> General Settings
      </h2>

      {/* Application */}
      <div className="mb-2">
        <button onClick={() => toggleAccordion("application")} className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start" style={{ border: "none", borderBottom: "1px solid var(--bs-border-color)" }}>
          <div className="d-flex align-items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-500" />
            <span className="fw-medium">Application</span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" style={{ transition: "transform 0.2s", transform: openAccordions.application ? "rotate(180deg)" : "none" }} />
        </button>
        {openAccordions.application && (
          <div className="accordion-popup py-3">
            <div className="row g-2">
              <div className="col-6">
                <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                  <span className="small fw-medium">Version</span>
                  <span className="small text-muted">1.0.0</span>
                </div>
              </div>
              <div className="col-6">
                <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                  <span className="small fw-medium">Environment</span>
                  <span className="small text-muted">{import.meta.env.DEV ? "Development" : "Production"}</span>
                </div>
              </div>
              <div className="col-12">
                <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded mb-2 gap-2 flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <MagnifyingGlassPlusIcon className="h-4 w-4 text-primary" />
                    <span className="small fw-medium">App Zoom</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <button type="button" onClick={cycleUiScale} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" title="Increase zoom to the next preset">
                      <MagnifyingGlassPlusIcon className="h-4 w-4" />
                      <span>{uiScale}%</span>
                    </button>
                    <select value={uiScale} onChange={(e) => setUiScale(Number(e.target.value))} className="form-select form-select-sm" style={{ width: "7rem" }} aria-label="App zoom level">
                      {APP_ZOOM_LEVELS.map((zoomLevel) => (
                        <option key={zoomLevel} value={zoomLevel}>
                          {zoomLevel}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="button" onClick={handleManualSync} disabled={syncLoading} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2">
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>{syncLoading ? "Syncing…" : "Sync Now"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Info */}
      <div className="mb-2">
        <button onClick={() => toggleAccordion("companyInfo")} className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start" style={{ border: "none", borderBottom: "1px solid var(--bs-border-color)" }}>
          <div className="d-flex align-items-center gap-2">
            <BriefcaseIcon className="h-5 w-5 text-blue-600" />
            <span className="fw-medium">Company Info</span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" style={{ transition: "transform 0.2s", transform: openAccordions.companyInfo ? "rotate(180deg)" : "none" }} />
        </button>
        {openAccordions.companyInfo && (
          <div className="accordion-popup py-3">
            {user?.company_id && (
              <div className="d-flex align-items-center gap-2 mb-3 px-1">
                <span className="text-xs text-muted" style={{ whiteSpace: "nowrap" }}>
                  Company ID
                </span>
                <span className="fw-bold text-sm px-3 py-1 rounded-pill" style={{ background: "var(--bs-primary-bg-subtle, #1e3a5f)", color: "var(--bs-primary, #6366f1)", border: "1px solid var(--bs-primary, #6366f1)", letterSpacing: "0.08em", fontFamily: "monospace" }}>
                  {user.company_id}
                </span>
                <span className="text-xs text-muted">(used at login)</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="form-floating">
                <input type="text" id="company_name" value={companyInfo.company_name} onChange={(e) => handleCompanyInfoChange("company_name", e.target.value)} className="form-control form-control-sm" placeholder="Company Name" />
                <label htmlFor="company_name">Company Name</label>
              </div>
              <div className="form-floating">
                <input type="email" id="company_email" value={companyInfo.company_email} onChange={(e) => handleCompanyInfoChange("company_email", e.target.value)} className="form-control form-control-sm" placeholder="Company Email" />
                <label htmlFor="company_email">Company Email</label>
              </div>
              <div className="form-floating">
                <input type="text" id="company_phone" value={companyInfo.company_phone} onChange={(e) => handleCompanyInfoChange("company_phone", e.target.value)} className="form-control form-control-sm" placeholder="Company Phone" />
                <label htmlFor="company_phone">Company Phone</label>
              </div>
              <div className="form-floating">
                <input type="text" id="company_address" value={companyInfo.company_address} onChange={(e) => handleCompanyInfoChange("company_address", e.target.value)} className="form-control form-control-sm" placeholder="Company Address" />
                <label htmlFor="company_address">Company Address</label>
              </div>
              <div className="form-floating">
                <input type="number" id="tax_rate" value={companyInfo.tax_rate} onChange={(e) => handleCompanyInfoChange("tax_rate", parseFloat(e.target.value) || 0)} className="form-control form-control-sm" placeholder="Tax Rate" min="0" max="100" step="0.01" />
                <label htmlFor="tax_rate">Tax Rate (%)</label>
              </div>
            </div>
            <p className="text-xs text-muted mb-2">e.g. 8.5 for 8.5%</p>
            <div className="mb-2">
              <Button_Toolbar icon={CheckCircleIcon} label={companyLoading ? "Saving..." : "Save "} onClick={handleSaveCompanyInfo} className="btn-primary" disabled={companyLoading} />
            </div>
          </div>
        )}
      </div>

      {/* Branding */}
      <div className="mb-2">
        <button onClick={() => toggleAccordion("branding")} className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start" style={{ border: "none", borderBottom: "1px solid var(--bs-border-color)" }}>
          <div className="d-flex align-items-center gap-2">
            <SwatchIcon className="h-5 w-5 text-purple-500" />
            <span className="fw-medium">Branding</span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" style={{ transition: "transform 0.2s", transform: openAccordions.branding ? "rotate(180deg)" : "none" }} />
        </button>
        {openAccordions.branding && (
          <div className="accordion-popup py-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-floating">
                <input type="text" id="companyName" value={localBranding.companyName} onChange={(e) => handleBrandingChange("companyName", e.target.value)} className="form-control form-control-sm" placeholder="Company Name" />
                <label htmlFor="companyName">Company Name</label>
              </div>
              <div className="form-floating">
                <input type="text" id="tagline" value={localBranding.tagline} onChange={(e) => handleBrandingChange("tagline", e.target.value)} className="form-control form-control-sm" placeholder="Tagline" />
                <label htmlFor="tagline">Tagline</label>
              </div>
            </div>
            <div className="form-floating">
              <input type="url" id="logoUrl" value={localBranding.logoUrl} onChange={(e) => handleBrandingChange("logoUrl", e.target.value)} className="form-control form-control-sm" placeholder="Logo URL" />
              <label htmlFor="logoUrl">Logo URL</label>
            </div>
            <div className="border rounded p-2">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <div className="fw-medium">Logo Image</div>
                <div className="d-flex align-items-center gap-2">
                  <label className={`btn btn-sm btn-outline-primary ${brandingLogoUploading ? "disabled" : ""}`}>
                    <ArrowUpTrayIcon className="h-4 w-4" style={{ width: 16, height: 16, marginRight: 6 }} />
                    {brandingLogoUploading ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUploadBrandingLogo(e.target.files?.[0] || null)} disabled={brandingLogoUploading} />
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={async () => {
                      setLogoPickerOpen(true);
                      await loadLogoPickerDocs();
                    }}
                  >
                    Choose from Documents
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { handleBrandingChange("logoDocumentId", null); handleBrandingChange("logoUrl", ""); }}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-2 d-flex align-items-center gap-3 flex-wrap">
                {localBranding.logoDocumentId ? (
                  <img src={documentsAPI.fileUrl(localBranding.logoDocumentId)} alt="Logo" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6, border: "1px solid var(--bs-border-color)" }} />
                ) : localBranding.logoUrl ? (
                  <img src={localBranding.logoUrl} alt="Logo" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6, border: "1px solid var(--bs-border-color)" }} />
                ) : (
                  <div className="text-muted small">No logo selected.</div>
                )}
                {localBranding.logoDocumentId && (
                  <div className="small text-muted" style={{ wordBreak: "break-all" }}>
                    Document ID: {String(localBranding.logoDocumentId)}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "primaryColor", label: "Primary", helpId: "primary-color", helpText: "Main buttons and links" },
                { key: "secondaryColor", label: "Secondary", helpId: "secondary-color", helpText: "Success states and highlights" },
                { key: "accentColor", label: "Accent", helpId: "accent-color", helpText: "Special elements and badges" },
              ].map(({ key, label, helpId, helpText }) => (
                <div key={key}>
                  <label className="flex items-center text-sm font-medium mb-1">
                    {label} <HelpIcon id={helpId} text={helpText} />
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={localBranding[key]} onChange={(e) => handleBrandingChange(key, e.target.value)} className="rounded border cursor-pointer flex-shrink-0" style={{ width: "2.5rem", height: "2.5rem" }} />
                    <input type="text" value={localBranding[key]} onChange={(e) => handleBrandingChange(key, e.target.value)} className="flex-1 min-w-0 px-2 py-1 border rounded text-xs font-mono" />
                  </div>
                </div>
              ))}
            </div>
            <Button_Toolbar icon={CheckCircleIcon} label="Save Branding" onClick={handleSaveBranding} className="btn-primary" />

            <Modal
              isOpen={logoPickerOpen}
              onClose={() => setLogoPickerOpen(false)}
              title="Select Logo from Documents"
              centered={true}
              footer={
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setLogoPickerOpen(false)}>
                    Close
                  </button>
                </div>
              }
            >
              <div className="space-y-2">
                {logoPickerLoading && <div className="text-muted">Loading images...</div>}
                {logoPickerError && <div className="text-danger">{logoPickerError}</div>}
                {!logoPickerLoading && !logoPickerError && logoPickerDocs.length === 0 && <div className="text-muted">No image documents found.</div>}

                {!logoPickerLoading && logoPickerDocs.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {logoPickerDocs.map((doc) => (
                      <button key={doc.id} type="button" className="border rounded p-2 text-start hover:bg-gray-50" onClick={() => handleSelectLogoFromDocuments(doc)} style={{ background: "var(--bs-body-bg)" }}>
                        <img src={documentsAPI.fileUrl(doc.id)} alt={doc.original_filename || "image"} style={{ width: "100%", height: 90, objectFit: "contain", background: "#fff", borderRadius: 6 }} />
                        <div className="small text-truncate mt-1">{doc.original_filename || "(unnamed)"}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Modal>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="mb-2">
        <button onClick={() => toggleAccordion("notifications")} className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start" style={{ border: "none", borderBottom: "1px solid var(--bs-border-color)" }}>
          <div className="d-flex align-items-center gap-2">
            <BellIcon className="h-5 w-5 text-amber-500" />
            <span className="fw-medium">Notifications</span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" style={{ transition: "transform 0.2s", transform: openAccordions.notifications ? "rotate(180deg)" : "none" }} />
        </button>
        {openAccordions.notifications && (
          <div className="accordion-popup py-3 space-y-3">
            {[
              { key: "emailEnabled", label: "Email Notifications", helpId: "email-notif", helpText: "Receive updates via email" },
              { key: "appointmentReminders", label: "Appointment Reminders", helpId: "appt-reminders", helpText: "Get reminded before appointments" },
              { key: "dailyDigest", label: "Daily Digest", helpId: "daily-digest", helpText: "Receive a daily summary email" },
            ].map(({ key, label, helpId, helpText }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center">
                  <span className="text-sm font-medium">{label}</span>
                  <HelpIcon id={helpId} text={helpText} />
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifications[key]} onChange={(e) => handleNotificationChange(key, e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
            <Button_Toolbar icon={CheckCircleIcon} label="Save Notifications" onClick={handleSaveNotifications} className="btn-primary" />
          </div>
        )}
      </div>

      {/* Client Portal Branding */}
      <div className="mb-2">
        <button onClick={() => toggleAccordion("clientPortal")} className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start" style={{ border: "none", borderBottom: "1px solid var(--bs-border-color)" }}>
          <div className="d-flex align-items-center gap-2">
            <Squares2X2Icon className="h-5 w-5 text-indigo-500" />
            <span className="fw-medium">Client Portal Page</span>
            <span className="badge bg-primary-subtle text-primary ms-1" style={{ fontSize: "0.65rem" }}>Branding</span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" style={{ transition: "transform 0.2s", transform: openAccordions.clientPortal ? "rotate(180deg)" : "none" }} />
        </button>
        {openAccordions.clientPortal && (
          <div className="accordion-popup py-3">
            <div className="mb-4 rounded-xl overflow-hidden border" style={{ border: "1px solid var(--bs-border-color)" }}>
              <div style={{ fontSize: "0.68rem", padding: "4px 10px", background: "var(--bs-secondary-bg)", color: "var(--bs-secondary-color)", borderBottom: "1px solid var(--bs-border-color)" }}>
                Live Preview
              </div>
              {portalBranding.portal_show_hero && (
                <div style={{
                  background: portalBranding.portal_hero_bg_color || "#4f46e5",
                  padding: "20px 16px", textAlign: "center", position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  {portalBranding.portal_hero_image_url && (
                    <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${portalBranding.portal_hero_image_url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.3 }} />
                  )}
                  <div style={{ position: "relative" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: portalBranding.portal_hero_text_color || "#ffffff" }}>
                      {portalBranding.portal_hero_title || companyInfo.company_name || "Your Business Name"}
                    </div>
                    {(portalBranding.portal_hero_subtitle) && (
                      <div style={{ fontSize: "0.72rem", color: `${portalBranding.portal_hero_text_color || "#ffffff"}bb`, marginTop: 4 }}>
                        {portalBranding.portal_hero_subtitle}
                      </div>
                    )}
                    {portalBranding.portal_hero_tagline && (
                      <div style={{ fontSize: "0.65rem", fontStyle: "italic", color: `${portalBranding.portal_hero_text_color || "#ffffff"}88`, marginTop: 3 }}>
                        {portalBranding.portal_hero_tagline}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {portalBranding.portal_show_banner && portalBranding.portal_banner_text && (
                <div style={{ background: portalBranding.portal_banner_color || "#4f46e5", color: "#fff", padding: "6px 12px", fontSize: "0.72rem", textAlign: "center" }}>
                  {portalBranding.portal_banner_text}
                </div>
              )}
              <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", padding: "8px 0" }}>
                {["Shop", "Cart", "Orders", "Account"].map(n => (
                  <div key={n} style={{ flex: 1, textAlign: "center", fontSize: "0.6rem", color: n === "Shop" ? (portalBranding.portal_primary_color || "#4f46e5") : "#9ca3af", fontWeight: n === "Shop" ? 700 : 400, borderBottom: n === "Shop" ? `2px solid ${portalBranding.portal_primary_color || "#4f46e5"}` : "2px solid transparent", paddingBottom: 4 }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div className="d-flex gap-3 mb-3">
              <label className="d-flex align-items-center gap-2 cursor-pointer">
                <input type="checkbox" className="form-check-input m-0" checked={portalBranding.portal_show_hero} onChange={(e) => handlePortalBrandingChange("portal_show_hero", e.target.checked)} />
                <span className="small fw-medium">Show Hero Section</span>
              </label>
              <label className="d-flex align-items-center gap-2 cursor-pointer">
                <input type="checkbox" className="form-check-input m-0" checked={portalBranding.portal_show_banner} onChange={(e) => handlePortalBrandingChange("portal_show_banner", e.target.checked)} />
                <span className="small fw-medium">Show Announcement Banner</span>
              </label>
            </div>

            {portalBranding.portal_show_hero && (
              <div className="border rounded-xl p-3 mb-3" style={{ background: "var(--bs-tertiary-bg)" }}>
                <p className="small fw-semibold text-muted mb-2 text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>Hero Section</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="form-floating">
                    <input type="text" className="form-control form-control-sm" id="portal_hero_title" value={portalBranding.portal_hero_title} onChange={(e) => handlePortalBrandingChange("portal_hero_title", e.target.value)} placeholder="Title" />
                    <label htmlFor="portal_hero_title">Headline</label>
                  </div>
                  <div className="form-floating">
                    <input type="text" className="form-control form-control-sm" id="portal_hero_subtitle" value={portalBranding.portal_hero_subtitle} onChange={(e) => handlePortalBrandingChange("portal_hero_subtitle", e.target.value)} placeholder="Subtitle" />
                    <label htmlFor="portal_hero_subtitle">Subtitle</label>
                  </div>
                </div>
                <div className="form-floating mb-2">
                  <input type="text" className="form-control form-control-sm" id="portal_hero_tagline" value={portalBranding.portal_hero_tagline} onChange={(e) => handlePortalBrandingChange("portal_hero_tagline", e.target.value)} placeholder="Tagline (optional)" />
                  <label htmlFor="portal_hero_tagline">Tagline (optional italic line)</label>
                </div>
                <div className="d-flex gap-3 mb-2 align-items-center flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted">Background</label>
                    <input type="color" value={portalBranding.portal_hero_bg_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_hero_bg_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted">Text</label>
                    <input type="color" value={portalBranding.portal_hero_text_color || "#ffffff"} onChange={(e) => handlePortalBrandingChange("portal_hero_text_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="flex-grow-1 form-floating">
                    <input type="url" className="form-control form-control-sm" id="portal_hero_image_url" value={portalBranding.portal_hero_image_url} onChange={(e) => handlePortalBrandingChange("portal_hero_image_url", e.target.value)} placeholder="Hero image URL" />
                    <label htmlFor="portal_hero_image_url">Hero Image URL</label>
                  </div>
                  <label className={`btn btn-sm btn-outline-primary flex-shrink-0 ${heroImageUploading ? "disabled" : ""}`} style={{ whiteSpace: "nowrap" }}>
                    {heroImageUploading ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUploadHeroImage(e.target.files?.[0] || null)} disabled={heroImageUploading} />
                  </label>
                  {portalBranding.portal_hero_image_url && (
                    <button type="button" className="btn btn-sm btn-outline-danger flex-shrink-0" onClick={() => handlePortalBrandingChange("portal_hero_image_url", "")}>Clear</button>
                  )}
                </div>
              </div>
            )}

            {portalBranding.portal_show_banner && (
              <div className="border rounded-xl p-3 mb-3" style={{ background: "var(--bs-tertiary-bg)" }}>
                <p className="small fw-semibold text-muted mb-2 text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>Announcement Banner</p>
                <div className="form-floating mb-2">
                  <input type="text" className="form-control form-control-sm" id="portal_banner_text" value={portalBranding.portal_banner_text} onChange={(e) => handlePortalBrandingChange("portal_banner_text", e.target.value)} placeholder="Banner message" />
                  <label htmlFor="portal_banner_text">Banner Message</label>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted">Banner Color</label>
                  <input type="color" value={portalBranding.portal_banner_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_banner_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                </div>
              </div>
            )}

            <div className="border rounded-xl p-3 mb-3" style={{ background: "var(--bs-tertiary-bg)" }}>
              <p className="small fw-semibold text-muted mb-2 text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.06em" }}>Colors & Footer</p>
              <div className="d-flex gap-3 mb-3 align-items-center flex-wrap">
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted">Primary</label>
                  <input type="color" value={portalBranding.portal_primary_color || "#4f46e5"} onChange={(e) => handlePortalBrandingChange("portal_primary_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  <span className="small text-muted font-monospace">{portalBranding.portal_primary_color || "#4f46e5"}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted">Secondary</label>
                  <input type="color" value={portalBranding.portal_secondary_color || "#0ea5e9"} onChange={(e) => handlePortalBrandingChange("portal_secondary_color", e.target.value)} style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  <span className="small text-muted font-monospace">{portalBranding.portal_secondary_color || "#0ea5e9"}</span>
                </div>
              </div>
              <div className="form-floating">
                <input type="text" className="form-control form-control-sm" id="portal_footer_text" value={portalBranding.portal_footer_text} onChange={(e) => handlePortalBrandingChange("portal_footer_text", e.target.value)} placeholder="Footer text" />
                <label htmlFor="portal_footer_text">Footer Text</label>
              </div>
            </div>

            <div className="d-flex gap-2">
              <Button_Toolbar icon={CheckCircleIcon} label={portalBrandingLoading ? "Saving..." : "Save Portal Settings"} onClick={handleSavePortalBranding} className="btn-primary" disabled={portalBrandingLoading} />
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetPortalBrandingDefaults}>Reset to Defaults</button>
            </div>
          </div>
        )}
      </div>

      {settingsSuccess && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          {settingsSuccess}
        </div>
      )}
    </div>
  </div>
);

export default Panel_General;
