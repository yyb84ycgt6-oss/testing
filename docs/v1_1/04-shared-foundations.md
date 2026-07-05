# 4) Shared Foundations

### 4.1 Identity, Roles, and Permissions
- One authentication model across all modules
- One RBAC model with module-scoped permissions
- High-risk actions require explicit approval policy
- Cross-module access is deny-by-default

Core roles:
- **Owner**
- **Security Lead**
- **Ops Lead**
- **Team Manager**
- **Analyst**
- **Operator**
- **Auditor**

Permission pattern:
- `module.resource.action`
- Examples:
  - `pc.device.read`
  - `pc.session.execute`
  - `flipper.payload.approve`
  - `flipper.cloud.sync`
  - `flipper.bluetooth.pair`
  - `flipper.wifi.connect`
  - `openclaw.operation.execute`
  - `audit.trace.read`

### 4.2 Shared Asset Registry
All modules register managed devices, files, profiles, operations, and outputs in one searchable asset layer.

Shared fields:
- `asset_id`
- `asset_type`
- `module`
- `owner_id`
- `classification`
- `status`
- `tags`
- `created_at`
- `updated_at`

### 4.3 Shared Workflow and Queue System
- One workflow builder for multi-step operations
- Queue and approval model shared across modules
- Reusable actions can chain module-specific steps
- Every step emits audit and event records

### 4.4 Shared Audit Log
- Immutable action trace for every module
- Correlation across approvals, executions, outputs, and follow-up tasks
- Read-only compliance access for auditors

### 4.5 Shared Command/Search Surface
- Global command palette for low-risk actions and navigation
- Search across assets, jobs, traces, devices, files, and workflows
- Results filtered by role, module permission, and classification
