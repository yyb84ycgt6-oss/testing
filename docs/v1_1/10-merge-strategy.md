# 10) Merge Strategy by Capability

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
