import React from 'react';
import { 
  XMarkIcon, ShoppingCartIcon, ClockIcon, TagIcon,
  SparklesIcon, CubeIcon, PlusIcon, MinusIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

/**
 * ProductDetailModal - A reusable modal for displaying product/service details
 * Opens when a card is selected, allows adding to cart with quantity selection
 */
export default function ProductDetailModal({ 
  isOpen, 
  onClose, 
  item, 
  itemType = 'product',
  onAddToCart,
  cartQuantity = 0 
}) {
  const [quantity, setQuantity] = React.useState(1);
  const isService = itemType === 'service';
  const hasImage = item?.image_url;
  const inCart = cartQuantity > 0;

  // Reset quantity when modal opens with new item
  React.useEffect(() => {
    if (isOpen) {
      setQuantity(cartQuantity > 0 ? cartQuantity : 1);
    }
  }, [isOpen, item?.id, cartQuantity]);

  if (!isOpen || !item) return null;

  const handleAddToCart = () => {
    onAddToCart(item, itemType, quantity);
    onClose();
  };

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

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
        <div className={`relative h-56 w-full ${hasImage ? '' : 'bg-gradient-to-br'} ${
          isService 
            ? 'from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800' 
            : 'from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800'
        }`}>
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
              {isService ? (
                <SparklesIcon className="h-24 w-24 text-primary-400 dark:text-primary-500 opacity-50" />
              ) : (
                <CubeIcon className="h-24 w-24 text-emerald-400 dark:text-emerald-500 opacity-50" />
              )}
            </div>
          )}
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
          
          {/* Type Badge */}
          <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${
            isService 
              ? 'bg-primary-500 text-white' 
              : 'bg-emerald-500 text-white'
          }`}>
            {isService ? 'Service' : 'Product'}
          </div>
          
          {/* In Cart Badge */}
          {inCart && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-sm font-medium">
              <CheckCircleSolid className="h-4 w-4" />
              {cartQuantity} in cart
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
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
                {item.category && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs">
                    {item.category}
                  </span>
                )}
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              isService ? 'text-primary-600 dark:text-primary-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              ${item.price?.toFixed(2)}
            </div>
          </div>
          
          {/* Description */}
          {item.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
              {item.description}
            </p>
          )}
          
          {/* Quantity Selector */}
          <div className="flex items-center justify-between mb-6">
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
              <p className={`text-2xl font-bold ${
                isService ? 'text-primary-600 dark:text-primary-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                ${(item.price * quantity).toFixed(2)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                isService 
                  ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20' 
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <ShoppingCartIcon className="h-5 w-5" />
              {inCart ? 'Update Cart' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
