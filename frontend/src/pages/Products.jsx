import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { productsAPI } from '../services/api';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';

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
    <div className="h-screen flex flex-col">
      {/* No page title; Add action is in fixed bottom bar */}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Scrollable content area that adapts when accordion expands/collapses */}
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        {/* Unified Layout (inverted: totals/averages in header, labels+sort in footer) */}
        <div className="flex-1 min-h-0 block mt-auto">
          <div className="h-full overflow-auto relative">
            {/* Shared grid template for alignment */}
            <div className="sticky top-0 bg-inherit z-30">
              <div
                className="grid px-4 py-3 text-xs"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 80px' }}
              >
                <div className="font-semibold text-gray-700">Total Products: {totalProducts}</div>
                <div className="font-semibold text-gray-700">Avg Price: ${avgPrice.toFixed(2)}
                  <div className="text-gray-500 font-normal">Total: ${totalPrice.toFixed(2)}</div>
                </div>
                <div></div>
                <div className="text-right text-gray-500"><span className="sr-only">Actions</span></div>
              </div>
            </div>

            {/* Rows (scroll). Align to bottom when content is short */}
            <div className="divide-y divide-gray-200 flex flex-col justify-end h-full min-h-[200px] pb-0">
              {sortedProducts.map((product) => (
                <div
                  key={product.id}
                  className="grid items-end"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 80px' }}
                >
                  <div className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 self-end">{product.name}</div>
                  <div className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 self-end">${Number(product.price).toFixed(2)}</div>
                  <div className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 self-end">{product?.inventory?.quantity ?? 0}</div>
                  <div className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium self-end">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
              
            </div>

            {/* Sticky footer bar (separate segment aligned to grid) */}
            <div className="sticky bottom-[64px] bg-inherit z-50">
              <div
                className="grid gap-0 px-4 py-2 text-xs"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 80px' }}
              >
                {['name','price','quantity'].map((key) => (
                  <div key={key} className="pr-4">
                    {editingColumn === key ? (
                      <input
                        autoFocus
                        type="text"
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value)}
                        onBlur={() => {
                          setColumnLabels(prev => ({ ...prev, [key]: tempLabel || prev[key] }));
                          setEditingColumn(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setColumnLabels(prev => ({ ...prev, [key]: tempLabel || prev[key] }));
                            setEditingColumn(null);
                          } else if (e.key === 'Escape') {
                            setEditingColumn(null);
                          }
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingColumn(key); setTempLabel(columnLabels[key]); }}
                        className="text-gray-700 hover:text-gray-900 font-medium"
                        title="Edit column label"
                      >
                        {columnLabels[key]}
                      </button>
                    )}
                    {/* Sort control: single rotating caret */}
                    <div className="mt-1 inline-flex align-middle">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortKey === key) {
                            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortKey(key);
                            setSortDir('asc');
                          }
                        }}
                        aria-label={`Toggle sort for ${key}`}
                        className={`px-2 py-0.5 text-[10px] border border-gray-300 rounded select-none ${sortKey===key ? 'bg-gray-100' : 'bg-white'}`}
                        title="Toggle sort"
                      >
                        <span className={`inline-block transform transition-transform ${sortKey===key && sortDir==='desc' ? 'rotate-180' : 'rotate-0'}`}>▲</span>
                      </button>
                    </div>
                  </div>
                ))}
                <div />
              </div>
            </div>
            {products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No products found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar (keeps Add Product always visible) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-center gap-3">
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
            className="flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm"
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
                <div key={data.month} className="flex items-center gap-3">
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
