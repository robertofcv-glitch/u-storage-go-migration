/**
 * Server/client capability contract for administration.
 *
 * `legacy` is intentionally explicit: these paths remain supported for
 * integrations, but new administration code should use the generalized
 * organization endpoints. This is metadata, not an authorization bypass.
 */
import { ADMIN_MODULE_PERMISSIONS } from "./platformAdmin";

export type AdminAction = "read" | "create" | "update" | "manage" | "delete" | "lifecycle";
export type AdminCapability = {
  route: string;
  module: string;
  actions: readonly AdminAction[];
  destructiveActions: readonly string[];
  auditEvents: readonly string[];
  legacy?: boolean;
};

const capability = (
  route: string,
  module: string,
  actions: readonly AdminAction[],
  destructiveActions: readonly string[],
  auditEvents: readonly string[],
  legacy = false,
): AdminCapability => ({ route, module, actions, destructiveActions, auditEvents, ...(legacy ? { legacy } : {}) });

/** The route prefixes guarded by the server and their audit contract. */
export const ADMIN_CAPABILITY_MATRIX = [
  capability("/api/admin/organization/companies", ADMIN_MODULE_PERMISSIONS.COMPANIES, ["read"], [], ["organization.companies.viewed"]),
  capability("/api/admin/organization/users", ADMIN_MODULE_PERMISSIONS.USERS, ["read", "lifecycle"], ["user.suspend", "user.delete"], ["organization.users.viewed", "user.status_changed"]),
  capability("/api/admin/organization/reconciliation", ADMIN_MODULE_PERMISSIONS.COMPANIES, ["read"], [], ["organization.reconciliation.viewed"]),
  capability("/api/admin/companies", ADMIN_MODULE_PERMISSIONS.COMPANIES, ["read", "create", "update", "manage", "lifecycle"], ["company.delete", "company.suspend"], ["company.created", "company.updated", "company.status_changed"]),
  capability("/api/admin/companies/users", ADMIN_MODULE_PERMISSIONS.USERS, ["read", "create", "update", "manage"], ["company.member.removed"], ["company.member.added", "company.member.updated", "company.member.removed"]),
  capability("/api/admin/companies/users/:userId", ADMIN_MODULE_PERMISSIONS.USERS, ["read", "update", "manage", "lifecycle"], ["user.suspend", "user.delete"], ["user.updated", "user.status_changed"]),
  capability("/api/admin/platform-roles", ADMIN_MODULE_PERMISSIONS.ROLE_MANAGEMENT, ["read", "create", "update", "manage", "delete"], ["platform_role.delete"], ["platform_role.created", "platform_role.updated", "platform_role.deleted"]),
  capability("/api/admin/movers", ADMIN_MODULE_PERMISSIONS.COMPANIES, ["read", "update", "lifecycle"], ["mover.delete"], ["mover.updated", "mover.status_changed"], true),
  capability("/api/admin/partners", ADMIN_MODULE_PERMISSIONS.COMPANIES, ["read", "update", "lifecycle"], ["partner.delete"], ["partner.updated", "partner.status_changed"], true),
  capability("/api/admin/users", ADMIN_MODULE_PERMISSIONS.USERS, ["read", "update", "lifecycle"], ["user.delete"], ["user.updated", "user.status_changed"], true),
  capability("/api/admin/admins", ADMIN_MODULE_PERMISSIONS.USERS, ["read", "update", "manage"], ["admin.revoke"], ["admin.updated", "admin.access_changed"], true),
] as const satisfies readonly AdminCapability[];

export function capabilityForRoute(route: string): AdminCapability | undefined {
  return [...ADMIN_CAPABILITY_MATRIX]
    .sort((a, b) => b.route.length - a.route.length)
    .find((entry) => route === entry.route || route.startsWith(`${entry.route}/`));
}