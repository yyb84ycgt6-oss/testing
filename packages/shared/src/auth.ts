export type Role = 'owner'|'security_lead'|'ops_lead'|'team_manager'|'analyst'|'operator'|'auditor';
export interface Identity { id: string; roles: Role[]; }
export function hasRole(identity: Identity, role: Role): boolean {
  return identity.roles.includes(role);
}
