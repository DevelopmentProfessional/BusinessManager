import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  PencilIcon, TrashIcon, ArrowUpTrayIcon, ShoppingCartIcon, XMarkIcon, 
  UserIcon, CreditCardIcon, BanknotesIcon, ClockIcon, TagIcon,
  PlusIcon, MinusIcon, CheckCircleIcon, ArrowLeftIcon,
  MagnifyingGlassIcon, PhotoIcon, SparklesIcon, CubeIcon, Squares2X2Icon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import useStore from '../services/useStore';
import { servicesAPI, clientsAPI, inventoryAPI } from '../services/api';
import Modal from './components/Modal';
import ServiceForm from './components/ServiceForm';
import MobileTable from './components/MobileTable';
import MobileAddButton from './components/MobileAddButton';
import PermissionGate from './components/PermissionGate';
import ProductDetailModal from './components/ProductDetailModal';
import CheckoutModal from './components/CheckoutModal';

// Unified Product/Service Card Component
const ItemCard = ({ item, itemType, onSelect, inCart, cartQuantity }) => {
  const isService = itemType === 'service';
  const hasImage = item.image_url;
  
  return (
    <button
      onClick={() => onSelect(item, itemType)}
      className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] h-48 ${
        inCart 
          ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
      }`}
    >
      {/* Full Card Background Image */}
      <div className={`absolute inset-0 ${hasImage ? '' : 'bg-gradient-to-br'} ${
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
              <SparklesIcon className="h-16 w-16 text-primary-400/50 dark:text-primary-500/50" />
            ) : (
              <CubeIcon className="h-16 w-16 text-emerald-400/50 dark:text-emerald-500/50" />
            )}
          </div>
        )}
      </div>
      
      {/* Gradient Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      {/* Type Badge - Top Left */}
      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm ${
        isService 
          ? 'bg-primary-500/90 text-white' 
          : 'bg-emerald-500/90 text-white'
      }`}>
        {isService ? 'Service' : 'Product'}
      </div>
      
      {/* In Cart Indicator - Top Right */}
      {inCart && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 rounded-full px-2 py-0.5">
          <CheckCircleSolid className="h-4 w-4 text-white" />
          {cartQuantity > 0 && (
            <span className="text-white text-xs font-bold">
              {cartQuantity}
            </span>
          )}
        </div>
      )}
      
      {/* Content Footer - Overlays bottom of image */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
        <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 drop-shadow-md">
          {item.name}
        </h3>
        
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white drop-shadow-md">
            ${item.price?.toFixed(2)}
          </span>
          
          {isService && item.duration_minutes && (
            <span className="flex items-center text-xs text-white/80 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <ClockIcon className="h-3 w-3 mr-1" />
              {item.duration_minutes}m
            </span>
          )}
          
          {!isService && item.sku && (
            <span className="text-xs text-white/70 font-mono bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {item.sku}
            </span>
          )}
        </div>
      </div>
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
    </button>
  );
};

// Cart Item Component
const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const isService = item.itemType === 'service';
  
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Mini Image/Icon */}
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isService 
          ? 'bg-primary-100 dark:bg-primary-900' 
          : 'bg-emerald-100 dark:bg-emerald-900'
      }`}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
        ) : isService ? (
          <SparklesIcon className="h-6 w-6 text-primary-500" />
        ) : (
          <CubeIcon className="h-6 w-6 text-emerald-500" />
        )}
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
    services, setServices, addService, updateService, removeService,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Check permissions at page level
  if (!hasPermission('services', 'read') && 
      !hasPermission('services', 'write') && 
      !hasPermission('services', 'delete') && 
      !hasPermission('services', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingService, setEditingService] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // POS State
  const [activeTab, setActiveTab] = useState('pos');
  const [posCategory, setPosCategory] = useState('all'); // 'all', 'services', 'products'
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClientsLocal] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [products, setProducts] = useState([]);
  
  // Product Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    loadServices();
    loadClients();
    loadProducts();
  }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) setClientsLocal(data);
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
    // In a real app, this would create a transaction record
    console.log(`Payment of $${cartTotal.toFixed(2)} processed via ${paymentMethod}${selectedClient ? ` for ${selectedClient.name}` : ''}`);
    setCart([]);
    setSelectedClient(null);
    setShowCheckout(false);
    clearError();
  };

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingService(null);
      openModal('service-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

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

  const handleCreateService = () => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to create services');
      return;
    }
    setEditingService(null);
    openModal('service-form');
  };

  const handleEditService = (service) => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to edit services');
      return;
    }
    setEditingService(service);
    openModal('service-form');
  };

  const handleDeleteService = async (serviceId) => {
    if (!hasPermission('services', 'delete')) {
      setError('You do not have permission to delete services');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    await servicesAPI.delete(serviceId);
    removeService(serviceId);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await servicesAPI.uploadCSV(formData);
    if (response?.data) {
      loadServices();
    }
    
    setIsImporting(false);
    event.target.value = '';
  };

  const handleSubmitService = async (serviceData) => {
    try {
      if (editingService) {
        const response = await servicesAPI.update(editingService.id, serviceData);
        updateService(editingService.id, response.data);
      } else {
        const response = await servicesAPI.create(serviceData);
        addService(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save service');
      console.error(err);
    }
  };

  const handleRefresh = () => {
    loadServices();
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
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Point of Sale & Service Management
            </p>
          </div>
          
          {/* Tab Switcher */}
          <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'pos' 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Point of Sale
              {cartItemCount > 0 && (
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  activeTab === 'pos' ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                }`}>
                  {cartItemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'services' 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Manage Services
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* POS View */}
      {activeTab === 'pos' && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          {/* Products/Services Grid */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Search and Filter Bar */}
            <div className="flex-shrink-0 mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products and services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                {/* Category Filter */}
                <div className="flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
                  <button
                    onClick={() => setPosCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      posCategory === 'all' 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPosCategory('services')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      posCategory === 'services' 
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <SparklesIcon className="h-4 w-4" />
                    Services
                  </button>
                  <button
                    onClick={() => setPosCategory('products')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      posCategory === 'products' 
                        ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <CubeIcon className="h-4 w-4" />
                    Products
                  </button>
                </div>
              </div>
            </div>
            
            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto pr-2">
              {/* Services Section */}
              {(posCategory === 'all' || posCategory === 'services') && filteredServices.length > 0 && (
                <div className="mb-6">
                  {posCategory === 'all' && (
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4" />
                      Services ({filteredServices.length})
                    </h3>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredServices.map(service => (
                      <ItemCard
                        key={`service-${service.id}`}
                        item={service}
                        itemType="service"
                        onSelect={handleSelectItem}
                        inCart={isInCart(service.id, 'service')}
                        cartQuantity={getCartQuantity(service.id, 'service')}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Products Section */}
              {(posCategory === 'all' || posCategory === 'products') && filteredProducts.length > 0 && (
                <div className="mb-6">
                  {posCategory === 'all' && (
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <CubeIcon className="h-4 w-4" />
                      Products ({filteredProducts.length})
                    </h3>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map(product => (
                      <ItemCard
                        key={`product-${product.id}`}
                        item={product}
                        itemType="product"
                        onSelect={handleSelectItem}
                        inCart={isInCart(product.id, 'product')}
                        cartQuantity={getCartQuantity(product.id, 'product')}
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
          </div>

          {/* Cart Sidebar */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm h-full flex flex-col">
              {/* Cart Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingCartIcon className="h-5 w-5" />
                    Cart
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
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
                              <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No customers found</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cart Summary & Checkout */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
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
                        <span className="text-emerald-600 dark:text-emerald-400">${(cartTotal * 1.08).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCheckout}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      <CreditCardIcon className="h-5 w-5" />
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Services Tab Content */}
      {activeTab === 'services' && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Services Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <PermissionGate page="services" permission="write">
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors"
                  >
                    Refresh
                  </button>
                  <label className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    {isImporting ? 'Importing...' : 'Import'}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="hidden"
                      disabled={isImporting}
                    />
                  </label>
                  <button
                    onClick={handleCreateService}
                    className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Service
                  </button>
                </div>
              </PermissionGate>
            </div>
          </div>
          
          {/* Services List */}
          <div className="flex-1 overflow-auto">
            <MobileTable
              data={filteredServices}
              columns={[
                { key: 'name', title: 'Name' },
                { key: 'category', title: 'Category', render: (v) => v || '-' },
                { key: 'price', title: 'Price', render: (v) => `$${v?.toFixed(2) || '0.00'}` },
                { key: 'duration_minutes', title: 'Duration', render: (v) => `${v || 0} min` },
              ]}
              onEdit={(item) => handleEditService(item)}
              onDelete={(item) => handleDeleteService(item.id)}
              editPermission={{ page: 'services', permission: 'write' }}
              deletePermission={{ page: 'services', permission: 'delete' }}
              emptyMessage="No services found"
            />
          </div>
        </div>
      )}

      {/* Floating Cart Button - Bottom Left */}
      {activeTab === 'pos' && (
        <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
          {/* Quick Add Button */}
          <button
            onClick={() => setPosCategory(posCategory === 'all' ? 'services' : posCategory === 'services' ? 'products' : 'all')}
            className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all group"
            title="Toggle category filter"
          >
            <Squares2X2Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
          </button>
          
          {/* Cart Summary Button */}
          {cart.length > 0 && (
            <button
              onClick={handleCheckout}
              className="flex items-center gap-3 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="relative">
                <ShoppingCartIcon className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 bg-white text-emerald-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs opacity-80">Checkout</p>
                <p className="font-bold">${cartTotal.toFixed(2)}</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        item={selectedItem}
        itemType={selectedItemType}
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

      {/* Modal for Service Form */}
      <Modal isOpen={isModalOpen && modalContent === 'service-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'service-form' && (
          <ServiceForm
            service={editingService}
            onSubmit={handleSubmitService}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
