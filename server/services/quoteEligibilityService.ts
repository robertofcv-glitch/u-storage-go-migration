import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  ustorageBranches,
  ustorageSettings,
  type Quote,
  type UstorageBranch,
} from "@shared/schema";

export type StorageDirection = "into_storage" | "out_of_storage";
export type ServiceMode = "branch_connected" | "general_point_to_point";

export interface QuoteEndpointSelection {
  fromBranchId?: string | null;
  toBranchId?: string | null;
}

export type QuoteEligibilityInput = Partial<Quote> & QuoteEndpointSelection;

export type EligibilityErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ENDPOINT_COMBINATION"
  | "GENERAL_MOVES_DISABLED"
  | "BRANCH_MOVES_DISABLED"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_UNAVAILABLE"
  | "BRANCH_DATA_INCOMPLETE"
  | "DIRECTION_DISABLED"
  | "CONTEXT_LOCKED"
  | "ELIGIBILITY_UNAVAILABLE";

const STATUS_BY_CODE: Record<EligibilityErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_ENDPOINT_COMBINATION: 422,
  GENERAL_MOVES_DISABLED: 409,
  BRANCH_MOVES_DISABLED: 409,
  BRANCH_NOT_FOUND: 422,
  BRANCH_UNAVAILABLE: 409,
  BRANCH_DATA_INCOMPLETE: 503,
  DIRECTION_DISABLED: 409,
  CONTEXT_LOCKED: 409,
  ELIGIBILITY_UNAVAILABLE: 503,
};

export class QuoteEligibilityError extends Error {
  readonly status: number;

  constructor(
    readonly code: EligibilityErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "QuoteEligibilityError";
    this.status = STATUS_BY_CODE[code];
  }
}

export const ELIGIBILITY_DERIVED_FIELDS = new Set([
  "serviceMode",
  "storageBranchId",
  "storageMoveType",
  "storageBranchBrand",
  "storageBranchGooglePlaceId",
  "storageBranchName",
  "storageBranchAddress",
  "storageBranchSnapshot",
  "eligibilityCheckedAt",
  "eligibilityVersion",
]);

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function existingBranchSelections(existing?: Quote): {
  fromBranchId: string | null;
  toBranchId: string | null;
} {
  if (!existing?.storageBranchId) return { fromBranchId: null, toBranchId: null };
  if (existing.storageMoveType === "out_of_storage") {
    return { fromBranchId: existing.storageBranchId, toBranchId: null };
  }
  if (existing.storageMoveType === "into_storage") {
    return { fromBranchId: null, toBranchId: existing.storageBranchId };
  }
  throw new QuoteEligibilityError(
    "INVALID_REQUEST",
    "The existing quote has branch data without a valid direction",
  );
}

async function loadBranch(
  branchId: string,
  executor: any,
  lockAvailability: boolean,
): Promise<UstorageBranch> {
  let branchQuery = executor
    .select()
    .from(ustorageBranches)
    .where(eq(ustorageBranches.id, branchId))
    .limit(1);
  if (lockAvailability) branchQuery = branchQuery.for("update");
  const [branch] = await branchQuery;
  if (!branch) {
    throw new QuoteEligibilityError("BRANCH_NOT_FOUND", "The selected storage branch does not exist", {
      branchId,
    });
  }
  if (branch.catalogStatus !== "official" || !branch.isActive) {
    throw new QuoteEligibilityError("BRANCH_UNAVAILABLE", "The selected storage branch is not currently available", {
      branchId,
      name: branch.name,
    });
  }
  if (!branch.address || !branch.googlePlaceId || !branch.lat || !branch.lng) {
    throw new QuoteEligibilityError(
      "BRANCH_DATA_INCOMPLETE",
      "The selected storage branch is temporarily unavailable because its verified location is incomplete",
      { branchId },
    );
  }
  return branch;
}

function branchSnapshot(branch: UstorageBranch) {
  return {
    id: branch.id,
    externalId: branch.externalId,
    brand: branch.brand,
    name: branch.name,
    address: branch.address,
    googlePlaceId: branch.googlePlaceId,
    mapsUrl: branch.mapsUrl,
    lat: branch.lat,
    lng: branch.lng,
    sourceVersion: branch.sourceVersion,
  };
}

