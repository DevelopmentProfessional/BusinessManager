# QUICK START GUIDE

## 🚀 5-Step Implementation Process

This guide walks you through deploying all 8 new features.

---

## Step 1: Database Setup (5 minutes)

### Run the migration to create all new tables:

```bash
cd backend
python migrations/add_workflow_audit_financial.py
```

**Or if using Alembic:**
```bash
cd backend
alembic upgrade head
```

**Verify in database:**
```sql
-- Connect to your PostgreSQL database
\dt audit_log
\dt workflow_template
\dt accounts_receivable
\dt procurement_order
-- Should see all 13 new tables
```

---

## Step 2: Seed Test Data (3 minutes)

### Populate tables with sample data for testing:

```bash
cd backend
python seed_new_features.py
```

**Expected output:**
```
Seeding test data for company: [uuid]
==================================================
✓ Created 3 workflow templates
✓ Created 50 audit log entries
✓ Created 9 GL accounts
✓ Created 5 AR records
✓ Created 5 AP records
✓ Created 5 purchase orders at various stages
✓ Created 1 inventory cost record
✓ Created schedule settings for user

==================================================
✅ Test data seeding completed successfully!
```

---

## Step 3: Verify Backend APIs (5 minutes)

### Test endpoints using curl or your API client:

```bash
# List workflows
curl http://localhost:8000/api/v1/workflows

# Get audit logs
curl http://localhost:8000/api/v1/audit-logs

# Get AR aging summary
curl http://localhost:8000/api/v1/accounts-receivable

# Get pending orders count
curl http://localhost:8000/api/v1/pending-orders/count

# Get purchase orders
curl http://localhost:8000/api/v1/purchase-orders

# Get schedule settings
curl http://localhost:8000/api/v1/schedule-settings/[USER_ID]
```

All should return `200 OK` with test data.

---

## Step 4: Integrate Components into Frontend (15-20 minutes)

### Location 1: Documents.jsx

**After line with document viewer, add:**

```jsx
import { WorkflowModal, WorkflowStatusTracker, ApprovalActions } 
  from './components/WorkflowApproval';

// In document toolbar:
<button
  onClick={() => setShowWorkflowModal(true)}
  className="px-4 py-2 bg-blue-600 text-white rounded"
>
  + Assign Workflow
</button>

// In document detail view:
{showWorkflowModal && (
  <WorkflowModal
    documentId={selectedDocument.id}
    onClose={() => setShowWorkflowModal(false)}
    onAssigned={() => {
      setShowWorkflowModal(false);
      refreshDocument();
    }}
  />
)}

<WorkflowStatusTracker 
  documentId={selectedDocument.id}
  onWorkflowUpdated={refreshDocument}
/>

<ApprovalActions 
  onApprovalComplete={refreshDocument}
/>
```

### Location 2: Reports.jsx

**Add import:**
```jsx
import FinancialDashboard from './components/FinancialDashboard';
```

**Add button in toolbar:**
```jsx
<button
  onClick={() => setShowFinancial(true)}
  className="px-4 py-2 bg-green-600 text-white rounded"
>
  💰 Financial Dashboard
</button>

{showFinancial && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 p-4 border-b flex justify-between">
        <h2 className="text-2xl font-bold">Financial Dashboard</h2>
        <button onClick={() => setShowFinancial(false)}>✕</button>
      </div>
      <div className="p-6">
        <FinancialDashboard />
      </div>
    </div>
  </div>
)}
```

### Location 3: Inventory.jsx

**Add imports:**
```jsx
import InventoryIntelligence from './components/InventoryIntelligence';
import ProcurementUI from './components/ProcurementUI';
```

**After inventory table:**
```jsx
<InventoryIntelligence 
  onCreatePO={(inventoryId) => handleCreatePO(inventoryId)}
/>
```

**In suppliers section:**
```jsx
<ProcurementUI 
  supplierId={selectedSupplier.id}
  onPOCreated={refreshPOs}
/>
```

### Location 4: Profile.jsx or MyAccount.jsx

**Add import:**
```jsx
import ScheduleSettings from './components/ScheduleSettings';
```

**In settings area (typically in grid layout):**
```jsx
<div className="lg:col-span-3">
  <ScheduleSettings userId={currentUser.id} />
</div>
```

### Location 5: Layout.jsx or Header.jsx

**Add import:**
```jsx
import PendingOrderBadge from './components/PendingOrderBadge';
```

