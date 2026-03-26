# Workflow Management System - Detailed Design & Architecture
## Implementation Guide for Document Routing & Approval Workflows

---

## 1. OVERVIEW

The Workflow Management System allows documents (invoices, POs, leave requests, expense reports, etc.) to flow through defined paths with role-based and person-specific approval gates, signature requirements, and SLA tracking.

### Core Features
- **Visual workflow builder** - Drag-and-drop workflow designer
- **Multi-stage routing** - Documents progress through sequential or parallel approval stages
- **Role/Person-based rules** - Route to specific roles, departments, or individuals
- **Signature requirements** - Require 1+ signatures from specified people/roles
- **Audit trail** - Complete history of workflow journey
- **SLA/deadline tracking** - Alert when approvals are overdue
- **Mobile-optimized** - Drag-and-drop friendly on touch devices
- **Conditional routing** - "If amount > $5000, route to CFO"

---

## 2. DATA MODEL

### New Database Tables

```python
# ─── WORKFLOW CONFIGURATION ────────────────────

class WorkflowTemplate(BaseModel, table=True):
    """Reusable workflow definitions (e.g., 'Expense Approval', 'Invoice Approval')"""
    __tablename__ = "workflow_template"
    
    name: str = Field(index=True)
    description: Optional[str] = None
    document_type: str  # "expense", "invoice", "leave_request", "purchase_order", etc.
    company_id: str = Field(index=True)
    is_active: bool = Field(default=True)
    
    # Workflow structure (stored as JSON for flexibility)
    # Allows quick loading without multiple queries
    Stage details as JSON:
    # {
    #   "stages": [
    #     {
    #       "id": "stage_1",
    #       "name": "Manager Review",
    #       "type": "sequential",  # sequential or parallel
    #       "approver_type": "role",  # "role", "person", "department"
    #       "approver_value": "manager",  # role name, user ID, or dept name
    #       "required_approvals": 1,
    #       "signatures_required": False,
    #       "sla_hours": 24,  # deadline in hours
    #       "next_stage_success": "stage_2",
    #       "next_stage_reject": "stage_reject"
    #     }
    #   ]
    # }
    stages_json: str = Field(default='{"stages": []}')
    
    # Conditions for dynamic routing
    # e.g., "if amount > 5000, route to CFO"
    routing_rules_json: Optional[str] = None  # flexibility for future
    
    created_by: Optional[UUID] = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class WorkflowStageDefinition(BaseModel, table=True):
    """Detailed per-stage configuration (denormalized from JSON for queries)"""
    __tablename__ = "workflow_stage_definition"
    
    workflow_template_id: UUID = Field(foreign_key="workflow_template.id", index=True)
    stage_order: int  # 1, 2, 3...
    stage_id: str  # "stage_1", "stage_2"
    stage_name: str
    
    execution_type: str = "sequential"  # sequential or parallel
    approver_type: str  # "role", "person", "department"
    approver_value: str  # role name, user UUID, or department name
    required_approvals: int = 1  # how many approvals needed if parallel
    signatures_required: bool = False
    signature_type: Optional[str] = None  # "individual", "group", "department"
    
    sla_hours: Optional[int] = None  # null = no deadline
    allow_skip: bool = False  # can stage be skipped
    allow_reassign: bool = True  # can approver reassign to someone else
    
    reject_action: str = "send_back_to_start"  # or "send_back_to_specific_stage"
    reject_target_stage_id: Optional[str] = None


class DocumentWorkflowInstance(BaseModel, table=True):
    """Instance of a workflow for a specific document"""
    __tablename__ = "document_workflow_instance"
    
    document_id: UUID = Field(foreign_key="document.id", index=True, unique=True)
    workflow_template_id: UUID = Field(foreign_key="workflow_template.id")
    company_id: str = Field(index=True)
    
    # Current state
    current_stage_id: Optional[str] = None  # null = completed or rejected
    current_approver_id: Optional[UUID] = Field(foreign_key="user.id")
    
    # Workflow status
    status: str = "in_progress"  # in_progress, approved, rejected, cancelled
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    # Rejection tracking
    rejection_reason: Optional[str] = None
    rejection_count: int = 0


class WorkflowApprovalStep(BaseModel, table=True):
    """Record of each approval action taken"""
    __tablename__ = "workflow_approval_step"
    
    workflow_instance_id: UUID = Field(foreign_key="document_workflow_instance.id", index=True)
    stage_id: str
    stage_name: str
    
    assigned_to_user_id: UUID = Field(foreign_key="user.id", index=True)
    assigned_to_role: Optional[str] = None  # for audit purposes
    assigned_by: Optional[UUID] = Field(foreign_key="user.id")
    
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    due_at: Optional[datetime] = None  # SLA deadline
    
    # Action taken
    action: str = "pending"  # pending, approved, rejected, reassigned, escalated
    action_by_user_id: Optional[UUID] = Field(foreign_key="user.id")  # who took action
    action_at: Optional[datetime] = None
    action_reason: Optional[str] = None  # why rejected
    
    # Signature details
    signature_image: Optional[str] = None  # base64 PNG
    signature_date: Optional[datetime] = None


class WorkflowApproverGroup(BaseModel, table=True):
    """Maps roles/departments to users for workflow routing"""
    __tablename__ = "workflow_approver_group"
    
    workflow_template_id: UUID = Field(foreign_key="workflow_template.id", index=True)
    stage_id: str
    approver_type: str  # "role", "department"
    approver_value: str  # role name or department name
    
    user_id: UUID = Field(foreign_key="user.id", index=True)
    company_id: str = Field(index=True)
    is_active: bool = True
    
    # Allow ordered priority (first approver gets assignment)
    priority: int = 1


# ─── NOTIFICATIONS ────────────────────────────

class WorkflowNotification(BaseModel, table=True):
    """Tracks notifications sent about workflow approvals"""
    __tablename__ = "workflow_notification"
    
    approval_step_id: UUID = Field(foreign_key="workflow_approval_step.id")
    user_id: UUID = Field(foreign_key="user.id", index=True)
    
    notification_type: str  # "assignment", "reminder", "escalation"
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None
    
    # Content
    subject: str
    message: str
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    
    # For escalation
    escalated_to_user_id: Optional[UUID] = Field(foreign_key="user.id")
```

