# Workflow Recommendations

## Goal

Provide configurable business workflows where each stage can request or verify documents, capture structured information, assign work, or require approval before the process advances. This is a recommendation for future design and implementation, not a committed feature specification.

## Current foundation

- The application has document-approval workflows: workflow templates contain JSON stage definitions, instances are attached to a document, and approval steps track an assignee, due date, decision, reason, and optional signature.
- The Documents page can assign a template and show its approval progress.
- A `Document` can already be associated with an entity through `entity_type` and `entity_id`.
- The current workflow instance is document-specific and has a unique document association. Stages do not currently define required-document slots or structured information to collect.

The existing approval flow is useful infrastructure, but a general workflow should not be modeled as one document approval with increasingly complex JSON. It should support work attached to a business record and use documents as one type of step input.

## Recommended experience

1. **Define a reusable template.** Administrators name the workflow, choose which business records it applies to, and compose ordered stages. Start with sequential stages; add conditional branches only when a concrete use case requires them.
2. **Configure each stage.** A stage can assign work to a role or person and optionally require one or more actions:
   - review or approval;
   - one or more named documents, with accepted types and required/optional status;
   - structured fields such as date, amount, text, choice, or checkbox, including required and conditional rules;
   - due dates and guidance for the assignee.
3. **Run it in context.** Start a workflow from the relevant business record. Show the current step, owner, due date, outstanding documents, and fields that need completion in that record's workflow panel.
4. **Gate progress transparently.** A required stage cannot advance until its required documents and fields are complete and any approval has been recorded. Allow only explicitly authorized users to waive a requirement, and record the reason.
5. **Keep a durable history.** Record stage changes, assignments, submitted values, document links/versions, decisions, waivers, and timestamps. Keep the workflow definition version used by each instance so later template edits do not rewrite active work.

## Recommended technical direction

- Generalize workflow instances to reference a typed business entity (`entity_type` and `entity_id`), rather than making every workflow depend on a document. Preserve the existing document approval behavior through a compatibility path or a carefully planned migration.
- Give templates and their steps a versioned, validated definition. JSON is reasonable for an early template editor, but validate a documented schema at the API boundary and snapshot the definition when starting an instance.
- Model workflow execution separately from its definition: an instance, stage/task instances, and an append-only event/audit history. Keep submitted field values tied to the stage instance and definition version.
- Represent each required document as a named requirement on a stage and link uploaded documents to that requirement. Reuse the existing document storage and metadata rather than copying file bytes into workflow-specific records. The existing entity link alone is not enough to distinguish, for example, an insurance certificate from an intake form.
- Enforce tenant scope and permissions on every read and write. Separate template administration, task completion, approval, document upload, and requirement-waiver permissions. Do not expose private workflow documents through the client portal by default.
- Use server-side validation for required values, document completion, transitions, and permissions. Make transitions idempotent and audit failures as well as successful approvals and waivers.
- Send notifications for assignments, due dates, overdue work, and blocked/returned stages through the existing centralized notification patterns. Keep notification delivery separate from workflow state changes so a delivery failure does not silently advance or roll back a workflow.

## Suggested delivery phases

### Phase 1 — Discovery and workflow definitions

Select one business process as the pilot. Confirm who initiates it, its business record, participants, document requirements, fields, approval rules, privacy needs, and what happens when information is missing. Build an administrator editor and validate/save versioned templates.

### Phase 2 — Execution and evidence

Create entity-linked workflow instances and stage tasks. Add required-document checklists, stage-specific information capture, validation, explicit completion/waiver rules, and a visible audit trail. Pilot with staff users before opening any workflow steps to clients.

### Phase 3 — Notifications and operational controls

Add assignment and due-date notifications, reassignment, return-for-changes, cancellation, and reporting on blocked or overdue work. Add client-portal participation only for workflows whose data and documents are explicitly approved for that audience.

### Phase 4 — Broader workflow capabilities

Use pilot feedback to decide whether conditional branches, parallel approvals, reusable subflows, integrations, or automation are needed. Avoid building these capabilities before a real process demonstrates the need.

## Decisions to make before implementation

- Which process should be the pilot, and which record starts it?
- Are stages sequential only, or are parallel work and conditional branches required?
- Which field types and document rules are essential for the pilot?
- Should a missing item block progress, allow a reasoned waiver, or be a warning?
- Who can create templates, start or cancel instances, reassign work, waive requirements, and view submitted information?
- Will any steps be visible or completable by clients, and what consent or retention rules apply?
- Which notifications are required, and which channels should be used?

## Acceptance criteria for a pilot

- A manager can configure and activate a versioned workflow without code changes.
- Starting a workflow creates an auditable instance tied to the intended business record and snapshots its template version.
- A required document is linked to its specific requirement; uploading an unrelated document does not satisfy it.
- Required fields are validated server-side and remain traceable to the stage definition that requested them.
- An instance cannot advance while required items are missing unless an authorized user records a permitted waiver.
- Tenant boundaries, roles, and the intended staff/client visibility are enforced consistently across the UI and API.
- Existing document approvals continue to function during and after rollout, with a tested migration or compatibility strategy.
