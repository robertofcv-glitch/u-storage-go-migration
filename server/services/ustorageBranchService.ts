/**
 * U-Storage Branch Service
 *
 * - Scrapes the public branch list (name, region, coordinates, page URL, "from" price)
 *   from https://u-storage.com.mx/sucursales and upserts it into ustorage_branches.
 * - Matches quote origin/destination addresses to the nearest active branch
 *   (geocoding via Google, haversine distance, configurable radius) to classify
 *   a move as "into storage" / "out of storage".
 * - Suggests a storage size tier from the move's estimated inventory volume.
 */

import { storage } from "../storage";
import {
  suggestStorageTier,
  ustorageBranches,
  type UstorageBranch,
  type UstorageSettings,
  type InsertUstorageBranch,
} from "@shared/schema";
import { db } from "../db";
import { asc, eq, or, sql } from "drizzle-orm";
import {
  loadOfficialBranchCatalog,
  OFFICIAL_BRANCH_CATALOG_VERSION,
} from "../data/officialBranchCatalog";
import { QuoteEligibilityError } from "./quoteEligibilityService";

const SUCURSALES_URL = "https://u-storage.com.mx/sucursales";

// ============================================================
// Scraper
// ============================================================

export interface ScrapedBranch extends InsertUstorageBranch {}

/** Parse the sucursales page markup into branch records. Exported for reuse/testing. */
export function parseSucursalesHtml(html: string): ScrapedBranch[] {
  // Coordinates: the page's initMap() JS computes distance per branch using
  // "new google.maps.LatLng(lat,lng); ... $('.dis_<id>')" pairs.
  const coordRx = /LatLng\(([-0-9.]+)\s*,\s*([-0-9.]+)\);[\s\S]{0,400}?\.dis_(\d+)/g;
  const coords: Record<string, { lat: number; lng: number }> = {};
  let m: RegExpExecArray | null;
  while ((m = coordRx.exec(html))) {
    if (!coords[m[3]]) coords[m[3]] = { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }

  const branches: ScrapedBranch[] = [];
  const seen = new Set<string>();
  const sections = html.split(/id='seccion_/).slice(1);
  for (const sec of sections) {
    const region = (sec.match(/height='50'>\s*([^<]+)<\/h5>/) || [])[1]?.trim() || null;
    const cardRx = /card-gris-lista-reser([\s\S]*?)dis_(\d+)/g;
    let c: RegExpExecArray | null;
    while ((c = cardRx.exec(sec))) {
      const body = c[1];
      const externalId = c[2];
      const name = (body.match(/class='atot'><a[^>]*>([^<]+)</) || [])[1]?.trim();
      const url = (body.match(/<a href='([^']+)'/) || [])[1] || null;
      const price = (body.match(/DESDE: \$([\d,.]+)/) || [])[1];
      const coord = coords[externalId];
      if (!name || !coord || seen.has(externalId)) continue;
      seen.add(externalId);
      branches.push({
        externalId,
        name,
        region,
        url,
        lat: String(coord.lat),
        lng: String(coord.lng),
        priceFromMxn: price ? price.replace(/,/g, "") : null,
      });
    }
  }
  return branches;
}

/** Extract the street address from a branch page (JSON-LD / og:description markup). */
export function parseBranchAddress(html: string): string | null {
  const jsonLd = html.match(/"streetAddress"\s*:\s*"([^"]+)"/) || html.match(/"[aA]ddress"\s*:\s*"([^"]+)"/);
  if (jsonLd?.[1]) return jsonLd[1].trim();
  return null;
}

/** Fetch a branch page and extract its address. Returns null on any failure. */
export async function fetchBranchAddress(url: string): Promise<string | null> {
  try {
    // Only fetch pages on the official U-Storage domain (URLs come from scraped HTML).
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^(www\.)?u-storage\.com\.mx$/.test(parsed.hostname)) {
      return null;
    }
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UStorageGoBot/1.0)" },
    });
    if (!res.ok) return null;
    return parseBranchAddress(await res.text());
  } catch {
    return null;
  }
}

