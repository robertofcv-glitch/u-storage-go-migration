import type { Request, Response, NextFunction } from "express";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "./db";
import { moverProfiles, partnerCompanyMemberships, companies, COMPANY_MEMBER_ROLES, COMPANY_MEMBER_STATUSES } from "@shared/schema";
import { getActiveUserId } from "./authMiddleware";

export type CompanyPermission = "company:read" | "company:manage" | "members:manage" |
  "fleet:manage" | "availability:manage" | "dispatch:manage";

const permissions: Record<string, CompanyPermission[]> = {
  owner: ["company:read", "company:manage", "members:manage", "fleet:manage", "availability:manage", "dispatch:manage"],
  admin: ["company:read", "company:manage", "members:manage", "fleet:manage", "availability:manage", "dispatch:manage"],
  dispatcher: ["company:read", "availability:manage", "dispatch:manage"],
  fleet_manager: ["company:read", "fleet:manage", "availability:manage"],
  accountant: ["company:read"],
  viewer: ["company:read"],
};

export function permissionsForRole(role: string): CompanyPermission[] {
  return permissions[role] || [];
}

export async function getCompanyMemberships(userId: string) {
  return db.select({ company: moverProfiles, membership: partnerCompanyMemberships })
    .from(partnerCompanyMemberships)
    .innerJoin(moverProfiles, eq(partnerCompanyMemberships.companyId, moverProfiles.id))
    .innerJoin(companies, eq(companies.id, moverProfiles.id))
    .where(and(
      eq(partnerCompanyMemberships.userId, userId),
      eq(partnerCompanyMemberships.status, COMPANY_MEMBER_STATUSES.ACTIVE),
      eq(companies.isActive, true),
      or(eq(companies.classification, "partner"), eq(companies.classification, "both")),
    ))
    .orderBy(asc(partnerCompanyMemberships.invitedAt));
}

export async function resolveActiveCompany(req: Request) {
  const userId = getActiveUserId(req);
  if (!userId) return undefined;
  const memberships = await getCompanyMemberships(userId);
  if (!memberships.length) return undefined;
  const selected = (req as any).session?.activePartnerCompanyId;
  return memberships.find(x => x.company.id === selected) || memberships[0];
}

export function requireCompanyPermission(permission: CompanyPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const active = await resolveActiveCompany(req);
      if (!active) return res.status(403).json({ message: "An active company membership is required" });
      if (["suspended", "inactive"].includes(active.company.partnerStatus || "")) {
        return res.status(403).json({ message: "This company is not active" });
      }
      if (["pending", "documents_review"].includes(active.company.partnerStatus || "") &&
          !["company:read", "company:manage"].includes(permission)) {
        return res.status(403).json({ message: "This company must be approved before using operational tools" });
      }
      if (["fleet:manage", "availability:manage", "dispatch:manage"].includes(permission) &&
          active.company.onboardingComplete !== true) {
        return res.status(403).json({ message: "Complete the company onboarding profile before using operational tools" });
      }
      const allowed = permissionsForRole(active.membership.role).includes(permission);
      if (!allowed) return res.status(403).json({ message: "Insufficient company permissions" });
      (req as any).company = active.company;
      (req as any).companyMembership = active.membership;
      (req as any).companyPermissions = permissionsForRole(active.membership.role);
      next();
    } catch (error) {
      console.error("Company authorization error:", error);
      res.status(500).json({ message: "Company authorization failed" });
    }
  };
}

export function companyPermission(role: string, permission: CompanyPermission) {
  return permissionsForRole(role).includes(permission);
}

export const companyRoles = COMPANY_MEMBER_ROLES;
export const companyStatuses = COMPANY_MEMBER_STATUSES;