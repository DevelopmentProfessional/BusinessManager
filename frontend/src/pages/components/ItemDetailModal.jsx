import React, { useState, useEffect } from 'react';
import {
  XMarkIcon, ShoppingCartIcon, TagIcon,
  SparklesIcon, CubeIcon, PlusIcon, MinusIcon,
  MapPinIcon, WrenchScrewdriverIcon, BuildingOfficeIcon,
  TrashIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { inventoryAPI } from '../../services/api';
import { getImageSrc } from './imageUtils';

/**
 * ItemDetailModal - Full screen modal for viewing/editing items
 */
export default function ItemDetailModal({
  isOpen,
  onClose,
  item,
  itemType = 'product',
  mode = 'sales',
  onAddToCart,
  onUpdateInventory,
  onDelete,
  canDelete = false,
  cartQuantity = 0
}) {
  const [quantity, setQuantity] = useState(1);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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
      
      // Load images for this inventory item
      loadImages(item.id);
    }
  }, [isOpen, item?.id, cartQuantity, isSalesMode]);

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

  if (!isOpen || !item) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseFloat(value) || 0) : value
    }));
  };

  const handleAddToCart = () => {
    onAddToCart?.(item, itemType, quantity);
    onClose();
  };

  const handleUpdateInventory = (e) => {
    e.preventDefault();
    onUpdateInventory?.(item.id, {
      name: formData.name,
      sku: formData.sku,
      price: parseFloat(formData.price) || 0,
      description: formData.description,
      quantity: parseInt(formData.quantity) || 0,
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

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

  const getTypeIcon = () => {
    if (isService) return <SparklesIcon className="h-16 w-16" />;
    if (isAsset) return <WrenchScrewdriverIcon className="h-16 w-16" />;
    if (isLocation) return <BuildingOfficeIcon className="h-16 w-16" />;
    if (isResource) return <CubeIcon className="h-16 w-16" />;
    return <CubeIcon className="h-16 w-16" />;
  };

  const isLowStock = formData.quantity <= formData.min_stock_level;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
    >
      {/* Modal content wrapper */}
      <div className="d-flex flex-column bg-white" style={{ maxHeight: '100%' }}>
      {/* Header Bar */}
      <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white flex-shrink-0">
        <h5 className="mb-0 fw-bold">
          {isSalesMode ? 'Item Details' : 'Edit Item'}
        </h5>
        <button
          onClick={onClose}
          className="btn btn-outline-secondary btn-sm rounded-circle p-0"
          style={{ width: '36px', height: '36px' }}
        >
          <XMarkIcon className="h-5 w-5" style={{ margin: 'auto', display: 'block' }} />
        </button>
      </div>

      {/* Image Section - Multiple images with navigation */}
      <div className="flex-shrink-0 position-relative">
        <div className="square-image-container">
          {displayImage ? (
            <img
              src={displayImage}
              alt={formData.name}
              className="square-image"
              onError={(e) => { 
                e.target.style.display = 'none';
                // Show placeholder when image fails to load
                const placeholder = e.target.nextElementSibling;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
          ) : null}
          {/* Placeholder/Fallback always present */}
          <div 
            className="square-image-placeholder" 
            style={{ display: displayImage ? 'none' : 'flex' }}
          >
            {getTypeIcon()}
          </div>
        </div>

        {/* Image Navigation Controls */}
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
            {/* Image counter */}
            <div className="position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white px-2 py-1 rounded-top-start">
              {currentImageIndex + 1} / {images.length}
            </div>
          </>
        )}

        {/* Legacy image indicator */}
        {hasLegacyImage && !hasImages && (
          <div className="position-absolute bottom-0 start-0 bg-warning bg-opacity-75 text-dark px-2 py-1 rounded-top-end text-xs">
            Legacy
          </div>
        )}

        {/* Primary image indicator */}
        {currentImage && currentImage.is_primary && (
          <div className="position-absolute top-0 start-0 bg-primary text-white px-2 py-1 rounded-bottom-end text-xs">
            Primary
          </div>
        )}

        {/* Sales Preview Overlay - shows how item appears in sales mode */}
        {!isSalesMode && (
          <div
            className="position-absolute bottom-0 start-0 end-0 p-3"
            style={{
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))'
            }}
          >
            <div className="text-white">
              <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                {formData.name || 'Item Name'}
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-bold" style={{ fontSize: '1.25rem' }}>
                  ${(parseFloat(formData.price) || 0).toFixed(2)}
                </span>
                {!isLocation && !isAsset && (
                  <span className={`badge ${isLowStock ? 'bg-danger' : 'bg-success'}`}>
                    {formData.quantity} in stock
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stock Status Badge - only in sales mode */}
        {isSalesMode && !isLocation && !isAsset && (
          <span className={`badge position-absolute bottom-0 end-0 m-3 ${isLowStock ? 'bg-danger' : 'bg-success'}`}>
            {formData.quantity} in stock {isLowStock && '(Low)'}
          </span>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-grow-1 overflow-auto p-3">
        {isSalesMode ? (
          /* Sales Mode - Display only */
          <div>
            <h4 className="fw-bold mb-2">{item.name}</h4>
            <div className="fs-4 fw-bold text-primary mb-3">${item.price?.toFixed(2)}</div>

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
              <span className="fw-medium">Quantity</span>
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
                  ${(item.price * quantity).toFixed(2)}
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className="btn btn-primary flex-grow-1 py-3 d-flex align-items-center justify-content-center gap-2"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                {inCart ? 'Update Cart' : 'Add to Cart'}
              </button>
            </div>
          </div>
        ) : (
          /* Inventory Mode - Editable Form */
          <form onSubmit={handleUpdateInventory}>
            {/* Name */}
            <div className="mb-3">
              <label className="form-label fw-medium">Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>

            {/* SKU */}
            <div className="mb-3">
              <label className="form-label fw-medium">SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            {/* Price */}
            <div className="mb-3">
              <label className="form-label fw-medium">Price</label>
              <div className="input-group">
                <span className="input-group-text">$</span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="form-control"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Type */}
            <div className="mb-3">
              <label className="form-label fw-medium">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="PRODUCT">Product</option>
                <option value="RESOURCE">Resource</option>
                <option value="ASSET">Asset</option>
                <option value="LOCATION">Location</option>
                <option value="ITEM">Item</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="form-label fw-medium">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control"
                rows="3"
              />
            </div>

            {/* Quantity & Min Stock - only for trackable items */}
            {!isLocation && !isAsset && (
              <>
                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label fw-medium">Quantity</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      className="form-control"
                      min="0"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-medium">Min Stock Level</label>
                    <input
                      type="number"
                      name="min_stock_level"
                      value={formData.min_stock_level}
                      onChange={handleChange}
                      className="form-control"
                      min="0"
                    />
                  </div>
                </div>

                {/* Stock Status */}
                <div className={`alert ${isLowStock ? 'alert-danger' : 'alert-success'} d-flex align-items-center gap-2 mb-3`}>
                  {isLowStock ? (
                    <>
                      <span className="fw-medium">Low Stock Warning</span>
                      <span className="small">Current quantity is at or below minimum level</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleSolid className="h-5 w-5" />
                      <span className="fw-medium">Stock OK</span>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Location */}
            <div className="mb-3">
              <label className="form-label fw-medium">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g., Warehouse A, Shelf 3"
              />
            </div>

            {/* Image URL */}
            <div className="mb-3">
              <label className="form-label fw-medium">Image URL</label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                className="form-control"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Status for locations/assets */}
            {(isLocation || isAsset) && (
              <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
                <CheckCircleSolid className="h-5 w-5" />
                <div>
                  <strong>Status: OK</strong>
                  <div className="small">{isLocation ? 'Locations' : 'Assets'} do not track stock levels</div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className="flex-shrink-0 p-3 border-top bg-white">
        {!isSalesMode ? (
          <div className="d-flex gap-3 justify-content-center align-items-center">
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-outline-danger rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '48px', height: '48px' }}
                title="Delete Item"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px' }}
              title="Cancel"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleUpdateInventory}
              className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '48px', height: '48px' }}
              title="Save Changes"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
