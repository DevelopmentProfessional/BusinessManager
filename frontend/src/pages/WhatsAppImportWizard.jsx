/**
 * WHATSAPP IMPORT WIZARD
 * Multi-step form to import products from WhatsApp Business catalog
 * 
 * Steps:
 * 1. Authenticate (access token + business account ID)
 * 2. Preview products
 * 3. Validate/add missing features
 * 4. Confirm import
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';

export default function WhatsAppImportWizard() {
  const navigate = useNavigate();
  const companyId = useStore(s => s.currentCompany?.company_id);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Step 1: Auth
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  
  // Step 2: Preview
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  
  // Step 3: Feature validation
  const [missingFeatures, setMissingFeatures] = useState([]);
  const [newFeatures, setNewFeatures] = useState({});
  
  // Step 4: Import confirmation
  const [importResult, setImportResult] = useState(null);

  const API_BASE = '/api/v1';

  // ─── STEP 1: FETCH PRODUCTS ───────────────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!accessToken || !businessAccountId) {
      setError('Access token and business account ID are required.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/inventory/whatsapp/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, business_account_id: businessAccountId })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch products');
      }

      setProducts(data.products || []);
      setSelectedProducts(new Set(data.products.map((_, i) => i)));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 2: VALIDATE FEATURES ────────────────────────────────────────────
  const handleValidateFeatures = async () => {
    setLoading(true);
    setError(null);

    const productsToImport = Array.from(selectedProducts).map(i => products[i]);

    try {
      const res = await fetch(`${API_BASE}/inventory/whatsapp/validate-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsToImport, company_id: companyId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Validation failed');
      }

      if (data.can_proceed) {
        // No missing features, proceed to confirmation
        setStep(4);
      } else {
        // Show missing features to add
        setMissingFeatures(data.missing_features || []);
        setStep(3);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 3: ADD MISSING FEATURES ─────────────────────────────────────────
  const handleAddFeature = async (featureName, options) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/inventory/whatsapp/add-missing-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_name: featureName,
          options: options,
          company_id: companyId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to add feature');
      }

      // Mark feature as added
      const updated = newFeatures;
      updated[featureName] = true;
      setNewFeatures({ ...updated });

      // Check if all missing features added
      const allAdded = missingFeatures.every(f => updated[f.feature_name]);
      if (allAdded) {
        // Move to import
        setStep(4);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 4: IMPORT ────────────────────────────────────────────────────────
  const handleImport = async () => {
    setLoading(true);
    setError(null);

    const productsToImport = Array.from(selectedProducts).map(i => products[i]);

    try {
      const res = await fetch(`${API_BASE}/inventory/whatsapp/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsToImport, company_id: companyId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Import failed');
      }

      setImportResult(data);
      setSuccess(`${data.imported} products imported successfully!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const styles = {
    container: { maxWidth: 700, margin: '0 auto', padding: 20 },
    card: { border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 20, background: '#fff' },
    title: { fontSize: 24, fontWeight: 700, marginBottom: 20 },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 15 },
    field: { marginBottom: 15 },
    label: { display: 'block', marginBottom: 5, fontWeight: 600, fontSize: 14 },
    input: { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' },
    button: { padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    error: { color: '#dc2626', padding: 10, background: '#fee2e2', borderRadius: 4, marginBottom: 15 },
    success: { color: '#059669', padding: 10, background: '#ecfdf5', borderRadius: 4, marginBottom: 15 },
    productCard: { border: '1px solid #ddd', padding: 10, marginBottom: 10, borderRadius: 4 },
    productCheckbox: { marginRight: 10 },
    featureList: { background: '#f9fafb', padding: 15, borderRadius: 4, marginBottom: 15 },
    featureItem: { padding: 10, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, marginBottom: 10 }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Import from WhatsApp Business</h1>
        
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* STEP 1: AUTHENTICATE */}
        {step === 1 && (
          <form onSubmit={handleAuthSubmit}>
            <p style={styles.subtitle}>
              Enter your WhatsApp Business API credentials to import your catalog products.
            </p>
            
            <div style={styles.field}>
              <label style={styles.label}>Access Token *</label>
              <input
                type="password"
                style={styles.input}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Your WhatsApp Business API access token"
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Business Account ID *</label>
              <input
                type="text"
                style={styles.input}
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                placeholder="Your business account ID"
                required
              />
            </div>

            <button
              type="submit"
              style={{ ...styles.button, ...(loading && styles.buttonDisabled) }}
              disabled={loading}
            >
              {loading ? 'Fetching Products...' : 'Fetch Products'}
            </button>
          </form>
        )}

        {/* STEP 2: PREVIEW & SELECT */}
        {step === 2 && (
          <>
            <p style={styles.subtitle}>
              Found {products.length} products. Select which ones to import.
            </p>

            <div style={styles.featureList}>
              {products.map((product, i) => (
                <div key={i} style={styles.productCard}>
                  <label>
                    <input
                      type="checkbox"
                      style={styles.productCheckbox}
                      checked={selectedProducts.has(i)}
                      onChange={(e) => {
                        const updated = new Set(selectedProducts);
                        if (e.target.checked) {
                          updated.add(i);
                        } else {
                          updated.delete(i);
                        }
                        setSelectedProducts(updated);
                      }}
                    />
                    <strong>{product.name}</strong> ${product.price || '—'}
                  </label>
                  {product.description && <p style={{ fontSize: 12, color: '#666', marginTop: 5 }}>{product.description}</p>}
                </div>
              ))}
            </div>

            <button
              onClick={handleValidateFeatures}
              style={{ ...styles.button, ...(loading && styles.buttonDisabled) }}
              disabled={loading || selectedProducts.size === 0}
            >
              {loading ? 'Validating...' : 'Next: Validate Features'}
            </button>
            <button
              onClick={() => setStep(1)}
              style={{ ...styles.button, background: '#6b7280', marginLeft: 10 }}
            >
              Back
            </button>
          </>
        )}

        {/* STEP 3: ADD MISSING FEATURES */}
        {step === 3 && (
          <>
            <p style={styles.subtitle}>
              Some product features are missing from your system. Add them before importing.
            </p>

            <div style={styles.featureList}>
              {missingFeatures.map((feature, i) => (
                <div key={i} style={styles.featureItem}>
                  <strong>{feature.feature_name}</strong>
                  <p style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                    Missing options: {feature.options_to_add.join(', ')}
                  </p>
                  <button
                    onClick={() => handleAddFeature(feature.feature_name, feature.options_to_add)}
                    disabled={newFeatures[feature.feature_name] || loading}
                    style={{
                      ...styles.button,
                      background: newFeatures[feature.feature_name] ? '#10b981' : '#4f46e5',
                      marginTop: 10,
                      ...(loading && styles.buttonDisabled)
                    }}
                  >
                    {newFeatures[feature.feature_name] ? '✓ Added' : 'Add Feature'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(4)}
              style={{ ...styles.button, ...(loading && styles.buttonDisabled) }}
              disabled={loading || missingFeatures.some(f => !newFeatures[f.feature_name])}
            >
              {loading ? 'Processing...' : 'Continue to Import'}
            </button>
            <button
              onClick={() => setStep(2)}
              style={{ ...styles.button, background: '#6b7280', marginLeft: 10 }}
            >
              Back
            </button>
          </>
        )}

        {/* STEP 4: IMPORT CONFIRMATION */}
        {step === 4 && (
          <>
            <p style={styles.subtitle}>
              Ready to import {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''}.
            </p>

            <div style={styles.featureList}>
              <p><strong>Summary:</strong></p>
              <ul>
                <li>Products to import: {selectedProducts.size}</li>
                <li>Company: {companyId}</li>
              </ul>
            </div>

            {importResult ? (
              <div style={styles.success}>
                <strong>✓ Import Complete!</strong>
                <p>Imported: {importResult.imported}, Skipped (duplicates): {importResult.skipped}</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleImport}
                  style={{ ...styles.button, background: '#10b981', ...(loading && styles.buttonDisabled) }}
                  disabled={loading}
                >
                  {loading ? 'Importing...' : 'Confirm Import'}
                </button>
                <button
                  onClick={() => setStep(2)}
                  style={{ ...styles.button, background: '#6b7280', marginLeft: 10 }}
                >
                  Back
                </button>
              </>
            )}

            {importResult && (
              <button
                onClick={() => navigate('/inventory')}
                style={{ ...styles.button, background: '#4f46e5', marginTop: 15, width: '100%' }}
              >
                Go to Inventory
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
