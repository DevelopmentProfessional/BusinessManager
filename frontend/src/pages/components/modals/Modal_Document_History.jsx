// FILE: Modal_Document_History.jsx
// Dedicated modal for viewing and replacing document version history
import React from "react";
import Modal from "./Modal";
import { formatDateTime } from "../../../utils/dateFormatters";
import { documentsAPI } from "../../../services/api";

export default function Modal_Document_History({
  isOpen,
  onClose,
  historyDoc,
  historyItems = [],
  onReplaceContent,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={historyDoc ? `History: ${historyDoc.original_filename}` : "History"}
      contentGravity="bottom"
    >
      {isOpen && historyDoc && (
        <div className="space-y-4">
          <div className="border dark:border-gray-700 max-h-[40vh] overflow-auto rounded">
            <table className="dark:divide-gray-700 divide-gray-200 divide-y min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="dark:text-gray-400 font-medium px-1 py-0 text-gray-500 text-left text-xs tracking-wider uppercase">Date</th>
                  <th className="dark:text-gray-400 font-medium px-1 py-0 text-gray-500 text-left text-xs tracking-wider uppercase">Note</th>
                  <th className="dark:text-gray-400 font-medium px-1 py-0 text-gray-500 text-left text-xs tracking-wider uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 dark:divide-gray-700 divide-gray-200 divide-y">
                {historyItems.map((h) => (
                  <tr key={h.id}>
                    <td className="dark:text-gray-300 px-1 py-0 text-gray-700 text-sm">{formatDateTime(h.created_at)}</td>
                    <td className="dark:text-gray-300 px-1 py-0 text-gray-700 text-sm">{h.note || "-"}</td>
                    <td className="px-1 py-0 text-sm">
                      <a
                        className="dark:text-indigo-400 hover:text-indigo-800 text-indigo-600"
                        href={documentsAPI.historyFileUrl(h.id, {
                          download: true,
                        })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
                {historyItems.length === 0 && (
                  <tr>
                    <td className="dark:text-gray-400 px-1 py-1 text-gray-500 text-sm" colSpan={3}>
                      No history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={onReplaceContent} className="space-y-2">
            <label className="block dark:text-gray-300 font-medium text-gray-700 text-sm">Upload new version</label>
            <input type="file" name="newVersionFile" className="form-control form-control-sm mb-2" />
            <div className="form-floating ui-form-floating-mb2">
              <input type="text" id="newVersionNote" name="newVersionNote" placeholder="Version Note" className="form-control ui-control-sm" />
              <label htmlFor="newVersionNote">Version Note (optional)</label>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary">
                Replace
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
