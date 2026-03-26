/**
 * ============================================================
 * INTEGRATION GUIDE: All Components
 * 
 * This document shows where and how to integrate all new
 * components into existing pages.
 * ============================================================
 */

// ============================================================
// 1. DOCUMENTS PAGE - Add Workflow Approval UI
// ============================================================

// FILE: frontend/src/pages/Documents.jsx
// LOCATION: At the top with other imports

import WorkflowApproval from './components/WorkflowApproval';
import { WorkflowModal, WorkflowStatusTracker, ApprovalActions } from './components/WorkflowApproval';

// Insert this inside the document viewer section (around line where document details are shown):

{/* Workflow Section - Add after document content viewer */}
<div className="mt-6 border-t pt-6">
  <WorkflowStatusTracker 
    documentId={selectedDocument.id}
    onWorkflowUpdated={refreshDocumentData}
  />
  
  {userRole === 'approver' && (
    <ApprovalActions 
      onApprovalComplete={refreshDocumentData}
    />
  )}
</div>

// Add button to document toolbar/actions:
<button
  onClick={() => setShowWorkflowModal(true)}
  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
>
  + Assign Workflow
</button>

{showWorkflowModal && (
  <WorkflowModal
    documentId={selectedDocument.id}
    onClose={() => setShowWorkflowModal(false)}
    onAssigned={() => {
      setShowWorkflowModal(false);
      refreshDocumentData();
    }}
  />
)}


// ============================================================
// 2. REPORTS PAGE - Add Financial Dashboard
// ============================================================

// FILE: frontend/src/pages/Reports.jsx
// LOCATION: At the top with other imports

import FinancialDashboard from './components/FinancialDashboard';

// Add this button to the navigation/toolbar area:

<button
  onClick={() => setShowFinancialDashboard(true)}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
>
  💰 Financial Dashboard
</button>

// Add this modal/panel below the main reports:

{showFinancialDashboard && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex justify-between">
        <h2 className="text-2xl font-bold">Financial Dashboard</h2>
        <button 
          onClick={() => setShowFinancialDashboard(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      <div className="p-6">
        <FinancialDashboard 
          onCreatePO={handleCreatePurchaseOrder}
        />
      </div>
    </div>
  </div>
)}


// ============================================================
// 3. INVENTORY PAGE - Add Inventory Intelligence
// ============================================================

// FILE: frontend/src/pages/Inventory.jsx (or InventoryManagement.jsx)
// LOCATION: At the top with other imports

import InventoryIntelligence from './components/InventoryIntelligence';
import ProcurementUI from './components/ProcurementUI';

// Add InventoryIntelligence component right after the main inventory table:

<InventoryIntelligence 
  onCreatePO={(inventoryId) => handleCreatePO(inventoryId)}
/>

// In the suppliers section (if it exists), add ProcurementUI:

<ProcurementUI 
  supplierId={selectedSupplier.id}
  onPOCreated={refreshPurchaseOrders}
/>


// ============================================================
// 4. PROFILE PAGE - Add Schedule Settings
// ============================================================

// FILE: frontend/src/pages/Profile.jsx (or MyAccount.jsx)
// LOCATION: At the top with other imports

import ScheduleSettings from './components/ScheduleSettings';

// Add Schedule Settings component in the profile settings section:

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Existing profile sections */}
  
  {/* New: Schedule Settings */}
  <div className="lg:col-span-3">
    <ScheduleSettings userId={currentUser.id} />
  </div>
</div>


// ============================================================
// 5. LAYOUT/HEADER - Add Pending Order Badge
// ============================================================

// FILE: frontend/src/pages/Layout.jsx (or components/Header.jsx)
// LOCATION: Where the client menu icon is rendered (bottom-right)

import PendingOrderBadge from './components/PendingOrderBadge';

// Wrap the client icon with the badge:

<div className="relative">
  {/* Your existing client menu icon */}
  <button 
    onClick={handleOpenClientMenu}
    className="relative p-2 hover:bg-gray-100 rounded-full"
  >
    <UserIcon className="w-6 h-6 text-gray-600" />
    {/* Add the badge component */}
    <PendingOrderBadge clientId={currentUser?.client_id} />
  </button>
</div>


// ============================================================
// STATE MANAGEMENT - Add to main app state
// ============================================================

// In your main app state hook/reducer, add:

const [showWorkflowModal, setShowWorkflowModal] = useState(false);
const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);
const [selectedDocument, setSelectedDocument] = useState(null);


// ============================================================
// SUMMARY OF API ENDPOINTS IN USE
// ============================================================

/*
WORKFLOW ENDPOINTS:
  GET    /api/v1/workflows                           — List available workflows
  POST   /api/v1/documents/{id}/assign-workflow      — Assign workflow to document
  GET    /api/v1/documents/{id}/workflow             — Get workflow status
  GET    /api/v1/documents/{id}/workflow-steps       — Get approval steps
  POST   /api/v1/approval-steps/{id}/approve         — Approve step
  POST   /api/v1/approval-steps/{id}/reject          — Reject step

FINANCIAL ENDPOINTS:
  GET    /api/v1/accounts-receivable                 — AR aging summary
  GET    /api/v1/accounts-payable                    — AP aging summary
  GET    /api/v1/gl-accounts                         — Chart of accounts
  GET    /api/v1/gl-trial-balance                    — Trial balance
  GET    /api/v1/purchase-orders                     — List POs
  POST   /api/v1/purchase-orders                     — Create PO
  PUT    /api/v1/purchase-orders/{id}/send           — Send PO
  GET    /api/v1/inventory-costs                     — Costing insights
  POST   /api/v1/inventory-costs                     — Create/update costs

INVENTORY ENDPOINTS:
  GET    /api/v1/inventory-costs?low_stock_only=true — Low stock items

AUDIT ENDPOINTS:
  GET    /api/v1/audit-logs                          — List audit logs
  GET    /api/v1/audit-summary                       — Audit summary

SETTINGS ENDPOINTS:
  GET    /api/v1/schedule-settings/{user_id}        — Get user schedule
  PUT    /api/v1/schedule-settings/{user_id}        — Update schedule
  GET    /api/v1/pending-orders                      — List pending
  GET    /api/v1/pending-orders/count                — Pending count
  GET    /api/v1/pending-orders/summary              — Summary


// ============================================================
// COMPONENT PROPS REFERENCE
// ============================================================

WorkflowStatusTracker:
  - documentId: UUID (required)
  - onWorkflowUpdated: () => void (callback when updated)

ApprovalActions:
  - stepId: UUID (required)
  - onApprovalComplete: () => void (callback)

FinancialDashboard:
  - onCreatePO: (inventoryId) => void (callback)

InventoryIntelligence:
  - onCreatePO: (inventoryId) => void (callback)

ProcurementUI:
  - supplierId: UUID (required)
  - onPOCreated: () => void (callback)

ScheduleSettings:
  - userId: UUID (required)

PendingOrderBadge:
  - clientId: UUID (optional - if provided, shows pending count for this client)
*/