**Wrap client icon:**
```jsx
<div className="relative">
  <button onClick={openClientMenu}>
    <UserIcon className="w-6 h-6" />
    <PendingOrderBadge clientId={currentUser?.client_id} />
  </button>
</div>
```

---

## Step 5: Test in Browser (10-15 minutes)

### Test Each Feature:

**Workflows:**
1. Go to Documents page
2. Click "Assign Workflow"
3. Select a workflow from the modal
4. Should see workflow progress tracker
5. Click "Approve" to progress workflow

**Financial Dashboard:**
1. Go to Reports page
2. Click "Financial Dashboard"
3. Should see:
   - 3 KPI cards (cash, AR, AP)
   - AR aging table
   - AP aging table
   - Low stock alerts

**Inventory Intelligence:**
1. Go to Inventory page
2. Scroll down to see:
   - 4 KPI cards
   - ABC analysis
   - Reorder recommendations
   - Detailed stock table

**Schedule Settings:**
1. Go to Profile page
2. Scroll to Schedule Settings
3. Toggle "Auto-Accept Client Bookings"
4. Set grace period to 24
5. Click Save
6. Should see success message

**Pending Orders Badge:**
1. Look at bottom-right client icon
2. Should see red badge with pending count
3. Badge updates every 30 seconds automatically

---

## Browser Console Testing

```javascript
// Test API responses directly in browser console

// Workflows
fetch('/api/v1/workflows').then(r => r.json()).then(console.log)

// Audit logs
fetch('/api/v1/audit-logs?limit=10').then(r => r.json()).then(console.log)

// Pending orders
fetch('/api/v1/pending-orders/count').then(r => r.json()).then(console.log)

// AR aging
fetch('/api/v1/accounts-receivable').then(r => r.json()).then(console.log)

// Financial
fetch('/api/v1/purchase-orders').then(r => r.json()).then(console.log)

// Schedule settings
fetch('/api/v1/schedule-settings/YOUR_USER_ID').then(r => r.json()).then(console.log)
```

---

## 🐛 Troubleshooting

### Error: "Module not found: workflows"
**Fix:** Make sure `backend/routers/workflows.py` exists and is imported in `main.py`

### Error: "Table does not exist"
**Fix:** Run the migration: `python migrations/add_workflow_audit_financial.py`

### Error: "401 Unauthorized"
**Fix:** Make sure you're sending authentication token in headers

### Components not rendering
**Fix:** Check import paths are correct relative to component location

### Pending badge not showing
**Fix:** Verify PendingOrderBadge is wrapped around client icon, check clientId is valid

---

## ✅ Checklist

- [ ] Database migration run (`python migrations/...`)
- [ ] Test data seeded (`python seed_new_features.py`)
- [ ] Backend APIs tested (curl commands successful)
- [ ] Components imported into 5 locations
- [ ] Each component tested in browser
- [ ] No console errors
- [ ] All buttons clickable and modals open
- [ ] Data displays correctly from APIs

---

## Performance Notes

✅ **Things already optimized:**
- Indexes on company_id (multi-tenant isolation)
- Workflow stages stored in JSON (flexible, no extra queries)
- Financial aging calculated at query time (always current)
- Badge refreshes every 30 seconds (not too aggressive)
- Large tables paginated if needed

---

## 📞 Common Questions

**Q: Do I need to restart the backend after migration?**
A: Recommended, as new model classes need to be loaded into memory.

**Q: Can I revert the migration?**
A: Yes, run: `python migrations/add_workflow_audit_financial.py downgrade`

**Q: What if I have existing workflows?**
A: Create new templates using the APIs, old data is unaffected.

**Q: Is this multi-tenant safe?**
A: Yes, all tables have company_id, all queries filter by current_user.company_id

**Q: How often is the pending badge updated?**
A: Every 30 seconds (configurable in PendingOrderBadge.jsx)

---

## Next Steps After Deployment

1. **Create real workflow templates** via UI for your approval processes
2. **Set up GL accounts** in financial dashboard for your chart of accounts
3. **Configure schedule settings** for each user
4. **Monitor audit logs** to see activity tracking working
5. **Create purchase orders** via procurement UI for suppliers
6. **Test workflows end-to-end** with actual documents

---

**Status: Ready to deploy in < 1 hour**

For detailed integration code, see `INTEGRATION_GUIDE.md`
For deployment checklist, see `FEATURE_COMPLETION.md`
