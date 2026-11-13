// FILE: Modal_Document_Sign.jsx
// Dedicated modal for signing a document with saved signature preview
import React from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_Document_Sign({
  isOpen,
  onClose,
  signDoc,
  signaturePreview,
  user,
  signLoading = false,
  onSubmitSign,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sign Document"
      contentGravity="top"
      footer={
        <div className="d-flex gap-2 justify-content-start align-items-center">
          {signaturePreview ? (
            <>
              <Button_Toolbar
                icon={CheckIcon}
                label={signLoading ? "Signing…" : "Sign"}
                onClick={onSubmitSign}
                className="btn-primary"
                disabled={signLoading}
                title="Sign document"
              />
              <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} disabled={signLoading} className="btn-outline-secondary" title="Cancel" />
            </>
          ) : (
            <Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />
          )}
        </div>
      }
    >
      {isOpen && signDoc && (
        <div className="space-y-4">
          <p className="dark:text-gray-400 text-gray-600 text-sm">{signDoc.original_filename}</p>

          {signaturePreview ? (
            <div className="text-center">
              <p className="dark:text-gray-400 mb-2 text-gray-600 text-sm">Your signature:</p>
              <div className="bg-white border inline-block p-1 rounded">
                <img src={signaturePreview} alt="Your signature" style={{ maxWidth: "300px", maxHeight: "100px" }} />
              </div>
              <p className="dark:text-gray-400 mt-2 text-gray-500 text-xs">
                Signing as: {user?.first_name} {user?.last_name}
              </p>
            </div>
          ) : signaturePreview === null && !signDoc ? (
            <div className="py-1 text-center">
              <div className="animate-spin border-b-2 border-primary-600 h-6 mx-auto rounded-full w-6"></div>
            </div>
          ) : (
            <div className="py-1 text-center">
              <p className="dark:text-gray-400 mb-2 text-gray-600">No signature saved yet.</p>
              <p className="dark:text-gray-500 text-gray-500 text-sm">Go to Employees &gt; Edit your profile &gt; Signature tab to create your signature.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
