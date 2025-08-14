import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { assetsAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import AssetForm from '../components/AssetForm';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';

export default function Assets() {
  const { 
    assets, setAssets, addAsset, updateAsset,
    employees, setEmployees,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingAsset, setEditingAsset] = useState(null);

  useEffect(() => {
    loadAssetsData();
  }, []);

  const loadAssetsData = async () => {
    setLoading(true);
    try {
      const [assetsRes, employeesRes] = await Promise.all([
        assetsAPI.getAll(),
        employeesAPI.getAll()
      ]);

      setAssets(assetsRes.data);
      setEmployees(employeesRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load assets data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = () => {
    setEditingAsset(null);
    openModal('asset-form');
  };

  const handleEditAsset = (asset) => {
    setEditingAsset(asset);
    openModal('asset-form');
  };

  const handleSubmitAsset = async (assetData) => {
    try {
      if (editingAsset) {
        const response = await assetsAPI.update(editingAsset.id, assetData);
        updateAsset(editingAsset.id, response.data);
      } else {
        const response = await assetsAPI.create(assetData);
        addAsset(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save asset');
      console.error(err);
    }
  };

  const handleDeleteAsset = async (asset) => {
    const ok = window.confirm(`Delete asset "${asset.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await assetsAPI.delete(asset.id);
      setAssets(assets.filter(a => a.id !== asset.id));
      clearError();
    } catch (err) {
      setError('Failed to delete asset');
      console.error(err);
    }
  };

  const getEmployeeName = (employeeId) => {
    if (!employeeId) return 'Unassigned';
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown Employee';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button 
            type="button" 
            onClick={handleCreateAsset}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Asset
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={assets}
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'asset_type', title: 'Type' },
            { key: 'serial_number', title: 'Serial', render: (v) => v || '-' },
            { key: 'assigned_employee_id', title: 'Assigned', render: (v) => getEmployeeName(v) },
          ]}
          onEdit={(item) => handleEditAsset(item)}
          onDelete={(item) => handleDeleteAsset(item)}
          emptyMessage="No assets found"
        />
        <MobileAddButton onClick={handleCreateAsset} label="Add" />
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purchase Price
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {asset.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {asset.asset_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {asset.serial_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getEmployeeName(asset.assigned_employee_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          asset.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : asset.status === 'maintenance'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {asset.purchase_price ? `$${asset.purchase_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button
                          onClick={() => handleDeleteAsset(asset)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEditAsset(asset)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {assets.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No assets found. Add your first asset to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Asset Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <AssetForm
            asset={editingAsset}
            onSubmit={handleSubmitAsset}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
