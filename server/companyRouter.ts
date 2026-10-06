import { Router } from "express";
import crypto from "crypto";
import { db } from "./db";
import { getActiveUserId, getCallerUserId, requireAuth, requireAdmin, requireAdminPermission, requirePlatformPermission } from "./authMiddleware";
import { companyPermission, getCompanyMemberships, permissionsForRole, resolveActiveCompany } from "./companyAuthorization";
import { and, eq, sql, ilike, or } from "drizzle-orm";
import { activityLogs, moverProfiles, partnerCompanyMemberships, users, userRoles, companies, companyMemberships, quotes, COMPANY_CLASSIFICATIONS } from "@shared/schema";
import { storage } from "./storage";
import { buildOrganizationReconciliationReport } from "./services/organizationReconciliation";

const roles = ["owner", "admin", "dispatcher", "fleet_manager", "accountant", "viewer"] as const;
const statuses = ["invited", "active", "suspended"] as const;
const safeCompany = (c: any) => {
  if (!c) return c;
  const { userId: _legacyOwnerId, ...company } = c;
  return company;
};
const membershipView = (m: any) => m ? ({
  id: m.id, companyId: m.companyId, userId: m.userId, invitedEmail: m.invitedEmail,
  role: m.role, status: m.status, invitedAt: m.invitedAt, acceptedAt: m.acceptedAt,
  invitedBy: m.invitedBy, updatedAt: m.updatedAt,
}) : m;
const actor = (req: any) => getActiveUserId(req)!;

async function hasAdminPermission(req: any, permission: string) {
  const callerId = getCallerUserId(req);
  if (!callerId) return false;
  const grants = await storage.getAdminPermissions(callerId);
  return Boolean(grants?.isSuperAdmin || (grants as any)?.[permission]);
}
async function log(req: any, action: string, companyId: string, details: any = {}) {
  await db.execute(sql`INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, company_id, membership_id)
    VALUES (${actor(req)}, ${action}, 'partner_company', ${companyId}, ${JSON.stringify(details)}::jsonb, ${companyId}, ${req.companyMembership?.id || null})`);
}
async function guardedMembershipMutation(companyId: string, membershipId: string, update?: { role: string; status: string; updatedBy: string }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`);
    const [target] = await tx.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.id, membershipId), eq(partnerCompanyMemberships.companyId, companyId)));
    if (!target) return { error: "not_found" as const };
    const removesActiveOwner = target.role === "owner" && target.status === "active" &&
      (!update || update.role !== "owner" || update.status !== "active");
    if (removesActiveOwner) {
      const rows = await tx.select({ count: sql<number>`count(*)` }).from(partnerCompanyMemberships)
        .where(and(eq(partnerCompanyMemberships.companyId, companyId), eq(partnerCompanyMemberships.role, "owner"), eq(partnerCompanyMemberships.status, "active")));
      if (Number(rows[0]?.count || 0) <= 1) return { error: "last_owner" as const };
    }
    if (!update) {
      await tx.delete(partnerCompanyMemberships).where(eq(partnerCompanyMemberships.id, membershipId));
      return { target };
    }
    const [membership] = await tx.update(partnerCompanyMemberships).set({ ...update, updatedAt: new Date() }).where(eq(partnerCompanyMemberships.id, membershipId)).returning();
    return { target, membership };
  });
}

async function guardedGeneralizedMembershipMutation(companyId: string, membershipId: string, update?: { role: string; status: string; updatedBy: string }, allowOperationalPartner = true) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`);
    const [target] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.id, membershipId), eq(companyMemberships.companyId, companyId)));
    if (!target) return { error: "not_found" as const };
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId));
    const [counterpart] = await tx.select({ id: partnerCompanyMemberships.id }).from(partnerCompanyMemberships).where(eq(partnerCompanyMemberships.id, target.id));
    if (!allowOperationalPartner && (company?.classification === "partner" || counterpart)) return { error: "partner_permission" as const };
    const removesOwner = target.role === "owner" && target.status === "active" &&
      (!update || update.role !== "owner" || update.status !== "active");
    if (removesOwner) {
      const owners = await tx.select({ count: sql<number>`count(*)` }).from(companyMemberships)
        .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner"), eq(companyMemberships.status, "active")));
      if (Number(owners[0]?.count || 0) <= 1) return { error: "last_owner" as const };
      if (counterpart) {
        const partnerOwners = await tx.select({ count: sql<number>`count(*)` }).from(partnerCompanyMemberships)
          .where(and(eq(partnerCompanyMemberships.companyId, companyId), eq(partnerCompanyMemberships.role, "owner"), eq(partnerCompanyMemberships.status, "active")));
        if (Number(partnerOwners[0]?.count || 0) <= 1) return { error: "last_partner_owner" as const };
      }
    }
    if (!update) {
      await tx.delete(companyMemberships).where(eq(companyMemberships.id, membershipId));
      return { target };
    }
    const [membership] = await tx.update(companyMemberships).set({ ...update, updatedAt: new Date() }).where(eq(companyMemberships.id, membershipId)).returning();
    return { target, membership };
  });
}
function requirePermission(permission: any) {
  return async (req: any, res: any, next: any) => {
    const active = await resolveActiveCompany(req);
    if (!active) return res.status(403).json({ message: "Active company membership required" });
    if (["suspended", "inactive"].includes(active.company.partnerStatus || "")) return res.status(403).json({ message: "This company is not active" });
    if (["pending", "documents_review"].includes(active.company.partnerStatus || "") && !["company:read", "company:manage"].includes(permission)) {
      return res.status(403).json({ message: "This company must be approved before managing its team or operations" });
    }
    if (["fleet:manage", "availability:manage", "dispatch:manage"].includes(permission) && active.company.onboardingComplete !== true) {
      return res.status(403).json({ message: "Complete the company onboarding profile before using operational tools" });
    }
    if (!companyPermission(active.membership.role, permission)) return res.status(403).json({ message: "Insufficient company permissions" });
    req.company = active.company; req.companyMembership = active.membership; req.companyPermissions = permissionsForRole(active.membership.role); next();
  };
}

