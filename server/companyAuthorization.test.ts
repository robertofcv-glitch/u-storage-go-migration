import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { activityLogs, companies, companyMemberships, moverProfiles, partnerCompanyMemberships, users } from "@shared/schema";
import { permissionsForRole, resolveActiveCompany, requireCompanyPermission } from "./companyAuthorization";
import { storage } from "./storage";
import { registerCompanyRouter } from "./companyRouter";

test("company roles expose only their intended capabilities", () => {
  assert.deepEqual(permissionsForRole("owner"), [
    "company:read", "company:manage", "members:manage", "fleet:manage", "availability:manage", "dispatch:manage",
  ]);
  assert.deepEqual(permissionsForRole("admin"), permissionsForRole("owner"));
  assert.deepEqual(permissionsForRole("dispatcher"), ["company:read", "availability:manage", "dispatch:manage"]);
  assert.deepEqual(permissionsForRole("fleet_manager"), ["company:read", "fleet:manage", "availability:manage"]);
  assert.deepEqual(permissionsForRole("accountant"), ["company:read"]);
  assert.deepEqual(permissionsForRole("viewer"), ["company:read"]);
  assert.deepEqual(permissionsForRole("unknown"), []);
});

test("active company selection is membership-scoped and falls back safely", async () => {
  const userId = randomUUID();
  const companyIds: string[] = [];
  try {
    await db.insert(users).values({
      id: userId,
      email: `company-auth-${userId}@example.test`,
      fullName: "Company authorization test",
      userType: "client",
    });
    const created = await db.insert(moverProfiles).values([
      { userId, companyName: `Company A ${userId}`, partnerStatus: "active" },
      { userId, companyName: `Company B ${userId}`, partnerStatus: "active" },
    ]).returning({ id: moverProfiles.id });
    companyIds.push(...created.map((row) => row.id));
    await db.insert(companies).values(created.map((row, index) => ({
      id: row.id,
      name: `Company ${index === 0 ? "A" : "B"} ${userId}`,
      classification: "partner",
      moverProfileId: row.id,
      ownerUserId: userId,
    })));
    const memberships = await db.insert(partnerCompanyMemberships).values([
      { companyId: companyIds[0], userId, role: "owner", status: "active", acceptedAt: new Date() },
      { companyId: companyIds[1], userId, role: "dispatcher", status: "active", acceptedAt: new Date() },
    ]).returning();

    const selected = await resolveActiveCompany({ user: { claims: { sub: userId } }, session: { activePartnerCompanyId: companyIds[1] } } as any);
    assert.equal(selected?.company.id, companyIds[1]);
    assert.equal(selected?.membership.role, "dispatcher");

    await db.update(partnerCompanyMemberships).set({ status: "suspended" }).where(eq(partnerCompanyMemberships.id, memberships[1].id));
    const fallback = await resolveActiveCompany({ user: { claims: { sub: userId } }, session: { activePartnerCompanyId: companyIds[1] } } as any);
    assert.equal(fallback?.company.id, companyIds[0]);
    assert.equal(fallback?.membership.role, "owner");
  } finally {
    if (companyIds.length) await db.delete(companies).where(inArray(companies.id, companyIds));
    if (companyIds.length) await db.delete(moverProfiles).where(inArray(moverProfiles.id, companyIds));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("operational company permissions require completed onboarding", async () => {
  const userId = randomUUID();
  const companyId = randomUUID();
  try {
    await db.insert(users).values({ id: userId, email: `onboarding-gate-${userId}@example.test`, userType: "mover" });
    await db.insert(moverProfiles).values({ id: companyId, userId, companyName: "Incomplete socio", partnerStatus: "active", onboardingComplete: false });
    await db.insert(companies).values({ id: companyId, name: "Incomplete socio", classification: "partner", moverProfileId: companyId, ownerUserId: userId });
    await db.insert(partnerCompanyMemberships).values({ companyId, userId, role: "owner", status: "active", acceptedAt: new Date() });
    let nextCalled = false;
    let responseCode = 0;
    const middleware = requireCompanyPermission("dispatch:manage");
    await middleware(
      { user: { claims: { sub: userId } }, session: {} } as any,
      { status(code: number) { responseCode = code; return { json() { return this; } }; } } as any,
      () => { nextCalled = true; },
    );
    assert.equal(responseCode, 403);
    assert.equal(nextCalled, false);
  } finally {
    await db.delete(companies).where(eq(companies.id, companyId));
    await db.delete(moverProfiles).where(eq(moverProfiles.id, companyId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("partner company PATCH persists onboarding readiness and unlocks operations", async () => {
  const userId = randomUUID();
  const companyId = randomUUID();
  let server: any;
  try {
    await db.insert(users).values({ id: userId, email: `company-patch-${userId}@example.test`, userType: "mover" });
    await db.insert(moverProfiles).values({ id: companyId, userId, companyName: "Patch socio", partnerStatus: "active", onboardingComplete: false });
    await db.insert(companies).values({ id: companyId, name: "Patch socio", classification: "partner", moverProfileId: companyId, ownerUserId: userId });
    await db.insert(partnerCompanyMemberships).values({ companyId, userId, role: "owner", status: "active", acceptedAt: new Date() });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { claims: { sub: userId } };
      (req as any).session = { activePartnerCompanyId: companyId };
      next();
    });
    app.use("/api", registerCompanyRouter());
    server = app.listen(0);
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/partner/company`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operatingTimezone: "America/Mexico_City",
        serviceCapabilities: ["moving", "packing"],
        travelBufferMinutes: 90,
        turnaroundBufferMinutes: 45,
        onboardingComplete: true,
        onboardingReadiness: { profile: true, fleet: true },
        ignoredField: "must not persist",
      }),
    });
    assert.equal(response.status, 200);
    const [profile] = await db.select().from(moverProfiles).where(eq(moverProfiles.id, companyId));
    assert.equal(profile.operatingTimezone, "America/Mexico_City");
    assert.deepEqual(profile.serviceCapabilities, ["moving", "packing"]);
    assert.equal(profile.travelBufferMinutes, 90);
    assert.equal(profile.turnaroundBufferMinutes, 45);
    assert.equal(profile.onboardingComplete, true);
    assert.deepEqual(profile.onboardingReadiness, { profile: true, fleet: true });
    const middleware = requireCompanyPermission("dispatch:manage");
    let nextCalled = false;
    await middleware(
      { user: { claims: { sub: userId } }, session: { activePartnerCompanyId: companyId } } as any,
      { status() { return { json() { return this; } }; } } as any,
      () => { nextCalled = true; },
    );
    assert.equal(nextCalled, true);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(activityLogs).where(eq(activityLogs.companyId, companyId));
    await db.delete(companies).where(eq(companies.id, companyId));
    await db.delete(moverProfiles).where(eq(moverProfiles.id, companyId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("client company conversion preserves owner identity and enables partner access", async () => {
  const userId = randomUUID();
  const companyId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `company-conversion-${userId}@example.test`,
      fullName: "Company conversion test",
      userType: "client",
    });
    await db.insert(companies).values({
      id: companyId,
      name: "Converted company",
      classification: "client",
      ownerUserId: userId,
    });
    const [owner] = await db.insert(companyMemberships).values({
      companyId,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    }).returning();
    await db.insert(moverProfiles).values({
      id: companyId,
      userId,
      companyName: "Converted company",
      partnerStatus: "active",
    });
    await db.update(companies).set({
      classification: "both",
      moverProfileId: companyId,
    }).where(eq(companies.id, companyId));
    await db.insert(partnerCompanyMemberships).values({
      id: owner.id,
      companyId,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: owner.acceptedAt || new Date(),
    });

    const selected = await resolveActiveCompany({
      user: { claims: { sub: userId } },
      session: { activePartnerCompanyId: companyId },
    } as any);
    assert.equal(selected?.company.id, companyId);
    assert.equal(selected?.membership.id, owner.id);
    assert.equal(selected?.membership.role, "owner");
  } finally {
    await db.delete(companies).where(eq(companies.id, companyId));
    await db.delete(moverProfiles).where(eq(moverProfiles.id, companyId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

test("deactivated platform roles are excluded from authorization role lookup", async () => {
  const userId = randomUUID();
  try {
    await db.insert(users).values({
      id: userId,
      email: `role-revocation-${userId}@example.test`,
      fullName: "Role revocation test",
      userType: "client",
    });
    await storage.addUserRole({ userId, role: "admin", isActive: true });
    assert.equal((await storage.getUserRoles(userId)).some(role => role.role === "admin"), true);

    await storage.removeUserRole(userId, "admin");
    assert.equal((await storage.getUserRoles(userId)).some(role => role.role === "admin"), false);
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});