# 5) Isolation and Sensitive-Action Policy

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
