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

  // Reusable image display with navigation
  const renderImage = (containerStyle = {}) => (
    <div className="position-relative" style={{ borderRadius: '8px', overflow: 'hidden', background: '#f0f0f0', ...containerStyle }}>
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

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
    >
      <div className="d-flex flex-column bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ maxHeight: '100%' }}>

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
                  ${(item.price * quantity).toFixed(2)}
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
          <form onSubmit={handleUpdateInventory}>
            {/* Top Section: Image (left) + Stock fields (right) */}
            <div className="d-flex gap-3" style={{ minHeight: '200px' }}>
              {/* Image */}
              <div className="flex-shrink-0" style={{ width: '45%' }}>
                {renderImage({ width: '100%', aspectRatio: '1' })}
              </div>

              {/* Stock fields stacked on the right */}
              <div className="flex-grow-1 d-flex flex-column justify-content-center">
                {!isLocation && !isAsset ? (
                  <>
                    <div>
                      <label className="form-label fw-medium small mb-0">Max Count</label>
                      <input
                        type="number"
                        name="min_stock_level"
                        value={formData.min_stock_level}
                        onChange={handleChange}
                        className="form-control form-control-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label fw-medium small mb-0">Min Count</label>
                      <input
                        type="number"
                        readOnly
                        value={0}
                        className="form-control form-control-sm bg-light dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label fw-medium small mb-0">Current Count</label>
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        className="form-control form-control-sm"
                        min="0"
                      />
                    </div>
                    <div>
                       <div className={`text-center py-1 rounded fw-medium small ${isLowStock ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                        {isLowStock ? 'Low Stock' : 'In Stock'}
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
            <div className="mb-1">
              <label className="form-label fw-medium mb-0">Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>

            <div className="mb-1">
              <label className="form-label fw-medium mb-0">Price</label>
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

            <div className="mb-1">
              <label className="form-label fw-medium mb-0  ">Type</label>
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

            <div className="mb-1">
              <label className="form-label fw-medium mb-0">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control"
                rows="3"
              />
            </div>

            <div className="mb-1">
              <label className="form-label fw-medium mb-0">SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="mb-1">
              <label className="form-label fw-medium mb-0">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g., Warehouse A, Shelf 3"
              />
            </div>

            <div className="mb-1">
              <label className="form-label fw-medium mb-0">Image URL</label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                className="form-control"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </form>
        )}
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className="flex-shrink-0 p-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
