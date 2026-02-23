import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { inventoryAPI, employeesAPI, serviceRelationsAPI } from '../../services/api';

const TABS = ['details', 'resources', 'assets', 'employees', 'locations'];

export default function Form_Service({ service, onSubmit, onCancel, onDelete, canDelete }) {
  const [activeTab, setActiveTab] = useState('details');

  // ── Basic form fields ────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    duration_minutes: '60',
    image_url: '',
  });

  // ── Lookup data ──────────────────────────────────────────────────
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(true);

  // ── Relationship state ───────────────────────────────────────────
  const [resources, setResources] = useState([]);
  const [assets, setAssets] = useState([]);
  const [svcEmployees, setSvcEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [relLoading, setRelLoading] = useState(false);

  // ── "Add" row state ──────────────────────────────────────────────
  const [newResource, setNewResource] = useState({ inventory_id: '', quantity: '1' });
  const [newAsset, setNewAsset] = useState({ inventory_id: '' });
  const [newEmployee, setNewEmployee] = useState({ user_id: '' });
  const [newLocation, setNewLocation] = useState({ inventory_id: '' });
  const [tabError, setTabError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        category: service.category || '',
        price: service.price?.toString() || '',
        duration_minutes: service.duration_minutes?.toString() || '60',
        image_url: service.image_url || '',
      });
    }
  }, [service]);

  // Load lookups once
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [invRes, empRes] = await Promise.all([
          inventoryAPI.getAll(),
          employeesAPI.getAll(),
        ]);
        if (!cancelled) {
          setInventory(invRes?.data ?? invRes ?? []);
          setEmployees(empRes?.data ?? empRes ?? []);
        }
      } catch (err) {
        console.error('Form_Service: failed to load lookups', err);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load relations when service id is available
  useEffect(() => {
    if (!service?.id) return;
    let cancelled = false;
    const load = async () => {
      setRelLoading(true);
      try {
        const [resRes, assRes, empRes, locRes] = await Promise.all([
          serviceRelationsAPI.getResources(service.id),
          serviceRelationsAPI.getAssets(service.id),
          serviceRelationsAPI.getEmployees(service.id),
          serviceRelationsAPI.getLocations(service.id),
        ]);
        if (!cancelled) {
          setResources(resRes?.data ?? resRes ?? []);
          setAssets(assRes?.data ?? assRes ?? []);
          setSvcEmployees(empRes?.data ?? empRes ?? []);
          setLocations(locRes?.data ?? locRes ?? []);
        }
      } catch (err) {
        console.error('Form_Service: failed to load relations', err);
      } finally {
        if (!cancelled) setRelLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [service?.id]);

  // ── Derived data ─────────────────────────────────────────────────
  const locationItems = inventory.filter(i => i.type === 'location');
  const resourceItems = inventory.filter(i => ['resource', 'product', 'item'].includes(i.type));
  const assetItems    = inventory.filter(i => i.type === 'asset');

  const linkedResourceIds = new Set(resources.map(r => r.inventory_id));
  const linkedAssetIds    = new Set(assets.map(a => a.inventory_id));
  const linkedEmployeeIds = new Set(svcEmployees.map(e => e.user_id));
  const linkedLocationIds = new Set(locations.map(l => l.inventory_id));

  const inventoryName = (id) => inventory.find(i => i.id === id)?.name ?? '—';
  const employeeName  = (id) => {
    const e = employees.find(e => e.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };
  const employeeColor = (id) => employees.find(e => e.id === id)?.color ?? '#6b7280';

  // ── Handlers ─────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      duration_minutes: parseInt(formData.duration_minutes),
    };
    if (!submitData.image_url) delete submitData.image_url;
    if (!submitData.category)  delete submitData.category;
    onSubmit(submitData);
  };

  const wrap = async (fn) => {
    setTabError('');
    try { await fn(); }
    catch (err) {
      setTabError(err?.response?.data?.detail || err?.message || 'Operation failed');
    }
  };

  const handleAddResource = () => wrap(async () => {
    if (!newResource.inventory_id) { setTabError('Select an item first'); return; }
    const res = await serviceRelationsAPI.addResource(service.id, newResource.inventory_id, parseFloat(newResource.quantity) || 1);
    setResources(prev => [...prev, res.data]);
    setNewResource({ inventory_id: '', quantity: '1' });
  });
  const handleRemoveResource = (id) => wrap(async () => {
    await serviceRelationsAPI.removeResource(id);
    setResources(prev => prev.filter(r => r.id !== id));
  });
  const handleUpdateResourceQty = async (id, quantity) => {
    try {
      await serviceRelationsAPI.updateResource(id, parseFloat(quantity) || 1);
      setResources(prev => prev.map(r => r.id === id ? { ...r, quantity: parseFloat(quantity) || 1 } : r));
    } catch (err) { console.error('Failed to update quantity', err); }
  };

  const handleAddAsset = () => wrap(async () => {
    if (!newAsset.inventory_id) { setTabError('Select an asset first'); return; }
    const res = await serviceRelationsAPI.addAsset(service.id, newAsset.inventory_id);
    setAssets(prev => [...prev, res.data]);
    setNewAsset({ inventory_id: '' });
  });
  const handleRemoveAsset = (id) => wrap(async () => {
    await serviceRelationsAPI.removeAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  });

  const handleAddEmployee = () => wrap(async () => {
    if (!newEmployee.user_id) { setTabError('Select an employee first'); return; }
    const res = await serviceRelationsAPI.addEmployee(service.id, newEmployee.user_id);
    setSvcEmployees(prev => [...prev, res.data]);
    setNewEmployee({ user_id: '' });
  });
  const handleRemoveEmployee = (id) => wrap(async () => {
    await serviceRelationsAPI.removeEmployee(id);
    setSvcEmployees(prev => prev.filter(e => e.id !== id));
  });

  const handleAddLocation = () => wrap(async () => {
    if (!newLocation.inventory_id) { setTabError('Select a location first'); return; }
    const res = await serviceRelationsAPI.addLocation(service.id, newLocation.inventory_id);
    setLocations(prev => [...prev, res.data]);
    setNewLocation({ inventory_id: '' });
  });
  const handleRemoveLocation = (id) => wrap(async () => {
    await serviceRelationsAPI.removeLocation(id);
    setLocations(prev => prev.filter(l => l.id !== id));
  });

  // ── Layout: flex column filling the modal body ───────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Container_Scrollable tab content ──────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }}>

        {/* Tab error */}
        {tabError && (
          <div className="alert alert-danger py-1 px-2 mb-2 small">{tabError}</div>
        )}

        {/* ── Details ── */}
        {activeTab === 'details' && (
          <form id="service-details-form" onSubmit={handleSubmit}>
            <div className="form-floating mb-2">
              <input type="text" id="name" name="name" required
                value={formData.name} onChange={handleChange}
                className="form-control form-control-sm" placeholder="Service Name" />
              <label htmlFor="name">Service Name *</label>
            </div>

            <div className="form-floating mb-2">
              <input type="text" id="category" name="category"
                value={formData.category} onChange={handleChange}
                className="form-control form-control-sm" placeholder="Category" />
              <label htmlFor="category">Category</label>
            </div>

            <div className="form-floating mb-2">
              <textarea id="description" name="description"
                value={formData.description} onChange={handleChange}
                className="form-control form-control-sm" placeholder="Description"
                style={{ height: '72px' }} />
              <label htmlFor="description">Description</label>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6">
                <div className="form-floating">
                  <input type="number" id="price" name="price" required min="0" step="0.01"
                    value={formData.price} onChange={handleChange}
                    className="form-control form-control-sm" placeholder="0.00" />
                  <label htmlFor="price">Price *</label>
                </div>
              </div>
              <div className="col-6">
                <div className="form-floating">
                  <input type="number" id="duration_minutes" name="duration_minutes" required min="1"
                    value={formData.duration_minutes} onChange={handleChange}
                    className="form-control form-control-sm" placeholder="60" />
                  <label htmlFor="duration_minutes">Duration (min) *</label>
                </div>
              </div>
            </div>

            <div className="form-floating mb-1">
              <input type="url" id="image_url" name="image_url"
                value={formData.image_url} onChange={handleChange}
                className="form-control form-control-sm" placeholder="https://..." />
              <label htmlFor="image_url">Image URL</label>
              {formData.image_url && (
                <img src={formData.image_url} alt="Preview"
                  className="mt-2 rounded border"
                  style={{ height: 56, width: 56, objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
            </div>
          </form>
        )}

        {/* ── Resources ── */}
        {activeTab === 'resources' && service && (
          <div>
            <p className="text-muted small mb-2">
              Consumable items used during this service (e.g. shampoo, conditioner).
            </p>
            {relLoading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              <>
                {resources.length === 0 ? (
                  <div className="text-muted small fst-italic mb-3">No resources linked yet.</div>
                ) : (
                  <table className="table table-sm mb-3">
                    <thead><tr><th style={{ width: 36 }}></th><th>Item</th><th style={{ width: 96 }}>Qty</th></tr></thead>
                    <tbody>
                      {resources.map(r => (
                        <tr key={r.id} className="align-middle">
                          <td>
                            <button type="button" className="btn btn-outline-danger btn-sm p-1"
                              onClick={() => handleRemoveResource(r.id)}>
                              <TrashIcon style={{ width: 13, height: 13 }} />
                            </button>
                          </td>
                          <td className="text-truncate" style={{ maxWidth: 160 }}>{inventoryName(r.inventory_id)}</td>
                          <td>
                            <input type="number" min="0" step="0.01"
                              className="form-control form-control-sm"
                              defaultValue={r.quantity}
                              onBlur={e => handleUpdateResourceQty(r.id, e.target.value)}
                              style={{ width: 80 }} />
                          </td>
                          
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="d-flex gap-2 align-items-center">
                  <select className="form-select form-select-sm flex-grow-1"
                    value={newResource.inventory_id}
                    onChange={e => setNewResource(prev => ({ ...prev, inventory_id: e.target.value }))}>
                    <option value="">— Select item —</option>
                    {resourceItems.filter(i => !linkedResourceIds.has(i.id)).map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <input type="number" min="0.01" step="0.01"
                    className="form-control form-control-sm" style={{ width: 72 }}
                    value={newResource.quantity}
                    onChange={e => setNewResource(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="Qty" />
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddResource}>
                    <PlusIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {resourceItems.length === 0 && (
                  <div className="text-muted small fst-italic mt-1">No resource/product items in inventory.</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Assets ── */}
        {activeTab === 'assets' && service && (
          <div>
            <p className="text-muted small mb-2">
              Equipment reserved for the full duration of this service (e.g. hair dryer, sink).
            </p>
            {relLoading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              <>
                {assets.length === 0 ? (
                  <div className="text-muted small fst-italic mb-3">No assets linked yet.</div>
                ) : (
                  <ul className="list-group list-group-flush mb-3">
                    {assets.map(a => (
                      <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <button type="button" className="btn btn-outline-danger btn-sm p-1"
                          onClick={() => handleRemoveAsset(a.id)}>
                          <TrashIcon style={{ width: 13, height: 13 }} />
                        </button>
                        <span className="text-truncate" style={{ maxWidth: 220 }}>{inventoryName(a.inventory_id)}</span>
                        
                      </li>
                    ))}
                  </ul>
                )}
                <div className="d-flex gap-2 align-items-center">
                  <select className="form-select form-select-sm flex-grow-1"
                    value={newAsset.inventory_id}
                    onChange={e => setNewAsset({ inventory_id: e.target.value })}>
                    <option value="">— Select asset —</option>
                    {assetItems.filter(i => !linkedAssetIds.has(i.id)).map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddAsset}>
                    <PlusIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {assetItems.length === 0 && (
                  <div className="text-muted small fst-italic mt-1">No asset-type items in inventory.</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Employees ── */}
        {activeTab === 'employees' && service && (
          <div>
            <p className="text-muted small mb-2">
              Employees capable of performing this service.
            </p>
            {relLoading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              <>
                {svcEmployees.length === 0 ? (
                  <div className="text-muted small fst-italic mb-3">No employees linked yet.</div>
                ) : (
                  <ul className="list-group list-group-flush mb-3">
                    {svcEmployees.map(se => (
                      <li key={se.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <button type="button" className="btn btn-outline-danger btn-sm p-1"
                          onClick={() => handleRemoveEmployee(se.id)}>
                          <TrashIcon style={{ width: 13, height: 13 }} />
                        </button>
                        <span className="d-flex align-items-center gap-2">
                          <span className="rounded-circle flex-shrink-0"
                            style={{ width: 10, height: 10, backgroundColor: employeeColor(se.user_id), display: 'inline-block' }} />
                          {employeeName(se.user_id)}
                        </span>
                        
                      </li>
                    ))}
                  </ul>
                )}
                <div className="d-flex gap-2 align-items-center">
                  <select className="form-select form-select-sm flex-grow-1"
                    value={newEmployee.user_id}
                    onChange={e => setNewEmployee({ user_id: e.target.value })}>
                    <option value="">— Select employee —</option>
                    {employees.filter(e => e.is_active && !linkedEmployeeIds.has(e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddEmployee}>
                    <PlusIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {employees.filter(e => e.is_active).length === 0 && (
                  <div className="text-muted small fst-italic mt-1">No active employees found.</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Locations ── */}
        {activeTab === 'locations' && service && (
          <div>
            <p className="text-muted small mb-2">
              Locations where this service is offered (e.g. franchise branches).
            </p>
            {relLoading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              <>
                {locations.length === 0 ? (
                  <div className="text-muted small fst-italic mb-3">No locations linked yet.</div>
                ) : (
                  <ul className="list-group list-group-flush mb-3">
                    {locations.map(loc => (
                      <li key={loc.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <button type="button" className="btn btn-outline-danger btn-sm p-1"
                          onClick={() => handleRemoveLocation(loc.id)}>
                          <TrashIcon style={{ width: 13, height: 13 }} />
                        </button>
                        <span className="text-truncate" style={{ maxWidth: 220 }}>
                          {inventoryName(loc.inventory_id)}
                        </span>
                        
                      </li>
                    ))}
                  </ul>
                )}
                <div className="d-flex gap-2 align-items-center">
                  <select className="form-select form-select-sm flex-grow-1"
                    value={newLocation.inventory_id}
                    onChange={e => setNewLocation({ inventory_id: e.target.value })}>
                    <option value="">— Select location —</option>
                    {locationItems.filter(i => !linkedLocationIds.has(i.id)).map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddLocation}>
                    <PlusIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {locationItems.length === 0 && (
                  <div className="text-muted small fst-italic mt-1">
                    No locations found. Add items with type "location" in Inventory.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer (sticky, always visible) ──────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--bs-border-color)',
        background: 'var(--bs-body-bg)',
      }}>
        {/* Row 1: Tab navigation — only when editing */}
        {service && (
          <div className="px-2 pt-2 pb-1 d-flex gap-1 overflow-auto flex-nowrap">
            {TABS.map(tab => {
              const count = tab === 'resources' ? resources.length
                : tab === 'assets'    ? assets.length
                : tab === 'employees' ? svcEmployees.length
                : tab === 'locations' ? locations.length
                : 0;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`btn btn-sm flex-shrink-0 ${activeTab === tab ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => { setActiveTab(tab); setTabError(''); }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {count > 0 && (
                    <span className={`badge ms-1 ${activeTab === tab ? 'bg-white text-primary' : 'bg-secondary'}`}
                      style={{ fontSize: '0.6rem' }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Row 2: Actions */}
        <div className="px-3 py-2 pb-4 d-flex align-items-center">
          {/* Left: Delete */}
          <div style={{ width: 40 }}>
            {service && canDelete && (
              <button
                type="button"
                style={{ height: '3rem', width: '3rem' }}
                className="btn btn-outline-danger btn-sm p-1 align-items-center justify-content-center d-flex"
                title="Delete service"
                onClick={() => {
                  if (window.confirm('Delete this service?')) onDelete(service.id);
                }}
              >
                <TrashIcon style={{ width: 18, height: 18 }} />
              </button>
            )}
          </div>

          {/* Center: Cancel + Save */}
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <button
              type="button"
              style={{ height: '3rem', width: '3rem' }}
              className="btn btn-outline-secondary btn-sm p-1 align-items-center justify-content-center d-flex"
              title="Cancel"
              onClick={onCancel}
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>

            {/* Save only shown on Details tab */}
            {activeTab === 'details' && (
              <button
                type="submit"
                form="service-details-form"
                className="btn btn-primary btn-sm p-1 align-items-center justify-content-center d-flex"
                title={service ? 'Update service' : 'Create service'}
                style={{ height: '3rem', width: '3rem' }}
              >
                <CheckIcon style={{ width: 18, height: 18 }} />
              </button>
            )}
          </div>

          {/* Right spacer to balance delete */}
          <div style={{ width: 40 }} />
        </div>
      </div>
    </div>
  );
}
