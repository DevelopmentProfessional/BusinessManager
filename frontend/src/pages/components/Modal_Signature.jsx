/*
 * ============================================================
 * FILE: Modal_Signature.jsx
 *
 * PURPOSE:
 *   Modal for viewing and capturing a user's digital signature.
 *   On open it fetches any existing saved signature; if none exists the
 *   drawing pad is shown immediately. The user can draw a new signature,
 *   save it to the backend, or replace an existing one.
 *
 * FUNCTIONAL PARTS:
 *   [1] State Initialization — saved signature data, loading flag, message, pad visibility
 *   [2] Load Signature Effect — fetches the current user's signature on modal open
 *   [3] Save Handler — PUTs the drawn signature to the API and closes on success
 *   [4] Cancel Handler — hides the drawing pad or closes the modal depending on context
 *   [5] JSX Render — scrollable content area with loading spinner, pad or image display, and footer actions
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import Widget_Signature from "./Widget_Signature";
import api from "../../services/api";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";

// ─── 1 STATE INITIALIZATION ────────────────────────────────────────────────
export default function Modal_Signature({ isOpen, onClose, userId }) {
  const [savedSignature, setSavedSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // ─── 2 LOAD SIGNATURE EFFECT ──────────────────────────────────────────────
  useEffect(() => {
    const loadSignature = async () => {
      if (!isOpen || !userId) return;
      setSignatureLoading(true);
      setSignatureMessage("");
      try {
        const res = await api.get("/auth/me/signature");
        setSavedSignature(res.data?.signature_data || null);
        setShowSignaturePad(!res.data?.signature_data); // Show pad if no signature exists
      } catch (error) {
        setSavedSignature(null);
        setShowSignaturePad(true);
      } finally {
        setSignatureLoading(false);
      }
    };
    loadSignature();
  }, [isOpen, userId]);

  const handleSaveSignature = async (dataUrl) => {
    setSignatureLoading(true);
    setSignatureMessage("");
    try {
      await api.put("/auth/me/signature", { signature_data: dataUrl });
      setSavedSignature(dataUrl);
      setShowSignaturePad(false);
      setSignatureMessage("Signature saved successfully");
      setTimeout(() => {
        setSignatureMessage("");
        onClose();
      }, 1500);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "Failed to save signature";
      setSignatureMessage(detail);
    } finally {
      setSignatureLoading(false);
    }
  };

  const handleCancel = () => {
    if (savedSignature) {
      setShowSignaturePad(false);
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding>
      <div className="component h-100 min-h-0">
        <div className="component-header">
          <div className="component-header-left">Signature</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            {signatureMessage && <div className={`alert py-2 small mb-3 ${signatureMessage.includes("Failed") ? "alert-danger" : "alert-success"}`}>{signatureMessage}</div>}

            {signatureLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary mb-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="text-muted">Loading signature...</div>
              </div>
            ) : showSignaturePad ? (
              <Widget_Signature onSave={handleSaveSignature} onCancel={handleCancel} initialSignature={savedSignature} width={500} height={200} />
            ) : savedSignature ? (
              <div className="d-flex flex-column gap-3">
                <img src={savedSignature} alt="Saved signature" className="border rounded" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted mb-0">No signature saved yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="component-footer">
          <div className="component-footer-left">
            {!showSignaturePad && savedSignature && (
              <Button_Toolbar icon={PlusIcon} label="New" onClick={() => setShowSignaturePad(true)} className="btn-outline-primary" title="Draw a new signature" />
            )}
          </div>
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
}