export async function scrapeBranches(): Promise<ScrapedBranch[]> {
  const res = await fetch(SUCURSALES_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UStorageGoBot/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch sucursales page: HTTP ${res.status}`);
  }
  const html = await res.text();
  const branches = parseSucursalesHtml(html);
  if (branches.length === 0) {
    throw new Error("No branches parsed from sucursales page (markup may have changed)");
  }
  return branches;
}

export interface OfficialCatalogSyncResult {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  sourceVersion: string;
}

const OFFICIAL_SOURCE_FIELDS = [
  "externalId",
  "googlePlaceId",
  "brand",
  "name",
  "region",
  "address",
  "url",
  "mapsUrl",
  "lat",
  "lng",
  "verificationNote",
  "sourceVersion",
  "catalogStatus",
] as const;

type CatalogSyncExecutor = {
  getAll(): Promise<UstorageBranch[]>;
  find(googlePlaceId: string, externalId: string): Promise<UstorageBranch | undefined>;
  create(data: InsertUstorageBranch): Promise<UstorageBranch>;
  update(id: string, data: Partial<InsertUstorageBranch>): Promise<UstorageBranch>;
};

export async function reconcileOfficialBranchCatalog(
  official: InsertUstorageBranch[],
  executor: CatalogSyncExecutor,
): Promise<OfficialCatalogSyncResult> {
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const officialPlaceIds = new Set(official.map((branch) => branch.googlePlaceId));
  const importedAt = new Date();

  for (const branch of official) {
    const existing = await executor.find(branch.googlePlaceId!, branch.externalId);
    const officialData = {
      ...branch,
      catalogStatus: "official",
      sourceVersion: OFFICIAL_BRANCH_CATALOG_VERSION,
    };
    if (existing) {
      const changed = OFFICIAL_SOURCE_FIELDS.some((field) => {
        const current = existing[field] == null ? "" : String(existing[field]);
        const incoming = officialData[field] == null ? "" : String(officialData[field]);
        if ((field === "lat" || field === "lng") && current && incoming) {
          return Number(current) !== Number(incoming);
        }
        return current !== incoming;
      });
      if (changed) {
        await executor.update(existing.id, { ...officialData, sourceImportedAt: importedAt });
        updated++;
      }
    } else {
      await executor.create({ ...officialData, sourceImportedAt: importedAt, isActive: false });
      created++;
    }
  }

  for (const branch of await executor.getAll()) {
    if (branch.googlePlaceId && officialPlaceIds.has(branch.googlePlaceId)) continue;
    if (branch.catalogStatus === "missing" && !branch.isActive) continue;
    await executor.update(branch.id, { catalogStatus: "missing", isActive: false });
    deactivated++;
  }

  return {
    total: official.length,
    created,
    updated,
    deactivated,
    sourceVersion: OFFICIAL_BRANCH_CATALOG_VERSION,
  };
}

/** Reconcile atomically and serialize startup/admin imports across app instances. */
export async function syncOfficialBranchCatalog(): Promise<OfficialCatalogSyncResult> {
  const official = await loadOfficialBranchCatalog();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ustorage-official-catalog-sync'))`);
    return reconcileOfficialBranchCatalog(official, {
      getAll: () =>
        tx.select().from(ustorageBranches)
          .orderBy(asc(ustorageBranches.region), asc(ustorageBranches.name)),
      find: async (googlePlaceId, externalId) => {
        const [branch] = await tx.select().from(ustorageBranches)
          .where(or(
            eq(ustorageBranches.googlePlaceId, googlePlaceId),
            eq(ustorageBranches.externalId, externalId),
          ))
          .limit(1);
        return branch;
      },
      create: async (data) => {
        const [branch] = await tx.insert(ustorageBranches).values(data).returning();
        return branch;
      },
      update: async (id, data) => {
        const [branch] = await tx.update(ustorageBranches)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(ustorageBranches.id, id))
          .returning();
        return branch;
      },
    });
  });
}

/** Startup reconciliation is idempotent and runs in development and production. */
export async function seedBranchesIfEmpty(): Promise<void> {
  const result = await syncOfficialBranchCatalog();
  if (result.created || result.updated || result.deactivated) {
    await storage.logActivity({
      actorRole: "system",
      action: "storage_catalog.synced",
      entityType: "storage_catalog",
      details: result,
    });
  }
  console.log(JSON.stringify({
    event: "ustorage.catalog_sync",
    catalogVersion: result.sourceVersion,
    total: result.total,
    created: result.created,
    updated: result.updated,
    deactivated: result.deactivated,
  }));
}

// ============================================================
// Geocoding + matching
// ============================================================

