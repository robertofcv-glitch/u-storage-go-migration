export type StorageServiceMode = "branch_connected" | "general_point_to_point";
export type StorageMoveDirection = "into_storage" | "out_of_storage";

export interface StorageBranchSnapshot {
  id: string;
  externalId?: string | null;
  brand: string;
  name: string;
  region?: string | null;
  address: string;
  googlePlaceId: string;
  mapsUrl?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  sourceVersion?: string | null;
}

export interface StorageMoveQuoteLike {
  moveContext?: StorageMoveContext | null;
  serviceMode?: string | null;
  storageMoveType?: string | null;
  storageBranchId?: string | null;
  storageBranchBrand?: string | null;
  storageBranchGooglePlaceId?: string | null;
  storageBranchName?: string | null;
  storageBranchAddress?: string | null;
  storageBranchSnapshot?: unknown;
  eligibilityCheckedAt?: Date | string | null;
  eligibilityVersion?: number | null;
}

export interface StorageMoveContext {
  serviceMode: StorageServiceMode;
  isBranchConnected: boolean;
  direction: StorageMoveDirection | null;
  branch: StorageBranchSnapshot | null;
  labels: {
    serviceEs: string;
    serviceEn: string;
    directionEs: string | null;
    directionEn: string | null;
  };
  eligibilityCheckedAt: Date | string | null;
  eligibilityVersion: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getStorageMoveContext(quote: StorageMoveQuoteLike): StorageMoveContext {
  if (
    quote.moveContext &&
    (quote.moveContext.serviceMode === "branch_connected" ||
      quote.moveContext.serviceMode === "general_point_to_point")
  ) {
    return quote.moveContext;
  }
  const snapshot = asRecord(quote.storageBranchSnapshot);
  const serviceMode: StorageServiceMode =
    quote.serviceMode === "branch_connected" ? "branch_connected" : "general_point_to_point";
  const direction: StorageMoveDirection | null =
    quote.storageMoveType === "into_storage" || quote.storageMoveType === "out_of_storage"
      ? quote.storageMoveType
      : null;

  const branchId = text(snapshot.id) || text(quote.storageBranchId);
  const branchName = text(snapshot.name) || text(quote.storageBranchName);
  const branchBrand = text(snapshot.brand) || text(quote.storageBranchBrand);
  const branchAddress = text(snapshot.address) || text(quote.storageBranchAddress);
  const googlePlaceId = text(snapshot.googlePlaceId) || text(quote.storageBranchGooglePlaceId);
  const hasCanonicalBranch =
    serviceMode === "branch_connected" &&
    Boolean(branchId && branchName && branchBrand && branchAddress && googlePlaceId);

  const branch: StorageBranchSnapshot | null = hasCanonicalBranch
    ? {
        id: branchId!,
        externalId: text(snapshot.externalId),
        brand: branchBrand!,
        name: branchName!,
        region: text(snapshot.region),
        address: branchAddress!,
        googlePlaceId: googlePlaceId!,
        mapsUrl: text(snapshot.mapsUrl),
        lat: typeof snapshot.lat === "string" || typeof snapshot.lat === "number" ? snapshot.lat : null,
        lng: typeof snapshot.lng === "string" || typeof snapshot.lng === "number" ? snapshot.lng : null,
        sourceVersion: text(snapshot.sourceVersion),
      }
    : null;

  const directionEs =
    direction === "into_storage" ? "Hacia bodega" :
    direction === "out_of_storage" ? "Desde bodega" :
    null;
  const directionEn =
    direction === "into_storage" ? "Into storage" :
    direction === "out_of_storage" ? "Out of storage" :
    null;

  return {
    serviceMode,
    isBranchConnected: serviceMode === "branch_connected",
    direction,
    branch,
    labels: {
      serviceEs: serviceMode === "branch_connected" ? "Traslado con bodega" : "Traslado general",
      serviceEn: serviceMode === "branch_connected" ? "Storage-connected move" : "General move",
      directionEs,
      directionEn,
    },
    eligibilityCheckedAt: quote.eligibilityCheckedAt ?? null,
    eligibilityVersion: quote.eligibilityVersion ?? null,
  };
}