import { Identity, hasRole } from './auth';
export type Decision = 'allow'|'deny'|'pending_approval';
export function evaluate(identity: Identity, permission: string): Decision {
  if (permission.endsWith('.read')) return hasRole(identity,'auditor')||identity.roles.length>0 ? 'allow' : 'deny';
  if (hasRole(identity,'owner')||hasRole(identity,'security_lead')) return 'allow';
  return 'pending_approval';
}
