import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminPermissionWorkspaces,
  getSwitchableDashboardRoles,
  getWorkspaceForRoute,
  getWorkspaceSelection,
  groupLinksByWorkspace,
  isNavigationLinkActive,
  resolveWorkspaceKey,
  toggleWorkspacePermissions,
} from "./workspaceCatalog";
import {
  ADMIN_WORKSPACE_DEFINITIONS,
  reconcileAdminWorkspaceLayout,
} from "@shared/adminWorkspaces";

test("groups permitted admin links and hides empty workspaces", () => {
  const links = [
    { href: "/admin/dashboard", label: "Overview" },
    { href: "/admin/dashboard/payments", label: "Payments" },
  ];
  assert.deepEqual(groupLinksByWorkspace(links, "admin", "en").map((group) => group.label), ["Overview", "Finance"]);
});

test("uses translated workspace labels", () => {
  const groups = groupLinksByWorkspace([{ href: "/dashboard", label: "Resumen" }], "client", "es-MX");
  assert.equal(groups[0].label, "Mi mudanza");
});

test("keeps the stable growth workspace identity while displaying Marketing", () => {
  const marketingDefinition = ADMIN_WORKSPACE_DEFINITIONS.find(
    (workspace) => workspace.key === "admin-growth",
  );
  assert.deepEqual(marketingDefinition, {
    key: "admin-growth",
    label: { en: "Marketing", es: "Marketing" },
    routes: ["/admin/dashboard/seo-marketing", "/admin/dashboard/blog"],
  });

  const links = [
    { href: "/admin/dashboard/seo-marketing", permission: "module:marketing" },
    { href: "/admin/dashboard/blog", permission: "module:marketing" },
  ];
  const availablePermissions = ["module:marketing"];
  const englishGroups = getAdminPermissionWorkspaces(links, availablePermissions, "en");
  const spanishGroups = getAdminPermissionWorkspaces(links, availablePermissions, "es-MX");

  assert.deepEqual(englishGroups.map((group) => ({
    key: group.key,
    label: group.label,
    hrefs: group.links.map((link) => link.href),
    permissions: group.permissions,
  })), [{
    key: "admin-growth",
    label: "Marketing",
    hrefs: ["/admin/dashboard/seo-marketing", "/admin/dashboard/blog"],
    permissions: ["module:marketing"],
  }]);
  assert.equal(spanishGroups[0].label, "Marketing");

  const savedLayout = [
    { href: "/admin/dashboard/blog", workspaceKey: "admin-growth" as const, position: 0 },
    { href: "/admin/dashboard/seo-marketing", workspaceKey: "admin-growth" as const, position: 1 },
  ];
  assert.deepEqual(
    groupLinksByWorkspace(links, "admin", "en", savedLayout)[0].links.map((link) => link.href),
    ["/admin/dashboard/blog", "/admin/dashboard/seo-marketing"],
  );
});

test("selects the most specific active route", () => {
  const links = [{ href: "/admin/dashboard" }, { href: "/admin/dashboard/quotes" }];
  assert.equal(isNavigationLinkActive("/admin/dashboard", "/admin/dashboard/quotes/123", links), false);
  assert.equal(isNavigationLinkActive("/admin/dashboard/quotes", "/admin/dashboard/quotes/123", links), true);
});

test("selects the workspace containing the current admin route", () => {
  const groups = groupLinksByWorkspace([
    { href: "/admin/dashboard" },
    { href: "/admin/dashboard/quotes" },
    { href: "/admin/dashboard/pricing" },
    { href: "/admin/dashboard/payments" },
  ], "admin", "en");
   assert.equal(getWorkspaceForRoute(groups, "/admin/dashboard/quotes/123")?.key, "admin-sales");
  assert.equal(getWorkspaceForRoute(groups, "/admin/dashboard/pricing")?.key, "admin-operations");
  assert.equal(resolveWorkspaceKey(groups, "/admin/dashboard/payments", "admin-overview"), "admin-finance");
});

