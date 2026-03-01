# ============================================================
# FILE: tasks.py
#
# PURPOSE:
#   Provides full CRUD management for tasks and their inter-task relationships.
#   Tasks can be linked to other tasks by title, forming a "related" graph that
#   is resolved and returned as human-readable titles in every response.
#
# FUNCTIONAL PARTS:
#   [1] Request Models — Pydantic model for task link requests
#   [2] Task Read Routes — list all tasks, get by ID, get by title
#   [3] Task Write Routes — create and update tasks with optional linked-task title resolution
#   [4] Task Delete Route — delete a task and remove all associated TaskLink records
#   [5] Task Link Management — add a link by title and remove a link by target task ID
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from backend.database import get_session
from backend.models import Task, TaskCreate, TaskUpdate, TaskRead, TaskLink, TaskLinkRead

# ─── 1 REQUEST MODELS ──────────────────────────────────────────────────────────

class TaskLinkRequest(BaseModel):
    target_task_title: str

router = APIRouter()

# ─── 2 TASK READ ROUTES ────────────────────────────────────────────────────────

@router.get("/tasks", response_model=List[TaskRead])
async def get_tasks(session: Session = Depends(get_session)):
    """Get all tasks"""
    tasks = session.exec(select(Task)).all()
    result = []
    for task in tasks:
        # Get linked task titles
        linked_titles = []
        for link in task.linked_tasks:
            target_task = session.get(Task, link.target_task_id)
            if target_task:
                linked_titles.append(target_task.title)
        
        task_dict = {
            **task.dict(),
            "linked_task_titles": linked_titles
        }
        result.append(TaskRead(**task_dict))
    return result

@router.get("/tasks/{task_id}", response_model=TaskRead)
async def get_task(task_id: UUID, session: Session = Depends(get_session)):
    """Get a specific task by ID"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get linked task titles
    linked_titles = []
    for link in task.linked_tasks:
        target_task = session.get(Task, link.target_task_id)
        if target_task:
            linked_titles.append(target_task.title)
    
    task_dict = {
        **task.dict(),
        "linked_task_titles": linked_titles
    }
    return TaskRead(**task_dict)

@router.get("/tasks/by-title/{title}", response_model=List[TaskRead])
async def get_tasks_by_title(title: str, session: Session = Depends(get_session)):
    """Get tasks by title"""
    tasks = session.exec(select(Task).where(Task.title == title)).all()
    result = []
    for task in tasks:
        # Get linked task titles
        linked_titles = []
        for link in task.linked_tasks:
            target_task = session.get(Task, link.target_task_id)
            if target_task:
                linked_titles.append(target_task.title)
        
        task_dict = {
            **task.dict(),
            "linked_task_titles": linked_titles
        }
        result.append(TaskRead(**task_dict))
    return result

# ─── 3 TASK WRITE ROUTES ───────────────────────────────────────────────────────

@router.post("/tasks", response_model=TaskRead)
async def create_task(task_data: TaskCreate, session: Session = Depends(get_session)):
    """Create a new task"""
    # Create the task
    task_dict = task_data.dict(exclude={"linked_task_titles"})
    task = Task(**task_dict)
    session.add(task)
    session.commit()
    session.refresh(task)
    
    # Link tasks by title if provided
    if task_data.linked_task_titles:
        for linked_title in task_data.linked_task_titles:
            # Find tasks with matching title
            linked_tasks = session.exec(select(Task).where(Task.title == linked_title)).all()
            for linked_task in linked_tasks:
                if linked_task.id != task.id:  # Don't link to self
                    # Check if link already exists
                    existing_link = session.exec(
                        select(TaskLink).where(
                            TaskLink.source_task_id == task.id,
                            TaskLink.target_task_id == linked_task.id
                        )
                    ).first()
                    if not existing_link:
                        link = TaskLink(
                            source_task_id=task.id,
                            target_task_id=linked_task.id,
                            link_type="related"
                        )
                        session.add(link)
        session.commit()
    
    # Get linked task titles for response
    linked_titles = []
    for link in task.linked_tasks:
        target_task = session.get(Task, link.target_task_id)
        if target_task:
            linked_titles.append(target_task.title)
    
    task_dict = {
        **task.dict(),
        "linked_task_titles": linked_titles
    }
    return TaskRead(**task_dict)

@router.put("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    task_data: TaskUpdate,
    session: Session = Depends(get_session)
):
    """Update a task"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_dict = task_data.dict(exclude_unset=True, exclude={"linked_task_titles"})
    
    # Update task fields
    for key, value in task_dict.items():
        setattr(task, key, value)
    
    # Handle linked_task_titles if provided
    if "linked_task_titles" in task_data.dict(exclude_unset=True):
        # Remove existing links
        existing_links = session.exec(
            select(TaskLink).where(TaskLink.source_task_id == task_id)
        ).all()
        for link in existing_links:
            session.delete(link)
        
        # Create new links by title
        if task_data.linked_task_titles:
            for linked_title in task_data.linked_task_titles:
                linked_tasks = session.exec(
                    select(Task).where(Task.title == linked_title)
                ).all()
                for linked_task in linked_tasks:
                    if linked_task.id != task.id:
                        link = TaskLink(
                            source_task_id=task.id,
                            target_task_id=linked_task.id,
                            link_type="related"
                        )
                        session.add(link)
    
    session.add(task)
    session.commit()
    session.refresh(task)
    
    # Get linked task titles for response
    linked_titles = []
    for link in task.linked_tasks:
        target_task = session.get(Task, link.target_task_id)
        if target_task:
            linked_titles.append(target_task.title)
    
    task_dict = {
        **task.dict(),
        "linked_task_titles": linked_titles
    }
    return TaskRead(**task_dict)

