/** Canonical, transport-safe organization contracts shared by server guards and consumers. */
export type OrganizationClassification = "client" | "partner" | "both";
export type OrganizationStatus = "active" | "suspended" | "inactive" | "pending" | "documents_review";
export type OrganizationMembershipRole = "owner" | "admin" | "dispatcher" | "fleet_manager" | "accountant" | "member" | "viewer";
export type OrganizationMembershipStatus = "invited" | "active" | "suspended";

export interface CanonicalOrganization {
  id: string;
  name: string;
  classification: OrganizationClassification;
  status: OrganizationStatus;
  ownerUserId: string | null;
  moverProfileId: string | null;
  memberCount: number;
}

export interface CanonicalOrganizationMembership {
  id: string;
  organizationId: string;
  userId: string | null;
  invitedEmail: string | null;
  role: OrganizationMembershipRole;
  status: OrganizationMembershipStatus;
}

export interface OrganizationImpactPreview {
  subject: "company" | "user";
  subjectId: string;
  operation: "suspend" | "reactivate" | "delete";
  affectedMemberships: number;
  affectedUsers: number;
  affectedQuotes: number;
  warnings: string[];
  destructive: boolean;
}