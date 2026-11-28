"""
Router: /api/v1/workflows and /api/v1/documents/{id}/workflow
CRUD for document workflow management and approvals.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import json

try:
    from backend.database import get_session
    from backend.models import (
        WorkflowTemplate, DocumentWorkflowInstance, WorkflowApprovalStep,
        Document, User, AuditLog
    )
    from backend.routers.auth import get_current_user
except ImportError:
    from database import get_session
    from models import (
        WorkflowTemplate, DocumentWorkflowInstance, WorkflowApprovalStep,
        Document, User, AuditLog
    )
    from routers.auth import get_current_user

router = APIRouter()


def _log_audit(session: Session, user_id: Optional[UUID], username: Optional[str], 
               action: str, entity_type: str, entity_id: Optional[UUID], 
               entity_name: Optional[str], company_id: Optional[str], 
               changes_json: Optional[str] = None, status: str = "success"):
    """Helper to log audit trail"""
    log = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        changes_json=changes_json,
        status=status,
        company_id=company_id
    )
    session.add(log)
    session.commit()


# ─── WORKFLOW TEMPLATE ENDPOINTS ────────────────────────────────────────────────

@router.post("/workflows", status_code=201)
def create_workflow(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new workflow template"""
    
    stages = payload.get('stages', [])
    if not stages:
        raise HTTPException(status_code=422, detail="At least one stage required")
    
    workflow = WorkflowTemplate(
        name=payload['name'],
        description=payload.get('description'),
        document_type=payload.get('document_type', 'document'),
        company_id=current_user.company_id,
        stages_json=json.dumps({'stages': stages}),
        created_by=current_user.id,
        is_active=True
    )
    
    session.add(workflow)
    session.commit()
    session.refresh(workflow)
    
    _log_audit(session, current_user.id, current_user.username, 'create', 
               'workflow', workflow.id, workflow.name, current_user.company_id)
    
    return workflow


@router.get("/workflows")
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


@router.put("/workflows/{workflow_id}")
def update_workflow(
    workflow_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a workflow template"""
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
    
    _log_audit(session, current_user.id, current_user.username, 'update', 
               'workflow', workflow.id, workflow.name, current_user.company_id)
    
    return workflow


@router.delete("/workflows/{workflow_id}", status_code=204)
def delete_workflow(
    workflow_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a workflow template"""
    workflow = session.get(WorkflowTemplate, workflow_id)
    if not workflow or workflow.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.is_active = False
    session.add(workflow)
    session.commit()
    
    _log_audit(session, current_user.id, current_user.username, 'delete', 
               'workflow', workflow.id, workflow.name, current_user.company_id)


# ─── WORKFLOW ASSIGNMENT & APPROVAL ─────────────────────────────────────────

@router.post("/documents/{document_id}/assign-workflow")
def assign_workflow_to_document(
    document_id: UUID,
    payload: dict,  # { workflow_template_id: UUID }
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Assign a workflow to a document and start the process"""
    
    document = session.get(Document, document_id)
    if not document or document.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    workflow_template = session.get(WorkflowTemplate, payload['workflow_template_id'])
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
    
    _log_audit(session, current_user.id, current_user.username, 'assign_workflow', 
               'document', document.id, document.original_filename, current_user.company_id)
    
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
    
    approvers = _get_approvers(
        stage_config.get('approver_type', 'role'),
        stage_config.get('approver_value', ''),
        workflow_instance.company_id,
        session
    )
    
    if not approvers:
        return  # No approvers - skip stage
    
    now = datetime.utcnow()
    due_at = None
    if stage_config.get('sla_hours'):
        due_at = now + timedelta(hours=stage_config['sla_hours'])
    
    # Sequential: assign to first approver
    approver = approvers[0]
    approval_step = WorkflowApprovalStep(
        workflow_instance_id=workflow_instance.id,
        stage_id=stage_config.get('id', ''),
        stage_name=stage_config.get('name', ''),
        assigned_to_user_id=approver.id,
        assigned_by=initiated_by.id,
        due_at=due_at,
        action='pending'
    )
    
    session.add(approval_step)
    session.commit()
    
    workflow_instance.current_stage_id = stage_config.get('id', '')
    workflow_instance.current_approver_id = approver.id
    session.add(workflow_instance)
    session.commit()


def _get_approvers(approver_type: str, approver_value: str, company_id: str, session: Session) -> List[User]:
    """Resolve approver type and value to actual User objects"""
    
    if approver_type == 'role':
        stmt = select(User).where(
            User.company_id == company_id,
            User.role == approver_value,
            User.is_active == True
        )
        return session.exec(stmt).all()
    
    elif approver_type == 'person' and approver_value:
        try:
            user = session.get(User, UUID(approver_value))
            return [user] if user else []
        except:
            return []
    
    return []


@router.get("/documents/{document_id}/workflow")
def get_document_workflow(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get workflow instance for a document"""
    
    stmt = select(DocumentWorkflowInstance).where(
        DocumentWorkflowInstance.document_id == document_id,
        DocumentWorkflowInstance.company_id == current_user.company_id
    )
    
    instance = session.exec(stmt).first()
    if not instance:
        return None
    
    return instance


@router.get("/documents/{document_id}/workflow-steps")
def get_workflow_steps(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all approval steps for a document workflow"""
    
    # Get workflow instance
    stmt = select(DocumentWorkflowInstance).where(
        DocumentWorkflowInstance.document_id == document_id,
        DocumentWorkflowInstance.company_id == current_user.company_id
    )
    instance = session.exec(stmt).first()
    if not instance:
        return []
    
    # Get all steps
    stmt = select(WorkflowApprovalStep).where(
        WorkflowApprovalStep.workflow_instance_id == instance.id
    ).order_by(WorkflowApprovalStep.created_at)
    
    return session.exec(stmt).all()


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
    
    step.action = 'approved'
    step.action_by_user_id = current_user.id
    step.action_at = datetime.utcnow()
    step.signature_image = payload.get('signature_image')
    
    session.add(step)
    session.commit()
    
    # Advance to next stage
    workflow_instance = session.get(DocumentWorkflowInstance, step.workflow_instance_id)
    _advance_workflow(workflow_instance, session, current_user)
    
    _log_audit(session, current_user.id, current_user.username, 'approve', 
               'workflow_step', step.id, step.stage_name, 'N/A')
    
    return {'status': 'approved'}


@router.post("/approval-steps/{step_id}/reject")
def reject_workflow_step(
    step_id: UUID,
    payload: dict,  # { reason: str }
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Reject a workflow step"""
    
    step = session.get(WorkflowApprovalStep, step_id)
    if not step or step.assigned_to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    
    _log_audit(session, current_user.id, current_user.username, 'reject', 
               'workflow_step', step.id, step.stage_name, 'N/A')
    
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
        (i for i, s in enumerate(stages_data['stages']) if s.get('id') == workflow_instance.current_stage_id),
        -1
    )
    
    if current_idx >= len(stages_data['stages']) - 1:
        # All stages complete
        workflow_instance.status = 'approved'
        workflow_instance.completed_at = datetime.utcnow()
        session.commit()
    else:
        # Move to next stage
        next_stage = stages_data['stages'][current_idx + 1]
        _start_workflow_stage(workflow_instance, next_stage, session, current_user)
