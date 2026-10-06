import {
  ADMIN_WORKSPACE_DEFINITIONS,
  type AdminWorkspaceLayoutItem,
} from "@shared/adminWorkspaces";

export type DashboardAudience = "admin" | "client" | "mover";

export type WorkspaceKey =
  | "admin-overview"
  | "admin-operations"
  | "admin-sales"
  | "admin-customer-care"
  | "admin-growth"
  | "admin-finance"
  | "admin-organization"
  | "admin-system"
  | "client-move"
  | "client-organization"
  | "partner-jobs"
  | "partner-resources"
  | "partner-organization";

export interface WorkspaceDefinition {
  key: WorkspaceKey;
  audience: DashboardAudience;
  label: { en: string; es: string };
  routes: readonly string[];
}

export const WORKSPACE_CATALOG: readonly WorkspaceDefinition[] = [
  ...ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => ({ ...workspace, audience: "admin" as const })),
  { key: "client-move", audience: "client", label: { en: "My Move", es: "Mi mudanza" }, routes: ["/dashboard", "/dashboard/moves", "/dashboard/quotes", "/dashboard/saved"] },
  { key: "client-organization", audience: "client", label: { en: "Organization", es: "Organización" }, routes: ["/dashboard/company"] },
  { key: "partner-jobs", audience: "mover", label: { en: "Jobs", es: "Trabajos" }, routes: ["/mover/dashboard", "/mover/dashboard/jobs", "/mover/dashboard/quotes"] },
  { key: "partner-resources", audience: "mover", label: { en: "Resources", es: "Recursos" }, routes: ["/mover/dashboard/documents", "/mover/dashboard/fleet", "/mover/dashboard/drivers"] },
  { key: "partner-organization", audience: "mover", label: { en: "Organization", es: "Organización" }, routes: ["/mover/dashboard/profile", "/mover/dashboard/company"] },
] as const;

export interface WorkspaceLink {
  href: string;
}

export interface PermissionWorkspaceLink extends WorkspaceLink {
  permission?: string;
  relatedPermissions?: readonly string[];
}

export interface AdminPermissionWorkspace<T extends PermissionWorkspaceLink> extends WorkspaceGroup<T> {
  permissions: string[];
}

export interface WorkspaceGroup<T extends WorkspaceLink> {
  key: WorkspaceKey;
  label: string;
  links: T[];
}

export function getAdminPermissionWorkspaces<T extends PermissionWorkspaceLink>(
  links: readonly T[],
  availablePermissions: readonly string[],
  language: string,
  layout?: readonly AdminWorkspaceLayoutItem[],
): AdminPermissionWorkspace<T>[] {
  return groupLinksByWorkspace(links, "admin", language, layout).flatMap((group) => {
    const permissions = Array.from(new Set(group.links
      .flatMap((link) => [link.permission, ...(link.relatedPermissions || [])])
      .filter((permission): permission is string => !!permission && availablePermissions.includes(permission))));
    return permissions.length ? [{ ...group, permissions }] : [];
  });
}

export function getWorkspaceSelection(
  selectedPermissions: readonly string[],
  workspacePermissions: readonly string[],
): "none" | "partial" | "all" {
  const selectedCount = workspacePermissions.filter((permission) => selectedPermissions.includes(permission)).length;
  if (selectedCount === 0) return "none";
  return selectedCount === workspacePermissions.length ? "all" : "partial";
}

export function toggleWorkspacePermissions(
  selectedPermissions: readonly string[],
  workspacePermissions: readonly string[],
  protectedPermissions: readonly string[] = [],
): string[] {
  const selectable = workspacePermissions.filter((permission) => !protectedPermissions.includes(permission));
  const shouldEnable = selectable.some((permission) => !selectedPermissions.includes(permission));
  const next = new Set(selectedPermissions);
  for (const permission of selectable) {
    if (shouldEnable) next.add(permission);
    else next.delete(permission);
  }
  return Array.from(next);
}

export function groupLinksByWorkspace<T extends WorkspaceLink>(
  links: readonly T[],
  audience: DashboardAudience,
  language: string,
  adminLayout?: readonly AdminWorkspaceLayoutItem[],
): WorkspaceGroup<T>[] {
  const definitions = WORKSPACE_CATALOG.filter((workspace) => workspace.audience === audience);
  return definitions.flatMap((workspace) => {
    const routes = audience === "admin" && adminLayout
      ? adminLayout.filter((item) => item.workspaceKey === workspace.key).sort((a, b) => a.position - b.position).map((item) => item.href)
      : workspace.routes;
    const workspaceLinks = routes.flatMap((route) => links.filter((link) => link.href === route));
    return workspaceLinks.length
      ? [{ key: workspace.key, label: language.startsWith("es") ? workspace.label.es : workspace.label.en, links: workspaceLinks }]
      : [];
  });
}

export function getWorkspaceForRoute<T extends WorkspaceLink>(
  groups: readonly WorkspaceGroup<T>[],
  location: string,
): WorkspaceGroup<T> | undefined {
  const allLinks = groups.flatMap((group) => group.links);
  return groups.find((group) =>
    group.links.some((link) => isNavigationLinkActive(link.href, location, allLinks))
  );
}

export function resolveWorkspaceKey<T extends WorkspaceLink>(
  groups: readonly WorkspaceGroup<T>[],
  location: string,
  selectedKey?: WorkspaceKey,
): WorkspaceKey | undefined {
  return getWorkspaceForRoute(groups, location)?.key
    ?? groups.find((group) => group.key === selectedKey)?.key
    ?? groups[0]?.key;
}

export function isNavigationLinkActive(href: string, location: string, links: readonly WorkspaceLink[]): boolean {
  if (location === href) return true;
  if (!location.startsWith(`${href}/`)) return false;
  return !links.some((candidate) =>
    candidate.href.length > href.length &&
    (location === candidate.href || location.startsWith(`${candidate.href}/`))
  );
}

export function getSwitchableDashboardRoles(roles: readonly string[]): string[] {
  return Array.from(new Set(roles.filter((role) => role === "admin" || role === "client" || role === "mover")));
}