export function registerCompanyRouter() {
  const r = Router();
  r.use("/partner", requireAuth);
  r.use("/admin/partner", requireAuth);
  // Generalized company administration. Legacy /admin/partner paths below are
  // intentionally retained for integrations which still use mover_profile_id.
  const classifications = Object.values(COMPANY_CLASSIFICATIONS);
  // Canonical organization routes are authorized exclusively with platform
  // modules. Legacy boolean guards remain only on compatibility routers below.
  const generalizedAdmin = [requireAdmin, requirePlatformPermission("module:companies")];
  const generalizedUsers = [requireAdmin, requirePlatformPermission("module:users")];
  const generalizedBoth = [
    requireAdmin,
    requirePlatformPermission("module:users"),
    requirePlatformPermission("module:companies"),
  ];
  const clientRoles = ["owner", "admin", "member", "viewer"] as const;
  const clientMembership = async (req: any) => {
    const rows = await db.select({ membership: companyMemberships, company: companies })
      .from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(and(eq(companyMemberships.userId, actor(req)), eq(companyMemberships.status, "active")));
    const eligible = rows.filter(x => x.company.isActive && (x.company.classification === "client" || x.company.classification === "both"));
    const selected = (req.session?.activeClientCompanyId && eligible.find(x => x.company.id === req.session.activeClientCompanyId)) || eligible[0];
    return selected;
  };
  const safeUser = (u: any) => u && ({ id: u.id, email: u.email, fullName: u.fullName, firstName: u.firstName, lastName: u.lastName, phone: u.phone, profileImageUrl: u.profileImageUrl, isActive: u.isActive });
  const canonicalCompany = (company: any, memberCount = 0) => ({
    id: company.id,
    name: company.name,
    classification: company.classification,
    status: company.isActive ? (company.partnerStatus || "active") : "inactive",
    ownerUserId: company.ownerUserId || null,
    moverProfileId: company.moverProfileId || null,
    memberCount,
  });
  const companyAudit = async (req: any, action: string, companyId: string, details: any = {}, executor: any = db) => {
    await executor.insert(activityLogs).values({
      userId: actor(req), action, entityType: "company", entityId: companyId,
      companyId, details,
    });
  };
  r.get("/companies/memberships", requireAuth, async (req: any, res) => {
    const userId = actor(req);
    const rows = await db.select({ membership: companyMemberships, company: companies })
      .from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(eq(companyMemberships.userId, userId));
    res.json({ memberships: rows });
  });
  r.get("/client/companies", requireAuth, async (req: any, res) => {
    const selected = await clientMembership(req);
    const rows = await db.select({ membership: companyMemberships, company: companies })
      .from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(and(eq(companyMemberships.userId, actor(req)), eq(companyMemberships.status, "active")));
    const eligible = rows.filter(x => x.company.isActive && (x.company.classification === "client" || x.company.classification === "both"));
    res.json({ companies: eligible, activeCompanyId: selected?.company.id || null });
  });
  r.put("/client/companies/active", requireAuth, async (req: any, res) => {
    const companyId = String(req.body?.companyId || "");
    const [eligible] = await db.select({ membership: companyMemberships, company: companies })
      .from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, actor(req)), eq(companyMemberships.status, "active"), eq(companies.isActive, true)));
    if (!eligible || !["client", "both"].includes(eligible.company.classification)) return res.status(403).json({ message: "Active client company membership required" });
    req.session.activeClientCompanyId = companyId;
    await new Promise<void>((resolve, reject) => req.session.save((error: any) => error ? reject(error) : resolve()));
    res.json({ activeCompanyId: companyId });
  });
  r.get("/client/companies/members", requireAuth, async (req: any, res) => {
    const active = await clientMembership(req);
    if (!active) return res.status(403).json({ message: "Active client company membership required" });
    const rows = await db.select({ membership: companyMemberships, user: users }).from(companyMemberships)
      .leftJoin(users, eq(companyMemberships.userId, users.id)).where(eq(companyMemberships.companyId, active.company.id));
    res.json({ company: active.company, members: rows.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })) });
  });
  r.get("/client/companies/memberships", requireAuth, async (req: any, res) => {
    const active = await clientMembership(req);
    if (!active) return res.status(403).json({ message: "Active client company membership required" });
    const rows = await db.select({ membership: companyMemberships, user: users }).from(companyMemberships).leftJoin(users, eq(companyMemberships.userId, users.id)).where(eq(companyMemberships.companyId, active.company.id));
    res.json({ company: active.company, memberships: rows.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })) });
  });
  r.post(["/client/companies/members", "/client/companies/memberships"], requireAuth, async (req: any, res) => {
    const active = await clientMembership(req);
    if (!active || !["owner", "admin"].includes(active.membership.role)) return res.status(403).json({ message: "Only client owners and admins can manage members" });
    const email = String(req.body?.email || "").trim().toLowerCase(), role = String(req.body?.role || "viewer");
    if (!email || !clientRoles.includes(role as any) || role === "owner") return res.status(400).json({ message: "Valid email and client role required" });
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    const duplicate = await db.select({ id: companyMemberships.id }).from(companyMemberships).where(and(eq(companyMemberships.companyId, active.company.id), existingUser ? eq(companyMemberships.userId, existingUser.id) : eq(companyMemberships.invitedEmail, email)));
    if (duplicate.length) return res.status(409).json({ message: "This user is already a member or invited" });
    const token = crypto.randomBytes(32).toString("hex");
    const [row] = await db.insert(companyMemberships).values({ companyId: active.company.id, userId: null, invitedEmail: email, role, status: "invited", acceptedAt: null, invitationTokenHash: crypto.createHash("sha256").update(token).digest("hex"), invitationExpiresAt: new Date(Date.now() + 7 * 86400000), invitedBy: actor(req), updatedBy: actor(req) }).returning();
    await companyAudit(req, "company.member.invited", active.company.id, { membershipId: row.id, email, role });
    res.status(201).json({ membership: membershipView(row), inviteToken: token });
  });
  r.post("/client/companies/members/invitations/:token/accept", requireAuth, async (req: any, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, actor(req)) });
    const hash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const [row] = await db.select().from(companyMemberships).where(and(eq(companyMemberships.invitationTokenHash, hash), eq(companyMemberships.status, "invited")));
    if (!row || !user?.email || user.email.toLowerCase() !== row.invitedEmail?.toLowerCase()) return res.status(403).json({ message: "Invitation does not match authenticated email" });
    if (!row.invitationExpiresAt || row.invitationExpiresAt <= new Date()) return res.status(410).json({ message: "Invitation has expired" });
    const [invitedCompany] = await db.select().from(companies).where(eq(companies.id, row.companyId));
    if (!invitedCompany?.isActive || !["client", "both"].includes(invitedCompany.classification)) return res.status(403).json({ message: "Invited company is not active for clients" });
    const [updated] = await db.update(companyMemberships).set({ userId: user.id, invitedEmail: null, status: "active", acceptedAt: new Date(), invitationTokenHash: null, invitationExpiresAt: null, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(companyMemberships.id, row.id), eq(companyMemberships.status, "invited"), eq(companyMemberships.invitationTokenHash, hash))).returning();
    if (!updated) return res.status(409).json({ message: "This invitation is no longer valid" });
    await db.update(companyMemberships).set({ userId: user.id, invitedEmail: null, status: "active", acceptedAt: updated.acceptedAt, invitationTokenHash: null, updatedBy: user.id, updatedAt: new Date() }).where(eq(companyMemberships.id, updated.id));
    await companyAudit(req, "company.member.invitation_accepted", row.companyId, { membershipId: row.id, userId: user.id });
    res.json({ membership: membershipView(updated), company: invitedCompany });
  });
  r.post("/companies/invitations/:token/accept", requireAuth, async (req: any, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, actor(req)) });
    const hash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const [row] = await db.select().from(companyMemberships).where(and(eq(companyMemberships.invitationTokenHash, hash), eq(companyMemberships.status, "invited")));
    if (!row || !user?.email || user.email.toLowerCase() !== row.invitedEmail?.toLowerCase()) return res.status(403).json({ message: "Invitation does not match authenticated email" });
    if (!row.invitationExpiresAt || row.invitationExpiresAt <= new Date()) return res.status(410).json({ message: "Invitation has expired" });
    const [company] = await db.select().from(companies).where(eq(companies.id, row.companyId));
    if (!company?.isActive) return res.status(403).json({ message: "Invited company is inactive" });
    const duplicate = await db.select({ id: companyMemberships.id }).from(companyMemberships).where(and(eq(companyMemberships.companyId, row.companyId), eq(companyMemberships.userId, user.id)));
    if (duplicate.length) return res.status(409).json({ message: "Account is already a company member" });
    const [updated] = await db.update(companyMemberships).set({ userId: user.id, invitedEmail: null, status: "active", acceptedAt: new Date(), invitationTokenHash: null, invitationExpiresAt: null, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(companyMemberships.id, row.id), eq(companyMemberships.status, "invited"), eq(companyMemberships.invitationTokenHash, hash))).returning();
    if (!updated) return res.status(409).json({ message: "Invitation is no longer valid" });
    await companyAudit(req, "company.member.invitation_accepted", company.id, { membershipId: row.id, userId: user.id });
    res.json({ membership: membershipView(updated), company });
  });
  const mutateClientMembership = async (req: any, res: any, remove: boolean) => {
    const active = await clientMembership(req);
    if (!active || !["owner", "admin"].includes(active.membership.role)) return res.status(403).json({ message: "Only client owners and admins can manage members" });
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${active.company.id}))`);
      const [target] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.id, req.params.membershipId), eq(companyMemberships.companyId, active.company.id)));
      if (!target) return { error: "not_found" };
      const [mirrored] = await tx.select({ id: partnerCompanyMemberships.id }).from(partnerCompanyMemberships).where(eq(partnerCompanyMemberships.id, target.id));
      if (mirrored) return { error: "partner_scoped" };
      if (active.membership.role === "admin" && target.role === "owner") return { error: "forbidden" };
      const nextRole = req.body?.role || target.role, nextStatus = req.body?.status || target.status;
      if (nextRole === "owner" && target.role !== "owner" && active.membership.role !== "owner") return { error: "owner_only" };
      if (target.userId === actor(req) && nextRole !== target.role) return { error: "self_role" };
      if (!clientRoles.includes(nextRole as any) || !["invited", "active", "suspended"].includes(nextStatus)) return { error: "invalid" };
      if (target.role === "owner" && target.status === "active" && (remove || nextRole !== "owner" || nextStatus !== "active")) {
        const owners = await tx.select({ id: companyMemberships.id }).from(companyMemberships).where(and(eq(companyMemberships.companyId, active.company.id), eq(companyMemberships.role, "owner"), eq(companyMemberships.status, "active")));
        if (owners.length <= 1) return { error: "last_owner" };
      }
      if (remove) { await tx.delete(companyMemberships).where(eq(companyMemberships.id, target.id)); return { target }; }
      const [updated] = await tx.update(companyMemberships).set({ role: nextRole, status: nextStatus, updatedBy: actor(req), updatedAt: new Date() }).where(eq(companyMemberships.id, target.id)).returning();
      return { target, updated };
    });
    if (result.error === "not_found") return res.status(404).json({ message: "Membership not found" });
    if (result.error === "forbidden") return res.status(403).json({ message: "Admins cannot modify owners" });
    if (result.error === "partner_scoped") return res.status(403).json({ message: "Partner-scoped memberships cannot be changed from client company tools" });
    if (result.error === "self_role") return res.status(403).json({ message: "You cannot change your own role" });
    if (result.error === "owner_only") return res.status(403).json({ message: "Only a current owner may grant owner role" });
    if (result.error === "invalid") return res.status(400).json({ message: "Invalid client role or status" });
    if (result.error === "last_owner") return res.status(409).json({ message: "The last active owner cannot be removed or demoted" });
    await companyAudit(req, `company.member.${remove ? "removed" : "updated"}`, active.company.id, { membershipId: req.params.membershipId });
    res.json(remove ? { success: true } : membershipView(result.updated));
  };
  r.patch(["/client/companies/members/:membershipId", "/client/companies/memberships/:membershipId"], requireAuth, (req: any, res: any) => mutateClientMembership(req, res, false));
  r.delete(["/client/companies/members/:membershipId", "/client/companies/memberships/:membershipId"], requireAuth, (req: any, res: any) => mutateClientMembership(req, res, true));
  r.get("/admin/companies", ...generalizedAdmin, async (req: any, res) => {
    const q = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const classification = typeof req.query.classification === "string" ? req.query.classification : undefined;
    const where = and(
      q ? or(ilike(companies.name, `%${q}%`), ilike(companies.id, `%${q}%`)) : undefined,
      classification && classifications.includes(classification as any) ? eq(companies.classification, classification) : undefined,
    );
    res.json({ companies: await db.select().from(companies).where(where).orderBy(companies.name) });
  });
  // Canonical organization contracts. Legacy list responses above remain
  // unchanged for deep links and integrations during the parity window.
  r.get("/admin/organization/companies", ...generalizedAdmin, async (req: any, res) => {
    const q = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const rows = await db.select({
      company: companies,
      memberCount: sql<number>`count(${companyMemberships.id})`,
    }).from(companies).leftJoin(companyMemberships, eq(companyMemberships.companyId, companies.id))
      .where(q ? or(ilike(companies.name, `%${q}%`), ilike(companies.id, `%${q}%`)) : undefined)
      .groupBy(companies.id).orderBy(companies.name);
    res.json({ organizations: rows.map((row) => canonicalCompany(row.company, Number(row.memberCount || 0))), contractVersion: 1 });
  });
  r.get("/admin/organization/users", ...generalizedUsers, async (_req: any, res) => {
    const [rows, roleRows] = await Promise.all([
      db.select({ user: users, membership: companyMemberships, company: companies })
        .from(users).leftJoin(companyMemberships, eq(companyMemberships.userId, users.id)).leftJoin(companies, eq(companyMemberships.companyId, companies.id)),
      db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles).where(eq(userRoles.isActive, true)),
    ]);
    const rolesByUser = new Map<string, string[]>();
    for (const row of roleRows) rolesByUser.set(row.userId, [...(rolesByUser.get(row.userId) || []), row.role]);
    const grouped = new Map<string, any>();
    for (const row of rows) {
      const activeRoles = rolesByUser.get(row.user.id) || [];
      const value = grouped.get(row.user.id) || {
        ...safeUser(row.user),
        status: row.user.isActive === false ? "suspended" : "active",
        profiles: activeRoles.filter((role) => ["client", "mover", "admin"].includes(role)),
        platformRoles: activeRoles.filter((role) => !["client", "mover", "admin"].includes(role)),
        memberships: [],
      };
      if (row.membership) value.memberships.push({
        membership: {
          id: row.membership.id, companyId: row.membership.companyId, userId: row.membership.userId,
          invitedEmail: row.membership.invitedEmail, role: row.membership.role, status: row.membership.status,
          invitationExpiresAt: row.membership.invitationExpiresAt,
        },
        company: row.company ? canonicalCompany(row.company) : null,
      });
      grouped.set(row.user.id, value);
    }
    res.json({ users: Array.from(grouped.values()), contractVersion: 1 });
  });
  r.get("/admin/organization/reconciliation", ...generalizedAdmin, async (_req: any, res) => {
    res.json(await buildOrganizationReconciliationReport());
  });
  r.get("/admin/organization/users/:userId/impact-preview", ...generalizedUsers, async (req: any, res) => {
    const userId = String(req.params.userId);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ message: "User not found" });
    const [membershipCount] = await db.select({ count: sql<number>`count(*)` }).from(companyMemberships).where(eq(companyMemberships.userId, userId));
    const [quoteCount] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.userId, userId));
    const operation = ["delete", "suspend", "reactivate"].includes(String(req.query.operation)) ? String(req.query.operation) : "suspend";
    res.json({ subject: "user", subjectId: userId, operation, affectedMemberships: Number(membershipCount?.count || 0), affectedUsers: 1, affectedQuotes: Number(quoteCount?.count || 0), warnings: operation === "delete" ? ["Deletion is destructive and is not performed by preview."] : [], destructive: operation === "delete", readOnly: true });
  });
  r.get("/admin/companies/:companyId/impact-preview", ...generalizedAdmin, async (req: any, res) => {
    const [company] = await db.select().from(companies).where(eq(companies.id, req.params.companyId));
    if (!company) return res.status(404).json({ message: "Company not found" });
    const [membershipCount] = await db.select({ count: sql<number>`count(*)` }).from(companyMemberships).where(eq(companyMemberships.companyId, company.id));
    const [userCount] = await db.select({ count: sql<number>`count(distinct ${companyMemberships.userId})` }).from(companyMemberships).where(eq(companyMemberships.companyId, company.id));
    const [quoteCount] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.companyId, company.id));
    const operation = ["delete", "suspend", "reactivate"].includes(String(req.query.operation)) ? String(req.query.operation) : "suspend";
    res.json({ subject: "company", subjectId: company.id, operation, affectedMemberships: Number(membershipCount?.count || 0), affectedUsers: Number(userCount?.count || 0), affectedQuotes: Number(quoteCount?.count || 0), warnings: operation === "delete" ? ["Deletion is destructive and is not performed by preview."] : [], destructive: operation === "delete", readOnly: true });
  });
  r.get("/admin/companies/users", ...generalizedUsers, async (_req: any, res) => {
    const rows = await db.select({ user: users, membership: companyMemberships, company: companies })
      .from(users).leftJoin(companyMemberships, eq(companyMemberships.userId, users.id))
      .leftJoin(companies, eq(companyMemberships.companyId, companies.id));
    const grouped = new Map<string, any>();
    for (const row of rows) {
      const item = grouped.get(row.user.id) || { ...safeUser(row.user), memberships: [] };
      if (row.membership && row.company) item.memberships.push({ membership: membershipView(row.membership), company: row.company });
      grouped.set(row.user.id, item);
    }
    res.json({ users: Array.from(grouped.values()) });
  });
  r.post("/admin/companies/users", ...generalizedBoth, async (req: any, res) => {
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const requestedUserId = req.body?.userId || null;
    const allocations = Array.isArray(req.body?.memberships)
      ? req.body.memberships
      : Array.isArray(req.body?.companyIds)
        ? req.body.companyIds.map((companyId: string) => ({ companyId, role: req.body?.role || "viewer" }))
        : [];
    if ((!email && !requestedUserId) || !allocations.length) return res.status(400).json({ message: "userId or email and memberships are required" });
    const result = await db.transaction(async tx => {
      let user: any;
      if (requestedUserId) {
        [user] = await tx.select().from(users).where(eq(users.id, requestedUserId));
      } else {
        [user] = await tx.select().from(users).where(eq(users.email, email!));
      }
      const created: any[] = [];
      const inviteTokens: Array<{ companyId: string; token: string }> = [];
      for (const allocation of allocations) {
        const companyId = String(allocation.companyId || ""), role = String(allocation.role || "viewer");
        if (!clientRoles.includes(role as any) && !roles.includes(role as any)) throw new Error("Invalid membership role");
        const [company] = await tx.select().from(companies).where(eq(companies.id, companyId));
        if (!company) throw new Error("Company not found");
        const existing = await tx.select({ id: companyMemberships.id }).from(companyMemberships).where(and(eq(companyMemberships.companyId, companyId), user ? eq(companyMemberships.userId, user.id) : eq(companyMemberships.invitedEmail, email!)));
        if (existing.length) throw new Error("Duplicate membership");
        const token = user ? null : crypto.randomBytes(32).toString("hex");
        const [membership] = await tx.insert(companyMemberships).values({ companyId, userId: user?.id || null, invitedEmail: user ? null : email, role, status: user ? "active" : "invited", acceptedAt: user ? new Date() : null, invitationTokenHash: token ? crypto.createHash("sha256").update(token).digest("hex") : null, invitationExpiresAt: token ? new Date(Date.now() + 7 * 86400000) : null, invitedBy: actor(req), updatedBy: actor(req) }).returning();
        if (token) inviteTokens.push({ companyId, token });
        created.push(membership);
      }
      return { user, created, inviteTokens };
    }).catch((error: any) => ({ error: error.message }));
    if ((result as any).error) return res.status(400).json({ message: (result as any).error });
    for (const membership of (result as any).created) await companyAudit(req, "company.member.added", membership.companyId, { membershipId: membership.id, userId: (result as any).user?.id || null, invitedEmail: email });
    res.status(201).json({ user: safeUser((result as any).user), memberships: (result as any).created.map(membershipView), inviteTokens: (result as any).inviteTokens });
  });
  r.get("/admin/companies/:companyId", ...generalizedAdmin, async (req: any, res) => {
    const [company] = await db.select().from(companies).where(eq(companies.id, req.params.companyId));
    if (!company) return res.status(404).json({ message: "Company not found" });
    const members = await db.select({ membership: companyMemberships, user: users }).from(companyMemberships)
      .leftJoin(users, eq(companyMemberships.userId, users.id)).where(eq(companyMemberships.companyId, company.id));
    res.json({ company, memberships: members.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })), members: members.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })) });
  });
  r.post("/admin/companies", ...generalizedAdmin, async (req: any, res) => {
    const name = String(req.body?.name || req.body?.companyName || "").trim();
    const classification = String(req.body?.classification || "client");
    if (!name || name.length > 200 || !classifications.includes(classification as any)) {
      return res.status(400).json({ message: "name and a valid classification (client, partner, or both) are required" });
    }
    const ownerUserId = req.body?.ownerUserId || null;
    if (!ownerUserId) return res.status(400).json({ message: "Companies require ownerUserId" });
    const company = await db.transaction(async tx => {
      if (ownerUserId && !(await tx.select({ id: users.id }).from(users).where(eq(users.id, ownerUserId))).length)
        throw new Error("Owner user not found");
      let created: any;
      if (classification === "partner" || classification === "both") {
        const [profile] = await tx.insert(moverProfiles).values({ userId: ownerUserId, companyName: name, partnerStatus: "active" }).returning();
        [created] = await tx.insert(companies).values({ id: profile.id, name, classification, moverProfileId: profile.id, ownerUserId }).returning();
      } else {
        [created] = await tx.insert(companies).values({ name, classification, ownerUserId }).returning();
      }
      if (ownerUserId && created.moverProfileId) {
        await tx.insert(partnerCompanyMemberships).values({ companyId: created.moverProfileId, userId: ownerUserId, role: "owner", status: "active", acceptedAt: new Date(), invitedBy: actor(req), updatedBy: actor(req) });
      } else if (ownerUserId) {
        await tx.insert(companyMemberships).values({ companyId: created.id, userId: ownerUserId, role: "owner", status: "active", acceptedAt: new Date(), invitedBy: actor(req), updatedBy: actor(req) });
      }
      await companyAudit(req, "company.created", created.id, { classification, ownerUserId }, tx);
      return created;
    }).catch((error: any) => ({ error: error.message }));
    if ((company as any).error) return res.status(400).json({ message: (company as any).error });
    res.status(201).json(company);
  });
  r.patch("/admin/companies/:companyId", ...generalizedAdmin, async (req: any, res) => {
    const data: any = { updatedAt: new Date() };
    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim() || req.body.name.length > 200) return res.status(400).json({ message: "Invalid company name" });
      data.name = req.body.name.trim();
    }
    if (req.body?.classification !== undefined) {
      if (!classifications.includes(req.body.classification)) return res.status(400).json({ message: "Invalid classification" });
      data.classification = req.body.classification;
    }
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    const company = await db.transaction(async tx => {
      const [before] = await tx.select().from(companies).where(eq(companies.id, req.params.companyId));
      if (!before) return null;
      if ((data.classification === "partner" || data.classification === "both") && !before.moverProfileId) {
        const ownerId = req.body?.ownerUserId || before.ownerUserId;
        if (!ownerId) throw new Error("Partner classification requires an owner user");
        const [ownerMembership] = await tx.select().from(companyMemberships).where(and(
          eq(companyMemberships.companyId, before.id),
          eq(companyMemberships.userId, ownerId),
          eq(companyMemberships.role, "owner"),
          eq(companyMemberships.status, "active"),
        ));
        if (!ownerMembership) throw new Error("Partner classification requires an active company owner");
        const [profile] = await tx.insert(moverProfiles).values({ id: before.id, userId: ownerId, companyName: data.name || before.name, partnerStatus: "active" }).returning();
        data.moverProfileId = profile.id; data.ownerUserId = ownerId;
        await tx.insert(partnerCompanyMemberships).values({
          id: ownerMembership.id,
          companyId: profile.id,
          userId: ownerId,
          role: "owner",
          status: "active",
          acceptedAt: ownerMembership.acceptedAt || new Date(),
          invitedBy: ownerMembership.invitedBy,
          updatedBy: actor(req),
        });
      }
      const moverProfileId = data.moverProfileId || before.moverProfileId;
      if (moverProfileId) {
        const nextClassification = data.classification || before.classification;
        const nextActive = data.isActive ?? before.isActive;
        await tx.update(moverProfiles).set({
          ...(data.name ? { companyName: data.name } : {}),
          partnerStatus: nextActive && (nextClassification === "partner" || nextClassification === "both") ? "active" : "suspended",
          updatedAt: new Date(),
        }).where(eq(moverProfiles.id, moverProfileId));
      }
      const [updated] = await tx.update(companies).set(data).where(eq(companies.id, req.params.companyId)).returning();
      await companyAudit(req, "company.updated", updated.id, { fields: Object.keys(data) }, tx);
      return updated;
    }).catch((error: any) => ({ error: error.message }));
    if (!company) return res.status(404).json({ message: "Company not found" });
    if ((company as any).error) return res.status(400).json({ message: (company as any).error });
    res.json(company);
  });
  r.delete("/admin/companies/:companyId", ...generalizedAdmin, async (req: any, res) => {
    const company = await db.transaction(async tx => {
      const [before] = await tx.select().from(companies).where(eq(companies.id, req.params.companyId));
      if (!before) return null;
      if (before.moverProfileId) {
        await tx.update(moverProfiles).set({ partnerStatus: "suspended", updatedAt: new Date() }).where(eq(moverProfiles.id, before.moverProfileId));
      }
      const [suspended] = await tx.update(companies).set({ isActive: false, updatedAt: new Date() }).where(eq(companies.id, before.id)).returning();
      await companyAudit(req, "company.suspended", suspended.id, {}, tx);
      return suspended;
    });
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  });
  r.get("/admin/companies/:companyId/memberships", ...generalizedAdmin, async (req: any, res) => {
    const rows = await db.select({ membership: companyMemberships, user: users }).from(companyMemberships).leftJoin(users, eq(companyMemberships.userId, users.id)).where(eq(companyMemberships.companyId, req.params.companyId));
    res.json({ memberships: rows.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })), members: rows.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })) });
  });
  // Frontend compatibility: both spellings are supported.
  r.get("/admin/companies/:companyId/members", ...generalizedAdmin, async (req: any, res) => {
    const rows = await db.select({ membership: companyMemberships, user: users }).from(companyMemberships).leftJoin(users, eq(companyMemberships.userId, users.id)).where(eq(companyMemberships.companyId, req.params.companyId));
    res.json({ members: rows.map(x => ({ membership: membershipView(x.membership), user: safeUser(x.user) })), memberships: rows.map(x => membershipView(x.membership)) });
  });
  r.get("/admin/users/:userId/memberships", ...generalizedUsers, async (req: any, res) => {
    const rows = await db.select({ membership: companyMemberships, company: companies })
      .from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(eq(companyMemberships.userId, req.params.userId));
    res.json({ memberships: rows });
  });
  r.get("/admin/companies/users/:userId/memberships", ...generalizedUsers, async (req: any, res) => {
    const rows = await db.select({ membership: companyMemberships, company: companies }).from(companyMemberships).innerJoin(companies, eq(companyMemberships.companyId, companies.id)).where(eq(companyMemberships.userId, req.params.userId));
    res.json({ memberships: rows });
  });
  const adminUserMembershipMutation = async (req: any, res: any, remove: boolean) => {
    const [target] = await db.select().from(companyMemberships).where(and(eq(companyMemberships.id, req.params.membershipId), eq(companyMemberships.userId, req.params.userId)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const canManageMovers = await hasAdminPermission(req, "canManageMovers");
    const role = req.body?.role || target.role, status = req.body?.status || target.status;
    if (!["owner", "admin", "member", "viewer", "dispatcher", "fleet_manager", "accountant"].includes(role) || !["invited", "active", "suspended"].includes(status)) return res.status(400).json({ message: "Invalid membership" });
    if (role === "owner" && target.role !== "owner") return res.status(403).json({ message: "Owner role may only be granted by a current company owner" });
    const result = await guardedGeneralizedMembershipMutation(target.companyId, target.id, remove ? undefined : { role, status, updatedBy: actor(req) }, canManageMovers);
    if (result.error === "not_found") return res.status(404).json({ message: "Membership not found" });
    if (result.error === "partner_permission") return res.status(403).json({ message: "Managing operational partner membership requires mover permission" });
    if (result.error === "last_owner" || result.error === "last_partner_owner") return res.status(409).json({ message: "The last active company or operational partner owner cannot be removed" });
    const mutatedTarget: any = (result as any).target;
    await companyAudit(req, `company.member.${remove ? "removed" : "updated"}`, mutatedTarget.companyId, { membershipId: mutatedTarget.id, userId: req.params.userId });
    res.json(remove ? { success: true } : membershipView((result as any).membership));
  };
  r.patch("/admin/users/:userId/memberships/:membershipId", ...generalizedUsers, (req: any, res: any) => adminUserMembershipMutation(req, res, false));
  r.delete("/admin/users/:userId/memberships/:membershipId", ...generalizedUsers, (req: any, res: any) => adminUserMembershipMutation(req, res, true));
  r.patch("/admin/companies/users/:userId/memberships/:membershipId", ...generalizedUsers, (req: any, res: any) => adminUserMembershipMutation(req, res, false));
  r.delete("/admin/companies/users/:userId/memberships/:membershipId", ...generalizedUsers, (req: any, res: any) => adminUserMembershipMutation(req, res, true));
  r.post(["/admin/companies/:companyId/memberships", "/admin/companies/:companyId/members"], ...generalizedAdmin, async (req: any, res) => {
    const role = String(req.body?.role || "viewer"), userId = req.body?.userId || null;
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const [company] = await db.select().from(companies).where(eq(companies.id, req.params.companyId));
    if (!company) return res.status(404).json({ message: "Company not found" });
    const allowedRoles = company.classification === "client"
      ? ["owner", "admin", "member", "viewer"]
      : ["owner", "admin", "dispatcher", "fleet_manager", "accountant", "viewer"];
    if (!allowedRoles.includes(role) || (!userId && !email))
      return res.status(400).json({ message: "A valid role and userId or email are required" });
    if (role === "owner") return res.status(403).json({ message: "Owner role may only be granted by a current company owner" });
    if (userId && !(await db.select({ id: users.id }).from(users).where(eq(users.id, userId))).length) return res.status(400).json({ message: "User not found" });
    const duplicate = await db.select({ id: companyMemberships.id }).from(companyMemberships).where(and(eq(companyMemberships.companyId, company.id), userId ? eq(companyMemberships.userId, userId) : eq(companyMemberships.invitedEmail, email!)));
    if (duplicate.length) return res.status(409).json({ message: "Membership or invitation already exists" });
    const inviteToken = userId ? null : crypto.randomBytes(32).toString("hex");
    const [row] = await db.insert(companyMemberships).values({ companyId: company.id, userId, invitedEmail: userId ? null : email, role, status: userId ? "active" : "invited", acceptedAt: userId ? new Date() : null, invitationTokenHash: inviteToken ? crypto.createHash("sha256").update(inviteToken).digest("hex") : null, invitationExpiresAt: inviteToken ? new Date(Date.now() + 7 * 86400000) : null, invitedBy: actor(req), updatedBy: actor(req) }).returning();
    await companyAudit(req, "company.member.added", company.id, { membershipId: row.id, role, userId, email });
    res.status(201).json({ membership: membershipView(row), ...(inviteToken ? { inviteToken } : {}) });
  });
  r.patch(["/admin/companies/:companyId/memberships/:membershipId", "/admin/companies/:companyId/members/:membershipId"], ...generalizedAdmin, async (req: any, res) => {
    const [target] = await db.select().from(companyMemberships).where(and(eq(companyMemberships.id, req.params.membershipId), eq(companyMemberships.companyId, req.params.companyId)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const [company] = await db.select().from(companies).where(eq(companies.id, target.companyId));
    const role = req.body?.role || target.role, status = req.body?.status || target.status;
    const allowedRoles = company?.classification === "client"
      ? ["owner", "admin", "member", "viewer"]
      : ["owner", "admin", "dispatcher", "fleet_manager", "accountant", "viewer"];
    if (!allowedRoles.includes(role) || !["invited", "active", "suspended"].includes(status)) return res.status(400).json({ message: "Invalid role or status" });
    if (role === "owner" && target.role !== "owner") return res.status(403).json({ message: "Owner role may only be granted by a current company owner" });
    const result = await guardedGeneralizedMembershipMutation(target.companyId, target.id, { role, status, updatedBy: actor(req) });
    if (result.error === "last_owner" || result.error === "last_partner_owner") return res.status(409).json({ message: "The last active company or operational partner owner cannot be removed or demoted" });
    const row = result.membership!;
    await companyAudit(req, "company.member.updated", target.companyId, { membershipId: target.id, role, status });
    res.json(row);
  });
  r.delete(["/admin/companies/:companyId/memberships/:membershipId", "/admin/companies/:companyId/members/:membershipId"], ...generalizedAdmin, async (req: any, res) => {
    const [target] = await db.select().from(companyMemberships).where(and(eq(companyMemberships.id, req.params.membershipId), eq(companyMemberships.companyId, req.params.companyId)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const result = await guardedGeneralizedMembershipMutation(target.companyId, target.id);
    if (result.error === "last_owner" || result.error === "last_partner_owner") return res.status(409).json({ message: "The last active company or operational partner owner cannot be removed" });
    await companyAudit(req, "company.member.removed", target.companyId, { membershipId: target.id });
    res.json({ success: true });
  });
  r.get("/partner/companies", async (req: any, res) => {
    const rows = await getCompanyMemberships(actor(req));
    const active = await resolveActiveCompany(req);
    res.json({ companies: rows.map(x => ({ company: safeCompany(x.company), membership: membershipView(x.membership), permissions: permissionsForRole(x.membership.role) })), activeCompanyId: active?.company.id || null });
  });
  r.put("/partner/companies/active", async (req: any, res) => {
    const companyId = String(req.body?.companyId || "");
    const rows = await getCompanyMemberships(actor(req));
    if (!rows.some(x => x.company.id === companyId)) return res.status(403).json({ message: "Not an active member of this company" });
    req.session.activePartnerCompanyId = companyId;
    await new Promise<void>((resolve, reject) => req.session.save((e: any) => e ? reject(e) : resolve()));
    res.json({ activeCompanyId: companyId });
  });
  r.get("/partner/company", requirePermission("company:read"), (req: any, res) => res.json({ company: safeCompany(req.company), membership: membershipView(req.companyMembership), permissions: req.companyPermissions }));
  r.patch("/partner/company", requirePermission("company:manage"), async (req: any, res) => {
    const allowed = ["companyName","businessEmail","contactPhone","contactWhatsApp","website","description","taxId","insuranceInfo","serviceAreas","moveTypes","vehicleTypes","fleetSize","crewSize","yearsInBusiness","operatingHours","operatingTimezone","serviceCapabilities","travelBufferMinutes","turnaroundBufferMinutes","onboardingComplete","onboardingReadiness"];
    const data: any = {}; for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k]; data.updatedAt = new Date();
    if (data.operatingTimezone !== undefined && (typeof data.operatingTimezone !== "string" || data.operatingTimezone.length < 1 || data.operatingTimezone.length > 100)) return res.status(400).json({ message: "Invalid operating timezone" });
    if (data.serviceCapabilities !== undefined && (!Array.isArray(data.serviceCapabilities) || data.serviceCapabilities.some((value: unknown) => typeof value !== "string" || value.length > 100))) return res.status(400).json({ message: "Invalid service capabilities" });
    for (const field of ["travelBufferMinutes", "turnaroundBufferMinutes"]) {
      if (data[field] !== undefined && (!Number.isInteger(data[field]) || data[field] < 0 || data[field] > 1440)) return res.status(400).json({ message: `Invalid ${field}` });
    }
    if (data.onboardingComplete !== undefined && typeof data.onboardingComplete !== "boolean") return res.status(400).json({ message: "Invalid onboarding completion value" });
    if (data.onboardingReadiness !== undefined && (data.onboardingReadiness === null || typeof data.onboardingReadiness !== "object" || Array.isArray(data.onboardingReadiness))) return res.status(400).json({ message: "Invalid onboarding readiness" });
    const [row] = await db.update(moverProfiles).set(data).where(eq(moverProfiles.id, req.company.id)).returning();
    await log(req, "company.updated", req.company.id, { fields: Object.keys(data) }); res.json(row);
  });
  r.get("/partner/company/members", requirePermission("company:read"), async (req: any, res) => {
    const rows = await db.select({ membership: partnerCompanyMemberships, user: users }).from(partnerCompanyMemberships)
      .leftJoin(users, eq(partnerCompanyMemberships.userId, users.id)).where(eq(partnerCompanyMemberships.companyId, req.company.id));
    res.json({ members: rows.map(x => ({ membership: membershipView(x.membership), user: x.user ? { id: x.user.id, email: x.user.email, fullName: x.user.fullName } : null })) });
  });
  r.post("/partner/company/invitations", requirePermission("members:manage"), async (req: any, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase(), role = String(req.body?.role || "viewer");
    if (!email || !roles.includes(role as any) || role === "owner") return res.status(400).json({ message: "Valid email and non-owner role required" });
    const token = crypto.randomBytes(32).toString("hex"), hash = crypto.createHash("sha256").update(token).digest("hex");
    const existing = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.companyId, req.company.id), eq(partnerCompanyMemberships.invitedEmail, email)));
    let row;
    if (existing[0]?.status === "active") return res.status(409).json({ message: "This person is already an active company member" });
    const expires = new Date(Date.now() + 7 * 86400000);
    if (existing[0]) [row] = await db.update(partnerCompanyMemberships).set({ userId: null, role, status: "invited", invitationTokenHash: hash, invitationExpiresAt: expires, invitedBy: actor(req), updatedBy: actor(req), invitedAt: new Date(), acceptedAt: null, updatedAt: new Date() }).where(eq(partnerCompanyMemberships.id, existing[0].id)).returning();
    else [row] = await db.insert(partnerCompanyMemberships).values({ companyId: req.company.id, invitedEmail: email, role, status: "invited", invitationTokenHash: hash, invitationExpiresAt: expires, invitedBy: actor(req), updatedBy: actor(req) }).returning();
    await db.insert(companyMemberships).values({ id: row.id, companyId: req.company.id, invitedEmail: email, role, status: "invited", invitationTokenHash: hash, invitedBy: actor(req), updatedBy: actor(req), invitedAt: row.invitedAt, updatedAt: row.updatedAt }).onConflictDoUpdate({ target: companyMemberships.id, set: { invitedEmail: email, role, status: "invited", invitationTokenHash: hash, updatedBy: actor(req), updatedAt: new Date() } });
    await log(req, "company.member.invited", req.company.id, { membershipId: row.id, email, role });
    res.status(201).json({ membership: membershipView(row), inviteToken: token });
  });
  r.post("/partner/company/invitations/:token/accept", async (req: any, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, actor(req)) });
    const hash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const [row] = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.invitationTokenHash, hash), eq(partnerCompanyMemberships.status, "invited")));
    if (!row || !user?.email || user.email.toLowerCase() !== row.invitedEmail?.toLowerCase()) return res.status(403).json({ message: "Invitation does not match authenticated email" });
    if (!row.invitationExpiresAt || row.invitationExpiresAt <= new Date()) return res.status(410).json({ message: "Invitation has expired" });
    const [generalizedCompany] = await db.select().from(companies).where(eq(companies.id, row.companyId));
    const [profile] = await db.select().from(moverProfiles).where(eq(moverProfiles.id, row.companyId));
    if (!generalizedCompany?.isActive || !["partner", "both"].includes(generalizedCompany.classification) || ["suspended", "inactive"].includes(profile?.partnerStatus || "")) return res.status(403).json({ message: "Partner company is not active" });
    const [alreadyMember] = await db.select({ id: partnerCompanyMemberships.id }).from(partnerCompanyMemberships)
      .where(and(eq(partnerCompanyMemberships.companyId, row.companyId), eq(partnerCompanyMemberships.userId, user.id)));
    if (alreadyMember) return res.status(409).json({ message: "This account is already a company member" });
    const [updated] = await db.update(partnerCompanyMemberships).set({ userId: user.id, invitedEmail: null, status: "active", acceptedAt: new Date(), invitationTokenHash: null, invitationExpiresAt: null, updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(partnerCompanyMemberships.id, row.id), eq(partnerCompanyMemberships.status, "invited"), eq(partnerCompanyMemberships.invitationTokenHash, hash))).returning();
    if (!updated) return res.status(409).json({ message: "This invitation is no longer valid" });
    req.companyMembership = updated;
    await log(req, "company.member.invitation_accepted", row.companyId, { membershipId: updated.id, userId: user.id });
    res.json({ membership: membershipView(updated) });
  });
  r.patch("/partner/company/members/:membershipId", requirePermission("members:manage"), async (req: any, res) => {
    const [target] = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.id, req.params.membershipId), eq(partnerCompanyMemberships.companyId, req.company.id)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const selfRole = req.companyMembership.role, nextRole = req.body.role || target.role, nextStatus = req.body.status || target.status;
    if (selfRole === "admin" && target.role === "owner") return res.status(403).json({ message: "Admins cannot modify owners" });
    if (selfRole === "admin" && nextRole === "owner") return res.status(403).json({ message: "Only owners can promote another owner" });
    if (!roles.includes(nextRole) || !statuses.includes(nextStatus)) return res.status(400).json({ message: "Invalid role or status" });
    const result = await guardedMembershipMutation(req.company.id, target.id, { role: nextRole, status: nextStatus, updatedBy: actor(req) });
    if (result.error === "last_owner") return res.status(409).json({ message: "The last active owner cannot be removed or demoted" });
    const updated = result.membership!;
    await log(req, "company.member.updated", req.company.id, { membershipId: target.id, role: nextRole, status: nextStatus }); res.json(membershipView(updated));
  });
  r.delete("/partner/company/members/:membershipId", requirePermission("members:manage"), async (req: any, res) => {
    const [target] = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.id, req.params.membershipId), eq(partnerCompanyMemberships.companyId, req.company.id)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    if (req.companyMembership.role === "admin" && target.role === "owner") return res.status(403).json({ message: "Admins cannot remove owners" });
    const result = await guardedMembershipMutation(req.company.id, target.id);
    if (result.error === "last_owner") return res.status(409).json({ message: "The last active owner cannot be removed" });
    await log(req, "company.member.removed", req.company.id, { membershipId: target.id }); res.json({ success: true });
  });

  const admin = [requireAdmin, requirePlatformPermission("module:companies"), requireAdminPermission("canManageMovers")];
  r.get("/admin/partner/companies", ...admin, async (_req: any, res: any) => {
    const companies = await db.select().from(moverProfiles);
    res.json({ companies });
  });
  r.get("/admin/partner/companies/:companyId/members", ...admin, async (req: any, res) => {
    const rows = await db.select({ membership: partnerCompanyMemberships, user: users }).from(partnerCompanyMemberships).leftJoin(users, eq(partnerCompanyMemberships.userId, users.id)).where(eq(partnerCompanyMemberships.companyId, req.params.companyId));
    res.json(rows.map(x => ({ membership: membershipView(x.membership), user: x.user ? { id: x.user.id, email: x.user.email, fullName: x.user.fullName } : null })));
  });
  r.post("/admin/partner/companies", ...admin, async (req: any, res) => {
    const { companyName, initialOwnerUserId, isInternal = false } = req.body || {};
    if (!companyName || !initialOwnerUserId) return res.status(400).json({ message: "companyName and initialOwnerUserId are required" });
    const owner = await db.query.users.findFirst({ where: eq(users.id, initialOwnerUserId) }); if (!owner) return res.status(400).json({ message: "Owner user not found" });
    const company = await db.transaction(async tx => {
      const [profile] = await tx.insert(moverProfiles).values({
        companyName, userId: initialOwnerUserId, isInternal: Boolean(isInternal),
        partnerStatus: req.body.partnerStatus || "active", businessEmail: req.body.businessEmail || null,
        contactPhone: req.body.contactPhone || null, description: req.body.description || null,
        verified: Boolean(req.body.verified), onboardingComplete: Boolean(req.body.onboardingComplete),
      }).returning();
      await tx.insert(companies).values({ id: profile.id, name: profile.companyName, classification: "partner", moverProfileId: profile.id, ownerUserId: initialOwnerUserId, isActive: true, createdAt: profile.createdAt, updatedAt: profile.updatedAt });
      await tx.insert(partnerCompanyMemberships).values({ companyId: profile.id, userId: initialOwnerUserId, role: "owner", status: "active", acceptedAt: new Date(), invitedBy: actor(req), updatedBy: actor(req) });
      return profile;
    });
    await log(req, "admin.company.created", company.id, { initialOwnerUserId, isInternal: company.isInternal });
    res.status(201).json(company);
  });
  r.patch("/admin/partner/companies/:companyId", ...admin, async (req: any, res) => {
    const allowed = ["companyName", "businessEmail", "contactPhone", "contactWhatsApp", "website", "description", "taxId", "insuranceInfo", "serviceAreas", "moveTypes", "vehicleTypes", "fleetSize", "crewSize", "yearsInBusiness", "operatingHours", "verified", "partnerStatus", "partnerStatusNote", "onboardingComplete", "isInternal"];
    const data: any = { updatedAt: new Date() };
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    const [row] = await db.update(moverProfiles).set(data).where(eq(moverProfiles.id, req.params.companyId)).returning(); if (!row) return res.status(404).json({ message: "Company not found" }); res.json(row);
  });
  r.post("/admin/partner/companies/:companyId/members", ...admin, async (req: any, res) => {
    const role = req.body.role || "viewer", email = req.body.email?.toLowerCase(), userId = req.body.userId;
    if (!roles.includes(role) || (!userId && !email)) return res.status(400).json({ message: "A valid role and userId or email are required" });
    if (role === "owner") return res.status(403).json({ message: "Owner role may only be granted by a current company owner" });
    const company = await db.query.moverProfiles.findFirst({ where: eq(moverProfiles.id, req.params.companyId) });
    if (!company) return res.status(404).json({ message: "Company not found" });
    const user = userId ? await db.query.users.findFirst({ where: eq(users.id, userId) }) : email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : undefined;
    const token = user ? null : crypto.randomBytes(32).toString("hex");
    const [row] = await db.insert(partnerCompanyMemberships).values({ companyId: req.params.companyId, userId: user?.id, invitedEmail: user ? null : email, role, status: user ? "active" : "invited", acceptedAt: user ? new Date() : null, invitationTokenHash: token ? crypto.createHash("sha256").update(token).digest("hex") : null, invitationExpiresAt: token ? new Date(Date.now() + 7 * 86400000) : null, invitedBy: actor(req), updatedBy: actor(req) }).returning();
    res.status(201).json({ membership: membershipView(row), ...(token ? { inviteToken: token } : {}) });
  });
  r.patch("/admin/partner/companies/:companyId/members/:membershipId", ...admin, async (req: any, res) => {
    const [target] = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.id, req.params.membershipId), eq(partnerCompanyMemberships.companyId, req.params.companyId)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const role = req.body.role || target.role, status = req.body.status || target.status;
    const result = await guardedMembershipMutation(target.companyId, target.id, { role, status, updatedBy: actor(req) });
    if (result.error === "last_owner") return res.status(409).json({ message: "Last owner protection" });
    res.json(membershipView(result.membership));
  });
  r.delete("/admin/partner/companies/:companyId/members/:membershipId", ...admin, async (req: any, res) => {
    const [target] = await db.select().from(partnerCompanyMemberships).where(and(eq(partnerCompanyMemberships.id, req.params.membershipId), eq(partnerCompanyMemberships.companyId, req.params.companyId)));
    if (!target) return res.status(404).json({ message: "Membership not found" });
    const result = await guardedMembershipMutation(target.companyId, target.id);
    if (result.error === "last_owner") return res.status(409).json({ message: "Last owner protection" });
    res.json({ success: true });
  });
  return r;
}
