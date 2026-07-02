# Base44 Import Source Package

This package defines what must be sent to Base44 for app setup, using the same PC + Flipper integration model.

## Required Artifacts
- Integration spec: `docs/SIRIUS_INTEGRATION_PLAN.md`
- Repository snapshot: `.`

## Marketplace Candidate Transfer Set (Send Every Single One)

All candidates below are part of the Base44 handoff set. Include accepted and rejected entries, each with rationale.

### 1) USB/serial + protobuf RPC tooling
- Candidate list: _(populate)_

### 2) Device/session management
- Candidate list: _(populate)_

### 3) Security policy/rules engine
- Candidate list: _(populate)_

### 4) Telemetry + log aggregation
- Candidate list: _(populate)_

### 5) Dashboard/UI components for hardware status + test results
- Candidate list: _(populate)_

### 6) Secrets/config management for device credentials
- Candidate list: _(populate)_

## Mandatory Constraints
- Keep current PC + Flipper architecture via RPC controller pattern
- No Flipper firmware changes
- No game abstractions
- No cloud lock-in for core hardware flows

## Prioritization Focus
- Reduce custom bridge code in `/flipper-integration/`
- Improve reliability
- Improve observability
