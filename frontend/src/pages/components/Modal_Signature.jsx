import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import SignaturePad from './SignaturePad';
import api from '../../services/api';

export default function SignatureModal({ isOpen, onClose, userId }) {
  const [savedSignature, setSavedSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    const loadSignature = async () => {
      if (!isOpen || !userId) return;
      setSignatureLoading(true);
      setSignatureMessage('');
      try {
        const res = await api.get('/auth/me/signature');
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
    setSignatureMessage('');
    try {
      await api.put('/auth/me/signature', { signature_data: dataUrl });
      setSavedSignature(dataUrl);
      setShowSignaturePad(false);
      setSignatureMessage('Signature saved successfully');
      setTimeout(() => {
        setSignatureMessage('');
        onClose();
      }, 1500);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to save signature';
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
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Signature"
      noPadding={true}
    >
      <div className="d-flex flex-column h-100">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {signatureMessage && (
            <div className={`alert py-2 small mb-3 ${signatureMessage.includes('Failed') ? 'alert-danger' : 'alert-success'}`}>
              {signatureMessage}
            </div>
          )}

          {signatureLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary mb-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="text-muted">Loading signature...</div>
            </div>
          ) : showSignaturePad ? (
            <SignaturePad
              onSave={handleSaveSignature}
              onCancel={handleCancel}
              initialSignature={savedSignature}
              width={500}
              height={200}
            />
          ) : savedSignature ? (
            <div className="d-flex flex-column gap-3">
              <img
                src={savedSignature}
                alt="Saved signature"
                className="border rounded"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted mb-0">No signature saved yet.</p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="border-top bg-white dark:bg-gray-800 p-3">
          <div className="d-flex justify-content-end gap-2">
            {!showSignaturePad && savedSignature && (
              <button 
                type="button" 
                className="btn btn-outline-primary"
                onClick={() => setShowSignaturePad(true)}
              >
                Replace Signature
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
