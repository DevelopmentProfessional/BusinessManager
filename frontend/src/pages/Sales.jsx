/*
 * ============================================================
 * FILE: Sales.jsx
 *
 * PURPOSE:
 *   Point-of-sale (POS) page that lets staff browse services and inventory
 *   products, manage a shopping cart, assign a client to a transaction, and
 *   process payment through checkout. Completed sales are persisted to the
 *   database and cached in localStorage for history review.
 *
 * FUNCTIONAL PARTS:
 *   [1]  ItemCard Component        — Reusable card UI for a single service or product with cart controls
 *   [2]  Sales Component (export)  — Main POS page shell with permission guard
 *   [3]  State Declarations        — POS state, cart, client, product/service, history, and modal flags
 *   [4]  Lifecycle / useEffect     — Initial data load, navigation pre-selection, and cart persistence
 *   [5]  Data Loading              — loadServices, loadProducts, loadClients, loadTransactionHistory
 *   [6]  Cart Handlers             — addToCart, removeFromCart, updateCartQuantity, increment/decrement
 *   [7]  Computed / Derived Values — cartTotal, cartItemCount, filtered lists, isInCart, filteredHistory
 *   [8]  Checkout Handler          — handleCheckout, processPayment (saves to DB + localStorage)
 *   [9]  Render / Return           — Sticky header, item grid, fixed footer, and all modal outlets
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

// ─── 1  IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  ShoppingCartIcon, XMarkIcon,
  UserIcon, CreditCardIcon, ClockIcon,
  PlusIcon, MinusIcon,
  MagnifyingGlassIcon, SparklesIcon, CubeIcon,
  ChevronDownIcon, ChevronUpIcon, FunnelIcon,
  UserCircleIcon, ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import Button_Toolbar from './components/Button_Toolbar';
import { servicesAPI, clientsAPI, inventoryAPI, saleTransactionsAPI, settingsAPI } from '../services/api';
import Gate_Permission from './components/Gate_Permission';
import Modal from './components/Modal';
import Modal_Detail_Item from './components/Modal_Detail_Item';
import Modal_Checkout_Sales from './components/Modal_Checkout_Sales';
import Modal_Cart_Sales from './components/Modal_Cart_Sales';
import Modal_History_Sales from './components/Modal_History_Sales';
import { getDisplayImageUrl } from './components/imageUtils';

// ─── 2  ITEM CARD COMPONENT ────────────────────────────────────────────────
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

// ─── 3  SALES PAGE COMPONENT ───────────────────────────────────────────────
export default function Sales() {
  const {
    services, setServices,
    loading, setLoading, error, setError, clearError,
    hasPermission, openAddClientModal, user
  } = useStore();
  const location = useLocation();

  // Check permissions at page level
  if (!hasPermission('services', 'read') &&
      !hasPermission('services', 'write') &&
      !hasPermission('services', 'delete') &&
      !hasPermission('services', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  // ─── 4  STATE / REF DECLARATIONS ─────────────────────────────────────────
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
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [clientPanelSearch, setClientPanelSearch] = useState('');
  const [showClientPanelDropdown, setShowClientPanelDropdown] = useState(false);
  
  // Product Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const hasFetched = useRef(false);

  // Sales History State
  const [salesHistory, setSalesHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const [historyFilters, setHistoryFilters] = useState({
    showServices: true,
    showProducts: true,
    minPrice: '',
    maxPrice: '',
    startDate: '',
    endDate: ''
  });

  // ─── 5  LIFECYCLE / useEffect HOOKS ──────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadServices();
    loadProducts();
    settingsAPI.getSettings().then(res => setAppSettings(res.data)).catch(() => {});
  }, []);

  // ─── 6  DATA LOADING FUNCTIONS ───────────────────────────────────────────
  const loadTransactionHistory = async () => {
    try {
      const res = await saleTransactionsAPI.getAll();
      const txData = res?.data ?? res;
      if (Array.isArray(txData)) {
        const clientMap = {};
        clients.forEach(c => { clientMap[c.id] = c; });
        const dbHistory = txData.map(tx => ({
          id: String(tx.id),
          date: tx.created_at || new Date().toISOString(),
          client: tx.client_id && clientMap[tx.client_id] ? { name: clientMap[tx.client_id].name, email: clientMap[tx.client_id].email } : null,
          items: [],
          subtotal: tx.subtotal || 0,
          tax: tx.tax_amount || 0,
          total: tx.total || 0,
          paymentMethod: tx.payment_method || 'cash',
        }));
        dbHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        setSalesHistory(dbHistory);
      }
    } catch (err) {
      console.error('Failed to load transaction history from DB:', err);
    }
  };

  // Auto-select client (and optionally pre-load their cart) when navigated from Clients page
  useEffect(() => {
    const { preSelectedClient, preloadCart } = location.state || {};
    if (preSelectedClient) {
      setSelectedClient(preSelectedClient);
      if (Array.isArray(preloadCart) && preloadCart.length > 0) {
        setCart(preloadCart);
      } else {
        // Load their saved cart from localStorage
        try {
          const saved = localStorage.getItem(`client_cart_${preSelectedClient.id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
          }
        } catch {}
      }
    }
  }, [location.state?.preSelectedClient]);

  // Sync cart to client's localStorage whenever cart or selected client changes
  useEffect(() => {
    if (selectedClient?.id) {
      try {
        localStorage.setItem(`client_cart_${selectedClient.id}`, JSON.stringify(cart));
      } catch {}
    }
  }, [cart, selectedClient?.id]);

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

  // Select a client and load their saved cart
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    try {
      const saved = localStorage.getItem(`client_cart_${client.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
    } catch {}
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

  // ─── 7  CART HANDLERS ─────────────────────────────────────────────────────
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

  // ─── 8  CHECKOUT / PAYMENT HANDLERS ──────────────────────────────────────
  const handleCheckout = () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const processPayment = async (paymentMethod) => {
    const tax = cartTotal * 0.08;
    const total = cartTotal + tax;

    // Build local sale record for immediate UI update
    const sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      client: selectedClient ? { name: selectedClient.name, email: selectedClient.email } : null,
      items: cart.map(item => ({ name: item.name, price: item.price, quantity: item.quantity, itemType: item.itemType })),
      subtotal: cartTotal,
      tax,
      total,
      paymentMethod,
    };
    setSalesHistory(prev => [sale, ...prev].slice(0, 50));

    // Persist to database
    try {
      const txData = {
        client_id: selectedClient?.id || null,
        employee_id: user?.id || null,
        subtotal: cartTotal,
        tax_amount: tax,
        total,
        payment_method: paymentMethod,
      };
      const txResponse = await saleTransactionsAPI.create(txData);
      const txId = txResponse?.data?.id || txResponse?.id;
      if (txId) {
        await Promise.all(cart.map(item =>
          saleTransactionsAPI.createItem({
            sale_transaction_id: txId,
            item_id: item.id || null,
            item_type: item.itemType || 'product',
            item_name: item.name,
            unit_price: item.price,
            quantity: item.quantity,
            line_total: item.price * item.quantity,
          })
        ));
        // Optimistically decrement local product quantities and bust the inventory cache
        const soldMap = {};
        cart.forEach(item => {
          if (item.itemType === 'product' && item.id) {
            soldMap[item.id] = (soldMap[item.id] || 0) + item.quantity;
          }
        });
        if (Object.keys(soldMap).length > 0) {
          setProducts(prev => prev.map(p =>
            soldMap[p.id] != null
              ? { ...p, quantity: Math.max(0, (p.quantity ?? 0) - soldMap[p.id]) }
              : p
          ));
          inventoryAPI.invalidateCache();
        }
      }
    } catch (err) {
      console.error('Failed to persist sale transaction:', err);
      // Continue — local sale record is already saved
    }

    setCart([]);
    setSelectedClient(null);
    setShowCheckout(false);
    clearError();
  };

  // ─── 9  SERVICE LOAD FUNCTION ─────────────────────────────────────────────
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

  // ─── 10  DERIVED / COMPUTED VALUES ───────────────────────────────────────
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

  const filteredHistory = salesHistory.filter((sale) => {
    const minPrice = historyFilters.minPrice ? Number(historyFilters.minPrice) : null;
    const maxPrice = historyFilters.maxPrice ? Number(historyFilters.maxPrice) : null;
    const startDate = historyFilters.startDate ? new Date(`${historyFilters.startDate}T00:00:00`) : null;
    const endDate = historyFilters.endDate ? new Date(`${historyFilters.endDate}T23:59:59`) : null;
    const saleDate = new Date(sale.date);

    if (Number.isFinite(minPrice) && sale.total < minPrice) return false;
    if (Number.isFinite(maxPrice) && sale.total > maxPrice) return false;
    if (startDate && saleDate < startDate) return false;
    if (endDate && saleDate > endDate) return false;

    // If no items loaded (DB records), show them regardless of type filter
    if (!sale.items || sale.items.length === 0) return true;

    if (!historyFilters.showServices && !historyFilters.showProducts) return false;
    if (historyFilters.showServices && historyFilters.showProducts) return true;

    const hasService = sale.items?.some((item) => item.itemType === 'service');
    const hasProduct = sale.items?.some((item) => item.itemType === 'product');
    if (historyFilters.showServices && hasService) return true;
    if (historyFilters.showProducts && hasProduct) return true;
    return false;
  });

  // ─── 11  RENDER / RETURN ──────────────────────────────────────────────────
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

      {/* Main Body - Items Grid */}
      <div className="flex-1 overflow-y-auto pb-4">
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
      <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg p-3 pt-2">
       
               {/* Client Selection Panel - shown when account icon is active */}
        {showClientPanel && (
          <div className="mb-2 relative">
            {selectedClient ? (
              <div className="flex items-center justify-between px-3 py-2 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-xl">
                <div className="flex items-center gap-1 min-w-0">
                  <UserCircleIcon className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{selectedClient.name}</p>
                    {selectedClient.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedClient.email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="flex-shrink-0 p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors ml-2"
                  title="Remove client"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientPanelSearch}
                    onChange={(e) => { setClientPanelSearch(e.target.value); setShowClientPanelDropdown(true); }}
                    onFocus={() => { loadClients(); setShowClientPanelDropdown(true); }}
                    className="app-search-input w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                  {showClientPanelDropdown && clientPanelSearch && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50">
                      {clients.filter(c =>
                        c.name?.toLowerCase().includes(clientPanelSearch.toLowerCase()) ||
                        c.email?.toLowerCase().includes(clientPanelSearch.toLowerCase())
                      ).slice(0, 6).map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            handleSelectClient(c);
                            setClientPanelSearch('');
                            setShowClientPanelDropdown(false);
                            setShowClientPanel(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        >
                          <p className="font-medium">{c.name}</p>
                          {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                        </button>
                      ))}
                      {clients.filter(c =>
                        c.name?.toLowerCase().includes(clientPanelSearch.toLowerCase()) ||
                        c.email?.toLowerCase().includes(clientPanelSearch.toLowerCase())
                      ).length === 0 && (
                        <button
                          onClick={() => openAddClientModal((newClient) => {
                            handleSelectClient(newClient);
                            setClientsLocal(prev => [...prev, newClient]);
                            setClientPanelSearch('');
                            setShowClientPanelDropdown(false);
                            setShowClientPanel(false);
                          })}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Create new client
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                onClick={() => openAddClientModal((newClient) => {
                    handleSelectClient(newClient);
                    setClientsLocal(prev => [...prev, newClient]);
                    setClientPanelSearch('');
                    setShowClientPanelDropdown(false);
                    setShowClientPanel(false);
                  })}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                  title="Add new client"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}
       
        {/* Search Row */}
        <div className="mb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products and services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-search-input w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Controls Row 1 - History and Cart */}
        <div className="flex items-center gap-1 pb-2" style={{ minHeight: '3rem' }}>
          {/* Sales History Button */}
          <Button_Toolbar
            icon={ArrowTrendingUpIcon}
            label="History"
            onClick={() => { setShowHistoryModal(true); loadTransactionHistory(); }}
            className="btn-outline-secondary"
          />

          {/* Cart Button */}
          <Button_Toolbar
            icon={ShoppingCartIcon}
            label="Cart"
            onClick={() => setShowCartModal(true)}
            className="btn-secondary"
            style={{ position: 'relative' }}
            badge={cartItemCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {cartItemCount}
              </span>
            ) : null}
          />
        </div>

        {/* Controls Row 2 - Client, Clear, Filters */}
        <div className="flex items-center gap-1 pb-2" style={{ minHeight: '3rem' }}>
          {/* Account / Client Icon */}
          <Button_Toolbar
            icon={UserCircleIcon}
            label="Client"
            onClick={() => { setShowClientPanel(p => !p); if (!showClientPanel) { loadClients(); } }}
            className={selectedClient ? 'btn-success' : 'btn-outline-secondary'}
            title={selectedClient ? `Client: ${selectedClient.name}` : 'Select client'}
            data-active={!!selectedClient}
            style={{ position: 'relative' }}
            badge={selectedClient ? (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-gray-800" />
            ) : null}
          />

          {/* Clear Filters Button - Shows when any filter is active */}
          {(showServices || showProducts) && (
            <Button_Toolbar
              icon={XMarkIcon}
              label="Clear"
              onClick={() => { setShowServices(false); setShowProducts(false); }}
              className="btn-danger"
            />
          )}

          {/* Service Toggle Button */}
          <Button_Toolbar
            icon={SparklesIcon}
            label="Services"
            onClick={() => setShowServices((prev) => !prev)}
            aria-pressed={showServices}
            data-active={showServices}
            className={showServices ? 'btn-primary' : 'btn-outline-secondary'}
            style={{ opacity: showServices ? 1 : 0.5 }}
          />

          {/* Product Toggle Button */}
          <Button_Toolbar
            icon={CubeIcon}
            label="Products"
            onClick={() => setShowProducts((prev) => !prev)}
            aria-pressed={showProducts}
            data-active={showProducts}
            className={showProducts ? 'btn-secondary' : 'btn-outline-secondary'}
            style={{ opacity: showProducts ? 1 : 0.5 }}
          />
        </div>
      </div>

      {/* Cart Modal */}
      <Modal_Cart_Sales
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        showClientDropdown={showClientDropdown}
        setShowClientDropdown={setShowClientDropdown}
        filteredClients={filteredClients}
        cartItemCount={cartItemCount}
        cartTotal={cartTotal}
        loadClients={loadClients}
        openAddClientModal={openAddClientModal}
        handleSelectClient={handleSelectClient}
        setClientsLocal={setClientsLocal}
        updateCartQuantity={updateCartQuantity}
        removeFromCart={removeFromCart}
        setCart={setCart}
        handleCheckout={handleCheckout}
      />

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
      <Modal_Detail_Item
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        item={selectedItem}
        itemType={selectedItemType}
        mode="sales"
        onAddToCart={addToCart}
        cartQuantity={selectedItem ? getCartQuantity(selectedItem.id, selectedItemType) : 0}
      />

      {/* Checkout Modal */}
      <Modal_Checkout_Sales
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        cartTotal={cartTotal}
        selectedClient={selectedClient}
        onProcessPayment={processPayment}
        taxRate={appSettings?.tax_rate ?? 0}
        currentUser={user}
        appSettings={appSettings}
      />

      {/* Sales History */}
      <Modal_History_Sales
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        filteredHistory={filteredHistory}
        historyFilters={historyFilters}
        setHistoryFilters={setHistoryFilters}
      />
    </div>
  );
}
