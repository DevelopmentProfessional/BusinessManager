import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { productsAPI } from '../services/api';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';
import { useRef } from 'react';
import { useLayoutEffect } from 'react';

export default function Products() {
  const { 
    products, setProducts, addProduct, removeProduct,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const location = useLocation();
  const salesOpen = new URLSearchParams(location.search).get('sales') === '1';

  const [editingProduct, setEditingProduct] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  // Inverted table state: footer-held labels and sorting
  const [columnLabels, setColumnLabels] = useState({
    name: 'Name',
    price: 'Price',
    quantity: 'Quantity',
  });
  const [editingColumn, setEditingColumn] = useState(null);
  const [tempLabel, setTempLabel] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  // Refs to measure outer header cell widths
  const nameHdrRef = useRef(null);
  const priceHdrRef = useRef(null);
  const qtyHdrRef = useRef(null);
  const actionsHdrRef = useRef(null);
  const [innerCols, setInnerCols] = useState('2fr 1fr 1fr 80px');
  const headerRowRef = useRef(null);
  const outerCols = '2fr 1fr 1fr 80px';
  const navHeight = 64; // adjust if your bottom nav height differs

  // Table-style refs for footer cells (column names) to sync widths
  const tfootNameRef = useRef(null);
  const tfootPriceRef = useRef(null);
  const tfootQtyRef = useRef(null);
  const tfootActionsRef = useRef(null);

  // Measure and sync inner table columns to match outer header/footer
  useLayoutEffect(() => {
    const measure = () => {
      const getW = (el) => (el && el.getBoundingClientRect ? el.getBoundingClientRect().width : 0);
      // Prefer measuring footer cells if present (often fully visible at bottom), fallback to header cells
      const w1 = getW(tfootNameRef.current) || getW(nameHdrRef.current);
      const w2 = getW(tfootPriceRef.current) || getW(priceHdrRef.current);
      const w3 = getW(tfootQtyRef.current) || getW(qtyHdrRef.current);
      const w4 = getW(tfootActionsRef.current) || getW(actionsHdrRef.current);
      if (w1 + w2 + w3 + w4 > 0) {
        setInnerCols(`${Math.round(w1)}px ${Math.round(w2)}px ${Math.round(w3)}px ${Math.round(w4)}px`);
      }
    };
    // Initial and next frame measure to avoid layout thrash
    measure();
    const raf = requestAnimationFrame(measure);
    // Observe header row for size changes
    let ro;
    if ('ResizeObserver' in window && headerRowRef.current) {
      ro = new ResizeObserver(() => measure());
      ro.observe(headerRowRef.current);
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      if (ro && headerRowRef.current) ro.disconnect();
    };
  }, [products.length]);

  useEffect(() => {
    loadProducts();
    loadSalesData();
  }, []);

  // Open Monthly Sales modal when URL has ?sales=1 (place before any early return)
  useEffect(() => {
    if (salesOpen) setIsSalesOpen(true);
  }, [salesOpen]);

  const loadSalesData = async () => {
    // Mock sales data - replace with actual API call
    const mockSalesData = [
      { month: 'Jan', sales: 12500 },
      { month: 'Feb', sales: 15200 },
      { month: 'Mar', sales: 18900 },
      { month: 'Apr', sales: 14300 },
      { month: 'May', sales: 21000 },
      { month: 'Jun', sales: 19800 },
    ];
    setSalesData(mockSalesData);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    openModal('product-form');
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    openModal('product-form');
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await productsAPI.delete(productId);
      removeProduct(productId);
      clearError();
    } catch (err) {
      setError('Failed to delete product');
      console.error(err);
    }
  };

  const handleSubmitProduct = async (productData) => {
    try {
      if (editingProduct) {
        const response = await productsAPI.update(editingProduct.id, productData);
        // Update product in store - you may need to implement updateProduct in store
        setProducts(products.map(p => p.id === editingProduct.id ? response.data : p));
      } else {
        const response = await productsAPI.create(productData);
        addProduct(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save product');
      console.error(err);
    }
  };

  // Sorting and computed metrics
  const sortedProducts = useMemo(() => {
    const arr = [...products];
    arr.sort((a, b) => {
      const getVal = (p) => {
        if (sortKey === 'quantity') return Number(p?.inventory?.quantity ?? 0);
        if (sortKey === 'price') return Number(p?.price ?? 0);
        return p?.[sortKey];
      };
      const va = getVal(a);
      const vb = getVal(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [products, sortKey, sortDir]);

  const totalProducts = products.length;
  const totalPrice = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const avgPrice = totalProducts > 0 ? totalPrice / totalProducts : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const maxSales = Math.max(...salesData.map(d => d.sales));

  return (
    <div className="h-full flex flex-col">
      {/* No page title; Add action is in fixed bottom bar */}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 py-3 rounded">
          {error}
        </div>
      )}

      {/* Link to TableFormat demo */}
      <div className="mb-2">
        <Link to="/tableformat" className="text-xs text-indigo-500 hover:underline">View TableFormat demo</Link>
      </div>

      {/* Main area: Outer TABLE with header (totals), single-cell middle (inner table), and footer (column names) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 h-full">
          <div className="h-full overflow-auto relative" style={{ paddingBottom: navHeight + 24 }}>
            <table className="w-full h-full table-fixed">
              <thead className="sticky top-0 z-30 bg-inherit border-b">
                <tr ref={headerRowRef} className="text-xs text-gray-600">
                  <td ref={nameHdrRef} className="px-2 py-2 font-semibold">Total Products: {totalProducts}</td>
                  <td ref={priceHdrRef} className="px-2 py-2 font-semibold">Avg Price: ${avgPrice.toFixed(2)}</td>
                  <td ref={qtyHdrRef} className="px-2 py-2">
                    <span className="font-semibold">Total: ${totalPrice.toFixed(2)}</span>
                  </td>
                  <td ref={actionsHdrRef} className="px-2 py-2 text-right text-gray-500">
                    <span className="sr-only">Actions</span>
                  </td>
                </tr>
              </thead>
              <tbody>
                {/* Single row/cell containing the inner table */}
                <tr>
                  <td colSpan={4} className="p-0 align-bottom">
                    <div className="h-full min-h-[200px] flex flex-col justify-end">
                      <table className="w-full">
                        {/* Hidden header for structure if needed */}
                        <thead className="sr-only" aria-hidden="true">
                          <tr>
                            <th>Name</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        {/* Sync widths to outer cells via colgroup */}
                        <colgroup>
                          {/* Using measured pixel widths string innerCols: split into 4 cols */}
                          {innerCols.split(' ').map((w, idx) => (
                            <col key={idx} style={{ width: w }} />
                          ))}
                        </colgroup>
                        <tbody className="align-bottom">
                          {sortedProducts.map((product) => (
                            <tr key={product.id} className="border-t border-gray-200">
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">${Number(product.price).toFixed(2)}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">{product?.inventory?.quantity ?? 0}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                                >
                                  <PencilIcon className="h-5 w-5 inline" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {products.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-12 text-gray-500">No products found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot className="sticky" style={{ bottom: navHeight }}>
                <tr className="text-xs bg-inherit border-t">
                  <th ref={tfootNameRef} className="px-2 py-2 text-left font-semibold">{columnLabels.name}</th>
                  <th ref={tfootPriceRef} className="px-2 py-2 text-left font-semibold">{columnLabels.price}</th>
                  <th ref={tfootQtyRef} className="px-2 py-2 text-left font-semibold">{columnLabels.quantity}</th>
                  <th ref={tfootActionsRef} className="px-2 py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar (keeps Add Product always visible) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl px-1py-3 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={handleCreateProduct}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Product
          </button>
          <button
            type="button"
            onClick={() => setIsSalesOpen(true)}
            className="flex items-center px-1py-2 rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm"
          >
            Monthly Sales
          </button>
        </div>
      </div>

      {/* Modal for Product Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <ProductForm
            product={editingProduct}
            onSubmit={handleSubmitProduct}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Modal for Monthly Sales */}
      <Modal isOpen={isSalesOpen} onClose={() => setIsSalesOpen(false)}>
        {isSalesOpen && (
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Monthly Sales</h2>
              <button
                onClick={() => setIsSalesOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {salesData.map((data) => (
                <div key={data.month} className="flex items-center gap-1">
                  <div className="w-8 text-sm text-gray-600 font-medium">
                    {data.month}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(data.sales / maxSales) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        ${(data.sales / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
