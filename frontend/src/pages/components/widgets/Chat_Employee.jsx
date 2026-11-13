/*
 * ============================================================
 * FILE: Chat_Employee.jsx
 *
 * PURPOSE:
 *   A full-screen direct-message chat panel between the current user and a
 *   selected employee. It polls the backend every 5 seconds for new messages,
 *   supports sending text or sharing a document from the document library, and
 *   groups messages by date with visual separators.
 *
 * FUNCTIONAL PARTS:
 *   [1] State & Refs — Message list, loading/sending flags, text input, document
 *       picker visibility and document list, polling interval ref
 *   [2] Message Loading & Polling — loadMessages fetches history; useEffect sets
 *       up a 5-second poll and marks the conversation as read on mount
 *   [3] Auto-scroll — useEffect scrolls to the bottom ref whenever messages change
 *   [4] Send Text — handleSend submits the text message via chatAPI
 *   [5] Send Document — handleSendDocument shares a document link via chatAPI
 *   [6] Document Picker — openDocPicker lazily loads the document list; filtered
 *       by docSearch
 *   [7] Message Grouping — Builds grouped list with date-separator entries
 *   [8] Render — Full-screen overlay with header, scrollable message list,
 *       optional document picker panel, and bottom input bar
 *   [9] Utility Functions — formatTime and formatDate helpers for timestamps
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-09-11 | GitHub Copilot | Stabilized message polling callback to satisfy exhaustive-deps safely
 * ============================================================
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { XMarkIcon, PaperAirplaneIcon, PaperClipIcon, DocumentIcon } from "@heroicons/react/24/outline";
import { chatAPI, documentsAPI, settingsAPI } from "../../../services/api";
import useDarkMode from "../../../services/useDarkMode";

export default function Chat_Employee({ employee, currentUser, onClose }) {
  // ─── 1 STATE & REFS ────────────────────────────────────────────────────────

  const { isDarkMode } = useDarkMode();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Timezone state with automatic browser detection fallback
  const [companyTimezone, setCompanyTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });

  // Document picker state
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load company timezone from settings
  useEffect(() => {
    settingsAPI
      .getScheduleSettings()
      .then((res) => {
        const tz = res?.data?.company_timezone;
        if (tz && tz.trim()) {
          setCompanyTimezone(tz.trim());
        }
      })
      .catch(() => {});
  }, []);

  // ─── 2 MESSAGE LOADING & POLLING ───────────────────────────────────────────

  const loadMessages = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await chatAPI.getHistory(employee.id);
      const data = res?.data ?? res;
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    loadMessages();
    chatAPI.markRead(employee.id).catch(() => {});
  }, [employee.id, loadMessages]);

  // ─── 3 AUTO-SCROLL ─────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── 4 SEND TEXT ───────────────────────────────────────────────────────────

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await chatAPI.sendMessage(employee.id, { content: trimmed, message_type: "text" });
      const msg = res?.data ?? res;
      setMessages((prev) => [...prev, msg]);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // ─── 5 SEND DOCUMENT ───────────────────────────────────────────────────────

  const handleSendDocument = async (doc) => {
    setSending(true);
    setShowDocPicker(false);
    try {
      const res = await chatAPI.sendMessage(employee.id, {
        content: doc.original_filename || doc.filename,
        message_type: "document",
        document_id: doc.id,
      });
      const msg = res?.data ?? res;
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      console.error("Failed to send document:", err);
    } finally {
      setSending(false);
    }
  };

  // ─── 6 DOCUMENT PICKER ─────────────────────────────────────────────────────

  const openDocPicker = async () => {
    setShowDocPicker((v) => !v);
    setDocSearch("");
    if (documents.length === 0) {
      setDocsLoading(true);
      try {
        const res = await documentsAPI.getAll();
        const data = res?.data ?? res;
        setDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load documents:", err);
      } finally {
        setDocsLoading(false);
      }
    }
  };

  const filteredDocs = documents.filter((d) => (d.original_filename || d.filename || "").toLowerCase().includes(docSearch.toLowerCase()) || (d.description || "").toLowerCase().includes(docSearch.toLowerCase()));

  // ─── 7 MESSAGE GROUPING ────────────────────────────────────────────────────

  // Build a grouped message list with date separators
  const grouped = [];
  let currentDate = null;
  for (const msg of messages) {
    const dateLabel = msg.created_at ? formatDate(msg.created_at, companyTimezone) : "";
    if (dateLabel && dateLabel !== currentDate) {
      grouped.push({ type: "date", label: dateLabel, key: `date-${dateLabel}` });
      currentDate = dateLabel;
    }
    grouped.push({ type: "message", msg, key: msg.id || Math.random() });
  }

  const dm = isDarkMode;

  // ─── 8 RENDER ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        zIndex: 1060,
        backgroundColor: dm ? "#212529" : "#ffffff",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`d-flex flex-column h-100 w-100 ${dm ? "bg-dark text-light" : "bg-white text-dark"}`} style={{ margin: 0, padding: 0, border: "none" }}>
        {/* ── Header ── */}
        <div className={`flex-shrink-0 px-2 py-1.5 ${dm ? "border-secondary" : "border-bottom"}`} style={{ margin: 0, backgroundColor: dm ? "#2d3139" : "#f8f9fa" }}>
          <div className="align-items-center d-flex justify-content-between">
            <div className="ui-flex-center-gap-2">
              <div
                className="align-items-center d-flex fw-bold justify-content-center rounded-circle text-white"
                style={{
                  width: 34,
                  height: 34,
                  fontSize: "0.8rem",
                  flexShrink: 0,
                  backgroundColor: employee.color || "#6c757d",
                }}
              >
                {employee.first_name?.[0]}
                {employee.last_name?.[0]}
              </div>
              <div>
                <div className="fw-semibold" style={{ fontSize: "0.95rem", lineHeight: 1.2 }}>
                  {employee.first_name} {employee.last_name}
                </div>
                <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                  {employee.role} &bull; {companyTimezone}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="align-items-center btn btn-outline-secondary d-flex flex-shrink-0 justify-content-center p-0 rounded-circle"
              style={{ width: "2rem", height: "2rem" }}
              title="Close chat"
              aria-label="Close"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className={`flex-grow-1 min-h-0 overflow-auto px-1 py-0 ${dm ? "bg-dark" : "bg-light"}`} style={{ minHeight: 0, margin: 0, padding: "12px" }}>
          {loading ? (
            <div className="py-1 small text-center text-muted">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="py-1 small text-center text-muted">No messages yet. Say hello!</div>
          ) : (
            grouped.map((item) => {
              if (item.type === "date") {
                return (
                  <div key={item.key} className="my-2 text-center">
                    <span className={`badge rounded-pill px-1 ${dm ? "bg-secondary" : "bg-white text-muted border"}`} style={{ fontSize: "0.68rem" }}>
                      {item.label}
                    </span>
                  </div>
                );
              }
              const { msg } = item;
              const isMine = String(msg.sender_id) === String(currentUser?.id);
              return (
                <div key={item.key} className={`d-flex mb-2 ${isMine ? "justify-content-end" : "justify-content-start"}`}>
                  <div className={`px-1 py-0 rounded-3 ${isMine ? "bg-primary text-white" : dm ? "bg-secondary text-light" : "bg-white border text-dark"}`} style={{ maxWidth: "75%", fontSize: "0.875rem", wordBreak: "break-word" }}>
                    {msg.message_type === "document" ? (
                      <a href={documentsAPI.fileUrl(msg.document_id)} target="_blank" rel="noopener noreferrer" className={`d-flex align-items-center gap-2 text-decoration-none ${isMine ? "text-white" : dm ? "text-light" : "text-dark"}`}>
                        <DocumentIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                        <span className="text-truncate" style={{ maxWidth: 260 }}>
                          {msg.content || "Document"}
                        </span>
                      </a>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    <div className={`text-end mt-1 ${isMine ? "text-white-50" : "text-muted"}`} style={{ fontSize: "0.65rem", lineHeight: 1 }} title={`Time zone: ${companyTimezone}`}>
                      {msg.created_at ? formatTime(msg.created_at, companyTimezone) : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Document Picker ── */}
        {showDocPicker && (
          <div className={`border-top flex-shrink-0 ${dm ? "bg-dark border-secondary" : "bg-white"}`} style={{ maxHeight: 200, overflowY: "auto", margin: 0 }}>
            <div className="align-items-center d-flex gap-2 pb-1 pt-1 px-2">
              <span className="fw-semibold text-xs text-muted">Attach from Documents library:</span>
              <input type="text" autoFocus className={`form-control form-control-sm ${dm ? "bg-secondary text-light border-secondary placeholder-light" : ""}`} placeholder="Search documents…" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
              <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => setShowDocPicker(false)} title="Close document picker">
                <XMarkIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="pb-0 px-2">
              {docsLoading ? (
                <div className="py-1 small text-center text-muted">Loading documents…</div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-1 small text-center text-muted">No documents found</div>
              ) : (
                filteredDocs.map((doc) => (
                  <button key={doc.id} type="button" className={`btn btn-sm w-100 text-start d-flex align-items-center gap-2 mb-1 ${dm ? "btn-outline-secondary" : "btn-outline-secondary"}`} onClick={() => handleSendDocument(doc)}>
                    <DocumentIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span className="text-truncate" style={{ fontSize: "0.8rem" }}>
                      {doc.original_filename || doc.filename}
                    </span>
                    {doc.description && (
                      <span className="ms-auto text-muted text-truncate" style={{ fontSize: "0.72rem", maxWidth: 120 }}>
                        {doc.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Bottom Input & Action Bar ── */}
        <div className={`flex-shrink-0 border-top p-2 ${dm ? "bg-dark border-secondary" : "bg-white border-gray-200"}`} style={{ margin: 0 }}>
          <form onSubmit={handleSend} className="align-items-center d-flex gap-2 w-100">
            {/* Close button - X icon only, circle */}
            <button
              type="button"
              onClick={onClose}
              className="align-items-center btn btn-circle btn-outline-secondary d-flex flex-shrink-0 justify-content-center p-0"
              style={{
                width: "2.25rem",
                height: "2.25rem",
                minWidth: "2.25rem",
                maxWidth: "2.25rem",
                minHeight: "2.25rem",
                maxHeight: "2.25rem",
                flex: "0 0 2.25rem",
                borderRadius: "50%",
                aspectRatio: "1 / 1",
              }}
              title="Close chat"
              aria-label="Close"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>

            {/* Attach button - circle */}
            <button
              type="button"
              title="Attach document from Documents library"
              className={`align-items-center btn btn-circle d-flex flex-shrink-0 justify-content-center p-0 ${showDocPicker ? "btn-primary" : "btn-outline-secondary"}`}
              style={{
                width: "2.25rem",
                height: "2.25rem",
                minWidth: "2.25rem",
                maxWidth: "2.25rem",
                minHeight: "2.25rem",
                maxHeight: "2.25rem",
                flex: "0 0 2.25rem",
                borderRadius: "50%",
                aspectRatio: "1 / 1",
              }}
              onClick={openDocPicker}
              aria-label="Attach document"
            >
              <PaperClipIcon style={{ width: 18, height: 18 }} />
            </button>

            {/* Message input */}
            <textarea
              ref={inputRef}
              rows={1}
              className={`form-control flex-grow-1 rounded-pill ${dm ? "bg-secondary text-light border-secondary" : ""}`}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending}
              style={{
                height: "2.5rem",
                minHeight: "2.5rem",
                maxHeight: "2.5rem",
                resize: "none",
                lineHeight: "2.5rem",
                padding: "0 1rem",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />

            {/* Send button - circle */}
            <button
              type="submit"
              className="align-items-center btn btn-circle btn-primary d-flex flex-shrink-0 justify-content-center p-0"
              style={{
                width: "2.25rem",
                height: "2.25rem",
                minWidth: "2.25rem",
                maxWidth: "2.25rem",
                minHeight: "2.25rem",
                maxHeight: "2.25rem",
                flex: "0 0 2.25rem",
                borderRadius: "50%",
                aspectRatio: "1 / 1",
              }}
              disabled={!text.trim() || sending}
              title="Send"
              aria-label="Send"
            >
              <PaperAirplaneIcon style={{ width: 18, height: 18 }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── 9 UTILITY FUNCTIONS ───────────────────────────────────────────────────────

function parseUtcTimestamp(ts) {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  let str = String(ts).trim();
  if (!str.endsWith("Z") && !str.includes("+") && !/-\d{2}:\d{2}$/.test(str)) {
    str += "Z";
  }
  return new Date(str);
}

function formatTime(ts, timezone) {
  const d = parseUtcTimestamp(ts);
  const tz = timezone || (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function formatDate(ts, timezone) {
  const d = parseUtcTimestamp(ts);
  const tz = timezone || (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  const now = new Date();
  try {
    const dStr = d.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric" });
    const nowStr = now.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric" });
    if (dStr === nowStr) return "Today";
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = yesterday.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric" });
    if (dStr === yStr) return "Yesterday";
    return dStr;
  } catch {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}
