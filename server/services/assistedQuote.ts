import { z } from "zod";

export const assistedQuoteDraftSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  customerName: z.string().trim().max(200).optional(),
  customerEmail: z.string().trim().email().optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  confirmNewLead: z.boolean().optional(),
  fromAddress: z.string().trim().max(500).optional(),
  toAddress: z.string().trim().max(500).optional(),
  homeSize: z.string().trim().max(100).optional(),
  storageOption: z.string().trim().max(100).optional(),
  moveDate: z.union([z.string(), z.date()]).optional().nullable(),
  moveAvailabilityStart: z.string().max(100).optional().nullable(),
  moveAvailabilityEnd: z.string().max(100).optional().nullable(),
  preferredMoveDates: z.array(z.string()).optional(),
  blockedMoveDates: z.array(z.string()).optional(),
  needsInsurance: z.boolean().optional(),
  needsPacking: z.boolean().optional(),
  needsUnpacking: z.boolean().optional(),
  needsBox: z.boolean().optional(),
  clientNotes: z.string().max(5000).optional().nullable(),
  adminNotes: z.string().max(5000).optional().nullable(),
  contactName: z.string().trim().max(200).optional().nullable(),
  contactEmail: z.string().trim().email().optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  inventoryItems: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(300),
    room: z.string().max(100).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    quantity: z.number().int().min(1).max(1000).default(1),
    notes: z.string().max(1000).optional().nullable(),
  })).optional(),
  estimatedCost: z.union([z.number(), z.string()]).optional().nullable(),
  estimatedCostHigh: z.union([z.number(), z.string()]).optional().nullable(),
  estimatedCurrency: z.string().max(10).optional(),
  partner: z.string().max(100).optional().nullable(),
  utmSource: z.string().max(300).optional().nullable(),
  utmMedium: z.string().max(300).optional().nullable(),
  utmCampaign: z.string().max(300).optional().nullable(),
  utmTerm: z.string().max(300).optional().nullable(),
  utmContent: z.string().max(300).optional().nullable(),
  landingPage: z.string().max(1000).optional().nullable(),
  referrerUrl: z.string().max(2000).optional().nullable(),
  fromBranchId: z.string().optional().nullable(),
  toBranchId: z.string().optional().nullable(),
  storageSizeLabel: z.string().max(100).optional().nullable(),
  storageSizeM2: z.union([z.number(), z.string()]).optional().nullable(),
  storageAccepted: z.boolean().optional().nullable(),
  storageContractStatus: z.string().max(50).optional().nullable(),
  storageRentalIntent: z.string().max(50).optional().nullable(),
  storageAvailabilityStatus: z.string().max(50).optional().nullable(),
  storageSelectedUnitCode: z.string().max(100).optional().nullable(),
  storageSelectedUnitSnapshot: z.unknown().optional().nullable(),
  storageReservationStatus: z.string().max(50).optional().nullable(),
  storageAvailabilityCheckedAt: z.string().optional().nullable(),
}).strip();

/** Canonical comparison forms used for exact lead/customer duplicate warnings. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function duplicateMatch(
  candidate: { email?: unknown; phone?: unknown },
  existing: { email?: unknown; phone?: unknown; id?: string },
) {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  return {
    email: !!email && email === normalizeEmail(existing.email),
    phone: !!phone && phone === normalizePhone(existing.phone),
    id: existing.id,
  };
}