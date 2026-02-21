import React, { useEffect, useState } from 'react';
import {
  XMarkIcon, CheckIcon,
  SparklesIcon, CubeIcon,
  WrenchScrewdriverIcon, BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import BarcodeScanner from './BarcodeScanner';
import cacheService from '../../services/cacheService';
import { servicesAPI } from '../../services/api';

export default function ItemForm({ onSubmit, onCancel, item = null, initialSku = '', showInitialQuantity = false, onSubmitWithExtras = null, showScanner = false, existingSkus = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: initialSku || '',
    price: 0,
    description: '',
    type: 'PRODUCT',
    image_url: '',
    location: '',
    service_id: '',
    quantity: 0,
    min_stock_level: 10,
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [availableLocations, setAvailableLocations] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        sku: item.sku || initialSku || '',
        price: item.price || 0,
        description: item.description || '',
        type: (typeof item.type === 'string'
          ? (['PRODUCT','RESOURCE','ASSET','LOCATION','ITEM'].includes(item.type.toUpperCase())
              ? item.type.toUpperCase()
              : 'PRODUCT')
          : 'PRODUCT'),
        image_url: item.image_url || '',
        location: item.location || '',
        service_id: item.service_id || '',
        quantity: item.quantity || 0,
        min_stock_level: item.min_stock_level || 10,
      });
    } else if (initialSku) {
      setFormData(prev => ({ ...prev, sku: initialSku }));
    }
  }, [item, initialSku]);

  useEffect(() => {
    setAvailableLocations(cacheService.getLocations());
    servicesAPI.getAll().then(res => {
      const data = res?.data ?? res;
      if (Array.isArray(data)) setAvailableServices(data);
    }).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseFloat(value) || 0) : value
    }));
  };

  const handleBarcodeDetected = (code) => {
    const scanned = String(code || '').trim();
    setScanError('');
    if (existingSkus.includes(scanned)) {
      setScanError(`Item with SKU "${scanned}" already exists.`);
      return;
    }
    setFormData(prev => ({ ...prev, sku: scanned }));
    setIsScannerOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = (formData.name || '').trim();
    const sku = (formData.sku || '').trim();
    if (!name || !sku) {
      alert('Name and SKU are required.');
      return;
    }
    const price = parseFloat(formData.price) || 0;
    if (price < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }
    const type = typeof formData.type === 'string' ? formData.type.toUpperCase() : 'PRODUCT';
    const description = (formData.description || '').trim();
    const image_url = (formData.image_url || '').trim();
    const location = (formData.location || '').trim();
    const payload = {
      name,
      sku,
      price,
      description: description || undefined,
      type,
      image_url: image_url || undefined,
      location: (location && location !== '[NEW]') ? location : undefined,
      service_id: formData.service_id || undefined,
      min_stock_level: parseInt(formData.min_stock_level) || 10,
    };
    const qty = parseInt(formData.quantity) || 0;
    const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;

    try {
      if (onSubmitWithExtras) {
        onSubmitWithExtras(payload, { initialQuantity: safeQty });
      } else {
        onSubmit(payload);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      throw error;
    }
  };

  const upperType = (formData.type || 'PRODUCT').toUpperCase();
  const isAsset = upperType === 'ASSET';
  const isLocation = upperType === 'LOCATION';
  const isResource = upperType === 'RESOURCE';
  const isLowStock = formData.quantity <= formData.min_stock_level;

  const getTypeIcon = () => {
    if (upperType === 'SERVICE') return <SparklesIcon className="h-16 w-16" />;
    if (isAsset) return <WrenchScrewdriverIcon className="h-16 w-16" />;
    if (isLocation) return <BuildingOfficeIcon className="h-16 w-16" />;
    if (isResource) return <CubeIcon className="h-16 w-16" />;
    return <CubeIcon className="h-16 w-16" />;
  };

  return (
    <div
      className="d-flex flex-column bg-white"
      style={{ maxHeight: '95vh' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-semibold">{item ? 'Edit' : 'Add New Item'}</h6>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-link text-dark p-0"
          style={{ lineHeight: 1 }}
          title="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-grow-1 overflow-auto px-3 pt-3 pe-2">
        <form id="item-form" onSubmit={handleSubmit}>
          {/* Top Section: Image placeholder (left) + Stock fields (right) */}
          <div className="d-flex gap-3 mb-3" style={{ minHeight: '200px' }}>
            {/* Image placeholder */}
            <div className="flex-shrink-0" style={{ width: '45%' }}>
              <div className="position-relative" style={{ borderRadius: '8px', overflow: 'hidden', background: '#f0f0f0', width: '100%', aspectRatio: '1' }}>
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt={formData.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: formData.image_url ? 'none' : 'flex',
                    width: '100%', height: '100%',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#adb5bd', position: 'absolute', top: 0, left: 0
                  }}
                >
                  {getTypeIcon()}
                </div>
              </div>
            </div>

            {/* Stock fields stacked on the right */}
            <div className="flex-grow-1 d-flex flex-column  gap-1">
              {!isLocation && !isAsset ? (
                <>
                <div>
                     <div className={`text-center w-50 py-1 rounded fw-medium small ${isLowStock ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </div>
                  </div>
                  <div className="form-floating">
                    <input
                      type="number"
                      id="min_stock_level"
                      name="min_stock_level"
                      value={formData.min_stock_level}
                      onChange={handleChange}
                      className="form-control form-control-sm"
                      placeholder="Max Count"
                      min="0"
                    />
                    <label htmlFor="min_stock_level">Max Count</label>
                  </div>
                  <div className="form-floating">
                    <input
                      type="number"
                      id="min_count"
                      readOnly
                      value={0}
                      className="form-control form-control-sm bg-light dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                      placeholder="Min Count"
                      min="0"
                    />
                    <label htmlFor="min_count">Min Count</label>
                  </div>
                  <div className="form-floating">
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      className="form-control form-control-sm"
                      placeholder="Current Count"
                      min="0"
                    />
                    <label htmlFor="quantity">Current Count</label>
                  </div>

                              <div className="mb-2">
            <div className="input-group">
               <div className="form-floating">
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Price"
                  step="0.01"
                  min="0"
                />
                <label htmlFor="price">Price</label>
              </div>
            </div>
          </div>

                </>
              ) : (
                <div className="d-flex align-items-center gap-2 text-success">
                  <CheckCircleSolid className="h-5 w-5" />
                  <div>
                    <div className="fw-medium">Status: OK</div>
                    <div className="small text-muted">{isLocation ? 'Locations' : 'Assets'} do not track stock</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full-width form fields below */}
          <div className="form-floating mb-2">
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Name"
              required
            />
            <label htmlFor="name">Name *</label>
          </div>

          <div className="form-floating mb-2">
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="form-select form-select-sm"
            >
              <option value="PRODUCT">Product</option>
              <option value="RESOURCE">Resource</option>
              <option value="ASSET">Asset</option>
              <option value="LOCATION">Location</option>
              <option value="ITEM">Item</option>
            </select>
            <label htmlFor="type">Type</label>
          </div>

          <div className="form-floating mb-2">
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Description"
              style={{ height: '80px' }}
            />
            <label htmlFor="description">Description</label>
          </div>

          <div className="form-floating mb-2">
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="SKU"
            />
            <label htmlFor="sku">SKU</label>
          </div>
          {showScanner && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="btn btn-outline-secondary btn-sm"
                title="Scan Barcode"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                  <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                  <path d="M3 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
                </svg>
                Scan
              </button>
            </div>
          )}
          {scanError && (
            <div className="alert alert-danger py-1 small mb-2">{scanError}</div>
          )}

          <div className="form-floating mb-2">
            <select
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="form-select form-select-sm"
            >
              <option value="">Select a location...</option>
              {availableLocations.map(location => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
              <option value="[NEW]">+ Add new location...</option>
            </select>
            <label htmlFor="location">Location</label>
          </div>

          {formData.location === '[NEW]' && (
            <div className="form-floating mb-2">
              <input
                type="text"
                id="new_location"
                name="location"
                value=""
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, location: e.target.value }));
                }}
                className="form-control form-control-sm"
                placeholder="Enter new location"
              />
              <label htmlFor="new_location">New Location</label>
            </div>
          )}

          {/* Linked Service - only for RESOURCE or ASSET types */}
          {(formData.type === 'RESOURCE' || formData.type === 'ASSET') && (
            <div className="form-floating mb-2">
              <select
                id="service_id"
                name="service_id"
                value={formData.service_id}
                onChange={handleChange}
                className="form-select form-select-sm"
              >
                <option value="">No linked service</option>
                {availableServices.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <label htmlFor="service_id">Linked Service (optional)</label>
            </div>
          )}

          <div className="form-floating mb-2">
            <input
              type="url"
              id="image_url"
              name="image_url"
              value={formData.image_url}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Image URL"
            />
            <label htmlFor="image_url">Image URL</label>
          </div>
        </form>
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className="flex-shrink-0 mt-2 pt-2 pb-3 px-3 border-top bg-white">
        <div className="d-flex align-items-center">
          <div></div>
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px' }}
              title="Cancel"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <button
              type="submit"
              form="item-form"
              className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px' }}
              title={item ? 'Save Changes' : 'Create Item'}
            >
              <CheckIcon className="h-5 w-5" />
            </button>
          </div>
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
