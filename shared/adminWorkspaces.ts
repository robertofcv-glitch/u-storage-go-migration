export const ADMIN_WORKSPACE_DEFINITIONS = [
  { key: "admin-overview", label: { en: "Overview", es: "Resumen" }, routes: ["/admin/dashboard", "/admin/dashboard/analytics", "/admin/dashboard/activity"] },
  { key: "admin-sales", label: { en: "Sales", es: "Ventas" }, routes: ["/admin/dashboard/quotes"] },
  { key: "admin-operations", label: { en: "Operations", es: "Operaciones" }, routes: ["/admin/dashboard/services", "/admin/dashboard/inventory", "/admin/dashboard/ustorage", "/admin/dashboard/pricing"] },
  { key: "admin-customer-care", label: { en: "Customer Care", es: "Atención al cliente" }, routes: ["/admin/dashboard/ratings", "/admin/dashboard/communications", "/admin/dashboard/whatsapp-inbox", "/admin/dashboard/ai-agent"] },
  { key: "admin-growth", label: { en: "Marketing", es: "Marketing" }, routes: ["/admin/dashboard/seo-marketing", "/admin/dashboard/blog"] },
  { key: "admin-finance", label: { en: "Finance", es: "Finanzas" }, routes: ["/admin/dashboard/payments"] },
  { key: "admin-organization", label: { en: "Organization", es: "Organización" }, routes: ["/admin/dashboard/usuarios", "/admin/dashboard/roles"] },
  { key: "admin-system", label: { en: "System", es: "Sistema" }, routes: ["/admin/dashboard/database", "/admin/dashboard/settings"] },
] as const;

export type AdminWorkspaceKey = typeof ADMIN_WORKSPACE_DEFINITIONS[number]["key"];

export interface AdminWorkspaceLayoutItem {
  href: string;
  workspaceKey: AdminWorkspaceKey;
  position: number;
}

export const DEFAULT_ADMIN_WORKSPACE_LAYOUT: AdminWorkspaceLayoutItem[] =
  ADMIN_WORKSPACE_DEFINITIONS.flatMap((workspace) =>
    workspace.routes.map((href, position) => ({ href, workspaceKey: workspace.key, position })),
  );

export function reconcileAdminWorkspaceLayout(
  savedLayout: readonly AdminWorkspaceLayoutItem[],
): AdminWorkspaceLayoutItem[] {
  if (!savedLayout.length) return DEFAULT_ADMIN_WORKSPACE_LAYOUT;

  const validRoutes = new Set(DEFAULT_ADMIN_WORKSPACE_LAYOUT.map((item) => item.href));
  const validWorkspaces = new Set(ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => workspace.key));
  const seenRoutes = new Set<string>();
  const grouped = new Map<AdminWorkspaceKey, AdminWorkspaceLayoutItem[]>(
    ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => [workspace.key, []]),
  );

  for (const item of [...savedLayout].sort((a, b) => a.position - b.position)) {
    if (
      !validRoutes.has(item.href)
      || !validWorkspaces.has(item.workspaceKey)
      || seenRoutes.has(item.href)
    ) continue;
    grouped.get(item.workspaceKey)!.push(item);
    seenRoutes.add(item.href);
  }

  for (const item of DEFAULT_ADMIN_WORKSPACE_LAYOUT) {
    if (seenRoutes.has(item.href)) continue;
    const workspaceItems = grouped.get(item.workspaceKey)!;
    workspaceItems.splice(Math.min(item.position, workspaceItems.length), 0, item);
    seenRoutes.add(item.href);
  }

  return ADMIN_WORKSPACE_DEFINITIONS.flatMap((workspace) =>
    grouped.get(workspace.key)!.map((item, position) => ({
      href: item.href,
      workspaceKey: workspace.key,
      position,
    })),
  );
}