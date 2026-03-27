/*
 * ============================================================
 * FILE: Form_Item.jsx
 *
 * PURPOSE:
 *   Create/edit form for a single inventory item. Supports multiple
 *   item types (Product, Resource, Asset, Location), allows photo
 *   capture via camera or URL, barcode scanning for SKU entry, and
 *   optional initial quantity/stock level fields for new items.
 *
 * FUNCTIONAL PARTS:
 *   [1] State              — form fields, scanner/camera/image mode,
 *                            pending photo, available locations and services
 *   [2] Effects            — populate form on edit, load locations and
 *                            services, clean up object URL on unmount
 *   [3] Handlers           — handleChange, handleBarcodeDetected,
 *                            handlePhotoCapture, handleSubmit
 *   [4] Derived Values     — type flags (isAsset, isLocation, isResource),
 *                            isLowStock, getTypeIcon
 *   [5] Render: Header     — title ("Add Item" / "Edit")
 *   [6] Render: Image Area — preview, camera/URL toggle panel
 *   [7] Render: Stock Fields — quantity, min stock level, price (or
 *                              "no stock tracking" notice for assets/locations)
 *   [8] Render: Core Fields — name, type, SKU with optional barcode button,
 *                             location dropdown, linked service, description
 *   [9] Render: Footer     — Cancel and Save/Create action buttons
 *  [10] Render: Modals     — Widget_Camera overlay, barcode Scanner_Barcode modal
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Converted type select to custom dropdown with per-option help popovers
 * ============================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import {
  XMarkIcon, CheckIcon,
  SparklesIcon, CubeIcon,
  WrenchScrewdriverIcon, BuildingOfficeIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import Button_Toolbar from './Button_Toolbar';
import Scanner_Barcode from './Scanner_Barcode';
import Widget_Camera from './Widget_Camera';
import Modal_BulkImport from './Modal_Import_Bulk';
import cacheService from '../../services/cacheService';
import { servicesAPI, suppliersAPI, inventoryAPI, inventoryCategoriesAPI } from '../../services/api';

// ─── 1 STATE ───────────────────────────────────────────────────────────────────
export default function Form_Item({ onSubmit, onCancel, item = null, initialSku = '', showInitialQuantity = false, onSubmitWithExtras = null, showScanner = false, existingSkus = [], onBulkImport = null }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: initialSku || '',
    price: 0,
    cost: '',
    description: '',
    type: 'PRODUCT',
    image_url: '',
    location: '',
    service_id: '',
    supplier_id: '',
    quantity: 0,
    min_stock_level: 10,
    category: '',
  });
  const [itemCategories, setItemCategories] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [addImageMode, setAddImageMode] = useState(null); // null | 'url' | 'camera'
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [availableLocations, setAvailableLocations] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [typeHelpKey, setTypeHelpKey] = useState(null);
  const [typeHelpPos, setTypeHelpPos] = useState({ top: 0, left: 0 });
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Bundle / Mix state (local — saved after item creation)
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  // Bundle
  const [bundleComponents, setBundleComponents] = useState([]); // [{id, name, price, quantity}]
  const [bundlePriceType, setBundlePriceType] = useState('fixed');
  const [bundlePricePercentage, setBundlePricePercentage] = useState(100);
  const [bundleNewProductId, setBundleNewProductId] = useState('');
  const [bundleNewQty, setBundleNewQty] = useState(1);
  // Mix
  const [mixTotalQty, setMixTotalQty] = useState(10);
  const [mixHasMax, setMixHasMax] = useState(false);
  const [mixMaxPerProduct, setMixMaxPerProduct] = useState('');
  const [mixComponents, setMixComponents] = useState([]); // [{id, name, price, max_quantity}]
  const [mixNewProductId, setMixNewProductId] = useState('');
  const [mixNewMax, setMixNewMax] = useState('');

  const typeOptions = [
    { value: 'PRODUCT', label: 'Product', description: 'Items sold to customers. Tracks inventory and stock levels.' },
    { value: 'BUNDLE', label: 'Bundle', description: 'Pre-defined set of products sold together at a fixed or percentage price.' },
    { value: 'MIX', label: 'Mix', description: 'Client picks a fixed total quantity from a list of products.' },
    { value: 'RESOURCE', label: 'Resource', description: 'Consumable materials used in services. Links to specific service offerings.' },
    { value: 'ASSET', label: 'Asset', description: 'Reusable equipment or tools. No stock tracking, managed by location/service.' },
    { value: 'LOCATION', label: 'Location', description: 'Physical place within your business (room, station, area). No stock tracking.' },
    { value: 'ITEM', label: 'Item', description: 'Generic item type. Use when other categories don\'t apply.' },
  ];

  // ─── 2 EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        sku: item.sku || initialSku || '',
        price: item.price || 0,
        cost: item.cost ?? '',
        description: item.description || '',
        type: (typeof item.type === 'string'
          ? (['PRODUCT','BUNDLE','MIX','RESOURCE','ASSET','LOCATION','ITEM'].includes(item.type.toUpperCase())
              ? item.type.toUpperCase()
              : 'PRODUCT')
          : 'PRODUCT'),
        image_url: item.image_url || '',
        location: item.location || '',
        service_id: item.service_id || '',
        supplier_id: item.supplier_id || '',
        quantity: item.quantity || 0,
        min_stock_level: item.min_stock_level || 10,
        category: item.category || '',
      });
    } else if (initialSku) {
      setFormData(prev => ({ ...prev, sku: initialSku }));
    }
  }, [item, initialSku]);

  useEffect(() => {
    const loadAvailableLocations = async () => {
      try {
        const [inventoryRes, distinctRes] = await Promise.all([
          inventoryAPI.getAll(),
          inventoryAPI.getLocations(),
        ]);
        const inventoryRows = inventoryRes?.data ?? inventoryRes ?? [];
        const rawDistinct = distinctRes?.data;
        const distinctRows = Array.isArray(rawDistinct)
          ? rawDistinct
          : Array.isArray(rawDistinct?.locations)
            ? rawDistinct.locations
            : [];

        const all = new Set(cacheService.getLocations());

        distinctRows.forEach((loc) => {
          const value = String(loc || '').trim();
          if (value) all.add(value);
        });

        if (Array.isArray(inventoryRows)) {
          inventoryRows.forEach((row) => {
            const rowLocation = String(row?.location || '').trim();
            if (rowLocation) all.add(rowLocation);
            if (String(row?.type || '').toUpperCase() === 'LOCATION') {
              const locationName = String(row?.name || '').trim();
              if (locationName) all.add(locationName);
            }
          });
        }

        setAvailableLocations([...all].sort((a, b) => a.localeCompare(b)));
      } catch {
        setAvailableLocations(cacheService.getLocations());
      }
    };

    loadAvailableLocations();

    servicesAPI.getAll().then(res => {
      const data = res?.data ?? res;
      if (Array.isArray(data)) setAvailableServices(data);
    }).catch(() => {});
    suppliersAPI.getAll().then(res => {
      const data = res?.data ?? res;
      if (Array.isArray(data)) setAvailableSuppliers(data);
    }).catch(() => {});
  }, []);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => { if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl); };
  }, []);

  // Load categories whenever type changes.
  // cancelled flag prevents stale API responses from overwriting fresh results
  // when the type changes quickly (e.g. initial populate from item prop).
  useEffect(() => {
    let cancelled = false;
    const type = (formData.type || 'PRODUCT').toLowerCase();
    inventoryCategoriesAPI.getByType(type)
      .then(res => { if (!cancelled) setItemCategories(Array.isArray(res?.data) ? res.data : []); })
      .catch(() => { if (!cancelled) setItemCategories([]); });
    setShowCategoryManager(false);
    setNewCategoryName('');
    return () => { cancelled = true; };
  }, [formData.type]);

  // Load products when type changes to BUNDLE or MIX
  useEffect(() => {
    const upper = (formData.type || '').toUpperCase();
    if (upper === 'BUNDLE' || upper === 'MIX') {
      inventoryAPI.getAll().then(res => {
        const items = res?.data ?? res ?? [];
        setAllProducts(Array.isArray(items) ? items.filter(i => (i.type || '').toUpperCase() === 'PRODUCT') : []);
      }).catch(() => {});
    } else {
      // Reset when leaving bundle/mix
      setBundleComponents([]);
      setBundlePriceType('fixed');
      setBundlePricePercentage(100);
      setMixComponents([]);
      setMixTotalQty(10);
      setMixHasMax(false);
      setMixMaxPerProduct('');
      setProductSearch('');
    }
  }, [formData.type]);

  // ─── 3 HANDLERS ──────────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);

  const handlePhotoCapture = (blob) => {
    setIsCameraOpen(false);
    setAddImageMode(null);
    if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
    setPendingPhoto(blob);
    setPendingPhotoUrl(URL.createObjectURL(blob));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
    setPendingPhoto(file);
    setPendingPhotoUrl(URL.createObjectURL(file));
    setAddImageMode(null);
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
  };

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

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const type = (formData.type || 'PRODUCT').toLowerCase();
    const normalizedName = name.toLocaleLowerCase();
    const existingCategory = itemCategories.find((category) => category.name?.trim().toLocaleLowerCase() === normalizedName);
    if (existingCategory) {
      setFormData((prev) => ({ ...prev, category: existingCategory.name }));
      setNewCategoryName('');
      setShowCategoryManager(false);
      return;
    }
    try {
      const res = await inventoryCategoriesAPI.create(type, name);
      const created = res?.data;
      if (!created?.name) return;
      setItemCategories(prev => [...prev.filter(c => c.id !== created?.id), created].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, category: created.name }));
      setNewCategoryName('');
      setShowCategoryManager(false);
    } catch { /* silent */ }
  };

  const handleDeleteCategory = async (catId) => {
    try {
      await inventoryCategoriesAPI.delete(catId);
      setItemCategories(prev => prev.filter(c => c.id !== catId));
      if (formData.category === itemCategories.find(c => c.id === catId)?.name) {
        setFormData(prev => ({ ...prev, category: '' }));
      }
    } catch { /* silent */ }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = (formData.name || '').trim();
    const sku = (formData.sku || '').trim();
    if (!name) {
      alert('Name is required.');
      return;
    }
    const price = parseFloat(formData.price) || 0;
    if (price < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }
    const cost = formData.cost !== '' && formData.cost != null ? parseFloat(formData.cost) : null;
    const type = typeof formData.type === 'string' ? formData.type.toUpperCase() : 'PRODUCT';
    const description = (formData.description || '').trim();
    const image_url = addImageMode === 'url' || !pendingPhotoUrl ? (formData.image_url || '').trim() : '';
    const location = (formData.location || '').trim();
    const payload = {
      name,
      sku,
      price,
      cost: cost ?? undefined,
      description: description || undefined,
      type,
      image_url: image_url || undefined,
      location: (location && location !== '[NEW]') ? location : undefined,
      service_id: formData.service_id || undefined,
      supplier_id: formData.supplier_id || undefined,
      category: formData.category || undefined,
      min_stock_level: parseInt(formData.min_stock_level) || 10,
    };
    const qty = parseInt(formData.quantity) || 0;
    const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;

    // Include bundle/mix pricing in payload
    if (type === 'BUNDLE') {
      payload.price_type = bundlePriceType;
      payload.price_percentage = bundlePriceType === 'percentage' ? (parseFloat(bundlePricePercentage) || 100) : null;
    }

    try {
      if (onSubmitWithExtras) {
        const extras = { initialQuantity: safeQty, pendingPhoto: pendingPhoto || null };
        if (type === 'BUNDLE') {
          extras.bundleComponents = bundleComponents;
        }
        if (type === 'MIX') {
          extras.mixConfig = {
            total_quantity: parseInt(mixTotalQty) || 10,
            max_per_product: mixHasMax && mixMaxPerProduct !== '' ? (parseInt(mixMaxPerProduct) || null) : null,
          };
          extras.mixComponents = mixComponents;
        }
        onSubmitWithExtras(payload, extras);
      } else {
        onSubmit(payload);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      throw error;
    }
  };

  // ─── 4 DERIVED VALUES ────────────────────────────────────────────────────────
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

  // ─── 5 RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900"      style={{ height: '100%' }}  >
      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">{item ? 'Edit' : 'Add Item'}</h6>
        {!item && onBulkImport && (
          <button
            type="button"
            title="Bulk Import"
            onClick={() => setIsBulkImportOpen(true)}
            className="btn btn-sm p-1 text-gray-500 dark:text-gray-400"
            style={{ lineHeight: 1 }}
          >
            <ArrowUpTrayIcon style={{ width: 18, height: 18 }} />
          </button>
        )}
      </div>

      {isBulkImportOpen && (
        <Modal_BulkImport
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          entityLabel="Items"
          allowPhotoUpload
          itemTypes={[
            { value: 'PRODUCT',  label: 'Product'  },
            { value: 'RESOURCE', label: 'Resource' },
            { value: 'ASSET',    label: 'Asset'    },
            { value: 'LOCATION', label: 'Location' },
            { value: 'ITEM',     label: 'Item'     },
            { value: 'BUNDLE',   label: 'Bundle'   },
            { value: 'MIX',      label: 'Mix'      },
          ]}
          defaultItemType="PRODUCT"
          onImport={async (rows) => {
            await onBulkImport(rows);
            setIsBulkImportOpen(false);
          }}
        />
      )}

      {/* ─── 6 RENDER: IMAGE AREA + 7 STOCK FIELDS ──────────────────────────────── */}
      {/* Container_Scrollable Content Area */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <form id="item-form" onSubmit={handleSubmit}>
          {/* Top Section: Image placeholder (left) + Stock fields (right) */}
          <div className="d-flex gap-3 mb-3" style={{ minHeight: '200px' }}>
            {/* Image area - layout matches Edit Item */}
            <div className="flex-shrink-0" style={{ width: '45%' }}>
              {/* Preview */}
              <div className="position-relative" style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--bs-secondary-bg)', width: '100%', aspectRatio: '1' }}>
                {pendingPhotoUrl ? (
                  <img
                    src={pendingPhotoUrl}
                    alt="Captured"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt={formData.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : null}
                <div
                  style={{
                    display: pendingPhotoUrl || formData.image_url ? 'none' : 'flex',
                    width: '100%', height: '100%',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#adb5bd', position: 'absolute', top: 0, left: 0
                  }}
                >
                  {getTypeIcon()}
                </div>
              </div>

              {/* Add photo button strip */}
              <div className="mt-1 d-flex align-items-center gap-1">
                {addImageMode === null && (
                  <button
                    type="button"
                    onClick={() => setAddImageMode('camera')}
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '3rem', height: '3rem', borderRadius: '4px' }}
                    title="Add photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                      <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Camera/URL panel */}
              {addImageMode !== null && (
                <div className="mt-1 p-2 border rounded bg-light dark:bg-gray-800 dark:border-gray-700">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="btn-group btn-group-sm">
                      <button type="button" className={`btn ${addImageMode === 'camera' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setAddImageMode('camera')} style={{ fontSize: '0.72rem', padding: '2px 10px' }}>Camera</button>
                      <button type="button" className={`btn ${addImageMode === 'upload' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setAddImageMode('upload')} style={{ fontSize: '0.72rem', padding: '2px 10px' }}>Upload</button>
                      <button type="button" className={`btn ${addImageMode === 'url' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setAddImageMode('url')} style={{ fontSize: '0.72rem', padding: '2px 10px' }}>URL</button>
                    </div>
                    <button type="button" onClick={() => { setAddImageMode(null); }} className="btn btn-link btn-sm p-0 ms-auto" style={{ fontSize: '0.75rem', color: '#6c757d', lineHeight: 1 }}>✕</button>
                  </div>
                  {addImageMode === 'camera' && (
                    <button type="button" onClick={() => setIsCameraOpen(true)} className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                      </svg>
                      {pendingPhotoUrl ? 'Retake Photo' : 'Open Camera'}
                    </button>
                  )}
                  {addImageMode === 'upload' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                          <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                        </svg>
                        {pendingPhotoUrl ? 'Replace Photo' : 'Choose from Device'}
                      </button>
                    </div>
                  )}
                  {addImageMode === 'url' && (
                    <div className="d-flex gap-1">
                      <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} onKeyDown={e => e.key === 'Enter' && setAddImageMode(null)} placeholder="https://..." className="form-control form-control-sm" style={{ fontSize: '0.8rem' }} />
                      <button type="button" onClick={() => setAddImageMode(null)} className="btn btn-primary btn-sm flex-shrink-0">OK</button>
                    </div>
                  )}
                </div>
              )}
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
                      placeholder="Min Count"
                      min="0"
                    />
                    <label htmlFor="min_stock_level">Min Count</label>
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

          {/* Cost — ASSET type only */}
          {isAsset && (
            <div className="mb-2">
              <div className="input-group">
                <div className="form-floating">
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    value={formData.cost}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="Cost"
                    step="0.01"
                    min="0"
                  />
                  <label htmlFor="cost">Cost (purchase / rental)</label>
                </div>
              </div>
            </div>
          )}

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

          {/* ─── 8 RENDER: CORE FIELDS ───────────────────────────────────────────── */}
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

          <div className="mb-2 position-relative">
            <label htmlFor="type" className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Type</label>
            <div className="position-relative">
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !isTypeDropdownOpen;
                  setIsTypeDropdownOpen(nextOpen);
                  if (!nextOpen) setTypeHelpKey(null);
                }}
                className="form-select form-select-sm text-start d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }}
              >
                <span>{typeOptions.find(opt => opt.value === formData.type)?.label || 'Select Type'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style={{ marginLeft: '8px' }}>
                  <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
              {isTypeDropdownOpen && (
                <div
                  className="position-absolute w-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
                  style={{ top: 'calc(100% + 4px)', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}
                >
                  {typeOptions.map((option, index) => {
                    const isHelpOpen = typeHelpKey === option.value;
                    return (
                      <div key={option.value} className="d-flex align-items-center gap-1 px-2 py-1 border-bottom border-gray-100 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, type: option.value }));
                            setIsTypeDropdownOpen(false);
                            setTypeHelpKey(null);
                          }}
                          className="btn btn-link text-start p-1 flex-grow-1 text-decoration-none text-gray-900 dark:text-gray-100"
                          style={{ fontSize: '0.875rem' }}
                        >
                          {option.label}
                        </button>
                        <div className="flex-shrink-0">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-primary border-0"
                            aria-label={`${option.label} help`}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTypeHelpPos({ top: rect.top, left: rect.right + 8 });
                              setTypeHelpKey(option.value);
                            }}
                            onMouseLeave={() => setTypeHelpKey(prev => prev === option.value ? null : prev)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTypeHelpPos({ top: rect.top, left: rect.right + 8 });
                              setTypeHelpKey(prev => prev === option.value ? null : option.value);
                            }}
                            style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700, fontSize: '0.75rem', border: 'none', outline: 'none' }}
                          >?</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Fixed-position tooltip — renders outside overflow container so it's never clipped */}
            {typeHelpKey && (() => {
              const opt = typeOptions.find(o => o.value === typeHelpKey);
              if (!opt) return null;
              return (
                <div
                  style={{
                    position: 'fixed',
                    top: typeHelpPos.top,
                    left: typeHelpPos.left,
                    width: 240,
                    maxWidth: 'calc(100vw - 1rem)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                  }}
                  className="p-2 rounded-lg shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                >
                  <div className="fw-semibold" style={{ fontSize: '0.8rem' }}>{opt.label}</div>
                  <div className="small text-gray-600 dark:text-gray-300">{opt.description}</div>
                </div>
              );
            })()}
          </div>

          {/* Category picker — appears once a type is selected */}
          <div className="mb-2">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="form-floating flex-grow-1">
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-select form-select-sm"
                >
                  <option value="">— None —</option>
                  {itemCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <label htmlFor="category">Category</label>
              </div>
              <button
                type="button"
                title={showCategoryManager ? 'Close' : 'Manage categories'}
                onClick={() => setShowCategoryManager(v => !v)}
                className="btn btn-sm btn-outline-secondary flex-shrink-0"
                style={{ height: '3.2rem', width: '2.6rem', fontSize: '0.8rem' }}
              >
                {showCategoryManager ? '×' : '⋯'}
              </button>
            </div>
            {showCategoryManager && (
              <div className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {itemCategories.length === 0 && (
                  <div className="small text-muted mb-2">No categories yet for this type.</div>
                )}
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {itemCategories.map(cat => (
                    <span key={cat.id} className="badge bg-secondary-subtle text-secondary-emphasis d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', fontWeight: 500 }}>
                      {cat.name}
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="btn-close btn-close-sm ms-1"
                        style={{ fontSize: '0.55rem', padding: '0.1rem' }}
                        aria-label="Remove"
                      />
                    </span>
                  ))}
                </div>
                <div className="d-flex gap-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                    placeholder="New category name..."
                    className="form-control form-control-sm"
                    style={{ fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="btn btn-sm btn-outline-primary flex-shrink-0"
                    style={{ fontSize: '0.78rem' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mb-2">
            <div className="form-floating position-relative">
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="form-control form-control-sm"
                placeholder="SKU"
                style={showScanner ? { paddingRight: '3.5rem' } : undefined}
              />
              <label htmlFor="sku">SKU</label>
              {showScanner && (
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="btn btn-link btn-sm p-0 m-0 position-absolute top-50 translate-middle-y d-flex align-items-center justify-content-center"
                  style={{ right: '0.25rem', width: '3rem', height: '3rem' }}
                  title="Scan Barcode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                    <path d="M3 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
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

          {/* Supplier */}
          <div className="form-floating mb-2">
            <select
              id="supplier_id"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              className="form-select form-select-sm"
            >
              <option value="">No supplier</option>
              {availableSuppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <label htmlFor="supplier_id">Supplier (optional)</label>
          </div>

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

          <hr className="my-2" />
          <div className="form-floating mb-2">
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control form-control-sm border-0 min-h-[80px]"
              placeholder="Description"
            />
            <label htmlFor="description">Description</label>
          </div>

          {/* ─── BUNDLE COMPONENTS INLINE ─── */}
          {upperType === 'BUNDLE' && (
            <div className="mt-3 p-3 rounded-3 border" style={{ borderColor: '#fb923c', background: '#fff7ed' }}>
              <div className="fw-semibold mb-2" style={{ color: '#c2410c', fontSize: '0.85rem' }}>Bundle Components</div>

              {/* Price type */}
              <div className="d-flex align-items-center gap-2 mb-2">
                <label className="small text-muted mb-0">Pricing:</label>
                <select
                  className="form-select form-select-sm w-auto"
                  value={bundlePriceType}
                  onChange={e => setBundlePriceType(e.target.value)}
                >
                  <option value="fixed">Fixed price (use Price above)</option>
                  <option value="percentage">% of component total</option>
                </select>
                {bundlePriceType === 'percentage' && (
                  <div className="d-flex align-items-center gap-1">
                    <input
                      type="number"
                      min="1" max="500"
                      className="form-control form-control-sm"
                      style={{ width: 70 }}
                      value={bundlePricePercentage}
                      onChange={e => setBundlePricePercentage(e.target.value)}
                    />
                    <span className="small text-muted">%</span>
                  </div>
                )}
              </div>

              {/* Added components */}
              {bundleComponents.length > 0 && (
                <div className="mb-2">
                  {bundleComponents.map(comp => (
                    <div key={comp.id} className="d-flex align-items-center gap-2 mb-1 p-2 rounded bg-white border" style={{ borderColor: '#fed7aa' }}>
                      <span className="flex-grow-1 small">{comp.name}</span>
                      <span className="small text-muted">${comp.price?.toFixed(2)}</span>
                      <input
                        type="number" min="0.1" step="0.1"
                        className="form-control form-control-sm"
                        style={{ width: 60 }}
                        value={comp.quantity}
                        onChange={e => setBundleComponents(prev => prev.map(c => c.id === comp.id ? { ...c, quantity: parseFloat(e.target.value) || 1 } : c))}
                      />
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setBundleComponents(prev => prev.filter(c => c.id !== comp.id))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add component row */}
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="text"
                  className="form-control form-control-sm flex-grow-1"
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
                <input
                  type="number" min="0.1" step="0.1"
                  className="form-control form-control-sm"
                  style={{ width: 60 }}
                  value={bundleNewQty}
                  onChange={e => setBundleNewQty(e.target.value)}
                  placeholder="Qty"
                />
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 160 }}
                  value={bundleNewProductId}
                  onChange={e => setBundleNewProductId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {allProducts
                    .filter(p => !bundleComponents.some(c => c.id === p.id) && (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())))
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-warning flex-shrink-0"
                  onClick={() => {
                    const prod = allProducts.find(p => p.id === bundleNewProductId);
                    if (!prod) return;
                    setBundleComponents(prev => [...prev, { id: prod.id, name: prod.name, price: prod.price || 0, quantity: parseFloat(bundleNewQty) || 1 }]);
                    setBundleNewProductId('');
                    setBundleNewQty(1);
                    setProductSearch('');
                  }}
                >Add</button>
              </div>
            </div>
          )}

          {/* ─── MIX CONFIG INLINE ─── */}
          {upperType === 'MIX' && (
            <div className="mt-3 p-3 rounded-3 border" style={{ borderColor: '#f472b6', background: '#fdf2f8' }}>
              <div className="fw-semibold mb-2" style={{ color: '#be185d', fontSize: '0.85rem' }}>Mix Setup</div>

              {/* Total quantity + max per product */}
              <div className="d-flex gap-3 align-items-center mb-2 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted mb-0">Total qty:</label>
                  <input
                    type="number" min="1"
                    className="form-control form-control-sm"
                    style={{ width: 70 }}
                    value={mixTotalQty}
                    onChange={e => setMixTotalQty(e.target.value)}
                  />
                </div>
                <div className="d-flex align-items-center gap-2">
                  <input type="checkbox" id="mix-has-max-inline" checked={mixHasMax} onChange={e => setMixHasMax(e.target.checked)} />
                  <label htmlFor="mix-has-max-inline" className="small text-muted mb-0" style={{ cursor: 'pointer' }}>Max per product</label>
                  {mixHasMax && (
                    <input
                      type="number" min="1"
                      className="form-control form-control-sm"
                      style={{ width: 70 }}
                      value={mixMaxPerProduct}
                      onChange={e => setMixMaxPerProduct(e.target.value)}
                      placeholder="Max"
                    />
                  )}
                </div>
              </div>

              {/* Added mix products */}
              {mixComponents.length > 0 && (
                <div className="mb-2">
                  {mixComponents.map(comp => (
                    <div key={comp.id} className="d-flex align-items-center gap-2 mb-1 p-2 rounded bg-white border" style={{ borderColor: '#fbcfe8' }}>
                      <span className="flex-grow-1 small">{comp.name}</span>
                      <span className="small text-muted">${comp.price?.toFixed(2)}</span>
                      <input
                        type="number" min="1"
                        className="form-control form-control-sm"
                        style={{ width: 60 }}
                        value={comp.max_quantity || ''}
                        placeholder="Max"
                        onChange={e => setMixComponents(prev => prev.map(c => c.id === comp.id ? { ...c, max_quantity: e.target.value !== '' ? parseInt(e.target.value) : null } : c))}
                      />
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setMixComponents(prev => prev.filter(c => c.id !== comp.id))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add product row */}
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="text"
                  className="form-control form-control-sm flex-grow-1"
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 180 }}
                  value={mixNewProductId}
                  onChange={e => setMixNewProductId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {allProducts
                    .filter(p => !mixComponents.some(c => c.id === p.id) && (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())))
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="number" min="1"
                  className="form-control form-control-sm"
                  style={{ width: 60 }}
                  value={mixNewMax}
                  onChange={e => setMixNewMax(e.target.value)}
                  placeholder="Max"
                />
                <button
                  type="button"
                  className="btn btn-sm flex-shrink-0"
                  style={{ background: '#ec4899', color: '#fff', border: 'none' }}
                  onClick={() => {
                    const prod = allProducts.find(p => p.id === mixNewProductId);
                    if (!prod) return;
                    setMixComponents(prev => [...prev, { id: prod.id, name: prod.name, price: prod.price || 0, max_quantity: mixNewMax !== '' ? parseInt(mixNewMax) : null }]);
                    setMixNewProductId('');
                    setMixNewMax('');
                    setProductSearch('');
                  }}
                >Add</button>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* ─── 9 RENDER: FOOTER ───────────────────────────────────────────────────── */}
      {/* Fixed Footer with Action Buttons */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }} />
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onCancel}
              className="btn-outline-secondary"
            />
            <Button_Toolbar
              icon={CheckIcon}
              label={item ? 'Save Changes' : 'Create Item'}
              type="submit"
              form="item-form"
              className="btn-primary"
            />
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>

      {/* ─── 10 RENDER: MODALS ──────────────────────────────────────────────────── */}
      {isCameraOpen && (
        <Widget_Camera
          onCapture={handlePhotoCapture}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}

      {/* Barcode Scanner Modal */}
      <Modal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} title="Scan Barcode" centered={true}>
        <Scanner_Barcode
          onDetected={handleBarcodeDetected}
          onCancel={() => setIsScannerOpen(false)}
        />
      </Modal>
    </div>
  );
}
