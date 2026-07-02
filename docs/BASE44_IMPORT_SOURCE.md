# Base44 Import Source Package

This package defines what must be sent to Base44 for app setup, using the same PC + Flipper integration model.

## Required Artifacts
- Integration spec: `docs/SIRIUS_INTEGRATION_PLAN.md`
- Repository snapshot: `base44-import-repo-snapshot.tar.gz` (archive of repository root)
- Snapshot generation reference: create from repo root before handoff (`tar -czf base44-import-repo-snapshot.tar.gz .`)

## Marketplace Candidate Transfer Set (Send Every Single One)

All candidates below are part of the Base44 handoff set. Include accepted and rejected entries, each with rationale.

### 1) USB/serial + protobuf RPC tooling
- `serialport` (Node) — **Accepted** — Mature serial transport, reduces custom USB/serial glue code.
- `@grpc/grpc-js` — **Accepted (optional transport layer)** — Strong protobuf RPC patterns for controller-side abstraction.
- `node-hid` — **Rejected (core flow)** — HID-first orientation; lower fit for protobuf-over-serial primary path.

### 2) Device/session management
- `xstate` — **Accepted** — Deterministic device/session state machine for reconnect/retry reliability.
- `redux-toolkit` — **Accepted (UI session state)** — Standardized store patterns for multi-device status dashboards.
- Custom in-house session manager — **Rejected** — Increases bridge maintenance and failure surface.

### 3) Security policy/rules engine
- `json-rules-engine` — **Accepted** — Local policy evaluation for hardware validation outcomes.
- `Open Policy Agent (OPA, local embedded/sidecar)` — **Accepted (advanced option)** — Strong policy governance without firmware changes.
- Cloud-only policy SaaS — **Rejected** — Violates no-lock-in requirement for core hardware flows.

### 4) Telemetry + log aggregation
- `OpenTelemetry JS` — **Accepted** — Standard traces/metrics for observability of controller and device workflows.
- `pino` — **Accepted** — Fast structured logs for reliable diagnostics.
- `Loki + Promtail` (self-hosted) — **Accepted** — Local/self-hosted log aggregation, no cloud lock-in.
- Proprietary cloud-only log platform — **Rejected** — Core observability would depend on vendor lock-in.

### 5) Dashboard/UI components for hardware status + test results
- `React + MUI` — **Accepted** — Mature component ecosystem for hardware status/test result dashboards.
- `TanStack Table` — **Accepted** — High-quality tabular views for test sessions/results.
- `Recharts` — **Accepted** — Lightweight charts for RF test telemetry trends.
- Game-style UI frameworks — **Rejected** — Conflicts with serious security workflow requirements.

### 6) Secrets/config management for device credentials
- `dotenvx` — **Accepted (development/local)** — Practical environment-based secret loading.
- `Mozilla SOPS` — **Accepted** — Encrypted config at rest for repository-adjacent secret files.
- `HashiCorp Vault` (self-hosted) — **Accepted (production option)** — Strong centralized secret control without mandatory cloud dependency.
- Cloud-vendor-locked secret manager as sole option — **Rejected** — Violates no-lock-in rule for core hardware operations.

## Mandatory Constraints
- Keep current PC + Flipper architecture via RPC controller pattern
- No Flipper firmware changes
- No game abstractions
- No cloud lock-in for core hardware flows

## Prioritization Focus
- Reduce custom bridge code in `/flipper-integration/`
- Improve reliability
- Improve observability
