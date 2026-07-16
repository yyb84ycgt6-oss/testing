# 8) RBAC Matrix (v1)

Roles:
- **Owner**
- **Security Lead**
- **Ops Lead**
- **Team Manager**
- **Analyst**
- **Operator**
- **Auditor** (read-only compliance access)

Access Policy:
- High-risk actions require role + policy approval gate.
- Security and governance modules deny by default.
- Auditor role has read-only access to logs, policy decisions, and traces.
