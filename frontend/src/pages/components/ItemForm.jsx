import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import BarcodeScanner from './BarcodeScanner';

export default function ItemForm({ onSubmit, onCancel, item = null, initialSku = '', showInitialQuantity = false, onSubmitWithExtras = null, showScanner = false, existingSkus = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: initialSku || '',
    price: '',
    description: '',
    // Use enum names expected by backend/DB enum (PRODUCT, RESOURCE, ASSET)
    type: 'PRODUCT',
    image_url: '',
  });
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        sku: item.sku || initialSku || '',
        price: item.price != null ? String(item.price) : '',
        description: item.description || '',
        // Accept either value or name from API; normalize to enum NAME for submission
        type: (typeof item.type === 'string'
          ? (['PRODUCT','RESOURCE','ASSET'].includes(item.type.toUpperCase())
              ? item.type.toUpperCase()
              : 'PRODUCT')
          : 'PRODUCT'),
        image_url: item.image_url || '',
      });
    } else if (initialSku) {
      setFormData(prev => ({ ...prev, sku: initialSku }));
    }
  }, [item, initialSku]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBarcodeDetected = (code) => {
    const scanned = String(code || '').trim();
    setScanError('');

    // Check if SKU already exists
    if (existingSkus.includes(scanned)) {
      setScanError(`Item with SKU "${scanned}" already exists.`);
      return;
    }

    // Set the scanned code as SKU
    setFormData(prev => ({ ...prev, sku: scanned }));
    setIsScannerOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Sanitize and validate fields
    const priceNum = Number(formData.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }
    const name = (formData.name || '').trim();
    const sku = (formData.sku || '').trim();
    const description = (formData.description || '').trim();
    if (!name || !sku) {
      alert('Name and SKU are required.');
      return;
    }
    const type = typeof formData.type === 'string'
      ? formData.type.toUpperCase()
      : 'PRODUCT';
    const image_url = (formData.image_url || '').trim();
    const payload = {
      name,
      sku,
      price: priceNum,
      description: description || undefined,
      // Backend accepts enum name or value; we send NAME for clarity
      type,
      image_url: image_url || undefined,
    };
    const qty = parseInt(String(initialQuantity || '0'), 10);
    const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;
    
    try {
      if (onSubmitWithExtras) {
        await onSubmitWithExtras(payload, { initialQuantity: safeQty });
      } else {
        await onSubmit(payload);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      throw error;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
      {/* Two-column layout */}
      <div className="d-flex flex-column flex-md-row" style={{ height: '100%' }}>
        
        {/* Left Section - POS Card Preview (30% height on mobile, side column on desktop) */}
        <div className="flex-shrink-0 p-2 d-flex flex-column align-items-center justify-content-center bg-gray-100 dark:bg-gray-900" 
             style={{ height: '30%', minHeight: '120px', maxHeight: '150px' }}>
          <p className="text-xs text-muted mb-2 text-center">POS Preview</p>
          
          {/* Full-size POS Card matching Sales page */}
          <div 
            className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border-2 overflow-hidden ${
              formData.type === 'PRODUCT' 
                ? 'border-emerald-400' 
                : formData.type === 'RESOURCE'
                  ? 'border-blue-400'
                  : 'border-purple-400'
            }`}
            style={{ width: '160px', height: '160px' }}
          >
            {/* Background with gradient or image */}
            <div className={`absolute inset-0 ${
              formData.type === 'PRODUCT' 
                ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800' 
                : formData.type === 'RESOURCE'
                  ? 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800'
                  : 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800'
            }`}>
              {formData.image_url ? (
                <img 
                  src={formData.image_url} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className={`h-12 w-12 ${
                    formData.type === 'PRODUCT' 
                      ? 'text-emerald-400/50' 
                      : formData.type === 'RESOURCE'
                        ? 'text-blue-400/50'
                        : 'text-purple-400/50'
                  }`} />
                </div>
              )}
            </div>
            
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Item Name - Top Left */}
            <div className="absolute top-2 left-2 right-2">
              <div className={`inline-block px-2 py-1 rounded-lg backdrop-blur-sm ${
                formData.type === 'PRODUCT' 
                  ? 'bg-emerald-600/90' 
                  : formData.type === 'RESOURCE'
                    ? 'bg-blue-600/90'
                    : 'bg-purple-600/90'
              }`}>
                <span className="font-semibold text-white text-sm line-clamp-1">
                  {formData.name || 'Item Name'}
                </span>
              </div>
            </div>
            
            {/* Price Badge - Bottom Left */}
            <div className="absolute bottom-2 left-2">
              <span className={`inline-block px-2 py-0.5 rounded-lg text-sm font-bold text-white backdrop-blur-sm ${
                formData.type === 'PRODUCT' 
                  ? 'bg-emerald-700/90' 
                  : formData.type === 'RESOURCE'
                    ? 'bg-blue-700/90'
                    : 'bg-purple-700/90'
              }`}>
                ${formData.price ? parseFloat(formData.price).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
          
          {/* Image URL below preview */}
          <div className="w-100 mt-2 px-1">
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Image URL"
            />
          </div>
        </div>

        {/* Right Half - Scrollable Form Inputs */}
        <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '80vh' }}>
          <form onSubmit={handleSubmit} className="p-3">
            {/* Header */}
            <h5 className="mb-3 fw-semibold">
              {item ? 'Edit' : 'Add New Item'}
            </h5>

            {/* Item Type Selection */}
            <div className="mb-3">
              <label className="form-label small text-muted">Type</label>
              <div className="btn-group w-100" role="group">
                {[
                  { value: 'PRODUCT', label: 'Product' },
                  { value: 'RESOURCE', label: 'Resource' },
                  { value: 'ASSET', label: 'Asset' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: value }))}
                    className={`btn btn-sm ${
                      formData.type === value
                        ? value === 'PRODUCT' ? 'btn-success' : value === 'RESOURCE' ? 'btn-primary' : 'btn-secondary'
                        : 'btn-outline-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="form-floating mb-2">
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="form-control form-control-sm"
                placeholder="Name"
              />
              <label htmlFor="name">Name *</label>
            </div>

            {/* SKU with Scanner */}
            <div className="d-flex gap-2 mb-2">
              <div className="form-floating flex-grow-1">
                <input
                  type="text"
                  id="sku"
                  name="sku"
                  required
                  value={formData.sku}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="SKU"
                />
                <label htmlFor="sku">SKU *</label>
              </div>
              {showScanner && (
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="btn btn-outline-secondary btn-sm"
                  title="Scan"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                    <path d="M3 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
                  </svg>
                </button>
              )}
            </div>
            {scanError && (
              <div className="alert alert-danger py-1 small mb-2">{scanError}</div>
            )}

            {/* Price and Quantity */}
            <div className="row g-2 mb-2">
              <div className={showInitialQuantity ? 'col-6' : 'col-12'}>
                <div className="form-floating">
                  <input
                    type="number"
                    id="price"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="0.00"
                  />
                  <label htmlFor="price">Price *</label>
                </div>
              </div>
              {showInitialQuantity && (
                <div className="col-6">
                  <div className="form-floating">
                    <input
                      type="number"
                      id="initialQuantity"
                      name="initialQuantity"
                      min="0"
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(e.target.value)}
                      className="form-control form-control-sm"
                      placeholder="0"
                    />
                    <label htmlFor="initialQuantity">Qty</label>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="form-floating mb-3">
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control form-control-sm"
                placeholder="Description"
                style={{ height: '60px' }}
              />
              <label htmlFor="description">Description</label>
            </div>

            {/* Action Buttons */}
            <div className="d-flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-outline-secondary rounded-pill flex-grow-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn rounded-pill flex-grow-1 text-white ${
                  formData.type === 'PRODUCT' 
                    ? 'btn-success' 
                    : formData.type === 'RESOURCE'
                      ? 'btn-primary'
                      : ''
                }`}
                style={formData.type === 'ASSET' ? { backgroundColor: '#8b5cf6' } : {}}
              >
                <CheckIcon className="h-4 w-4 me-1" />
                {item ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Scan Barcode</h5>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="btn btn-sm btn-outline-secondary"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <BarcodeScanner
                onDetected={handleBarcodeDetected}
                onCancel={() => setIsScannerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
