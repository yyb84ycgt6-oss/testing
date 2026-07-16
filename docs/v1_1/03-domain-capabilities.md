# 3) Domain Capabilities

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
