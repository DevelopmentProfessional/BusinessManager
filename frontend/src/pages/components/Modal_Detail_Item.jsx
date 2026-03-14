/*
 * ============================================================
 * FILE: Modal_Detail_Item.jsx
 *
 * PURPOSE:
 *   Full-screen modal for viewing or editing an inventory item, operating
 *   in two modes: "sales" (display + add-to-cart) and "inventory" (full
 *   edit form with image management, barcode scanning, and stock tracking).
 *
 * FUNCTIONAL PARTS:
 *   [1] State Initialisation — Form data, image list, scanner/camera state, edit mode flags
 *   [2] Data Loaders — loadImages (fetches InventoryImage records), location cache read
 *   [3] Form & SKU Handlers — handleChange, isDuplicateSku, handleBarcodeDetected
 *   [4] Image Management Handlers — add URL, capture photo, delete image, edit image URL
 *   [5] Cart & Inventory Action Handlers — handleAddToCart, handleUpdateInventory, handleDelete
 *   [6] Derived Display Helpers — getTypeIcon, isLowStock, renderImage (with nav arrows)
 *   [7] Sales Mode Header — Full-width image with stock badge and multi-image navigation
 *   [8] Inventory Mode Header — Compact "Edit Item" title bar
 *   [9] Sales Mode Content — Name, price, description, quantity selector, add-to-cart button
 *   [10] Inventory Mode Form — Image panel + stock fields side-by-side, photo strip,
 *        full-width form fields (name, type, SKU with scanner, location, description)
 *   [11] Fixed Footer — Delete / Cancel / Save actions (inventory mode only)
 *   [12] Sub-modal Mounts — Barcode scanner modal and camera widget
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon, ShoppingCartIcon, TagIcon,
  SparklesIcon, CubeIcon, PlusIcon, MinusIcon,
  MapPinIcon, WrenchScrewdriverIcon, BuildingOfficeIcon,
  TrashIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon,
  BeakerIcon, CogIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import Button_Toolbar from './Button_Toolbar';
import { inventoryAPI, inventoryFeaturesAPI, productRelationsAPI } from '../../services/api';
import Modal from './Modal';
import cacheService from '../../services/cacheService';
import { getImageSrc } from './imageUtils';
import Scanner_Barcode from './Scanner_Barcode';
import Widget_Camera from './Widget_Camera';
import FeatureSection from './FeatureSection';

// ─── Production Relations Panel ────────────────────────────────────────────────
// Shown only for PRODUCT type items in inventory mode
function ProductionRelationsPanel({ productId }) {
  const [activeTab, setActiveTab] = useState('resources');
  const [resources, setResources]   = useState([]);
  const [assets, setAssets]         = useState([]);
  const [locations, setLocations]   = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Add-row state
  const [addingResource, setAddingResource] = useState(false);
  const [newResourceId, setNewResourceId]   = useState('');
  const [newResourceQty, setNewResourceQty] = useState(1);
  const [addingAsset, setAddingAsset]       = useState(false);
  const [newAssetId, setNewAssetId]         = useState('');
  const [newAssetBatch, setNewAssetBatch]   = useState(1);
  const [newAssetDur, setNewAssetDur]       = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationId, setNewLocationId]   = useState('');

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError('');
    try {
      const [rRes, aRes, lRes, invRes] = await Promise.all([
        productRelationsAPI.getResources(productId),
        productRelationsAPI.getAssets(productId),
        productRelationsAPI.getLocations(productId),
        inventoryAPI.getAll(),
      ]);
      setResources(Array.isArray(rRes?.data) ? rRes.data : []);
      setAssets(Array.isArray(aRes?.data) ? aRes.data : []);
      setLocations(Array.isArray(lRes?.data) ? lRes.data : []);
      setAllInventory(Array.isArray(invRes?.data) ? invRes.data : []);
    } catch { setError('Failed to load production relations.'); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const invMap = Object.fromEntries(allInventory.map(i => [i.id, i]));
  const resourceItems  = allInventory.filter(i => (i.type || '').toUpperCase() === 'RESOURCE');
  const assetItems     = allInventory.filter(i => (i.type || '').toUpperCase() === 'ASSET');
  const locationItems  = allInventory.filter(i => (i.type || '').toUpperCase() === 'LOCATION');

  const handleAddResource = async () => {
    if (!newResourceId) return;
    try { await productRelationsAPI.addResource(productId, newResourceId, newResourceQty); load(); setAddingResource(false); setNewResourceId(''); setNewResourceQty(1); }
    catch { setError('Failed to add resource.'); }
  };
  const handleRemoveResource = async (id) => {
    try { await productRelationsAPI.removeResource(id); load(); }
    catch { setError('Failed to remove resource.'); }
  };
  const handleUpdateResourceQty = async (id, qty) => {
    try { await productRelationsAPI.updateResource(id, { quantity_per_batch: parseFloat(qty) || 1 }); load(); }
    catch { setError('Failed to update resource.'); }
  };

  const handleAddAsset = async () => {
    if (!newAssetId) return;
    try {
      await productRelationsAPI.addAsset(productId, newAssetId, parseInt(newAssetBatch) || 1, newAssetDur ? parseFloat(newAssetDur) : null);
      load(); setAddingAsset(false); setNewAssetId(''); setNewAssetBatch(1); setNewAssetDur('');
    } catch { setError('Failed to add asset.'); }
  };
  const handleRemoveAsset = async (id) => {
    try { await productRelationsAPI.removeAsset(id); load(); }
    catch { setError('Failed to remove asset.'); }
  };
  const handleUpdateAsset = async (id, data) => {
    try { await productRelationsAPI.updateAsset(id, data); load(); }
    catch { setError('Failed to update asset.'); }
  };

  const handleAddLocation = async () => {
    if (!newLocationId) return;
    try { await productRelationsAPI.addLocation(productId, newLocationId); load(); setAddingLocation(false); setNewLocationId(''); }
    catch { setError('Failed to add location.'); }
  };
  const handleRemoveLocation = async (id) => {
    try { await productRelationsAPI.removeLocation(id); load(); }
    catch { setError('Failed to remove location.'); }
  };

  const tabStyle = (t) => ({
    padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
    borderBottom: activeTab === t ? '2px solid #6366f1' : '2px solid transparent',
    color: activeTab === t ? '#6366f1' : '#6b7280',
    background: 'none', border: 'none', cursor: 'pointer',
  });

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem' };
  const inputSm = { fontSize: '0.75rem', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, background: 'var(--bs-body-bg)', color: 'var(--bs-body-color)' };
  const btnDanger = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 14 };
  const btnPrimary = { fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' };
  const btnOutline = { fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, background: 'none', color: '#6366f1', border: '1px solid #6366f1', cursor: 'pointer' };

  return (
    <div className="mt-3" style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}>
      {/* Header */}
      <div style={{ padding: '6px 10px 0', background: '#f9fafb', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <CogIcon style={{ width: 14, height: 14, color: '#6366f1' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Production Setup</span>
        </div>
        <div style={{ display: 'flex' }}>
          {[
            { key: 'resources', label: 'Resources' },
            { key: 'assets',    label: 'Assets'    },
            { key: 'locations', label: 'Locations' },
          ].map(({ key, label }) => (
            <button key={key} style={tabStyle(key)} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '8px 10px', minHeight: 80 }}>
        {loading && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Loading…</div>}
        {error   && <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</div>}

        {/* ── Resources tab ── */}
        {activeTab === 'resources' && !loading && (
          <>
            {resources.length === 0 && !addingResource && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 6 }}>No resources linked. Add resources that are consumed when making a batch.</div>
            )}
            {resources.map(r => (
              <div key={r.id} style={rowStyle}>
                <BeakerIcon style={{ width: 13, height: 13, color: '#6b7280', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{invMap[r.resource_id]?.name || r.resource_id?.slice(0, 8)}</span>
                <input
                  type="number" min="0.01" step="0.01"
                  defaultValue={r.quantity_per_batch}
                  onBlur={(e) => handleUpdateResourceQty(r.id, e.target.value)}
                  style={{ ...inputSm, width: 60 }}
                  title="Quantity consumed per batch"
                />
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>/ batch</span>
                <button style={btnDanger} onClick={() => handleRemoveResource(r.id)} title="Remove">×</button>
              </div>
            ))}

            {addingResource ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                <select value={newResourceId} onChange={e => setNewResourceId(e.target.value)} style={{ ...inputSm, flex: 1 }}>
                  <option value="">Select resource…</option>
                  {resourceItems.filter(i => !resources.some(r => r.resource_id === i.id)).map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <input type="number" min="0.01" step="0.01" value={newResourceQty}
                  onChange={e => setNewResourceQty(e.target.value)} style={{ ...inputSm, width: 60 }} placeholder="Qty" />
                <button style={btnPrimary} onClick={handleAddResource}>Add</button>
                <button style={btnOutline} onClick={() => { setAddingResource(false); setNewResourceId(''); setNewResourceQty(1); }}>Cancel</button>
              </div>
            ) : (
              <button style={{ ...btnOutline, marginTop: 6 }} onClick={() => setAddingResource(true)}>+ Add Resource</button>
            )}
          </>
        )}

        {/* ── Assets tab ── */}
        {activeTab === 'assets' && !loading && (
          <>
            {assets.length === 0 && !addingAsset && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 6 }}>No assets linked. Add equipment used to produce this item.</div>
            )}
            {assets.map(a => (
              <div key={a.id} style={rowStyle}>
                <WrenchScrewdriverIcon style={{ width: 13, height: 13, color: '#6b7280', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{invMap[a.asset_id]?.name || a.asset_id?.slice(0, 8)}</span>
                <input type="number" min="1" step="1" defaultValue={a.batch_size}
                  onBlur={(e) => handleUpdateAsset(a.id, { batch_size: parseInt(e.target.value) || 1 })}
                  style={{ ...inputSm, width: 55 }} title="Units produced per batch" />
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>units/batch</span>
                <input type="number" min="0" step="1" defaultValue={a.duration_minutes ?? ''}
                  onBlur={(e) => handleUpdateAsset(a.id, { duration_minutes: e.target.value ? parseFloat(e.target.value) : null })}
                  style={{ ...inputSm, width: 55 }} placeholder="min" title="Duration in minutes per batch" />
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>min</span>
                <button style={btnDanger} onClick={() => handleRemoveAsset(a.id)} title="Remove">×</button>
              </div>
            ))}

            {addingAsset ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
                <select value={newAssetId} onChange={e => setNewAssetId(e.target.value)} style={{ ...inputSm, flex: '1 1 120px' }}>
                  <option value="">Select asset…</option>
                  {assetItems.filter(i => !assets.some(a => a.asset_id === i.id)).map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <input type="number" min="1" value={newAssetBatch} onChange={e => setNewAssetBatch(e.target.value)}
                  style={{ ...inputSm, width: 60 }} placeholder="Units/batch" title="Units produced per batch" />
                <input type="number" min="0" value={newAssetDur} onChange={e => setNewAssetDur(e.target.value)}
                  style={{ ...inputSm, width: 60 }} placeholder="Min" title="Duration per batch in minutes" />
                <button style={btnPrimary} onClick={handleAddAsset}>Add</button>
                <button style={btnOutline} onClick={() => { setAddingAsset(false); setNewAssetId(''); setNewAssetBatch(1); setNewAssetDur(''); }}>Cancel</button>
              </div>
            ) : (
              <button style={{ ...btnOutline, marginTop: 6 }} onClick={() => setAddingAsset(true)}>+ Add Asset</button>
            )}
          </>
        )}

        {/* ── Locations tab ── */}
        {activeTab === 'locations' && !loading && (
          <>
            {locations.length === 0 && !addingLocation && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 6 }}>No production locations linked.</div>
            )}
            {locations.map(l => (
              <div key={l.id} style={rowStyle}>
                <MapPinIcon style={{ width: 13, height: 13, color: '#6b7280', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{invMap[l.location_id]?.name || l.location_id?.slice(0, 8)}</span>
                <button style={btnDanger} onClick={() => handleRemoveLocation(l.id)} title="Remove">×</button>
              </div>
            ))}

            {addingLocation ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                <select value={newLocationId} onChange={e => setNewLocationId(e.target.value)} style={{ ...inputSm, flex: 1 }}>
                  <option value="">Select location…</option>
                  {locationItems.filter(i => !locations.some(l => l.location_id === i.id)).map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <button style={btnPrimary} onClick={handleAddLocation}>Add</button>
                <button style={btnOutline} onClick={() => { setAddingLocation(false); setNewLocationId(''); }}>Cancel</button>
              </div>
            ) : (
              <button style={{ ...btnOutline, marginTop: 6 }} onClick={() => setAddingLocation(true)}>+ Add Location</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 1 COMPONENT DEFINITION & STATE ────────────────────────────────────────
export default function Modal_Detail_Item({
  isOpen,
  onClose,
  item,
  itemType = 'product',
  mode = 'sales',
  onAddToCart,
  onUpdateInventory,
  onDelete,
  canDelete = false,
  cartQuantity = 0,
  existingSkus = []
}) {
  const [quantity, setQuantity] = useState(1);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [addImageMode, setAddImageMode] = useState(null); // null | 'url' | 'camera'
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [imageError, setImageError] = useState('');
  const [editingImageId, setEditingImageId] = useState(null);
  const [editingImageUrl, setEditingImageUrl] = useState('');
  // Feature-derived values (updated by FeatureSection callbacks)
  const [featureStock, setFeatureStock] = useState(null);       // total qty from features, or null
  const [featuresPriceRange, setFeaturesPriceRange] = useState(null); // { min, max } or null
  const [salesPriceRange, setSalesPriceRange] = useState(null); // { min, max } or null — sales mode only
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: 0,
    description: '',
    quantity: 0,
    min_stock_level: 10,
    location: '',
    image_url: '',
    type: 'PRODUCT'
  });

  const upperType = (itemType || item?.type || 'product').toUpperCase();
  const isService = upperType === 'SERVICE';
  const isAsset = upperType === 'ASSET';
  const isLocation = upperType === 'LOCATION';
  const isResource = upperType === 'RESOURCE';
  const hasLegacyImage = formData.image_url;
  const hasImages = images.length > 0;
  const currentImage = hasImages ? images[currentImageIndex] : null;
  const displayImage = currentImage ? getImageSrc(currentImage) : (hasLegacyImage ? formData.image_url : null);
  const inCart = cartQuantity > 0;
  const isSalesMode = mode === 'sales';

  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        name: item.name || '',
        sku: item.sku || '',
        price: item.price || 0,
        description: item.description || '',
        quantity: item.quantity || 0,
        min_stock_level: item.min_stock_level || 10,
        location: item.location || '',
        image_url: item.image_url || '',
        type: item.type || 'PRODUCT'
      });
      if (isSalesMode) {
        setQuantity(cartQuantity > 0 ? cartQuantity : 1);
      }
      // Reset feature-derived state for fresh load
      setFeatureStock(null);
      setFeaturesPriceRange(null);
      setSalesPriceRange(null);

      // In sales mode, fetch feature price range for this item
      if (isSalesMode) {
        inventoryFeaturesAPI.get(item.id).then(res => {
          const features = res?.data ?? res;
          if (!Array.isArray(features)) return;
          const active = features.find(f => f.affects_price);
          if (!active) return;
          const prices = active.options
            .filter(o => o.is_enabled && o.price != null)
            .map(o => parseFloat(o.price));
          if (prices.length) {
            setSalesPriceRange({ min: Math.min(...prices), max: Math.max(...prices) });
          }
        }).catch(() => {});
      }

      // Load images for this inventory item
      loadImages(item.id);

      // Load available locations from cache (no API call)
      setAvailableLocations(cacheService.getLocations());
    }
  }, [isOpen, item?.id, cartQuantity, isSalesMode]);

  // ─── 2 DATA LOADERS ───────────────────────────────────────────────────────
  const loadImages = async (inventoryId) => {
    try {
      const response = await inventoryAPI.getImages(inventoryId);
      const imageList = response.data || [];
      setImages(imageList);
      setCurrentImageIndex(0);
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]);
    }
  };


  // ─── 3 FORM & SKU HANDLERS ────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const nextValue = type === 'number' ? (parseFloat(value) || 0) : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    if (name === 'sku' && scanError) {
      setScanError(isDuplicateSku(nextValue) ? scanError : '');
    }
  };

  const handleOpenScanner = () => {
    if (isSalesMode) return;
    setIsScannerOpen(true);
  };

  const isDuplicateSku = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;
    const currentSku = String(item?.sku || '').trim().toLowerCase();
    return normalized !== currentSku && existingSkus.some(sku => String(sku || '').trim().toLowerCase() === normalized);
  };

  const handleBarcodeDetected = (code) => {
    const scanned = String(code || '').trim();
    if (!scanned) {
      setScanError('No barcode detected. Please try again.');
      return;
    }
    if (isDuplicateSku(scanned)) {
      setScanError(`Item with SKU "${scanned}" already exists.`);
      return;
    }
    setScanError('');
    setFormData(prev => ({ ...prev, sku: scanned }));
    setIsScannerOpen(false);
  };

  // ─── 4 IMAGE MANAGEMENT HANDLERS ──────────────────────────────────────────
  const handleAddImageUrl = async () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setImageError('');
    try {
      await inventoryAPI.addImageUrl(item.id, { image_url: url, is_primary: images.length === 0 });
      setNewImageUrl('');
      setAddImageMode(null);
      await loadImages(item.id);
    } catch {
      setImageError('Failed to add image URL.');
    }
  };

  const handlePhotoCapture = async (blob) => {
    setIsCameraOpen(false);
    setAddImageMode(null);
    setImageError('');
    try {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await inventoryAPI.uploadImageFile(item.id, file, images.length === 0);
      await loadImages(item.id);
    } catch {
      setImageError('Failed to upload photo.');
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    setImageError('');
    try {
      await inventoryAPI.deleteImage(imageId);
      if (editingImageId === imageId) { setEditingImageId(null); setEditingImageUrl(''); }
      setCurrentImageIndex(prev => Math.max(0, prev - 1));
      await loadImages(item.id);
    } catch {
      setImageError('Failed to delete image.');
    }
  };

  const handleSaveEditImageUrl = async () => {
    const url = editingImageUrl.trim();
    if (!url) return;
    setImageError('');
    try {
      await inventoryAPI.updateImage(editingImageId, { image_url: url });
      setEditingImageId(null);
      setEditingImageUrl('');
      await loadImages(item.id);
    } catch {
      setImageError('Failed to update image URL.');
    }
  };

  // ─── 5 CART & INVENTORY ACTION HANDLERS ───────────────────────────────────
  const handleAddToCart = () => {
    onAddToCart?.(item, itemType, quantity);
    onClose();
  };

  const handleUpdateInventory = (e) => {
    e.preventDefault();
    if (isDuplicateSku(formData.sku)) {
      setScanError(`Item with SKU "${formData.sku}" already exists.`);
      return;
    }
    onUpdateInventory?.(item.id, {
      name: formData.name,
      sku: formData.sku,
      // When features manage price, preserve the existing fixed price (don't override with range)
      price: parseFloat(formData.price) || 0,
      description: formData.description,
      // When features manage stock, use the feature-computed total
      quantity: featureStock != null ? featureStock : parseInt(formData.quantity) || 0,
      min_stock_level: parseInt(formData.min_stock_level) || 10,
      location: formData.location,
      image_url: formData.image_url,
      type: formData.type
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      onDelete?.(item.id);
      onClose();
    }
  };

  // ─── 6 DISPLAY HELPERS ────────────────────────────────────────────────────
  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

  const getTypeIcon = () => {
    if (isService) return <SparklesIcon className="h-16 w-16" />;
    if (isAsset) return <WrenchScrewdriverIcon className="h-16 w-16" />;
    if (isLocation) return <BuildingOfficeIcon className="h-16 w-16" />;
    if (isResource) return <CubeIcon className="h-16 w-16" />;
    return <CubeIcon className="h-16 w-16" />;
  };

  // When features are managing stock, use the feature-derived total; else use form value
  const effectiveStock = featureStock ?? formData.quantity;
  const isLowStock = effectiveStock <= formData.min_stock_level;

  // Reusable image display with navigation
  const renderImage = (containerStyle = {}) => (
    <div className="position-relative" style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--bs-secondary-bg)', ...containerStyle }}>
      {displayImage ? (
        <img
          src={displayImage}
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
          display: displayImage ? 'none' : 'flex',
          width: '100%', height: '100%',
          alignItems: 'center', justifyContent: 'center',
          color: '#adb5bd', position: 'absolute', top: 0, left: 0
        }}
      >
        {getTypeIcon()}
      </div>

      {hasImages && images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentImageIndex((prev) => prev === 0 ? images.length - 1 : prev - 1)}
            className="position-absolute top-50 start-0 translate-middle-y btn btn-dark btn-sm rounded-circle ms-1"
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentImageIndex((prev) => prev === images.length - 1 ? 0 : prev + 1)}
            className="position-absolute top-50 end-0 translate-middle-y btn btn-dark btn-sm rounded-circle me-1"
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <div className="position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white px-2 py-1" style={{ fontSize: '0.7rem', borderTopLeftRadius: '4px' }}>
            {currentImageIndex + 1} / {images.length}
          </div>
        </>
      )}

      {hasLegacyImage && !hasImages && (
        <div className="position-absolute bottom-0 start-0 bg-warning bg-opacity-75 text-dark px-2 py-1" style={{ fontSize: '0.65rem', borderTopRightRadius: '4px' }}>
          Legacy
        </div>
      )}

      {currentImage && currentImage.is_primary && (
        <div className="position-absolute top-0 start-0 bg-primary text-white px-2 py-1" style={{ fontSize: '0.65rem', borderBottomRightRadius: '4px' }}>
          Primary
        </div>
      )}
    </div>
  );

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* ─── 7 INVENTORY MODE HEADER ─────────────────────────────────────── */}
      {/* Header for Inventory Mode - Fixed at top */}
      {!isSalesMode && (
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Edit Item</h6>
           
        </div>
      )}

      {/* Sales Mode: Full-width image header */}
      {isSalesMode && (
        <div className="flex-shrink-0 position-relative">
          <div className="square-image-container">
            {displayImage ? (
              <img
                src={displayImage}
                alt={formData.name}
                className="square-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="square-image-placeholder"
              style={{ display: displayImage ? 'none' : 'flex' }}
            >
              {getTypeIcon()}
            </div>
          </div>

          {hasImages && images.length > 1 && (
            <>
              <button
                onClick={() => setCurrentImageIndex((prev) => prev === 0 ? images.length - 1 : prev - 1)}
                className="position-absolute top-50 start-0 translate-middle-y btn btn-dark btn-sm rounded-circle ms-2"
                style={{ width: '32px', height: '32px' }}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentImageIndex((prev) => prev === images.length - 1 ? 0 : prev + 1)}
                className="position-absolute top-50 end-0 translate-middle-y btn btn-dark btn-sm rounded-circle me-2"
                style={{ width: '32px', height: '32px' }}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              <div className="position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white px-2 py-1 rounded-top-start">
                {currentImageIndex + 1} / {images.length}
              </div>
            </>
          )}

          {!isLocation && !isAsset && (
            <span className={`badge position-absolute bottom-0 end-0 m-3 ${isLowStock ? 'bg-danger' : 'bg-success'}`}>
              {formData.quantity} in stock {isLowStock && '(Low)'}
            </span>
          )}
        </div>
      )}

      {/* Container_Scrollable Content Area */}
      <div className="overflow-auto px-3 pt-3 no-scrollbar bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ flexGrow: 1 }}>
        {isSalesMode ? (
          /* Sales Mode - Display only */
          <div>
            <h4 className="fw-bold mb-2">{item.name}</h4>
            <div className="fs-4 fw-bold text-primary mb-3">
              {salesPriceRange
                ? salesPriceRange.min === salesPriceRange.max
                  ? `$${salesPriceRange.min.toFixed(2)}`
                  : `From $${salesPriceRange.min.toFixed(2)} to $${salesPriceRange.max.toFixed(2)}`
                : `$${item.price?.toFixed(2)}`}
            </div>

            {item.description && (
              <p className="text-muted mb-3">{item.description}</p>
            )}

            <div className="d-flex gap-2 text-muted small mb-4">
              {item.sku && (
                <span className="d-flex align-items-center gap-1">
                  <TagIcon className="h-4 w-4" /> {item.sku}
                </span>
              )}
              {item.location && (
                <span className="d-flex align-items-center gap-1">
                  <MapPinIcon className="h-4 w-4" /> {item.location}
                </span>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <span className="fw-medium">Quantity</span>
                {inCart && (
                  <div className="small text-muted">{cartQuantity} already in cart</div>
                )}
              </div>
              <div className="d-flex align-items-center gap-3">
                <button
                  onClick={decrementQuantity}
                  disabled={quantity <= 1}
                  className="btn btn-outline-secondary rounded-circle p-0"
                  style={{ width: '44px', height: '44px' }}
                >
                  <MinusIcon className="h-5 w-5" style={{ margin: 'auto', display: 'block' }} />
                </button>
                <span className="fs-4 fw-semibold" style={{ minWidth: '50px', textAlign: 'center' }}>
                  {quantity}
                </span>
                <button
                  onClick={incrementQuantity}
                  className="btn btn-outline-secondary rounded-circle p-0"
                  style={{ width: '44px', height: '44px' }}
                >
                  <PlusIcon className="h-5 w-5" style={{ margin: 'auto', display: 'block' }} />
                </button>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div>
                <small className="text-muted">Total</small>
                <div className="fs-3 fw-bold text-primary">
                  {salesPriceRange && salesPriceRange.min !== salesPriceRange.max
                    ? `$${(salesPriceRange.min * quantity).toFixed(2)}–$${(salesPriceRange.max * quantity).toFixed(2)}`
                    : `$${((salesPriceRange?.min ?? item.price) * quantity).toFixed(2)}`}
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className={`btn flex-grow-1 d-flex align-items-center justify-content-center gap-2 ${inCart ? 'btn-secondary' : 'btn-primary'}`}
              >
                <ShoppingCartIcon className="h-5 w-5" />
                {inCart ? `Update (${cartQuantity} → ${quantity})` : `Add ${quantity} to Cart`}
              </button>
            </div>
          </div>
        ) : (
          /* Inventory Mode - Image + Stock fields at top, form fields below */
          <>
          <form onSubmit={handleUpdateInventory}>
            {/* Top Section: Image (left) + Stock fields (right) */}
            <div className="d-flex gap-3 mb-3" style={{ minHeight: '200px' }}>
              {/* Image */}
              <div className="flex-shrink-0" style={{ width: '45%' }}>
                {renderImage({ width: '100%', aspectRatio: '1' })}
              {/* Add image panel */}
              {addImageMode !== null && (
                <div className="mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className={`btn ${addImageMode === 'camera' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setAddImageMode('camera')}
                        style={{ fontSize: '0.72rem', padding: '2px 10px' }}
                      >Camera</button>
                      <button
                        type="button"
                        className={`btn ${addImageMode === 'url' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setAddImageMode('url')}
                        style={{ fontSize: '0.72rem', padding: '2px 10px' }}
                      >URL</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAddImageMode(null); setNewImageUrl(''); setImageError(''); }}
                      className="btn btn-link btn-sm p-0 ms-auto"
                      style={{ fontSize: '0.75rem', color: '#6c757d', lineHeight: 1 }}
                    >✕</button>
                  </div>

                  {addImageMode === 'camera' && (
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                      </svg>
                      Open Camera
                    </button>
                  )}

                  {addImageMode === 'url' && (
                    <div className="d-flex gap-1">
                      <input
                        type="url"
                        value={newImageUrl}
                        onChange={e => setNewImageUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddImageUrl()}
                        placeholder="https://..."
                        className="form-control form-control-sm"
                        style={{ fontSize: '0.8rem' }}
                      />
                      <button type="button" onClick={handleAddImageUrl} className="btn btn-primary btn-sm flex-shrink-0">Add</button>
                    </div>
                  )}

                  {imageError && (
                    <div className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>{imageError}</div>
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
                        value={featureStock != null ? featureStock : formData.quantity}
                        onChange={handleChange}
                        className="form-control form-control-sm"
                        placeholder="Current Count"
                        min="0"
                        disabled={featureStock != null}
                        title={featureStock != null ? 'Stock is managed by features below' : ''}
                      />
                      <label htmlFor="quantity">
                        {featureStock != null ? 'Stock (from features)' : 'Current Count'}
                      </label>
                    </div>

                                <div className="mb-2">
              <div className="input-group">
                 <div className="form-floating">
                  <input
                    type="number"
                    id="detail_price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="Price"
                    step="0.01"
                    min="0"
                  />
                  <label htmlFor="detail_price">Price</label>
                </div>
              </div>
              {featuresPriceRange && (
                <div className="mt-1 small text-primary fw-semibold">
                  {featuresPriceRange.min === featuresPriceRange.max
                    ? `Feature price: $${featuresPriceRange.min.toFixed(2)}`
                    : `From $${featuresPriceRange.min.toFixed(2)} to $${featuresPriceRange.max.toFixed(2)}`
                  }
                </div>
              )}
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

            {/* Photo management strip */}
            <div className="mb-2">
              <div className="d-flex align-items-center gap-1 flex-wrap" style={{ minHeight: '44px' }}>
                {images.map((img, idx) => (
                  <div key={img.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={getImageSrc(img)}
                      alt=""
                      style={{
                        width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px',
                        cursor: 'pointer',
                        border: editingImageId === img.id
                          ? '2px solid var(--bs-warning)'
                          : idx === currentImageIndex
                            ? '2px solid var(--bs-primary)'
                            : '2px solid #dee2e6'
                      }}
                      onClick={() => setCurrentImageIndex(idx)}
                    />
                    {/* Delete button — top right */}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      style={{
                        position: 'absolute', top: '-5px', right: '-5px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#dc3545', color: '#fff', border: 'none',
                        padding: 0, fontSize: '10px', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >×</button>
                    {/* Edit URL button — bottom left (only for URL-based images) */}
                    {img.image_url && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddImageMode(null);
                          if (editingImageId === img.id) {
                            setEditingImageId(null);
                            setEditingImageUrl('');
                          } else {
                            setEditingImageId(img.id);
                            setEditingImageUrl(img.image_url);
                          }
                        }}
                        title="Edit image URL"
                        style={{
                          position: 'absolute', bottom: '-5px', left: '-5px',
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: editingImageId === img.id ? '#ffc107' : '#6c757d',
                          color: '#fff', border: 'none',
                          padding: 0, fontSize: '9px', lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >✎</button>
                    )}
                  </div>
                ))}

                {/* Add photo button */}
                {addImageMode === null && (
                  <button
                    type="button"
                    onClick={() => setAddImageMode('camera')}
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', borderRadius: '4px' }}
                    title="Add photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                      <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                    </svg>
                  </button>
                )}
              </div>



              {/* Edit existing image URL panel */}
              {editingImageId !== null && (
                <div className="mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Edit Image URL</span>
                    <button
                      type="button"
                      onClick={() => { setEditingImageId(null); setEditingImageUrl(''); setImageError(''); }}
                      className="btn btn-link btn-sm p-0 ms-auto"
                      style={{ fontSize: '0.75rem', color: '#6c757d', lineHeight: 1 }}
                    >✕</button>
                  </div>
                  <div className="d-flex gap-1">
                    <input
                      type="url"
                      value={editingImageUrl}
                      onChange={e => setEditingImageUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEditImageUrl()}
                      placeholder="https://..."
                      className="form-control form-control-sm"
                      style={{ fontSize: '0.8rem' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEditImageUrl}
                      className="btn btn-warning btn-sm flex-shrink-0"
                    >
                      Save
                    </button>
                  </div>
                  {imageError && (
                    <div className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>{imageError}</div>
                  )}
                </div>
              )}

              {imageError && addImageMode === null && editingImageId === null && (
                <div className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>{imageError}</div>
              )}
            </div>

            {/* Full-width form fields below */}
            <div className="form-floating mb-2">
              <input
                type="text"
                id="detail_name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control form-control-sm"
                placeholder="Name"
                required
              />
              <label htmlFor="detail_name">Name *</label>
            </div>



            <div className="form-floating mb-2">
              <select
                id="detail_type"
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
              <label htmlFor="detail_type">Type</label>
            </div>



            <div className="mb-2">
              <div className="form-floating position-relative">
                <input
                  type="text"
                  id="detail_sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="SKU"
                  style={!isSalesMode ? { paddingRight: '3.25rem' } : undefined}
                />
                <label htmlFor="detail_sku">SKU</label>
                {!isSalesMode && (
                  <button
                    type="button"
                    onClick={handleOpenScanner}
                    className="btn btn-link btn-sm p-0 m-0 position-absolute top-50 translate-middle-y"
                    style={{ right: '0.5rem' }}
                    title="Scan Barcode"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                      <path d="M3 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
                    </svg>
                  </button>
                )}
              </div>
              {scanError && (
                <div className="alert alert-danger py-1 small mt-2 mb-0">{scanError}</div>
              )}
            </div>

            <div className="form-floating mb-2">
              <select
                id="detail_location"
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
              <label htmlFor="detail_location">Location</label>
            </div>

            {/* Supplier (read-only display) */}
            <div className="form-floating mb-2">
              <input
                type="text"
                id="detail_supplier"
                readOnly
                value={item?.supplier_name || '— None —'}
                className="form-control form-control-sm bg-transparent border-0 text-muted"
                placeholder="Supplier"
              />
              <label htmlFor="detail_supplier">Supplier</label>
            </div>

            {formData.location === '[NEW]' && (
              <div className="form-floating mb-2">
                <input
                  type="text"
                  id="detail_new_location"
                  name="location"
                  value=""
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, location: e.target.value }));
                  }}
                  className="form-control form-control-sm"
                  placeholder="Enter new location"
                />
                <label htmlFor="detail_new_location">New Location</label>
              </div>
            )}

          </form>

          {/* Descriptive Features — PRODUCT and ITEM types only, shown after item is saved */}
          {item?.id && !isResource && !isAsset && !isLocation && !isService && (
            <FeatureSection
              inventoryId={item.id}
              onStockChange={setFeatureStock}
              onPriceRangeChange={setFeaturesPriceRange}
            />
          )}

          {/* Production Setup — PRODUCT type only */}
          {item?.id && upperType === 'PRODUCT' && (
            <ProductionRelationsPanel productId={item.id} />
          )}

          <hr className="my-2" />
          <div className="form-floating mb-2 border-0">
            <textarea
              id="detail_description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="form-control form-control-sm border-0"
              placeholder="Description"
              style={{ height: '120px' }}
            />
            <label htmlFor="detail_description">Description</label>
          </div>
          </>
        )}
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {!isSalesMode ? (
          <div className="d-flex align-items-center">
            <div>
              {canDelete && (
                <Button_Toolbar
                  icon={TrashIcon}
                  label="Delete Item"
                  onClick={handleDelete}
                  className="btn-outline-danger"
                />
              )}
            </div>
            <div className="flex-grow-1 d-flex gap-3 justify-content-center align-items-center">
              <Button_Toolbar
                icon={XMarkIcon}
                label="Cancel"
                onClick={onClose}
                className="btn-outline-secondary"
              />
              <Button_Toolbar
                icon={CheckIcon}
                label="Save Changes"
                onClick={handleUpdateInventory}
                className="btn-primary"
              />
            </div>
                {/* Right spacer to balance delete */}
          <div style={{ width: 40 }} />
          </div>
        ) : null}
      </div>
      </div>

      <Modal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} title="Scan Barcode" centered={true}>
        <Scanner_Barcode
          onDetected={handleBarcodeDetected}
          onCancel={() => setIsScannerOpen(false)}
        />
      </Modal>

      {isCameraOpen && (
        <Widget_Camera
          onCapture={handlePhotoCapture}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}
    </Modal>
  );
}
