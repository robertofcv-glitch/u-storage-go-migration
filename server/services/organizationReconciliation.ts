import { db } from "../db";
import { companies, companyMemberships, moverProfiles, partnerCompanyMemberships } from "@shared/schema";

export type ReconciliationExecutor = Pick<typeof db, "select">;
export type OrganizationReconciliationReport = {
  generatedAt: string;
  legacyCompanies: number;
  generalizedCompanies: number;
  missingGeneralizedCompanies: string[];
  missingGeneralizedMemberships: string[];
  missingLegacyMemberships: string[];
  ambiguousCompanies: Array<{ legacyCompanyId: string; generalizedCompanyIds: string[]; reason: string }>;
  parity: "ok" | "review";
  readOnly: true;
};

/** Read-only parity report. It never inserts, updates, deletes, or guesses a match. */
export async function buildOrganizationReconciliationReport(executor: ReconciliationExecutor = db): Promise<OrganizationReconciliationReport> {
  const [legacyCompanies, generalizedCompanies, legacyMemberships, generalizedMemberships] = await Promise.all([
    executor.select({ id: moverProfiles.id }).from(moverProfiles),
    executor.select({ id: companies.id, moverProfileId: companies.moverProfileId }).from(companies),
    executor.select({ id: partnerCompanyMemberships.id }).from(partnerCompanyMemberships),
    executor.select({ id: companyMemberships.id }).from(companyMemberships),
  ]);
  const generalizedByMover = new Map<string, string[]>();
  for (const company of generalizedCompanies) {
    if (company.moverProfileId) generalizedByMover.set(company.moverProfileId, [...(generalizedByMover.get(company.moverProfileId) || []), company.id]);
  }
  const missingGeneralizedCompanies = legacyCompanies.map((x) => x.id).filter((id) => !generalizedByMover.has(id));
  const legacyMembershipIds = new Set(legacyMemberships.map((x) => x.id));
  const generalizedMembershipIds = new Set(generalizedMemberships.map((x) => x.id));
  const missingGeneralizedMemberships = Array.from(legacyMembershipIds).filter((id) => !generalizedMembershipIds.has(id)).sort();
  const missingLegacyMemberships = Array.from(generalizedMembershipIds).filter((id) => !legacyMembershipIds.has(id)).sort();
  const ambiguousCompanies = Array.from(generalizedByMover.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([legacyCompanyId, ids]) => ({ legacyCompanyId, generalizedCompanyIds: ids.sort(), reason: "Multiple generalized companies reference one legacy mover profile" }));
  return {
    generatedAt: new Date().toISOString(),
    legacyCompanies: legacyCompanies.length,
    generalizedCompanies: generalizedCompanies.length,
    missingGeneralizedCompanies: missingGeneralizedCompanies.sort(),
    missingGeneralizedMemberships,
    missingLegacyMemberships,
    ambiguousCompanies,
    parity: missingGeneralizedCompanies.length || missingGeneralizedMemberships.length || missingLegacyMemberships.length || ambiguousCompanies.length ? "review" : "ok",
    readOnly: true,
  };
}