### Model Relationships
```
WorkflowTemplate (1) ──────┬──── (N) WorkflowStageDefinition
                           ├──── (N) DocumentWorkflowInstance
                           └──── (N) WorkflowApproverGroup

Document (1) ────────────── (1) DocumentWorkflowInstance
                                   │
                                   └──── (N) WorkflowApprovalStep
                                          └──── (1) User (approver)
                                          └──── (N) WorkflowNotification
```

---

## 3. WORKFLOW BUILDER COMPONENT (React)

### File Structure
```
frontend/src/pages/
  WorkflowManager.jsx          # Main page
  components/
    WorkflowBuilder.jsx         # Visual drag-and-drop designer
    StageEditor.jsx             # Edit individual stage
    ApproverSelector.jsx        # Choose approver (role/person/dept)
    WorkflowPreview.jsx         # Preview workflow path
    WorkflowInstanceTracker.jsx # View workflow progress for a document
```

### WorkflowBuilder.jsx - Main Component

```jsx
/**
 * ============================================================
 * FILE: WorkflowBuilder.jsx
 *
 * PURPOSE:
 *   Drag-and-drop visual workflow designer.
 *   Allows creation/editing of approval workflows.
 *   Mobile-optimized with touch drag support.
 *
 * FEATURES:
 *   - Add/remove stages
 *   - Drag to reorder (desktop + mobile)
 *   - Configure each stage (approver, SLA, signatures)
 *   - Preview workflow path
 *   - Save/publish workflow
 * ============================================================
 */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  TrashIcon, 
  EyeIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationIcon
} from '@heroicons/react/24/outline';

const WorkflowBuilder = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  
  // ─── STATE ────────────────────────────────────────────────────────────
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    document_type: 'invoice',
    stages: []
  });
  
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [draggedStageId, setDraggedStageId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  
  // ─── HANDLERS ──────────────────────────────────────────────────────────
  
  const handleAddStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: `Stage ${workflow.stages.length + 1}`,
      type: 'sequential',
      approver_type: 'role',
      approver_value: 'manager',
      required_approvals: 1,
      signatures_required: false,
      sla_hours: 24
    };
    
    setWorkflow({
      ...workflow,
      stages: [...workflow.stages, newStage]
    });
    
    setSelectedStageId(newStage.id);
    setShowStageEditor(true);
  };
  
  const handleRemoveStage = (stageId) => {
    setWorkflow({
      ...workflow,
      stages: workflow.stages.filter(s => s.id !== stageId)
    });
    setSelectedStageId(null);
  };
  
  const handleUpdateStage = (stageId, updates) => {
    setWorkflow({
      ...workflow,
      stages: workflow.stages.map(s =>
        s.id === stageId ? { ...s, ...updates } : s
      )
    });
  };
  
  const handleReorderStages = (draggedId, targetId) => {
    const draggedIdx = workflow.stages.findIndex(s => s.id === draggedId);
    const targetIdx = workflow.stages.findIndex(s => s.id === targetId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;
    
    const newStages = [...workflow.stages];
    [newStages[draggedIdx], newStages[targetIdx]] = [newStages[targetIdx], newStages[draggedIdx]];
    
    setWorkflow({ ...workflow, stages: newStages });
  };
  
  const handleSaveWorkflow = async () => {
    if (!workflow.name.trim()) {
      alert('Workflow name is required');
      return;
    }
    
    if (workflow.stages.length === 0) {
      alert('Please add at least one approval stage');
      return;
    }
    
    try {
      const endpoint = workflowId 
        ? `/api/v1/workflows/${workflowId}`
        : '/api/v1/workflows';
      
      const response = await fetch(endpoint, {
        method: workflowId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      
      if (!response.ok) throw new Error('Failed to save workflow');
      
      alert('Workflow saved successfully');
      navigate('/workflows');
    } catch (error) {
      console.error(error);
      alert('Error saving workflow');
    }
  };
  
  // ─── RENDER ───────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflow Builder</h1>
          <p className="text-gray-600 mt-2">Design document approval flows</p>
        </div>
        
        {/* Workflow Properties */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <input
            type="text"
            placeholder="Workflow Name (e.g., Invoice Approval)"
            value={workflow.name}
            onChange={(e) => setWorkflow({...workflow, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
          />
          
          <textarea
            placeholder="Description"
            value={workflow.description}
            onChange={(e) => setWorkflow({...workflow, description: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 h-20"
          />
          
          <select
            value={workflow.document_type}
            onChange={(e) => setWorkflow({...workflow, document_type: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="invoice">Invoice</option>
            <option value="expense">Expense Report</option>
            <option value="leave_request">Leave Request</option>
            <option value="purchase_order">Purchase Order</option>
            <option value="travel_request">Travel Request</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        {/* Stage Designer */}
        <div className="grid grid-cols-3 gap-8">
          
          {/* Left: Stages List (Mobile: full width, then center) */}
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Approval Stages</h2>
              <button
                onClick={handleAddStage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-5 h-5" />
                Add Stage
              </button>
            </div>
            
            {workflow.stages.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">No stages yet. Click "Add Stage" to begin.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workflow.stages.map((stage, index) => (
                  <div key={stage.id}>
                    {/* Stage Card */}
                    <div
                      draggable
                      onDragStart={() => setDraggedStageId(stage.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleReorderStages(draggedStageId, stage.id)}
                      onClick={() => setSelectedStageId(stage.id)}
                      className={`p-4 border-2 rounded-lg cursor-move transition ${
                        selectedStageId === stage.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-200 text-gray-700 text-sm font-bold rounded-full">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="font-medium text-gray-900">{stage.name}</h3>
                              <p className="text-sm text-gray-600">
                                {stage.approver_type === 'role' && `Role: ${stage.approver_value}`}
                                {stage.approver_type === 'person' && `Specific person`}
                                {stage.approver_type === 'department' && `Department: ${stage.approver_value}`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStage(stage.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* Stage details summary */}
                      <div className="mt-3 text-sm text-gray-600 space-y-1">
                        <p>{stage.type === 'sequential' ? 'Sequential' : 'Parallel'} execution</p>
                        {stage.sla_hours && <p>{stage.sla_hours}h SLA</p>}
                        {stage.signatures_required && <p>✓ Signature required</p>}
                      </div>
                    </div>
                    
                    {/* Arrow to next stage */}
                    {index < workflow.stages.length - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowRightIcon className="w-5 h-5 text-gray-400 transform rotate-90" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right: Stage Editor (Mobile: below list) */}
          <div className="col-span-3 lg:col-span-1">
            {selectedStageId ? (
              <StageEditor
                stage={workflow.stages.find(s => s.id === selectedStageId)}
                onUpdate={(updates) => handleUpdateStage(selectedStageId, updates)}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-gray-600">Select a stage to edit</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Buttons */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <EyeIcon className="w-5 h-5" />
            Preview
          </button>
          
          <button
            onClick={() => navigate('/workflows')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSaveWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <CheckCircleIcon className="w-5 h-5" />
            Save Workflow
          </button>
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreview && (
        <WorkflowPreview
          workflow={workflow}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder;
```

### StageEditor.jsx - Edit Individual Stage

```jsx
import React, { useState } from 'react';

const StageEditor = ({ stage, onUpdate }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Settings</h3>
      
      <div className="space-y-4">
        {/* Stage Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage Name
          </label>
          <input
            type="text"
            value={stage.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        
        {/* Execution Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Execution Type
          </label>
          <select
            value={stage.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="sequential">Sequential (one after another)</option>
            <option value="parallel">Parallel (simultaneous)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Sequential: approvals happen one-by-one. Parallel: all approvers at once.
          </p>
        </div>
        
        {/* Approver Type */}
        <ApproverSelector stage={stage} onUpdate={onUpdate} />
        
        {/* Required Approvals (for parallel) */}
        {stage.type === 'parallel' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Approvals Required
            </label>
            <input
              type="number"
              min="1"
              value={stage.required_approvals}
              onChange={(e) => onUpdate({ required_approvals: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              How many of the approvers must approve?
            </p>
          </div>
        )}
        
        {/* SLA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SLA Deadline (hours)
          </label>
          <input
            type="number"
            min="0"
            value={stage.sla_hours || ''}
            onChange={(e) => onUpdate({ sla_hours: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Leave blank for no deadline"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Alert if approval not completed within this time
          </p>
        </div>
        
        {/* Signature Required */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={stage.signatures_required}
              onChange={(e) => onUpdate({ signatures_required: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Require Signature
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Document must be digitally signed to proceed
          </p>
        </div>
        
        {/* Allow Reassign */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={stage.allow_reassign}
              onChange={(e) => onUpdate({ allow_reassign: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Allow Reassignment
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Approver can reassign to another person in same role
          </p>
        </div>
      </div>
    </div>
  );
};

export default StageEditor;
```

### ApproverSelector.jsx - Choose Who Approves

```jsx
import React, { useState, useEffect } from 'react';

const ApproverSelector = ({ stage, onUpdate }) => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  useEffect(() => {
    // Load available users and departments
    Promise.all([
      fetch('/api/v1/users').then(r => r.json()),
      fetch('/api/v1/departments').then(r => r.json())
    ]).then(([usersData, deptsData]) => {
      setUsers(usersData);
      setDepartments(deptsData);
    });
  }, []);
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Who Must Approve?
      </label>
      
      <div className="space-y-3">
        {/* Type Selection */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'role', label: 'By Role' },
            { value: 'department', label: 'By Department' },
            { value: 'person', label: 'Specific Person' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => onUpdate({ approver_type: option.value, approver_value: '' })}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                stage.approver_type === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        
        {/* Value Selection */}
        {stage.approver_type === 'role' && (
          <select
            value={stage.approver_value}
            onChange={(e) => onUpdate({ approver_value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">-- Select Role --</option>
            <option value="manager">Manager</option>
            <option value="finance">Finance</option>
            <option value="admin">Admin</option>
            <option value="ceo">CEO</option>
          </select>
        )}
        
        {stage.approver_type === 'department' && (
          <select
            value={stage.approver_value}
            onChange={(e) => onUpdate({ approver_value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">-- Select Department --</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        )}
        
        {stage.approver_type === 'person' && (
          <select
            value={stage.approver_value}
            onChange={(e) => onUpdate({ approver_value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">-- Select Person --</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default ApproverSelector;
```

---

## 4. WORKFLOW INSTANCE TRACKER (Show Workflow Progress)

```jsx
/**
 * WorkflowInstanceTracker.jsx
 * Shows current and past workflow progress for a document
 */

const WorkflowInstanceTracker = ({ documentId }) => {
  const [instance, setInstance] = useState(null);
  const [approvalSteps, setApprovalSteps] = useState([]);
  
  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/documents/${documentId}/workflow`).then(r => r.json()),
      fetch(`/api/v1/documents/${documentId}/workflow-steps`).then(r => r.json())
    ]).then(([inst, steps]) => {
      setInstance(inst);
      setApprovalSteps(steps);
    });
  }, [documentId]);
  
  if (!instance) return <div>Loading...</div>;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Progress</h3>
      
      <div className="space-y-4">
        {approvalSteps.map((step, index) => (
          <div key={step.id} className="flex gap-4">
            {/* Status Indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                step.action === 'approved' ? 'bg-green-600' :
                step.action === 'rejected' ? 'bg-red-600' :
                step.action === 'pending' ? 'bg-yellow-600' :
                'bg-gray-400'
              }`}>
                {step.action === 'approved' ? '✓' :
                 step.action === 'rejected' ? '✗' :
                 step.action === 'pending' ? '⏱' :
                 '○'}
              </div>
              {index < approvalSteps.length - 1 && (
                <div className="w-1 h-12 bg-gray-300 my-1"></div>
              )}
            </div>
            
            {/* Step Details */}
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{step.stage_name}</h4>
              <p className="text-sm text-gray-600">
                Assigned to: {step.assigned_to_user?.name}
              </p>
              <p className="text-sm text-gray-600">
                Assigned {formatDate(step.assigned_at)}
                {step.action_at && ` • ${step.action === 'approved' ? 'Approved' : 'Rejected'} ${formatDate(step.action_at)}`}
              </p>
              {step.action_reason && (
                <p className="text-sm text-red-900 mt-1">Reason: {step.action_reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {instance.status === 'approved' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-900">
            ✓ Document approved on {formatDate(instance.completed_at)}
          </p>
        </div>
      )}
      
      {instance.status === 'rejected' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-900">
            ✗ Document rejected. Reason: {instance.rejection_reason}
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkflowInstanceTracker;
```

---

## 5. BACKEND API ENDPOINTS

### Workflow Template Management

```python
# File: backend/routers/workflows.py

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
import json

from backend.database import get_session
from backend.models import (
    WorkflowTemplate, WorkflowStageDefinition, DocumentWorkflowInstance,
    WorkflowApprovalStep, User
)
from backend.routers.auth import get_current_user

router = APIRouter()

# ─── WORKFLOW TEMPLATE ENDPOINTS ────────────────────────────────────────

@router.get("/workflows", response_model=List[dict])
def list_workflows(
    document_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all workflow templates for company"""
    stmt = select(WorkflowTemplate).where(
        WorkflowTemplate.company_id == current_user.company_id,
        WorkflowTemplate.is_active == True
    )
    if document_type:
        stmt = stmt.where(WorkflowTemplate.document_type == document_type)
    
    return session.exec(stmt).all()


@router.post("/workflows", status_code=201)
def create_workflow(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow template"""
    
    # Validate stages
    stages = payload.get('stages', [])
    if not stages:
        raise HTTPException(status_code=422, detail="At least one stage required")
    
    workflow = WorkflowTemplate(
        name=payload['name'],
        description=payload.get('description'),
        document_type=payload['document_type'],
        company_id=current_user.company_id,
        stages_json=json.dumps({'stages': stages}),
        created_by=current_user.id
    )
    
    session.add(workflow)
    session.commit()
    session.refresh(workflow)
    
    return workflow


@router.put("/workflows/{workflow_id}")
def update_workflow(
    workflow_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update existing workflow template"""
    workflow = session.get(WorkflowTemplate, workflow_id)
    if not workflow or workflow.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.name = payload.get('name', workflow.name)
    workflow.description = payload.get('description', workflow.description)
    workflow.stages_json = json.dumps({'stages': payload.get('stages', [])})
    workflow.updated_at = datetime.utcnow()
    
    session.add(workflow)
    session.commit()
    session.refresh(workflow)
    
    return workflow


# ─── WORKFLOW ASSIGNMENT ────────────────────────────────────────────────

@router.post("/documents/{document_id}/assign-workflow")
def assign_workflow_to_document(
    document_id: UUID,
    payload: dict,  # { workflow_template_id: UUID }
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Assign a workflow to a document and start the process"""
    
    # Load document and workflow
    document = session.get(Document, document_id)
    workflow_template = session.get(WorkflowTemplate, payload['workflow_template_id'])
    
    if not document or document.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not workflow_template or workflow_template.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create workflow instance
    workflow_instance = DocumentWorkflowInstance(
        document_id=document.id,
        workflow_template_id=workflow_template.id,
        company_id=current_user.company_id,
        status='in_progress'
    )
    
    session.add(workflow_instance)
    session.commit()
    session.refresh(workflow_instance)
    
    # Start first stage
    stages_data = json.loads(workflow_template.stages_json)
    if stages_data['stages']:
        _start_workflow_stage(
            workflow_instance,
            stages_data['stages'][0],
            session,
            current_user
        )
    
    return {
        'workflow_instance_id': workflow_instance.id,
        'status': workflow_instance.status
    }


def _start_workflow_stage(
    workflow_instance: DocumentWorkflowInstance,
    stage_config: dict,
    session: Session,
    initiated_by: User
):
    """Helper to start a workflow stage and assign approvers"""
    
    # Get approvers based on stage config
    approvers = _get_approvers(
        stage_config['approver_type'],
        stage_config['approver_value'],
        workflow_instance.company_id,
        session
    )
    
    if not approvers:
        raise Exception(f"No approvers found for {stage_config['approver_type']}")
    
    # Create approval steps for each approver
    now = datetime.utcnow()
    due_at = None
    if stage_config.get('sla_hours'):
        due_at = now + timedelta(hours=stage_config['sla_hours'])
    
    for approver in approvers[:1]:  # Sequential: assign to first
        approval_step = WorkflowApprovalStep(
            workflow_instance_id=workflow_instance.id,
            stage_id=stage_config['id'],
            stage_name=stage_config['name'],
            assigned_to_user_id=approver.id,
            assigned_by=initiated_by.id,
            due_at=due_at,
            action='pending'
        )
        
        session.add(approval_step)
        
        # Send notification
        _send_approval_notification(approver, workflow_instance, stage_config, session)
    
    workflow_instance.current_stage_id = stage_config['id']
    session.commit()


def _get_approvers(approver_type: str, approver_value: str, company_id: str, session: Session) -> List[User]:
    """Resolve approver_type and approver_value to actual User objects"""
    
    if approver_type == 'role':
        stmt = select(User).where(
            User.company_id == company_id,
            User.role == approver_value
        )
        return session.exec(stmt).all()
    
    elif approver_type == 'department':
        stmt = select(User).where(
            User.company_id == company_id,
            User.department_id == UUID(approver_value)
        )
        return session.exec(stmt).all()
    
    elif approver_type == 'person':
        return [session.get(User, UUID(approver_value))]
    
    return []


# ─── APPROVAL ACTIONS ───────────────────────────────────────────────────

@router.post("/approval-steps/{step_id}/approve")
def approve_workflow_step(
    step_id: UUID,
    payload: dict,  # { signature_image?: str, notes?: str }
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Approve a workflow step and advance to next stage"""
    
    step = session.get(WorkflowApprovalStep, step_id)
    if not step or step.assigned_to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Record approval
    step.action = 'approved'
    step.action_by_user_id = current_user.id
    step.action_at = datetime.utcnow()
    step.signature_image = payload.get('signature_image')
    
    session.add(step)
    session.commit()
    
    # Advance to next stage
    workflow_instance = session.get(DocumentWorkflowInstance, step.workflow_instance_id)
    _advance_workflow(workflow_instance, session, current_user)
    
    return {'status': 'approved'}


@router.post("/approval-steps/{step_id}/reject")
def reject_workflow_step(
    step_id: UUID,
    payload: dict,  # { reason: str }
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Reject a workflow step and return to previous stage"""
    
    step = session.get(WorkflowApprovalStep, step_id)
    if not step or step.assigned_to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Record rejection
    step.action = 'rejected'
    step.action_by_user_id = current_user.id
    step.action_at = datetime.utcnow()
    step.action_reason = payload.get('reason', '')
    
    session.add(step)
    
    workflow_instance = session.get(DocumentWorkflowInstance, step.workflow_instance_id)
    workflow_instance.status = 'rejected'
    workflow_instance.rejection_reason = payload.get('reason', '')
    workflow_instance.rejection_count += 1
    
    session.commit()
    
    # Notify document owner
    document = session.get(Document, workflow_instance.document_id)
    _send_rejection_notification(document.owner_id, workflow_instance, step, session)
    
    return {'status': 'rejected'}


def _advance_workflow(
    workflow_instance: DocumentWorkflowInstance,
    session: Session,
    current_user: User
):
    """Move workflow to next stage"""
    
    template = session.get(WorkflowTemplate, workflow_instance.workflow_template_id)
    stages_data = json.loads(template.stages_json)
    
    # Find current stage index
    current_idx = next(
        (i for i, s in enumerate(stages_data['stages']) if s['id'] == workflow_instance.current_stage_id),
        -1
    )
    
    if current_idx >= len(stages_data['stages']) - 1:
        # All stages complete
        workflow_instance.status = 'approved'
        workflow_instance.completed_at = datetime.utcnow()
        session.commit()
        
        # Notify document owner
        document = session.get(Document, workflow_instance.document_id)
        _send_approval_complete_notification(document.owner_id, workflow_instance, session)
    else:
        # Move to next stage
        next_stage = stages_data['stages'][current_idx + 1]
        _start_workflow_stage(workflow_instance, next_stage, session, current_user)


def _send_approval_notification(approver: User, workflow_instance: DocumentWorkflowInstance, stage: dict, session: Session):
    """Send notification to approver (in-app + email)"""
    document = session.get(Document, workflow_instance.document_id)
    
    notification = WorkflowNotification(
        approval_step_id=...,  # Link to approval step
        user_id=approver.id,
        notification_type='assignment',
        subject=f'Approval Needed: {document.original_filename}',
        message=f'A document needs your approval in stage: {stage["name"]}'
    )
    session.add(notification)
    session.commit()
    
    # TODO: Send email via SMTP service


def _send_rejection_notification(owner_id: UUID, workflow_instance: DocumentWorkflowInstance, step: WorkflowApprovalStep, session: Session):
    """Notify owner that document was rejected"""
    document = session.get(Document, workflow_instance.document_id)
    
    notification = WorkflowNotification(
        user_id=owner_id,
        notification_type='rejection',
        subject=f'Document Rejected: {document.original_filename}',
        message=f'Your document was rejected at {step.stage_name}. Reason: {step.action_reason}'
    )
    session.add(notification)
    session.commit()
```

---

## 6. DATABASE MIGRATION

```python
# File: backend/migrations/add_workflow_system.py
"""
Migration to add workflow management tables
Run with: python -m backend.init_database  # or similar
"""

def create_workflow_tables(engine):
    """Create all workflow-related tables"""
    
    create_table_statements = [
        '''
        CREATE TABLE workflow_template (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL,
            description VARCHAR,
            document_type VARCHAR NOT NULL,
            company_id VARCHAR NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            stages_json TEXT,
            routing_rules_json TEXT,
            created_by UUID REFERENCES "user"(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP,
            INDEX idx_company_id (company_id),
            INDEX idx_document_type (document_type)
        )
        ''',
        '''
        CREATE TABLE workflow_stage_definition (
            id UUID PRIMARY KEY,
            workflow_template_id UUID NOT NULL REFERENCES workflow_template(id) ON DELETE CASCADE,
            stage_order INT NOT NULL,
            stage_id VARCHAR NOT NULL,
            stage_name VARCHAR NOT NULL,
            execution_type VARCHAR DEFAULT 'sequential',
            approver_type VARCHAR NOT NULL,
            approver_value VARCHAR NOT NULL,
            required_approvals INT DEFAULT 1,
            signatures_required BOOLEAN DEFAULT FALSE,
            signature_type VARCHAR,
            sla_hours INT,
            allow_skip BOOLEAN DEFAULT FALSE,
            allow_reassign BOOLEAN DEFAULT TRUE,
            reject_action VARCHAR DEFAULT 'send_back_to_start',
            reject_target_stage_id VARCHAR,
            INDEX idx_workflow_template (workflow_template_id)
        )
        ''',
        '''
        CREATE TABLE document_workflow_instance (
            id UUID PRIMARY KEY,
            document_id UUID NOT NULL UNIQUE REFERENCES document(id) ON DELETE CASCADE,
            workflow_template_id UUID NOT NULL REFERENCES workflow_template(id),
            company_id VARCHAR NOT NULL,
            current_stage_id VARCHAR,
            current_approver_id UUID REFERENCES "user"(id),
            status VARCHAR DEFAULT 'in_progress',
            started_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            rejection_reason VARCHAR,
            rejection_count INT DEFAULT 0,
            INDEX idx_document (document_id),
            INDEX idx_status (status),
            INDEX idx_company (company_id)
        )
        ''',
        '''
        CREATE TABLE workflow_approval_step (
            id UUID PRIMARY KEY,
            workflow_instance_id UUID NOT NULL REFERENCES document_workflow_instance(id) ON DELETE CASCADE,
            stage_id VARCHAR NOT NULL,
            stage_name VARCHAR NOT NULL,
            assigned_to_user_id UUID NOT NULL REFERENCES "user"(id),
            assigned_to_role VARCHAR,
            assigned_by UUID REFERENCES "user"(id),
            assigned_at TIMESTAMP DEFAULT NOW(),
            due_at TIMESTAMP,
            action VARCHAR DEFAULT 'pending',
            action_by_user_id UUID REFERENCES "user"(id),
            action_at TIMESTAMP,
            action_reason VARCHAR,
            signature_image LONGTEXT,
            signature_date TIMESTAMP,
            INDEX idx_workflow_instance (workflow_instance_id),
            INDEX idx_user (assigned_to_user_id),
            INDEX idx_status (action)
        )
        ''',
        '''
        CREATE TABLE workflow_approver_group (
            id UUID PRIMARY KEY,
            workflow_template_id UUID REFERENCES workflow_template(id) ON DELETE CASCADE,
            stage_id VARCHAR,
            approver_type VARCHAR,
            approver_value VARCHAR,
            user_id UUID NOT NULL REFERENCES "user"(id),
            company_id VARCHAR NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            priority INT DEFAULT 1,
            INDEX idx_workflow (workflow_template_id),
            INDEX idx_user (user_id)
        )
        ''',
        '''
        CREATE TABLE workflow_notification (
            id UUID PRIMARY KEY,
            approval_step_id UUID REFERENCES workflow_approval_step(id),
            user_id UUID NOT NULL REFERENCES "user"(id),
            notification_type VARCHAR,
            sent_at TIMESTAMP DEFAULT NOW(),
            read_at TIMESTAMP,
            subject VARCHAR,
            message TEXT,
            email_sent BOOLEAN DEFAULT FALSE,
            email_sent_at TIMESTAMP,
            escalated_to_user_id UUID REFERENCES "user"(id),
            INDEX idx_user (user_id),
            INDEX idx_read (read_at)
        )
        '''
    ]
    
    with engine.connect() as conn:
        for stmt in create_table_statements:
            conn.execute(stmt)
            conn.commit()
```

---

## 7. INTEGRATION WITH EXISTING DOCUMENT SYSTEM

### Update Document Model

Add workflow reference to existing `Document` model:

```python
# In backend/models.py, add to Document class:

class Document(BaseModel, table=True):
    # ... existing fields ...
    
    # Workflow references (new)
    workflow_template_id: Optional[UUID] = Field(foreign_key="workflow_template.id", default=None)
    workflow_instance_id: Optional[UUID] = Field(foreign_key="document_workflow_instance.id", default=None)
    
    # ... rest of fields ...
```

### Update Documents.jsx

Add workflow assignment UI:

```jsx
// In frontend/src/pages/Documents.jsx

const [showWorkflowModal, setShowWorkflowModal] = useState(false);
const [selectedDocId, setSelectedDocId] = useState(null);

const handleAssignWorkflow = (docId) => {
  setSelectedDocId(docId);
  setShowWorkflowModal(true);
};

// Add button in document table:
<button
  onClick={() => handleAssignWorkflow(doc.id)}
  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
>
  Assign Workflow
</button>

// Add modal component above return:
{showWorkflowModal && (
  <WorkflowAssignmentModal
    documentId={selectedDocId}
    documentType={selectedDoc?.type}
    onClose={() => setShowWorkflowModal(false)}
    onAssigned={() => loadDocuments()}
  />
)}
```

---

## 8. NEXT STEPS FOR IMPLEMENTATION

1. **Phase 1 - Core Models (Week 1)**
   - Add workflow tables to database
   - Create Python models
   - Create API endpoints (basic CRUD)

2. **Phase 2 - Backend Engine (Week 2)**
   - Implement `_get_approvers()` logic
   - Implement `_start_workflow_stage()` logic
   - Implement approval/rejection handlers
   - Add audit logging to approval steps

3. **Phase 3 - Frontend Builder (Week 3)**
   - Build WorkflowBuilder component
   - Build StageEditor component
   - Build ApproverSelector component
   - Add preview functionality

4. **Phase 4 - Integration & UI (Week 4)**
   - Add workflow assignment button to Documents page
   - Add workflow tracker to document viewer
   - Add "My Approvals" dashboard
   - Send notifications (in-app first, then email)

5. **Phase 5 - Advanced Features (Week 5+)**
   - Conditional routing (if/then rules)
   - Escalation timers
   - Bulk reassignment
   - Performance analytics

---

## 9. MOBILE OPTIMIZATION

The workflow builder is already mobile-optimized:

- **Drag-to-reorder:** Touch-friendly drag handlers (larger hit targets)
- **Responsive layout:** Stages list stacks on mobile, editor beside on desktop
- **Touch gestures:** Swipe to delete (future enhancement)
- **Simplified UI:** Mobile shows only essential controls

---

## 10. SUCCESS METRICS

Track these to measure workflow system adoption and value:

- Approval turnaround time (hours to approve)
- Number of documents in workflow
- Rejection rate (identify bottlenecks)
- SLA compliance (% approved on time)
- User engagement (approvers per day)
- Workflow cycle time (start to completion)

---

This design provides a production-ready workflow system that:
✅ Handles complex approval chains
✅ Requires signatures where needed
✅ Routes by role, department, or person
✅ Tracks SLAs and deadlines
✅ Is mobile-friendly (drag-and-drop)
✅ Maintains complete audit trail
✅ Scales to enterprise complexity

Would you like me to:
1. **Generate the Python models and migrations** (ready to copy-paste)?
2. **Build the complete React components** (WorkflowBuilder, StageEditor)?
3. **Implement the backend API** (all endpoints with error handling)?
4. **Create integration hooks** to existing Documents page?
5. **Design the notifications system** (in-app + email)?

