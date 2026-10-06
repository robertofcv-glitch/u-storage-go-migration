import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq } from "drizzle-orm";
import {
  ADMIN_MODULE_PERMISSIONS,
  PLATFORM_ADMIN_ALL_MODULES,
  PLATFORM_ROLE_PERMISSIONS,
  hasPlatformPermission,
  permissionsForPlatformRoles,
  validatePlatformRoleModules,
} from "../shared/platformAdmin";
import { db } from "./db";
import { activityLogs, adminPermissions, platformRoleModules, platformRoles, userRoles, users } from "../shared/schema";
import { activateCallerPlatformRole, getPlatformAdminAccess, requireAdmin, requirePlatformPermission } from "./authMiddleware";
import { platformRoleAuditRecord } from "./platformRoleAudit";
import { registerCompanyRouter } from "./companyRouter";
import { assignPlatformAdminRole } from "./adminAccess";

test("every built-in platform role allows only its assigned admin modules", () => {
  for (const [role, expected] of Object.entries(PLATFORM_ROLE_PERMISSIONS)) {
    const actual = permissionsForPlatformRoles([role]);
    for (const module of PLATFORM_ADMIN_ALL_MODULES) {
      assert.equal(
        hasPlatformPermission(actual, module),
        role === "super_admin" || expected.includes(module),
        `${role} access to ${module}`,
      );
    }
  }

  assert.equal(hasPlatformPermission(permissionsForPlatformRoles(["operations"]), "module:future"), false);
});

test("super admins receive an unrestricted permission", () => {
  const permissions = permissionsForPlatformRoles(["super_admin"]);
  assert.deepEqual(permissions, ["*"]);
  assert.equal(hasPlatformPermission(permissions, "module:anything"), true);
});

test("role module payloads allow recognized permissions and protect unrestricted access", () => {
  assert.deepEqual(validatePlatformRoleModules([
    ADMIN_MODULE_PERMISSIONS.QUOTES,
    ADMIN_MODULE_PERMISSIONS.QUOTES,
    ADMIN_MODULE_PERMISSIONS.DATABASE,
  ]), {
    valid: true,
    modules: [ADMIN_MODULE_PERMISSIONS.QUOTES, ADMIN_MODULE_PERMISSIONS.DATABASE],
  });
  assert.equal(validatePlatformRoleModules(["module:unknown"]).valid, false);
  assert.equal(validatePlatformRoleModules(["*"]).valid, false);
  assert.equal(validatePlatformRoleModules([ADMIN_MODULE_PERMISSIONS.ROLE_MANAGEMENT]).valid, false);
  assert.deepEqual(validatePlatformRoleModules(["*"], { superAdmin: true }), { valid: true, modules: ["*"] });
  assert.equal(validatePlatformRoleModules([], { superAdmin: true }).valid, false);
});

test("role management changes produce attributable audit records", () => {
  assert.deepEqual(platformRoleAuditRecord({
    operation: "updated",
    actorId: "actor-id",
    roleId: "role-id",
    slug: "operations",
    modules: [ADMIN_MODULE_PERMISSIONS.QUOTES],
  }), {
    userId: "actor-id",
    actorRole: "admin",
    action: "platform_role.updated",
    entityType: "platform_role",
    entityId: "role-id",
    details: { slug: "operations", modules: [ADMIN_MODULE_PERMISSIONS.QUOTES] },
  });
});

