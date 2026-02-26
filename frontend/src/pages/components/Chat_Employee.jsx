import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PaperAirplaneIcon, PaperClipIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { chatAPI, documentsAPI } from '../../services/api';
import useDarkMode from '../../services/useDarkMode';

export default function Chat_Employee({ employee, currentUser, onClose }) {
  const { isDarkMode } = useDarkMode();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Document picker state
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  const loadMessages = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await chatAPI.getHistory(employee.id);
      const data = res?.data ?? res;
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    chatAPI.markRead(employee.id).catch(() => {});
    pollRef.current = setInterval(() => loadMessages(true), 5000);
    return () => clearInterval(pollRef.current);
  }, [employee.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await chatAPI.sendMessage(employee.id, { content: trimmed, message_type: 'text' });
      const msg = res?.data ?? res;
      setMessages(prev => [...prev, msg]);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendDocument = async (doc) => {
    setSending(true);
    setShowDocPicker(false);
    try {
      const res = await chatAPI.sendMessage(employee.id, {
        content: doc.original_filename || doc.filename,
        message_type: 'document',
        document_id: doc.id,
      });
      const msg = res?.data ?? res;
      setMessages(prev => [...prev, msg]);
    } catch (err) {
      console.error('Failed to send document:', err);
    } finally {
      setSending(false);
    }
  };

  const openDocPicker = async () => {
    setShowDocPicker(v => !v);
    setDocSearch('');
    if (documents.length === 0) {
      setDocsLoading(true);
      try {
        const res = await documentsAPI.getAll();
        const data = res?.data ?? res;
        setDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setDocsLoading(false);
      }
    }
  };

  const filteredDocs = documents.filter(d =>
    (d.original_filename || d.filename || '').toLowerCase().includes(docSearch.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(docSearch.toLowerCase())
  );

  // Build a grouped message list with date separators
  const grouped = [];
  let currentDate = null;
  for (const msg of messages) {
    const dateLabel = msg.created_at ? formatDate(msg.created_at) : '';
    if (dateLabel && dateLabel !== currentDate) {
      grouped.push({ type: 'date', label: dateLabel, key: `date-${dateLabel}` });
      currentDate = dateLabel;
    }
    grouped.push({ type: 'message', msg, key: msg.id || Math.random() });
  }

  const dm = isDarkMode;

  return (
    <div
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        zIndex: 1060,
        backgroundColor: dm ? '#212529' : '#ffffff',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`d-flex flex-column h-100 w-100 ${dm ? 'bg-dark text-light' : 'bg-white text-dark'}`} style={{ margin: 0, padding: 0, border: 'none' }}>
        {/* ── Header ── */}
        <div className={`flex-shrink-0 px-3 py-2 ${dm ? 'border-secondary' : 'border-bottom'}`} style={{ margin: 0, backgroundColor: dm ? '#2d3139' : '#f8f9fa' }}>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
              style={{
                width: 34, height: 34, fontSize: '0.8rem', flexShrink: 0,
                backgroundColor: employee.color || '#6c757d',
              }}
            >
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </div>
            <div>
              <div className="fw-semibold" style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
                {employee.first_name} {employee.last_name}
              </div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                {employee.role}
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          className={`flex-grow-1 overflow-auto px-3 py-2 ${dm ? 'bg-dark' : 'bg-light'}`}
          style={{ minHeight: 0, margin: 0, padding: '12px' }}
        >
          {loading ? (
            <div className="text-center text-muted small py-5">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted small py-5">No messages yet. Say hello!</div>
          ) : (
            grouped.map(item => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="text-center my-2">
                    <span
                      className={`badge rounded-pill px-3 ${dm ? 'bg-secondary' : 'bg-white text-muted border'}`}
                      style={{ fontSize: '0.68rem' }}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              }
              const { msg } = item;
              const isMine = String(msg.sender_id) === String(currentUser?.id);
              return (
                <div
                  key={item.key}
                  className={`d-flex mb-2 ${isMine ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-3 ${
                      isMine
                        ? 'bg-primary text-white'
                        : dm ? 'bg-secondary text-light' : 'bg-white border text-dark'
                    }`}
                    style={{ maxWidth: '75%', fontSize: '0.875rem', wordBreak: 'break-word' }}
                  >
                    {msg.message_type === 'document' ? (
                      <a
                        href={documentsAPI.fileUrl(msg.document_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`d-flex align-items-center gap-2 text-decoration-none ${isMine ? 'text-white' : dm ? 'text-light' : 'text-dark'}`}
                      >
                        <DocumentIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                        <span className="text-truncate" style={{ maxWidth: 260 }}>
                          {msg.content || 'Document'}
                        </span>
                      </a>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    <div
                      className={`text-end mt-1 ${isMine ? 'text-white-50' : 'text-muted'}`}
                      style={{ fontSize: '0.65rem', lineHeight: 1 }}
                    >
                      {msg.created_at ? formatTime(msg.created_at) : ''}
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
          <div
            className={`border-top flex-shrink-0 ${dm ? 'bg-dark border-secondary' : 'bg-white'}`}
            style={{ maxHeight: 200, overflowY: 'auto', margin: 0 }}
          >
            <div className="d-flex align-items-center gap-2 px-3 pt-2 pb-1">
              <input
                type="text"
                autoFocus
                className={`form-control form-control-sm ${dm ? 'bg-secondary text-light border-secondary placeholder-light' : ''}`}
                placeholder="Search documents…"
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-link text-muted p-0"
                onClick={() => setShowDocPicker(false)}
              >
                <XMarkIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="px-3 pb-2">
              {docsLoading ? (
                <div className="text-muted small text-center py-2">Loading…</div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-muted small text-center py-2">No documents found</div>
              ) : (
                filteredDocs.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`btn btn-sm w-100 text-start d-flex align-items-center gap-2 mb-1 ${dm ? 'btn-outline-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => handleSendDocument(doc)}
                  >
                    <DocumentIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span className="text-truncate" style={{ fontSize: '0.8rem' }}>
                      {doc.original_filename || doc.filename}
                    </span>
                    {doc.description && (
                      <span className="text-muted ms-auto text-truncate" style={{ fontSize: '0.72rem', maxWidth: 120 }}>
                        {doc.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Input ── */}
        <div className={`flex-shrink-0 pt-2 pb-4 px-3 border-top ${dm ? 'bg-dark border-secondary' : 'bg-white border-gray-200'}`} style={{ margin: 0 }}>
          <div className="d-flex align-items-center">
            <div style={{ width: 40 }} className="d-flex align-items-center">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem', borderRadius: '50%', minWidth: '3rem' }}
                title="Close"
              >
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="flex-grow-1">
              <form onSubmit={handleSend} className="d-flex align-items-center gap-3 justify-content-center">
                <button
                  type="button"
                  title="Share a document"
                  className={`btn btn-sm p-1 d-flex align-items-center justify-content-center ${showDocPicker ? 'btn-primary' : dm ? 'btn-outline-secondary' : 'btn-outline-secondary'}`}
                  onClick={openDocPicker}
                  style={{ width: '3rem', height: '3rem', borderRadius: '50%', minWidth: '3rem', flexShrink: 0 }}
                >
                  <PaperClipIcon style={{ width: 18, height: 18 }} />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  className={`form-control rounded-pill ${dm ? 'bg-secondary text-light border-secondary' : ''}`}
                  placeholder="Type a message…"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  disabled={sending}
                  style={{ 
                    height: '3rem', 
                    resize: 'none', 
                    maxWidth: '600px',
                    flex: '1 1 auto',
                    lineHeight: '3rem',
                    padding: '0 1rem'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-primary p-1 d-flex align-items-center justify-content-center"
                  disabled={!text.trim() || sending}
                  title="Send"
                  style={{ width: '3rem', height: '3rem', borderRadius: '50%', minWidth: '3rem', flexShrink: 0 }}
                >
                  <PaperAirplaneIcon style={{ width: 18, height: 18 }} />
                </button>
              </form>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
