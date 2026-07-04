# Command Center Spec v1.1

## 1) Purpose
This version turns the Command Center into one unified application with dedicated product modules for **PC**, **Flipper Zero**, and **OpenClaw**, all operating on shared security, policy, workflow, and audit foundations.

## 2) Product Model
### Shell
- Single application shell
- Shared authentication, authorization, navigation, search, workflow runner, and audit system
- Module isolation by domain, permission, and risk policy

### Product Modules
- **PC Module**
- **Flipper Zero Module**
- **OpenClaw Module**

### Shared Platform Layers
- Identity & access control
- Asset registry
- Workflow & queue engine
- Audit & trace store
- Command/search surface
- Policy decision engine

## 3) Domain Capabilities
### 3.1 PC Module
Purpose: centralize workstation, session, file, and tool operations.

Capabilities:
- Device inventory for PCs, hosts, and sessions
- File and artifact navigation
- Tool launch registry
- Session lifecycle management
- System state snapshots
- Assigned workflow execution against approved PC targets

Primary entities:
- `pc_device`
- `pc_session`
- `pc_file_asset`
- `pc_tool_profile`
- `pc_snapshot`

### 3.2 Flipper Zero Module
Purpose: manage authorized device profiles, files, connectivity, sync history, and lab workflows.

Capabilities:
- Device inventory and ownership tracking
- Payload/profile library with version history
- File import/export and save workflows
- Managed cloud backup/sync targets
- Bluetooth pairing and session state tracking
- Wi-Fi network profiles and connection state tracking
- Sync/import/export history
- Lab workflow execution for approved scenarios
- Device health and state summaries
- Approval-gated high-risk operations

Primary entities:
- `flipper_device`
- `flipper_profile`
- `flipper_payload`
- `flipper_file_asset`
- `flipper_cloud_target`
- `flipper_bluetooth_pair`
- `flipper_wifi_profile`
- `flipper_sync_job`
- `flipper_state_snapshot`

Connectivity surfaces:
- Cloud connectors for approved storage providers
- Bluetooth device pairing and trusted-session management
- Wi-Fi profile registration, testing, and state visibility

File lifecycle:
- Import files into the Flipper workspace
- Export files from the device or library to approved destinations
- Save versioned file snapshots with metadata and audit traces
- Restore previously approved file versions

### 3.3 OpenClaw Module
Purpose: preserve OpenClaw functionality as an isolated operational domain.

Capabilities:
- OpenClaw asset and endpoint registry
- Operation templates and execution history
- Module-specific insights and status views
- Queue-based execution for approved actions
- Result packaging for downstream workflows

Primary entities:
- `openclaw_asset`
- `openclaw_operation`
- `openclaw_job`
- `openclaw_result`
- `openclaw_snapshot`

## 4) Shared Foundations
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

## 5) Isolation and Sensitive-Action Policy
### Isolation Rules
- No direct module-to-module privileged execution
- All cross-module interactions must go through typed workflows
- Sensitive assets are not visible outside permitted modules
- Policy engine evaluates every execution request before dispatch

### Approval-Gated Action Classes
- Device write or destructive changes
- Profile/payload publication
- New cloud target registration
- Bluetooth pairing with a new device
- Wi-Fi profile creation or connection changes
- Session takeover or remote execution
- Cross-module workflow execution
- Export of classified outputs

## 6) Policy Decision Table
| Action Class | Example Permission | Default Policy | Additional Gate |
| --- | --- | --- | --- |
| View inventory | `*.read` | Allow by role | Classification filter |
| Create workflow | `workflow.create` | Allow by role | Schema validation |
| Execute low-risk workflow | `*.execute` | Conditional allow | Target scope check |
| Execute high-risk workflow | `*.execute` | Deny until approved | Owner/Security approval |
| Export artifact | `asset.export` | Conditional allow | Classification + audit tag |
| Register cloud target | `flipper.cloud.write` | Deny until approved | Secret handling + target validation |
| Pair Bluetooth device | `flipper.bluetooth.pair` | Conditional allow | Trust policy + audit trace |
| Connect to Wi-Fi profile | `flipper.wifi.connect` | Conditional allow | Approved profile + environment policy |
| Modify device/profile state | `*.write` | Deny until approved | Risk review + trace requirement |
| Cross-module action chain | `workflow.execute` | Deny until approved | Policy simulation + approval |