test("keeps an available workspace selection and safely falls back when it disappears", () => {
  const groups = groupLinksByWorkspace([
    { href: "/admin/dashboard/quotes" },
    { href: "/admin/dashboard/payments" },
  ], "admin", "en");
  assert.equal(resolveWorkspaceKey(groups, "/admin/unknown", "admin-finance"), "admin-finance");
   assert.equal(resolveWorkspaceKey(groups.slice(0, 1), "/admin/unknown", "admin-finance"), "admin-sales");
  assert.equal(resolveWorkspaceKey([], "/admin/unknown", "admin-finance"), undefined);
});

test("only exposes dashboard roles in the role switcher", () => {
  assert.deepEqual(getSwitchableDashboardRoles(["client", "client", "operations", "mover"]), ["client", "mover"]);
  assert.equal(getSwitchableDashboardRoles(["client"]).length > 1, false);
});

test("maps module permissions through the shared admin workspace catalog", () => {
  const groups = getAdminPermissionWorkspaces([
    { href: "/admin/dashboard/quotes", permission: "module:quotes" },
    { href: "/admin/dashboard/inventory", permission: "module:inventory" },
    { href: "/admin/dashboard/usuarios", permission: "module:users", relatedPermissions: ["module:companies"] },
    { href: "/admin/dashboard/database", permission: "module:database" },
  ], ["module:quotes", "module:inventory", "module:users", "module:companies", "module:database"], "en");
  assert.deepEqual(groups.map(({ label, permissions }) => ({ label, permissions })), [
     { label: "Sales", permissions: ["module:quotes"] },
     { label: "Operations", permissions: ["module:inventory"] },
    { label: "Organization", permissions: ["module:users", "module:companies"] },
    { label: "System", permissions: ["module:database"] },
  ]);
});

test("uses a saved admin layout for grouping and section order", () => {
  const links = [
    { href: "/admin/dashboard/quotes", label: "Quotes" },
    { href: "/admin/dashboard/payments", label: "Payments" },
  ];
  const layout = [
    { href: "/admin/dashboard/payments", workspaceKey: "admin-operations" as const, position: 0 },
    { href: "/admin/dashboard/quotes", workspaceKey: "admin-operations" as const, position: 1 },
  ];
  const groups = groupLinksByWorkspace(links, "admin", "en", layout);
  assert.deepEqual(groups.map((group) => ({
    label: group.label,
    hrefs: group.links.map((link) => link.href),
  })), [{ label: "Operations", hrefs: ["/admin/dashboard/payments", "/admin/dashboard/quotes"] }]);
});

test("adds new sections to existing saved workspace layouts without discarding custom placement", () => {
  const savedLayout = [
    { href: "/admin/dashboard/payments", workspaceKey: "admin-operations" as const, position: 0 },
    { href: "/admin/dashboard/quotes", workspaceKey: "admin-operations" as const, position: 1 },
  ];

  const reconciled = reconcileAdminWorkspaceLayout(savedLayout);
  const operationsRoutes = reconciled
    .filter((item) => item.workspaceKey === "admin-operations")
    .map((item) => item.href);

  assert.equal(operationsRoutes[0], "/admin/dashboard/services");
  assert.ok(operationsRoutes.includes("/admin/dashboard/payments"));
  assert.ok(operationsRoutes.includes("/admin/dashboard/quotes"));
  assert.equal(new Set(reconciled.map((item) => item.href)).size, reconciled.length);
});

test("reports partial workspace assignments and preserves protected modules during bulk changes", () => {
  assert.equal(getWorkspaceSelection(["module:quotes"], ["module:quotes", "module:inventory"]), "partial");
  assert.deepEqual(
    toggleWorkspacePermissions([], ["module:database", "module:settings"], ["module:database", "module:settings"]),
    [],
  );
  assert.deepEqual(
    toggleWorkspacePermissions(["module:database", "module:settings"], ["module:database", "module:settings"], ["module:database", "module:settings"]),
    ["module:database", "module:settings"],
  );
});