export async function resolveQuoteEligibility(
  input: QuoteEligibilityInput,
  existing?: Quote,
  executor: any = db,
  lockAvailability = false,
): Promise<Partial<Quote>> {
  try {
    for (const field of ["fromBranchId", "toBranchId"] as const) {
      if (!hasOwn(input, field)) continue;
      const value = input[field];
      if (value !== null && value !== undefined && (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > 100
      )) {
        throw new QuoteEligibilityError(
          "INVALID_REQUEST",
          `${field} must be a valid branch ID or null`,
          { field },
        );
      }
    }
    for (const field of ["fromAddress", "toAddress"] as const) {
      if (!hasOwn(input, field)) continue;
      const value = input[field];
      if (typeof value !== "string" || !value.trim() || value.length > 500) {
        throw new QuoteEligibilityError(
          "INVALID_REQUEST",
          `${field} must be a non-empty address of at most 500 characters`,
          { field },
        );
      }
    }

    let settingsQuery = executor.select().from(ustorageSettings).limit(1);
    if (lockAvailability) settingsQuery = settingsQuery.for("update");
    const [settings] = await settingsQuery;
    if (!settings) {
      throw new QuoteEligibilityError(
        "ELIGIBILITY_UNAVAILABLE",
        "Service availability is temporarily unavailable. Please try again.",
      );
    }

    const previous = existingBranchSelections(existing);
    const fromBranchId = hasOwn(input, "fromBranchId")
      ? input.fromBranchId ?? null
      : previous.fromBranchId;
    const toBranchId = hasOwn(input, "toBranchId")
      ? input.toBranchId ?? null
      : previous.toBranchId;

    if (fromBranchId && toBranchId) {
      throw new QuoteEligibilityError(
        "INVALID_ENDPOINT_COMBINATION",
        "Select an approved storage branch as either the origin or destination, not both",
      );
    }

    const fromAddress = input.fromAddress ?? existing?.fromAddress;
    const toAddress = input.toAddress ?? existing?.toAddress;
    if (!fromAddress || !toAddress) {
      throw new QuoteEligibilityError(
        "INVALID_REQUEST",
        "Both origin and destination are required to determine service eligibility",
      );
    }

    if (!fromBranchId && !toBranchId) {
      if (!settings.generalMovesEnabled) {
        throw new QuoteEligibilityError(
          "GENERAL_MOVES_DISABLED",
          "General point-to-point moves are not currently available. Select an approved storage branch.",
        );
      }
      return {
        fromAddress,
        toAddress,
        serviceMode: "general_point_to_point",
        storageBranchId: null,
        storageMoveType: null,
        storageBranchBrand: null,
        storageBranchGooglePlaceId: null,
        storageBranchName: null,
        storageBranchAddress: null,
        storageBranchSnapshot: null,
        eligibilityCheckedAt: new Date(),
        eligibilityVersion: 1,
      };
    }

    if (!settings.branchMovesEnabled) {
      throw new QuoteEligibilityError(
        "BRANCH_MOVES_DISABLED",
        "Moves connected to a storage branch are not currently available",
      );
    }

    const direction: StorageDirection = fromBranchId ? "out_of_storage" : "into_storage";
    if (direction === "out_of_storage" && settings.outOfStorageEnabled === false) {
      throw new QuoteEligibilityError(
        "DIRECTION_DISABLED",
        "Moves departing from a storage branch are not currently available",
        { direction },
      );
    }
    if (direction === "into_storage" && settings.intoStorageEnabled === false) {
      throw new QuoteEligibilityError(
        "DIRECTION_DISABLED",
        "Moves arriving at a storage branch are not currently available",
        { direction },
      );
    }

    const branch = await loadBranch(
      (fromBranchId ?? toBranchId)!,
      executor,
      lockAvailability,
    );
    const canonicalAddress = branch.address!;
    return {
      fromAddress: fromBranchId ? canonicalAddress : fromAddress,
      toAddress: toBranchId ? canonicalAddress : toAddress,
      serviceMode: "branch_connected",
      storageBranchId: branch.id,
      storageMoveType: direction,
      storageBranchBrand: branch.brand,
      storageBranchGooglePlaceId: branch.googlePlaceId,
      storageBranchName: branch.name,
      storageBranchAddress: canonicalAddress,
      storageBranchSnapshot: branchSnapshot(branch),
      eligibilityCheckedAt: new Date(),
      eligibilityVersion: 1,
    };
  } catch (error) {
    if (error instanceof QuoteEligibilityError) throw error;
    console.error("[QuoteEligibility] Availability check failed:", error);
    throw new QuoteEligibilityError(
      "ELIGIBILITY_UNAVAILABLE",
      "Service availability could not be verified. Please try again.",
    );
  }
}

export function assertNoDerivedEligibilityFields(input: object): void {
  const supplied = Array.from(ELIGIBILITY_DERIVED_FIELDS).filter((field) => hasOwn(input, field));
  if (supplied.length > 0) {
    throw new QuoteEligibilityError(
      "INVALID_REQUEST",
      "Service classification and branch details are determined by the server",
      { fields: supplied },
    );
  }
}

export function shouldRecalculateEligibility(input: QuoteEligibilityInput, existing?: Quote): boolean {
  return (
    !existing ||
    hasOwn(input, "fromAddress") ||
    hasOwn(input, "toAddress") ||
    hasOwn(input, "fromBranchId") ||
    hasOwn(input, "toBranchId") ||
    (hasOwn(input, "isPartial") && input.isPartial === false && existing.isPartial !== false)
  );
}