# ─── 4 TASK DELETE ROUTE ───────────────────────────────────────────────────────

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: UUID, session: Session = Depends(get_session)):
    """Delete a task"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete all links involving this task
    links_as_source = session.exec(
        select(TaskLink).where(TaskLink.source_task_id == task_id)
    ).all()
    links_as_target = session.exec(
        select(TaskLink).where(TaskLink.target_task_id == task_id)
    ).all()
    
    for link in links_as_source + links_as_target:
        session.delete(link)
    
    session.delete(task)
    session.commit()
    return {"message": "Task deleted successfully"}

# ─── 5 TASK LINK MANAGEMENT ────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/link", response_model=TaskRead)
async def link_task_by_title(
    task_id: UUID,
    link_request: TaskLinkRequest,
    session: Session = Depends(get_session)
):
    """Link a task to another task by title"""
    target_task_title = link_request.target_task_title
    """Link a task to another task by title"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Find tasks with matching title
    target_tasks = session.exec(
        select(Task).where(Task.title == target_task_title)
    ).all()
    
    if not target_tasks:
        raise HTTPException(
            status_code=404,
            detail=f"No task found with title '{target_task_title}'"
        )
    
    # Create links to all matching tasks
    for target_task in target_tasks:
        if target_task.id != task.id:
            # Check if link already exists
            existing_link = session.exec(
                select(TaskLink).where(
                    TaskLink.source_task_id == task.id,
                    TaskLink.target_task_id == target_task.id
                )
            ).first()
            if not existing_link:
                link = TaskLink(
                    source_task_id=task.id,
                    target_task_id=target_task.id,
                    link_type="related"
                )
                session.add(link)
    
    session.commit()
    session.refresh(task)
    
    # Get linked task titles for response
    linked_titles = []
    for link in task.linked_tasks:
        target_task = session.get(Task, link.target_task_id)
        if target_task:
            linked_titles.append(target_task.title)
    
    task_dict = {
        **task.dict(),
        "linked_task_titles": linked_titles
    }
    return TaskRead(**task_dict)

@router.delete("/tasks/{task_id}/link/{target_task_id}")
async def unlink_task(
    task_id: UUID,
    target_task_id: UUID,
    session: Session = Depends(get_session)
):
    """Unlink a task from another task"""
    link = session.exec(
        select(TaskLink).where(
            TaskLink.source_task_id == task_id,
            TaskLink.target_task_id == target_task_id
        )
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    session.delete(link)
    session.commit()
    return {"message": "Task unlinked successfully"}