## 7) Action Taxonomy
All modules use the same action taxonomy:
- `inventory.read`
- `inventory.register`
- `asset.read`
- `asset.write`
- `profile.read`
- `profile.write`
- `file.import`
- `file.export`
- `file.save`
- `cloud.sync`
- `bluetooth.pair`
- `wifi.connect`
- `workflow.create`
- `workflow.execute`
- `session.read`
- `session.execute`
- `job.queue`
- `job.cancel`
- `audit.read`
- `export.create`

Action naming rule:
- `<module>.<capability>.<verb>`
- Examples:
  - `pc.session.execute`
  - `flipper.profile.write`
  - `openclaw.operation.execute`

## 8) Event Taxonomy
Core event families:
- `auth.*`
- `policy.*`
- `workflow.*`
- `queue.*`
- `audit.*`
- `asset.*`
- `pc.*`
- `flipper.*`
- `openclaw.*`

Representative events:
- `policy.decision.recorded`
- `workflow.run.created`
- `workflow.step.completed`
- `queue.approval.requested`
- `queue.approval.granted`
- `audit.trace.finalized`
- `pc.session.started`
- `flipper.file.imported`
- `flipper.file.exported`
- `flipper.cloud.sync.completed`
- `flipper.bluetooth.paired`
- `flipper.wifi.connected`
- `flipper.sync.completed`
- `openclaw.operation.finished`

## 9) Navigation and Route Map
### Global Navigation
- Dashboard
- Workflows
- Queue & Approvals
- Assets
- Audit
- Settings

### Module Navigation
- `/pc`
  - `/pc/devices`
  - `/pc/sessions`
  - `/pc/files`
  - `/pc/tools`
- `/flipper`
  - `/flipper/devices`
  - `/flipper/files`
  - `/flipper/profiles`
  - `/flipper/payloads`
  - `/flipper/cloud`
  - `/flipper/bluetooth`
  - `/flipper/wifi`
  - `/flipper/sync-history`
- `/openclaw`
  - `/openclaw/assets`
  - `/openclaw/operations`
  - `/openclaw/jobs`
  - `/openclaw/results`

### Shared Routes
- `/dashboard`
- `/workflows`
- `/queue`
- `/assets`
- `/audit`
- `/settings/access`
- `/settings/policy`

### Navigation States
- Overview
- Module detail
- Action compose
- Approval pending
- Execution in progress
- Trace/result review

## 10) Merge Strategy by Capability
Do not merge repositories wholesale. Merge only validated capabilities:

### Keep from PC
- Device/session management
- File and artifact handling
- Tooling registry

### Keep from Flipper Zero
- Device inventory
- Profile/payload library
- Sync and history

### Keep from OpenClaw
- Core operations unique to OpenClaw
- Execution templates
- Specialized outputs and results

Selection rules:
- Keep the strongest implementation of each capability
- Remove duplicate features after capability comparison
- Normalize names and contracts before integration

## 11) MVP Implementation Slices
### Slice 1: Shell and Shared Platform
- App shell
- Auth/RBAC
- Audit model
- Workflow queue
- Global navigation

### Slice 2: PC Module MVP
- Device list
- Session list
- File/assets panel
- Approved workflow execution

### Slice 3: Flipper Zero Module MVP
- Device registry
- Profile library
- Sync history
- Approval-gated write flows

### Slice 4: OpenClaw Module MVP
- Asset registry
- Operation templates
- Job execution history
- Result review panel

### Slice 5: Cross-Module Intelligence
- Shared asset search
- Cross-module dashboards
- Approval-driven workflow chaining

## 12) Acceptance Criteria
- One app shell hosts all modules
- All modules share one identity and audit foundation
- Sensitive actions are approval-gated
- Module routes and permissions are isolated
- All actions emit policy, execution, and audit records
- Cross-module workflows run only through shared contracts