interface GeoPoint {
  lat: number;
  lng: number;
}

const geocodeCache = new Map<string, { point: GeoPoint | null; at: number }>();
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = address.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.at < GEOCODE_CACHE_TTL_MS) return cached.point;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[UStorageBranch] GOOGLE_PLACES_API_KEY not configured, cannot geocode");
    return null;
  }
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({ textQuery: address, regionCode: "MX" }),
    });
    const data = await res.json();
    const loc = data?.places?.[0]?.location;
    const point = loc && typeof loc.latitude === "number" && typeof loc.longitude === "number"
      ? { lat: loc.latitude, lng: loc.longitude }
      : null;
    geocodeCache.set(key, { point, at: Date.now() });
    return point;
  } catch (error) {
    console.error("[UStorageBranch] Geocoding error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function nearestBranch(point: GeoPoint, branches: UstorageBranch[]): { branch: UstorageBranch; distanceKm: number } | null {
  let best: { branch: UstorageBranch; distanceKm: number } | null = null;
  for (const branch of branches) {
    if (!branch.lat || !branch.lng) continue;
    const d = haversineKm(point, { lat: parseFloat(branch.lat), lng: parseFloat(branch.lng) });
    if (!best || d < best.distanceKm) best = { branch, distanceKm: d };
  }
  return best;
}

// ============================================================
// Recommendation
// ============================================================

export interface StorageRecommendation {
  moveType: "into_storage" | "out_of_storage";
  branch: {
    id: string;
    externalId: string;
    brand: string;
    name: string;
    region: string | null;
    address: string;
    googlePlaceId: string;
    lat: string;
    lng: string;
    mapsUrl: string | null;
    url: string | null;
    priceFromMxn: string | null;
  };
  distanceKm: number;
  suggestedTier: {
    key: string;
    labelEs: string;
    labelEn: string;
    m2: number;
    volumeM3: number;
    example: string;
  } | null;
  reservationUrl: string | null;
}

export interface StorageProximityResult {
  valid: boolean;
  fromMatch: { id: string; name: string; distanceKm: number } | null;
  toMatch: { id: string; name: string; distanceKm: number } | null;
  nearest: { name: string; region: string | null; address: string | null; distanceKm: number } | null;
  radiusKm: number;
}

type NearbyBranch = { branch: UstorageBranch; distanceKm: number } | null;

export function buildStorageProximityResult(params: {
  branchMovesEnabled: boolean;
  generalMovesEnabled: boolean;
  intoStorageEnabled: boolean;
  outOfStorageEnabled: boolean;
  fromNear: NearbyBranch;
  toNear: NearbyBranch;
  radiusKm: number;
}): StorageProximityResult {
  const round = (n: number) => Math.round(n * 100) / 100;
  const fromMatch =
    params.branchMovesEnabled &&
    params.outOfStorageEnabled &&
    params.fromNear &&
    params.fromNear.distanceKm <= params.radiusKm
      ? {
          id: params.fromNear.branch.id,
          name: params.fromNear.branch.name,
          distanceKm: round(params.fromNear.distanceKm),
        }
      : null;
  const toMatch =
    params.branchMovesEnabled &&
    params.intoStorageEnabled &&
    params.toNear &&
    params.toNear.distanceKm <= params.radiusKm
      ? {
          id: params.toNear.branch.id,
          name: params.toNear.branch.name,
          distanceKm: round(params.toNear.distanceKm),
        }
      : null;
  const candidates = [params.fromNear, params.toNear].filter(Boolean) as {
    branch: UstorageBranch;
    distanceKm: number;
  }[];
  const overallNearest = candidates.sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;

  return {
    valid: !!(fromMatch || toMatch || params.generalMovesEnabled),
    fromMatch,
    toMatch,
    nearest: overallNearest
      ? {
          name: overallNearest.branch.name,
          region: overallNearest.branch.region,
          address: overallNearest.branch.address,
          distanceKm: round(overallNearest.distanceKm),
        }
      : null,
    radiusKm: params.radiusKm,
  };
}

/**
 * Booking rule: at least ONE of the two addresses (origin or destination)
 * must be within the match radius of an active U-Storage branch.
 * Independent of the into/out-of-storage recommendation toggles.
 */
export async function validateStorageProximity(params: {
  fromAddress: string;
  toAddress: string;
}): Promise<StorageProximityResult> {
  const settings = await storage.getUstorageSettings();
  if (!settings.branchMovesEnabled) {
    return {
      valid: settings.generalMovesEnabled,
      fromMatch: null,
      toMatch: null,
      nearest: null,
      radiusKm: parseFloat(settings.matchRadiusKm?.toString() || "2"),
    };
  }
  const branches = (await storage.getUstorageBranches()).filter(
    (b) => b.isActive && b.catalogStatus === "official" && b.address && b.googlePlaceId && b.lat && b.lng,
  );
  if (branches.length === 0) {
    throw new QuoteEligibilityError(
      "ELIGIBILITY_UNAVAILABLE",
      "Storage location validation is temporarily unavailable. Please try again.",
    );
  }

  const parsedRadius = parseFloat(settings.matchRadiusKm?.toString() || "2");
  const radiusKm = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 2;

  const [fromPoint, toPoint] = await Promise.all([
    geocodeAddress(params.fromAddress),
    geocodeAddress(params.toAddress),
  ]);
  if (!fromPoint && !toPoint) {
    throw new QuoteEligibilityError(
      "ELIGIBILITY_UNAVAILABLE",
      "Address validation is temporarily unavailable. Please try again.",
    );
  }

  const fromNear = fromPoint ? nearestBranch(fromPoint, branches) : null;
  const toNear = toPoint ? nearestBranch(toPoint, branches) : null;

  return buildStorageProximityResult({
    branchMovesEnabled: settings.branchMovesEnabled,
    generalMovesEnabled: settings.generalMovesEnabled,
    intoStorageEnabled: settings.intoStorageEnabled !== false,
    outOfStorageEnabled: settings.outOfStorageEnabled !== false,
    fromNear,
    toNear,
    radiusKm,
  });
}

export async function getStorageSettings(): Promise<UstorageSettings> {
  return storage.getUstorageSettings();
}

/**
 * Classify a move and recommend a branch + size.
 * - Destination near a branch → "into_storage" (user is moving things INTO storage)
 * - Origin near a branch → "out_of_storage"
 * - Destination match takes precedence when both are within radius.
 */
export async function getStorageRecommendation(params: {
  fromAddress: string;
  toAddress: string;
  volumeM3?: number;
}): Promise<StorageRecommendation | null> {
  const settings = await storage.getUstorageSettings();
  if (!settings.branchMovesEnabled || (!settings.intoStorageEnabled && !settings.outOfStorageEnabled)) return null;

  const branches = (await storage.getUstorageBranches()).filter(
    (b) => b.isActive && b.catalogStatus === "official" && b.address && b.googlePlaceId && b.lat && b.lng,
  );
  if (branches.length === 0) return null;

  const radiusKm = parseFloat(settings.matchRadiusKm?.toString() || "2");

  const [fromPoint, toPoint] = await Promise.all([
    settings.outOfStorageEnabled ? geocodeAddress(params.fromAddress) : Promise.resolve(null),
    settings.intoStorageEnabled ? geocodeAddress(params.toAddress) : Promise.resolve(null),
  ]);

  let match: { branch: UstorageBranch; distanceKm: number } | null = null;
  let moveType: "into_storage" | "out_of_storage" | null = null;

  if (toPoint) {
    const near = nearestBranch(toPoint, branches);
    if (near && near.distanceKm <= radiusKm) {
      match = near;
      moveType = "into_storage";
    }
  }
  if (!match && fromPoint) {
    const near = nearestBranch(fromPoint, branches);
    if (near && near.distanceKm <= radiusKm) {
      match = near;
      moveType = "out_of_storage";
    }
  }
  if (!match || !moveType) return null;

  const tier = params.volumeM3 && params.volumeM3 > 0 ? suggestStorageTier(params.volumeM3) : null;
  const { branch, distanceKm } = match;

  return {
    moveType,
    branch: {
      id: branch.id,
      externalId: branch.externalId,
      brand: branch.brand,
      name: branch.name,
      region: branch.region,
      address: branch.address!,
      googlePlaceId: branch.googlePlaceId!,
      lat: branch.lat!,
      lng: branch.lng!,
      mapsUrl: branch.mapsUrl,
      url: branch.url,
      priceFromMxn: branch.priceFromMxn,
    },
    distanceKm: Math.round(distanceKm * 100) / 100,
    suggestedTier: tier,
    reservationUrl: branch.url,
  };
}