async function startPermissionServer(userId: string) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { claims: { sub: userId } };
    next();
  });
  const usersGuard = [requireAdmin, requirePlatformPermission(ADMIN_MODULE_PERMISSIONS.USERS)];
  app.get("/admin/dashboard/users", ...usersGuard, (_req, res) => res.sendStatus(204));
  app.get("/api/admin/users", ...usersGuard, (_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function startImpersonatedPermissionServer(operatorId: string, impersonatedUserId: string) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = {
      originalAdminUser: { id: operatorId },
      impersonatedUser: { id: impersonatedUserId },
    };
    next();
  });
  app.get("/api/admin/users", requireAdmin, requirePlatformPermission(ADMIN_MODULE_PERMISSIONS.USERS), (_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function startOrganizationPermissionServer(userId: string) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { claims: { sub: userId } };
    next();
  });
  app.use("/api", registerCompanyRouter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("excluded modules return 403 for direct URLs and API requests", async () => {
  const userId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `platform-denied-${userId}@example.test`,
      fullName: "Platform denied test",
      userType: "admin",
    });
    await db.insert(userRoles).values([
      { userId, role: "admin" },
      { userId, role: "accounting" },
    ]);
    const server = await startPermissionServer(userId);
    try {
      for (const path of ["/admin/dashboard/users", "/api/admin/users"]) {
        const response = await fetch(`${server.url}${path}`);
        assert.equal(response.status, 403, path);
      }
    } finally {
      await server.close();
    }
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("canonical super admins retain unrestricted access without a legacy flag", async () => {
  const userId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `platform-super-${userId}@example.test`,
      fullName: "Platform super admin test",
      userType: "admin",
    });
    await db.insert(userRoles).values([
      { userId, role: "admin" },
      { userId, role: "super_admin" },
    ]);
    const access = await getPlatformAdminAccess(userId);
    assert.equal(access.platformRoles.includes("super_admin"), true);
    assert.deepEqual(access.effectivePermissions, ["*"]);

    const server = await startPermissionServer(userId);
    try {
      assert.equal((await fetch(`${server.url}/api/admin/users`)).status, 204);
    } finally {
      await server.close();
    }
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("legacy super admins are normalized into the platform access contract", async () => {
  const userId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `legacy-super-${userId}@example.test`,
      fullName: "Legacy super admin test",
      userType: "admin",
    });
    await db.insert(userRoles).values({ userId, role: "admin" });
    await db.insert(adminPermissions).values({ userId, isSuperAdmin: true });

    const access = await getPlatformAdminAccess(userId);
    assert.deepEqual(access.platformRoles, ["super_admin"]);
    assert.deepEqual(access.availablePlatformRoles, [{ slug: "super_admin", name: "Super Admin" }]);
    assert.equal(access.activePlatformRole, "super_admin");
    assert.deepEqual(access.effectivePermissions, ["*"]);
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("owning super admin does not bypass a different active workspace role", async () => {
  const userId = randomUUID();
  const slug = `scoped_super_${userId.replaceAll("-", "")}`;
  try {
    await db.insert(users).values({
      id: userId,
      email: `${slug}@example.test`,
      fullName: "Scoped legacy super admin test",
      userType: "admin",
    });
    await db.insert(adminPermissions).values({ userId, isSuperAdmin: true });
    const [definition] = await db.insert(platformRoles).values({ slug, name: "Scoped role" }).returning();
    await db.insert(platformRoleModules).values({
      roleId: definition.id,
      moduleKey: ADMIN_MODULE_PERMISSIONS.QUOTES,
    });
    await db.insert(userRoles).values([
      { userId, role: "admin" },
      { userId, role: slug },
    ]);

    const access = await getPlatformAdminAccess(userId, slug);
    assert.equal(access.platformRoles.includes("super_admin"), true);
    assert.equal(access.activePlatformRole, slug);
    assert.deepEqual(access.effectivePermissions, [ADMIN_MODULE_PERMISSIONS.QUOTES]);
  } finally {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.delete(platformRoles).where(eq(platformRoles.slug, slug));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("admin guards authorize the real operator while impersonating a non-admin", async () => {
  const operatorId = randomUUID();
  const impersonatedUserId = randomUUID();
  try {
    await db.insert(users).values([
      { id: operatorId, email: `operator-${operatorId}@example.test`, fullName: "Operator", userType: "admin" },
      { id: impersonatedUserId, email: `client-${impersonatedUserId}@example.test`, fullName: "Client", userType: "client" },
    ]);
    await db.insert(userRoles).values([
      { userId: operatorId, role: "admin" },
      { userId: impersonatedUserId, role: "client" },
    ]);
    await db.insert(adminPermissions).values({ userId: operatorId, isSuperAdmin: true });

    const server = await startImpersonatedPermissionServer(operatorId, impersonatedUserId);
    try {
      assert.equal((await fetch(`${server.url}/api/admin/users`)).status, 204);
    } finally {
      await server.close();
    }
  } finally {
    await db.delete(users).where(eq(users.id, impersonatedUserId));
    await db.delete(users).where(eq(users.id, operatorId));
  }
});

test("active role switching uses the real operator while impersonating", async () => {
  const operatorId = randomUUID();
  const impersonatedUserId = randomUUID();
  const scopedSlug = `impersonation_scope_${operatorId.replaceAll("-", "")}`;
  try {
    await db.insert(users).values([
      { id: operatorId, email: `switch-operator-${operatorId}@example.test`, fullName: "Switch operator", userType: "admin" },
      { id: impersonatedUserId, email: `switch-client-${impersonatedUserId}@example.test`, fullName: "Switch client", userType: "client" },
    ]);
    await db.insert(platformRoles).values({ slug: scopedSlug, name: "Scoped impersonation role" });
    await db.insert(userRoles).values([
      { userId: operatorId, role: "admin" },
      { userId: operatorId, role: scopedSlug },
      { userId: impersonatedUserId, role: "client" },
    ]);
    await db.insert(adminPermissions).values({ userId: operatorId, isSuperAdmin: true });
    const req = {
      session: {
        originalAdminUser: { id: operatorId },
        impersonatedUser: { id: impersonatedUserId },
        activePlatformRole: scopedSlug,
      },
    } as any;

    const result = await activateCallerPlatformRole(req, "super_admin");
    assert.equal(result.ok, true);
    assert.equal(req.session.activePlatformRole, "super_admin");
    if (result.ok) assert.deepEqual(result.access.effectivePermissions, ["*"]);
  } finally {
    await db.delete(userRoles).where(eq(userRoles.userId, impersonatedUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, operatorId));
    await db.delete(platformRoles).where(eq(platformRoles.slug, scopedSlug));
    await db.delete(users).where(eq(users.id, impersonatedUserId));
    await db.delete(users).where(eq(users.id, operatorId));
  }
});

test("platform role assignment replaces disabled roles and records the actor and before state", async () => {
  const actorId = randomUUID();
  const targetUserId = randomUUID();
  const previousSlug = `disabled_previous_${targetUserId.replaceAll("-", "")}`;
  const nextSlug = `next_role_${targetUserId.replaceAll("-", "")}`;
  try {
    await db.insert(users).values([
      { id: actorId, email: `actor-${actorId}@example.test`, fullName: "Actor", userType: "admin" },
      { id: targetUserId, email: `target-${targetUserId}@example.test`, fullName: "Target", userType: "client" },
    ]);
    await db.insert(platformRoles).values([
      { slug: previousSlug, name: "Disabled previous role", isActive: false },
      { slug: nextSlug, name: "Next role", isActive: true },
    ]);
    await db.insert(userRoles).values([
      { userId: actorId, role: "admin" },
      { userId: targetUserId, role: previousSlug },
    ]);

    const result = await assignPlatformAdminRole({ targetUserId, newRole: nextSlug, actorId });
    assert.deepEqual(result.previousRoles, [previousSlug]);

    const activeRoles = (await db.select().from(userRoles).where(eq(userRoles.userId, targetUserId)))
      .filter((role) => role.isActive)
      .map((role) => role.role)
      .sort();
    assert.deepEqual(activeRoles, ["admin", nextSlug].sort());
    const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
    assert.equal(target.userType, "admin");
    const [permissions] = await db.select().from(adminPermissions).where(eq(adminPermissions.userId, targetUserId));
    assert.equal(permissions.isSuperAdmin, false);
    const [audit] = await db.select().from(activityLogs).where(eq(activityLogs.entityId, targetUserId));
    assert.equal(audit.userId, actorId);
    assert.deepEqual(audit.details, {
      targetUserId,
      previousRoles: [previousSlug],
      previousRole: previousSlug,
      newRole: nextSlug,
    });
  } finally {
    await db.delete(activityLogs).where(eq(activityLogs.entityId, targetUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, targetUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, actorId));
    await db.delete(platformRoles).where(eq(platformRoles.slug, previousSlug));
    await db.delete(platformRoles).where(eq(platformRoles.slug, nextSlug));
    await db.delete(users).where(eq(users.id, targetUserId));
    await db.delete(users).where(eq(users.id, actorId));
  }
});

test("administrators can switch between assigned workspace roles", async () => {
  const userId = randomUUID();
  const firstSlug = `switch_first_${userId.replaceAll("-", "")}`;
  const secondSlug = `switch_second_${userId.replaceAll("-", "")}`;
  try {
    await db.insert(users).values({
      id: userId,
      email: `platform-switch-${userId}@example.test`,
      fullName: "Platform role switching test",
      userType: "admin",
    });
    await db.insert(userRoles).values([
      { userId, role: "admin" },
      { userId, role: firstSlug },
      { userId, role: secondSlug },
    ]);
    const definitions = await db.insert(platformRoles).values([
      { slug: firstSlug, name: "First workspace" },
      { slug: secondSlug, name: "Second workspace" },
    ]).returning();
    await db.insert(platformRoleModules).values(definitions.map((role) => ({
      roleId: role.id,
      moduleKey: role.slug === firstSlug ? ADMIN_MODULE_PERMISSIONS.QUOTES : ADMIN_MODULE_PERMISSIONS.PAYMENTS,
    })));

    const first = await getPlatformAdminAccess(userId, firstSlug);
    const second = await getPlatformAdminAccess(userId, secondSlug);
    assert.deepEqual(first.effectivePermissions, [ADMIN_MODULE_PERMISSIONS.QUOTES]);
    assert.deepEqual(second.effectivePermissions, [ADMIN_MODULE_PERMISSIONS.PAYMENTS]);
  } finally {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.delete(platformRoles).where(eq(platformRoles.slug, firstSlug));
    await db.delete(platformRoles).where(eq(platformRoles.slug, secondSlug));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("legacy administrators without a platform role retain equivalent module access", async () => {
  const userId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `platform-legacy-${userId}@example.test`,
      fullName: "Legacy platform access test",
      userType: "admin",
    });
    await db.insert(userRoles).values({ userId, role: "admin" });
    const access = await getPlatformAdminAccess(userId);
    assert.deepEqual(new Set(access.effectivePermissions), new Set(PLATFORM_ADMIN_ALL_MODULES));
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("canonical organization routes use platform modules instead of legacy booleans", async () => {
  const usersOnlyId = randomUUID();
  const companiesOnlyId = randomUUID();
  const usersSlug = `users_only_${usersOnlyId.replaceAll("-", "")}`;
  const companiesSlug = `companies_only_${companiesOnlyId.replaceAll("-", "")}`;
  try {
    await db.insert(users).values([
      { id: usersOnlyId, email: `${usersSlug}@example.test`, fullName: "Users only", userType: "admin" },
      { id: companiesOnlyId, email: `${companiesSlug}@example.test`, fullName: "Companies only", userType: "admin" },
    ]);
    await db.insert(adminPermissions).values([
      { userId: usersOnlyId, canManageUsers: false, canManageMovers: false },
      { userId: companiesOnlyId, canManageUsers: false, canManageMovers: false },
    ]);
    const definitions = await db.insert(platformRoles).values([
      { slug: usersSlug, name: "Users only" },
      { slug: companiesSlug, name: "Companies only" },
    ]).returning();
    await db.insert(platformRoleModules).values(definitions.map((role) => ({
      roleId: role.id,
      moduleKey: role.slug === usersSlug ? ADMIN_MODULE_PERMISSIONS.USERS : ADMIN_MODULE_PERMISSIONS.COMPANIES,
    })));
    await db.insert(userRoles).values([
      { userId: usersOnlyId, role: "admin" },
      { userId: usersOnlyId, role: usersSlug },
      { userId: companiesOnlyId, role: "admin" },
      { userId: companiesOnlyId, role: companiesSlug },
    ]);

    const usersServer = await startOrganizationPermissionServer(usersOnlyId);
    try {
      assert.equal((await fetch(`${usersServer.url}/api/admin/organization/users`)).status, 200);
      assert.equal((await fetch(`${usersServer.url}/api/admin/organization/companies`)).status, 403);
    } finally {
      await usersServer.close();
    }
    const companiesServer = await startOrganizationPermissionServer(companiesOnlyId);
    try {
      assert.equal((await fetch(`${companiesServer.url}/api/admin/organization/companies`)).status, 200);
      assert.equal((await fetch(`${companiesServer.url}/api/admin/organization/users`)).status, 403);
    } finally {
      await companiesServer.close();
    }
  } finally {
    await db.delete(userRoles).where(eq(userRoles.userId, usersOnlyId));
    await db.delete(userRoles).where(eq(userRoles.userId, companiesOnlyId));
    await db.delete(platformRoles).where(eq(platformRoles.slug, usersSlug));
    await db.delete(platformRoles).where(eq(platformRoles.slug, companiesSlug));
    await db.delete(users).where(eq(users.id, usersOnlyId));
    await db.delete(users).where(eq(users.id, companiesOnlyId));
  }
});

test("a custom role can be created, assigned, edited, and deleted", async () => {
  const userId = randomUUID();
  const slug = `test_role_${userId.replaceAll("-", "")}`;
  let roleId: string | undefined;
  try {
    await db.insert(users).values({
      id: userId,
      email: `platform-custom-${userId}@example.test`,
      fullName: "Platform custom role test",
      userType: "admin",
    });
    await db.insert(userRoles).values({ userId, role: "admin" });
    const [role] = await db.insert(platformRoles).values({
      slug,
      name: "Temporary test role",
      isSystem: false,
    }).returning();
    roleId = role.id;
    await db.insert(platformRoleModules).values({
      roleId,
      moduleKey: ADMIN_MODULE_PERMISSIONS.QUOTES,
    });
    await db.insert(userRoles).values({ userId, role: slug });

    let access = await getPlatformAdminAccess(userId);
    assert.deepEqual(access.platformRoles, [slug]);
    assert.equal(hasPlatformPermission(access.effectivePermissions, ADMIN_MODULE_PERMISSIONS.QUOTES), true);
    assert.equal(hasPlatformPermission(access.effectivePermissions, ADMIN_MODULE_PERMISSIONS.PAYMENTS), false);

    await db.delete(platformRoleModules).where(eq(platformRoleModules.roleId, roleId));
    await db.insert(platformRoleModules).values({
      roleId,
      moduleKey: ADMIN_MODULE_PERMISSIONS.PAYMENTS,
    });
    access = await getPlatformAdminAccess(userId);
    assert.equal(hasPlatformPermission(access.effectivePermissions, ADMIN_MODULE_PERMISSIONS.QUOTES), false);
    assert.equal(hasPlatformPermission(access.effectivePermissions, ADMIN_MODULE_PERMISSIONS.PAYMENTS), true);

    await db.delete(userRoles).where(eq(userRoles.role, slug));
    await db.delete(platformRoles).where(eq(platformRoles.id, roleId));
    roleId = undefined;
    assert.equal((await getPlatformAdminAccess(userId)).platformRoles.includes(slug), false);
  } finally {
    await db.delete(userRoles).where(eq(userRoles.role, slug));
    if (roleId) await db.delete(platformRoles).where(eq(platformRoles.id, roleId));
    await db.delete(users).where(eq(users.id, userId));
  }
});
