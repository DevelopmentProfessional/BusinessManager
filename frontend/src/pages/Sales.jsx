import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ShoppingCartIcon, XMarkIcon,
  UserIcon, CreditCardIcon, ClockIcon,
  PlusIcon, MinusIcon,
  MagnifyingGlassIcon, SparklesIcon, CubeIcon,
  ChevronDownIcon, ChevronUpIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { servicesAPI, clientsAPI, inventoryAPI } from '../services/api';
import PermissionGate from './components/PermissionGate';
import ItemDetailModal from './components/ItemDetailModal';
import CheckoutModal from './components/CheckoutModal';
import { getDisplayImageUrl } from './components/imageUtils';

// Unified Product/Service Card Component
const ItemCard = ({ item, itemType, onSelect, inCart, cartQuantity, onIncrement, onDecrement, onAddToCart }) => {
  const isService = itemType === 'service';
  const imageUrl = getDisplayImageUrl(item);
  const hasImage = !!imageUrl;
  
  const handleIncrement = (e) => {
    e.stopPropagation();
    onIncrement(item, itemType);
  };
  
  const handleDecrement = (e) => {
    e.stopPropagation();
    onDecrement(item, itemType);
  };
  
  const handleAddToCart = (e) => {
    e.stopPropagation();
    onAddToCart(item, itemType, 1);
  };
  
  return (
    <div
      onClick={() => onSelect(item, itemType)}
      className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 overflow-hidden hover:shadow-lg cursor-pointer h-48 ${
        inCart 
          ? 'border-secondary-500 ring-2 ring-secondary-200 dark:ring-secondary-800' 
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
      }`}
    >
      {/* Full Card Background Image */}
      <div className={`absolute inset-0 ${hasImage ? '' : 'bg-gradient-to-br'} ${        isService 
          ? 'from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800' 
          : 'from-secondary-100 to-secondary-200 dark:from-secondary-900 dark:to-secondary-800'
      }`}>
        {hasImage ? (
          <div className="w-full h-full">
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                e.target.style.display = 'none';
                // Show fallback when image fails
                const fallback = e.target.parentElement.nextElementSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          </div>
        ) : null}
        {/* Fallback icon - always present but conditionally visible */}
        <div 
          className={`absolute inset-0 flex items-center justify-content center ${
            hasImage ? 'hidden' : 'flex'
          }`}
        >
          {isService ? (
            <SparklesIcon className="h-16 w-16 text-primary-400/50 dark:text-primary-500/50" />
          ) : (
            <CubeIcon className="h-16 w-16 text-secondary-400/50 dark:text-secondary-500/50" />
          )}
        </div>
      </div>
      
      {/* Gradient Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      {/* Item Name - Top Left */}
      <div className="absolute top-2 left-2">
        <div className={`inline-block px-2 py-1 rounded-lg backdrop-blur-sm ${
          isService 
            ? 'bg-primary-600/90' 
            : 'bg-secondary-600/90'
        }`}>
          <h3 className="font-semibold text-white text-sm line-clamp-1">
            {item.name}
          </h3>
        </div>
      </div>
      
      {/* Content Footer - Overlays bottom of image with badge-style backgrounds */}
      <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
        <div className="flex items-center justify-between gap-2">
          {/* Price Badge */}
          <span className={`inline-block px-2 py-0.5 rounded-lg text-sm font-bold text-white backdrop-blur-sm ${
            isService 
              ? 'bg-primary-700/90' 
              : 'bg-secondary-700/90'
          }`}>
            ${item.price?.toFixed(2)}
          </span>
          
          {/* Cart Controls - Bottom Right */}
          <div>
            {inCart ? (
              <div className="flex items-center gap-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full shadow-lg px-1 py-0.5">
                <button
                  onClick={handleDecrement}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900 text-gray-600 dark:text-gray-300 hover:text-red-600 transition-colors"
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-white">
                  {cartQuantity}
                </span>
                <button
                  onClick={handleIncrement}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-secondary-100 dark:hover:bg-secondary-900 text-gray-600 dark:text-gray-300 hover:text-secondary-600 transition-colors"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                className="flex items-center gap-1 px-2 py-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full shadow-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-secondary-500 hover:text-white transition-colors"
              >
                <ShoppingCartIcon className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
    </div>
  );
};

// Cart Item Component
const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const isService = item.itemType === 'service';
  const imageUrl = getDisplayImageUrl(item);

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Mini Image/Icon */}
      <div className={`w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden ${
        isService
          ? 'bg-primary-100 dark:bg-primary-900'
          : 'bg-secondary-100 dark:bg-secondary-900'
      }`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-full h-full flex items-center justify-center ${
            imageUrl ? 'hidden' : 'flex'
          }`}
        >
          {isService ? (
            <SparklesIcon className="h-6 w-6 text-primary-500" />
          ) : (
            <CubeIcon className="h-6 w-6 text-secondary-500" />
          )}
        </div>
      </div>
      
      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.name}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ${item.price?.toFixed(2)} × {item.quantity}
        </p>
      </div>
      
      {/* Quantity Controls */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)}
          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
        >
          <MinusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">{item.quantity}</span>
        <button 
          onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)}
          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
        >
          <PlusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      
      {/* Subtotal & Remove */}
      <div className="text-right">
        <p className="font-semibold text-sm text-gray-900 dark:text-white">
          ${(item.price * item.quantity).toFixed(2)}
        </p>
        <button 
          onClick={() => onRemove(item.cartKey)}
          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default function Sales() {
  const {
    services, setServices,
    loading, setLoading, error, setError, clearError,
    hasPermission, openAddClientModal
  } = useStore();

  // Check permissions at page level
  if (!hasPermission('services', 'read') && 
      !hasPermission('services', 'write') && 
      !hasPermission('services', 'delete') && 
      !hasPermission('services', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  // POS State
  const [showServices, setShowServices] = useState(true);
  const [showProducts, setShowProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClientsLocal] = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [products, setProducts] = useState([]);
  
  // Product Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const hasFetched = useRef(false);

  // Sales History State
  const [salesHistory, setSalesHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('salesHistory');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadServices();
    loadProducts();
  }, []);

  const loadClients = async () => {
    if (clientsLoaded) return; // Already loaded, skip
    try {
      const response = await clientsAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) {
        setClientsLocal(data);
        setClientsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load clients for POS:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await inventoryAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) {
        // Filter to include items that are products (or untyped/legacy 'item' type)
        // Exclude only RESOURCE and ASSET types which are not sellable
        const productItems = data.filter(item => {
          const itemType = (item.type || '').toUpperCase();
          // Include: PRODUCT, empty, 'item' (legacy), or any non-resource/asset
          return itemType !== 'RESOURCE' && itemType !== 'ASSET';
        });
        setProducts(productItems);
      }
    } catch (err) {
      console.error('Failed to load products for POS:', err);
    }
  };

  // Open product detail modal
  const handleSelectItem = (item, itemType) => {
    setSelectedItem(item);
    setSelectedItemType(itemType);
    setShowProductModal(true);
  };

  // POS Functions
  // Use cartKey to distinguish services from products (avoids ID collisions)
  const addToCart = (item, itemType = 'service', quantity = 1) => {
    const cartKey = `${itemType}-${item.id}`;
    const existing = cart.find(c => c.cartKey === cartKey);
    if (existing) {
      setCart(cart.map(c => 
        c.cartKey === cartKey ? { ...c, quantity } : c
      ));
    } else {
      setCart([...cart, { ...item, cartKey, itemType, quantity }]);
    }
  };
  
  // Get quantity of item in cart
  const getCartQuantity = (itemId, itemType) => {
    const cartKey = `${itemType}-${itemId}`;
    const item = cart.find(c => c.cartKey === cartKey);
    return item?.quantity || 0;
  };

  const removeFromCart = (cartKey) => {
    setCart(cart.filter(item => item.cartKey !== cartKey));
  };

  const updateCartQuantity = (cartKey, quantity) => {
    if (quantity <= 0) {
      removeFromCart(cartKey);
    } else {
      setCart(cart.map(item => 
        item.cartKey === cartKey ? { ...item, quantity } : item
      ));
    }
  };

  // Increment item quantity in cart (or add with qty 1 if not in cart)
  const incrementCartItem = (item, itemType) => {
    const cartKey = `${itemType}-${item.id}`;
    const existing = cart.find(c => c.cartKey === cartKey);
    if (existing) {
      updateCartQuantity(cartKey, existing.quantity + 1);
    } else {
      addToCart(item, itemType, 1);
    }
  };

  // Decrement item quantity in cart (removes if qty becomes 0)
  const decrementCartItem = (item, itemType) => {
    const cartKey = `${itemType}-${item.id}`;
    const existing = cart.find(c => c.cartKey === cartKey);
    if (existing) {
      updateCartQuantity(cartKey, existing.quantity - 1);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const processPayment = (paymentMethod) => {
    const sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      client: selectedClient ? { name: selectedClient.name, email: selectedClient.email } : null,
      items: cart.map(item => ({ name: item.name, price: item.price, quantity: item.quantity, itemType: item.itemType })),
      subtotal: cartTotal,
      tax: cartTotal * 0.08,
      total: cartTotal * 1.08,
      paymentMethod,
    };
    const updated = [sale, ...salesHistory].slice(0, 50); // Keep last 50
    setSalesHistory(updated);
    try { localStorage.setItem('salesHistory', JSON.stringify(updated)); } catch {}

    setCart([]);
    setSelectedClient(null);
    setShowCheckout(false);
    clearError();
  };

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAPI.getAll();
      // Handle both direct data and response.data formats
      const servicesData = response?.data ?? response;
      if (Array.isArray(servicesData)) {
        setServices(servicesData);
        clearError();
      } else {
        console.error('Invalid services data format:', servicesData);
        setError('Invalid data format received from server');
        setServices([]);
      }
    } catch (err) {
      setError('Failed to load services');
      console.error('Error loading services:', err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on search and category
  const filteredServices = services.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Check if item is in cart
  const isInCart = (itemId, itemType) => {
    return cart.some(c => c.cartKey === `${itemType}-${itemId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900 -m-4 md:-m-6 p-4 md:p-6">
      {/* Sticky Header - Title Only */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
        {error && (
          <div className="mt-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Sales History Section */}
      {salesHistory.length > 0 && (
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <ClockIcon className="h-4 w-4" />
              Sales History ({salesHistory.length})
            </span>
            {showHistory
              ? <ChevronUpIcon className="h-4 w-4 text-gray-500" />
              : <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            }
          </button>
          {showHistory && (
            <div className="max-h-60 overflow-y-auto border-b border-gray-200 dark:border-gray-700">
              {salesHistory.map(sale => (
                <div key={sale.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(sale.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {sale.client && (
                        <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{sale.client.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {sale.items.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right ml-3">
                    <span className="font-semibold text-gray-900 dark:text-white">${sale.total.toFixed(2)}</span>
                    <div className="text-xs text-gray-400 capitalize">{sale.paymentMethod}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Body - Items Grid */}
      <div className="flex-1 overflow-y-auto pb-40">
          {/* Services Section */}
          {showServices && filteredServices.length > 0 && (
            <div className="mb-6">
              {showProducts && (
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4" />
                  Services ({filteredServices.length})
                </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredServices.map(service => (
                  <ItemCard
                    key={`service-${service.id}`}
                    item={service}
                    itemType="service"
                    onSelect={handleSelectItem}
                    inCart={isInCart(service.id, 'service')}
                    cartQuantity={getCartQuantity(service.id, 'service')}
                    onIncrement={incrementCartItem}
                    onDecrement={decrementCartItem}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Products Section */}
          {showProducts && filteredProducts.length > 0 && (
            <div className="mb-6">
              {showServices && (
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CubeIcon className="h-4 w-4" />
                  Products ({filteredProducts.length})
                </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredProducts.map(product => (
                  <ItemCard
                    key={`product-${product.id}`}
                    item={product}
                    itemType="product"
                    onSelect={handleSelectItem}
                    inCart={isInCart(product.id, 'product')}
                    cartQuantity={getCartQuantity(product.id, 'product')}
                    onIncrement={incrementCartItem}
                    onDecrement={decrementCartItem}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Empty State */}
          {filteredServices.length === 0 && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No items found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter</p>
            </div>
          )}
        </div>

      {/* Fixed Footer - Search, Toggles, Cart */}
      <div className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg p-3 md:ml-64">
        {/* Search Row */}
        <div className="mb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products and services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Controls Row - left-aligned, content-width */}
        <div className="flex items-center gap-3">
          {/* Circular Cart Button */}
          <button
            onClick={() => setShowCartModal(true)}
            className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center bg-secondary-600 hover:bg-secondary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <ShoppingCartIcon className="h-5 w-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* Service Toggle Button */}
          <button
            type="button"
            onClick={() => setShowServices((prev) => !prev)}
            aria-pressed={showServices}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-colors ${
              showServices
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <SparklesIcon className={`h-4 w-4 ${showServices ? 'text-white' : 'text-primary-500'}`} />
            <span className="text-sm font-medium">Services</span>
          </button>

          {/* Product Toggle Button */}
          <button
            type="button"
            onClick={() => setShowProducts((prev) => !prev)}
            aria-pressed={showProducts}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-colors ${
              showProducts
                ? 'bg-secondary-600 text-white border-secondary-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <CubeIcon className={`h-4 w-4 ${showProducts ? 'text-white' : 'text-secondary-500'}`} />
            <span className="text-sm font-medium">Products</span>
          </button>
        </div>
      </div>

      {/* Cart Modal */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCartModal(false)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full sm:w-[480px] max-h-[90vh] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            {/* Cart Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCartIcon className="h-5 w-5" />
                  Cart ({cartItemCount})
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <ShoppingCartIcon className="h-10 w-10 text-gray-400" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Cart is empty</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add items to get started</p>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh]">
                  {cart.map(item => (
                    <CartItem
                      key={item.cartKey}
                      item={item}
                      onUpdateQuantity={updateCartQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                </div>

                {/* Client Selection */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <UserIcon className="h-4 w-4 inline mr-1" />
                    Customer (optional)
                  </label>
                  {selectedClient ? (
                    <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedClient.name}</p>
                        {selectedClient.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedClient.email}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => setSelectedClient(null)} 
                        className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => { loadClients(); setShowClientDropdown(true); }}
                          className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => openAddClientModal((newClient) => {
                            setSelectedClient(newClient);
                            setClientsLocal(prev => [...prev, newClient]);
                            setClientSearch('');
                            setShowClientDropdown(false);
                          })}
                          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                          title="Add new customer"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                      {showClientDropdown && clientSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {filteredClients.slice(0, 5).map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedClient(c);
                                setClientSearch('');
                                setShowClientDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white"
                            >
                              <p className="font-medium">{c.name}</p>
                              {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                            </button>
                          ))}
                          {filteredClients.length === 0 && (
                            <button
                              onClick={() => openAddClientModal((newClient) => {
                                setSelectedClient(newClient);
                                setClientsLocal(prev => [...prev, newClient]);
                                setClientSearch('');
                                setShowClientDropdown(false);
                              })}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-2"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Create new customer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cart Summary & Checkout */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal ({cartItemCount} items)</span>
                      <span className="text-gray-900 dark:text-white">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Tax (8%)</span>
                      <span className="text-gray-900 dark:text-white">${(cartTotal * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-secondary-600 dark:text-secondary-400">${(cartTotal * 1.08).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => { setShowCartModal(false); handleCheckout(); }}
                    className="w-full py-4 bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary-600/20"
                  >
                    <CreditCardIcon className="h-5 w-5" />
                    Proceed to Checkout
                  </button>
                  <button
                    onClick={() => setShowCartModal(false)}
                    className="w-full py-2 mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Item Detail Modal - Sales Mode */}
      <ItemDetailModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        item={selectedItem}
        itemType={selectedItemType}
        mode="sales"
        onAddToCart={addToCart}
        cartQuantity={selectedItem ? getCartQuantity(selectedItem.id, selectedItemType) : 0}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        cartTotal={cartTotal}
        selectedClient={selectedClient}
        onProcessPayment={processPayment}
      />
    </div>
  );
}
