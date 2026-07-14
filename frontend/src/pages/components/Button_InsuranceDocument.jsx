import React, { useMemo, useState } from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { documentsAPI } from "../../services/api";
import Modal_Viewer_Document from "./Modal_DocumentView";

/**
 * Opens the shared insurance plan document (prefer immutable plan id or document id).
 * One document reference per plan — not per employee.
 */
export default function Button_InsuranceDocument({ planId, planName, documentId, insurancePlans = [], className="", title = "View insurance plan document" }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  const resolvedDocumentId = useMemo(() => {
    if (documentId) return documentId;
    if (planId != null) {
      const planById = insurancePlans.find((p) => p.id === planId);
      if (planById?.document_id) return planById.document_id;
    }
    if (!planName || !insurancePlans.length) return null;
    const plan = insurancePlans.find((p) => p.name === planName);
    return plan?.document_id || null;
  }, [documentId, insurancePlans, planId, planName]);

  if (!resolvedDocumentId) return null;

  const handleOpen = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setLoading(true);
    try {
      const res = await documentsAPI.getById(resolvedDocumentId);
      const doc = res?.data ?? res;
      if (doc?.id) {
        setViewerDoc(doc);
        setViewerOpen(true);
      }
    } catch (err) {
      console.error("Failed to load insurance document:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className={`btn btn-outline-secondary btn-bulk-circle ${className}`.trim()} onClick={handleOpen} disabled={loading} title={title} aria-label={title}>
        <DocumentTextIcon style={{ width: 18, height: 18 }} />
      </button>
      <Modal_Viewer_Document
        isOpen={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setViewerDoc(null);
        }}
        document={viewerDoc}
      />
    </>
  );
}
