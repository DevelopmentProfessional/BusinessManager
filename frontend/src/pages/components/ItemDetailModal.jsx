import React, { useState, useEffect } from 'react';
import {
  XMarkIcon, ShoppingCartIcon, ClockIcon, TagIcon,
  SparklesIcon, CubeIcon, PlusIcon, MinusIcon,
  MapPinIcon, WrenchScrewdriverIcon, BuildingOfficeIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

/**
 * ItemDetailModal - Unified modal for viewing/editing items
 * Used by both Sales (Add to Cart) and Inventory (Update Stock) pages
 * 
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Close handler
 * @param {object} item - The item to display
 * @param {string} itemType - 'service', 'product', 'asset', 'location', 'resource', 'item'
 * @param {string} mode - 'sales' for POS (Add to Cart) or 'inventory' for stock management
 * @param {function} onAddToCart - Handler for adding to cart (sales mode)
 * @param {function} onUpdateInventory - Handler for updating inventory (inventory mode)
 * @param {number} cartQuantity - Current quantity in cart (sales mode)
 */
export default function ItemDetailModal({
  isOpen,
  onClose,
  item,
  itemType = 'product',
  mode = 'sales', // 'sales' or 'inventory'
  onAddToCart,
  onUpdateInventory,
  onDelete,
  canDelete = false,
  cartQuantity = 0
}) {
  const [quantity, setQuantity] = useState(1);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [minStockLevel, setMinStockLevel] = useState(10);
  
  const upperType = (itemType || item?.type || 'product').toUpperCase();
  const isService = upperType === 'SERVICE';
  const isAsset = upperType === 'ASSET';
  const isLocation = upperType === 'LOCATION';
  const isResource = upperType === 'RESOURCE';
  const hasImage = item?.image_url;
  const inCart = cartQuantity > 0;
  const isSalesMode = mode === 'sales';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && item) {
      if (isSalesMode) {
        setQuantity(cartQuantity > 0 ? cartQuantity : 1);
      } else {
        setStockQuantity(item.quantity || 0);
        setMinStockLevel(item.min_stock_level || 10);
      }
    }
  }, [isOpen, item?.id, cartQuantity, isSalesMode]);

  if (!isOpen || !item) return null;

  const handleAddToCart = () => {
    onAddToCart?.(item, itemType, quantity);
    onClose();
  };

  const handleUpdateInventory = (e) => {
    e.preventDefault();
    onUpdateInventory?.(item.id, {
      quantity: parseInt(stockQuantity),
      min_stock_level: parseInt(minStockLevel)
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

  // Get type-specific colors
  const getTypeColors = () => {
    if (isService) return {
      gradient: 'from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800',
      badge: 'bg-primary-500 text-white',
      icon: 'text-primary-400 dark:text-primary-500',
      price: 'text-primary-600 dark:text-primary-400',
      button: 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20',
      iconComponent: SparklesIcon
    };
    if (isAsset) return {
      gradient: 'from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800',
      badge: 'bg-purple-500 text-white',
      icon: 'text-purple-400 dark:text-purple-500',
      price: 'text-purple-600 dark:text-purple-400',
      button: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20',
      iconComponent: WrenchScrewdriverIcon
    };
    if (isLocation) return {
      gradient: 'from-teal-100 to-teal-200 dark:from-teal-900 dark:to-teal-800',
      badge: 'bg-teal-500 text-white',
      icon: 'text-teal-400 dark:text-teal-500',
      price: 'text-teal-600 dark:text-teal-400',
      button: 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20',
      iconComponent: BuildingOfficeIcon
    };
    if (isResource) return {
      gradient: 'from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800',
      badge: 'bg-blue-500 text-white',
      icon: 'text-blue-400 dark:text-blue-500',
      price: 'text-blue-600 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
      iconComponent: CubeIcon
    };
    return {
      gradient: 'from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800',
      badge: 'bg-emerald-500 text-white',
      icon: 'text-emerald-400 dark:text-emerald-500',
      price: 'text-emerald-600 dark:text-emerald-400',
      button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
      iconComponent: CubeIcon
    };
  };

  const colors = getTypeColors();
  const TypeIcon = colors.iconComponent;

  const getTypeLabel = () => {
    const labels = { 
      SERVICE: 'Service', PRODUCT: 'Product', ASSET: 'Asset', 
      LOCATION: 'Location', RESOURCE: 'Resource', ITEM: 'Item' 
    };
    return labels[upperType] || 'Product';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Header */}
        <div className={`relative h-56 w-full ${hasImage ? '' : `bg-gradient-to-br ${colors.gradient}`}`}>
          {hasImage ? (
            <img 
              src={item.image_url} 
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <TypeIcon className={`h-24 w-24 ${colors.icon} opacity-50`} />
            </div>
          )}
          
          {/* Gradient overlay for images */}
          {hasImage && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          )}
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
          
          {/* Type Badge */}
          <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}>
            {getTypeLabel()}
          </div>
          
          {/* In Cart Badge (Sales mode only) */}
          {isSalesMode && inCart && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-sm font-medium">
              <CheckCircleSolid className="h-4 w-4" />
              {cartQuantity} in cart
            </div>
          )}
          
          {/* Stock Badge (Inventory mode only) */}
          {!isSalesMode && (
            <div className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              (isLocation || isAsset) 
                ? 'bg-green-500 text-white' 
                : item.quantity <= item.min_stock_level 
                  ? 'bg-red-500 text-white' 
                  : 'bg-green-500 text-white'
            }`}>
              {(isLocation || isAsset) ? 'OK' : `${item.quantity} in stock`}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-5">
          {/* Title & Price */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {item.name}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                {isService && item.duration_minutes && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    {item.duration_minutes} min
                  </span>
                )}
                {!isService && item.sku && (
                  <span className="flex items-center gap-1">
                    <TagIcon className="h-4 w-4" />
                    {item.sku}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" />
                    {item.location}
                  </span>
                )}
                {item.category && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs">
                    {item.category}
                  </span>
                )}
              </div>
            </div>
            {item.price > 0 && (
              <div className={`text-2xl font-bold ${colors.price}`}>
                ${item.price?.toFixed(2)}
              </div>
            )}
          </div>
          
          {/* Description */}
          {item.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
              {item.description}
            </p>
          )}
          
          {/* Sales Mode: Quantity Selector & Add to Cart */}
          {isSalesMode && (
            <>
              {/* Quantity Selector */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MinusIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900 dark:text-white">
                    {quantity}
                  </span>
                  <button 
                    onClick={incrementQuantity}
                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
                  >
                    <PlusIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>
              
              {/* Total & Add Button */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total</p>
                  <p className={`text-2xl font-bold ${colors.price}`}>
                    ${(item.price * quantity).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handleAddToCart}
                  className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${colors.button}`}
                >
                  <ShoppingCartIcon className="h-5 w-5" />
                  {inCart ? 'Update Cart' : 'Add to Cart'}
                </button>
              </div>
            </>
          )}
          
          {/* Inventory Mode: Stock Management */}
          {!isSalesMode && (
            <form onSubmit={handleUpdateInventory} className="space-y-4">
              {/* Only show quantity fields for non-location/asset items */}
              {!isLocation && !isAsset && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Minimum Stock Level
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minStockLevel}
                      onChange={(e) => setMinStockLevel(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
              
              {/* For locations/assets, just show a simple status */}
              {(isLocation || isAsset) && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                    <CheckCircleSolid className="h-5 w-5" />
                    <span className="font-medium">Status: OK</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {isLocation ? 'Locations' : 'Assets'} do not track stock levels
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="py-3 px-4 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors flex items-center gap-2"
                    title="Delete Item"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                {!isLocation && !isAsset && (
                  <button
                    type="submit"
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all ${colors.button}`}
                  >
                    Update Inventory
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
