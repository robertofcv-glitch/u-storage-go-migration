import type { UstorageBranch } from "@shared/schema";

export type AvailabilityStatus = "available" | "unavailable" | "rate_limited" | "format_error" | "wrong_branch" | "no_availability";
export type StorageUnitOption = {
  code: string;
  usableSizeM2: number;
  heightM: number | null;
  capacityM3: number | null;
  dimensions: string | null;
  floor: string | null;
  priceMxn: number | null;
  promotion: string | null;
  characteristics: string[];
  branchGooglePlaceId: string;
  checkedAt: string;
  reservationUrl: string;
  recommended: boolean;
  fit: "too_small" | "recommended" | "larger";
};
export type AvailabilityResult = {
  status: AvailabilityStatus;
  branchId: string;
  branchGooglePlaceId: string;
  checkedAt: string;
  options: StorageUnitOption[];
  retryable: boolean;
};
export type ReservationHandoffResult =
  | { ok: true; option: StorageUnitOption; reservationUrl: string }
  | { ok: false; status: AvailabilityStatus };

type RawUnit = Record<string, unknown>;
export type AvailabilityFetcher = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_MS = 60_000;
const PUBLIC_AVAILABILITY_URL = "https://u-storage.com.mx/mejor";
const cache = new Map<string, { at: number; value: AvailabilityResult }>();

const text = (value: unknown, max = 240): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const number = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function sanitizeUnitSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const allowed = ["code", "usableSizeM2", "heightM", "capacityM3", "dimensions", "floor", "priceMxn", "promotion", "characteristics", "branchGooglePlaceId", "checkedAt", "fit"];
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    const item = source[key];
    if (Array.isArray(item)) output[key] = item.filter(v => typeof v === "string").map(v => v.slice(0, 120)).slice(0, 8);
    else if (typeof item === "string") output[key] = item.slice(0, 240);
    else if (typeof item === "number" && Number.isFinite(item)) output[key] = item;
  }
  const reservationUrl = text(source.reservationUrl, 500);
  if (reservationUrl) {
    try {
      const parsed = new URL(reservationUrl);
      const code = text(source.code, 100);
      if (
        parsed.protocol === "https:" &&
        /^(www\.)?u-storage\.com\.mx$/i.test(parsed.hostname) &&
        code &&
        parsed.searchParams.get("code") === code
      ) {
        parsed.search = "";
        parsed.hash = "";
        parsed.searchParams.set("code", code);
        output.reservationUrl = parsed.toString();
      }
    } catch {
      // Ignore malformed or non-official handoff URLs.
    }
  }
  return Object.keys(output).length ? output : null;
}

function stripMarkup(value: unknown): string[] {
  const source = text(value, 2000);
  if (!source) return [];
  return source
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<hr\s*\/?>/gi, "|")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split("|")
    .map(part => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** Normalize only the small public unit contract we need; never retain upstream payloads. */
export function normalizeAvailabilityPayload(payload: unknown, branch: UstorageBranch, now = new Date()): StorageUnitOption[] | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const publicBranch = root.suc && typeof root.suc === "object" ? root.suc as RawUnit : null;
  const publicUnit = root.info && typeof root.info === "object" ? root.info as RawUnit : null;
  const publicBranchId = publicBranch ? text(publicBranch.id, 100) : null;
  const publicBranchMatches = !!publicBranch && !!branch.externalId && publicBranchId === branch.externalId;
  const rows = Array.isArray(root.units)
    ? root.units
    : Array.isArray(root.options)
      ? root.options
      : Array.isArray(payload)
        ? payload
        : publicBranch && publicUnit
          ? [{
              code: publicUnit.id_bodega ?? root.bode,
              branchGooglePlaceId: publicBranchMatches ? branch.googlePlaceId : publicBranch.placeid,
              branchExternalId: publicBranchId,
              usableSizeM2: publicUnit.me,
              heightM: publicUnit.heig,
              capacityM3: publicUnit.vol,
              dimensions: publicUnit.meddes,
              floor: publicUnit.ubc ?? publicUnit.ubica,
              priceMxn: publicUnit.preciointernet,
              promotion: publicUnit.promomas,
              characteristics: stripMarkup(publicUnit.filtro),
            }]
          : null;
  if (!rows) return null;
  const seen = new Set<string>();
  const result: StorageUnitOption[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const unit = row as RawUnit;
    const code = text(unit.code ?? unit.unitCode ?? unit.id, 100);
    const branchId = text(unit.branchGooglePlaceId ?? unit.googlePlaceId ?? unit.branchId, 160);
    const branchExternalId = text(unit.branchExternalId ?? unit.externalId, 100);
    const size = number(unit.usableSizeM2 ?? unit.sizeM2 ?? unit.areaM2);
    const belongsToBranch = branchId === branch.googlePlaceId
      || (!!branch.externalId && branchExternalId === branch.externalId);
    if (!code || !size || !branch.googlePlaceId || !belongsToBranch || seen.has(code)) continue;
    seen.add(code);
    const dimensions = text(unit.dimensions ?? unit.dimension);
    const heightM = number(unit.heightM ?? unit.height);
    const reportedCapacity = number(unit.capacityM3 ?? unit.volumeM3 ?? unit.volume);
    const capacityM3 = reportedCapacity ?? (heightM ? size * heightM : null);
    const floor = text(unit.floor);
    const priceMxn = number(unit.priceMxn ?? unit.price ?? unit.monthlyPrice);
    const promotion = text(unit.promotion ?? unit.promo);
    const characteristics = Array.isArray(unit.characteristics)
      ? unit.characteristics.filter((v): v is string => typeof v === "string").map(v => v.slice(0, 120)).slice(0, 8)
      : [];
    result.push({
      code, usableSizeM2: size, heightM, capacityM3, dimensions, floor, priceMxn, promotion, characteristics,
      branchGooglePlaceId: branch.googlePlaceId, checkedAt: now.toISOString(),
      reservationUrl: buildReservationUrl(branch, code), recommended: false, fit: "larger",
    });
  }
  return result;
}

export function buildReservationUrl(branch: Pick<UstorageBranch, "url" | "googlePlaceId">, code: string): string {
  const raw = branch.url;
  if (!raw || !branch.googlePlaceId || !/^(https:\/\/)(www\.)?u-storage\.com\.mx\//i.test(raw)) return "";
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    url.searchParams.set("code", code);
    return url.toString();
  } catch { return ""; }
}

function capacityRanges(volumeM3?: number): Array<[number, number]> {
  const target = Number.isFinite(volumeM3) && (volumeM3 || 0) > 0 ? volumeM3! : 12;
  const points = [0, target * 0.35, target * 0.6, target * 0.85, target, target * 1.25, target * 1.75, target * 2.5];
  return points.slice(0, -1).map((start, index) => [
    Math.max(0, Math.floor(start)),
    Math.min(200, Math.max(1, Math.ceil(points[index + 1]))),
  ]);
}

export function createUStorageAvailabilityAdapter(options: {
  endpoint?: string;
  fetcher?: AvailabilityFetcher;
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => Date;
} = {}) {
  const endpoint = options.endpoint || process.env.U_STORAGE_AVAILABILITY_URL || PUBLIC_AVAILABILITY_URL;
  const fetcher = options.fetcher || ((url, init) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheMs = options.cacheMs ?? DEFAULT_CACHE_MS;
  return {
    async getAvailability(branch: UstorageBranch, volumeM3?: number): Promise<AvailabilityResult> {
      const checkedAt = (options.now || (() => new Date()))().toISOString();
      const key = `${branch.id}:${volumeM3 || 0}`;
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < cacheMs) return cached.value;
      const unavailable = (status: AvailabilityStatus, retryable: boolean): AvailabilityResult => ({
        status, branchId: branch.id, branchGooglePlaceId: branch.googlePlaceId || "", checkedAt, options: [], retryable,
      });
      if (!endpoint || !branch.googlePlaceId) return unavailable("unavailable", true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const targetVolume = Number.isFinite(volumeM3) && (volumeM3 || 0) > 0 ? volumeM3! : 0;
        const isPublicEndpoint = endpoint === PUBLIC_AVAILABILITY_URL;
        const volumeRanges = isPublicEndpoint
          ? capacityRanges(volumeM3)
          : [[0, 200]];
        const requests = volumeRanges.map(async ([minVolume, maxVolume]) => {
          const url = new URL(endpoint);
          url.searchParams.set("lat", branch.lat || "");
          url.searchParams.set("lng", branch.lng || "");
          url.searchParams.set("branch", branch.googlePlaceId);
          // The temporary public endpoint expects a comma-separated volume range.
          // Keep this translation isolated here because its contract is undocumented.
          url.searchParams.set("tama", `${minVolume},${maxVolume}`);
          const response = await fetcher(url.toString(), {
            headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; UStorageGo/1.0)" },
            signal: controller.signal,
          });
          return {
            status: response.status,
            ok: response.ok,
            payload: response.ok ? await response.json().catch(() => null) : null,
          };
        });
        const settled = await Promise.allSettled(requests);
        const responses = settled
          .filter((result): result is PromiseFulfilledResult<Awaited<(typeof requests)[number]>> => result.status === "fulfilled")
          .map(result => result.value);
        if (!responses.length) return unavailable("unavailable", true);
        if (responses.some(response => response.status === 429)) return unavailable("rate_limited", true);
        if (responses.every(response => !response.ok)) {
          return unavailable("unavailable", responses.some(response => response.status >= 500));
        }
        const payloads = responses.filter(response => response.ok).map(response => response.payload);
        const normalizedGroups = payloads.map(payload => normalizeAvailabilityPayload(payload, branch, options.now ? options.now() : new Date()));
        if (normalizedGroups.some(group => group === null)) return unavailable("format_error", true);
        const normalized = normalizedGroups.flatMap(group => group || []);
        const rawBranchIds = payloads.flatMap(payload => {
          if (!payload || typeof payload !== "object") return [];
          const root = payload as Record<string, unknown>;
          if (root.suc && typeof root.suc === "object") {
            const sourceBranch = root.suc as RawUnit;
            return [
              text(sourceBranch.placeid, 160),
              text(sourceBranch.id, 100),
            ].filter((id): id is string => !!id);
          }
          const rawRows = root.units ?? root.options ?? payload;
          return Array.isArray(rawRows)
            ? rawRows.map(row => row && typeof row === "object" ? text((row as RawUnit).branchGooglePlaceId ?? (row as RawUnit).googlePlaceId ?? (row as RawUnit).branchId, 160) : null).filter((id): id is string => !!id)
            : [];
        });
        if (rawBranchIds.length > 0 && rawBranchIds.every(id => id !== branch.googlePlaceId && id !== branch.externalId)) {
          return unavailable("wrong_branch", false);
        }
        const unique = new Map(normalized.map(option => [option.code, option]));
        const optionsForBand = Array.from(unique.values()).sort((a, b) =>
          (a.capacityM3 ?? a.usableSizeM2 * 2.4) - (b.capacityM3 ?? b.usableSizeM2 * 2.4));
        if (optionsForBand.length && targetVolume > 0) {
          for (const option of optionsForBand) {
            const capacity = option.capacityM3 ?? option.usableSizeM2 * 2.4;
            option.fit = capacity < targetVolume ? "too_small" : "larger";
          }
          const fitting = optionsForBand.find(option =>
            (option.capacityM3 ?? option.usableSizeM2 * 2.4) >= targetVolume);
          if (fitting) {
            fitting.recommended = true;
            fitting.fit = "recommended";
          }
        }
        const fitRank: Record<StorageAvailabilityOption["fit"], number> = {
          recommended: 0,
          larger: 1,
          too_small: 2,
        };
        optionsForBand.sort((a, b) => {
          const rankDifference = fitRank[a.fit] - fitRank[b.fit];
          if (rankDifference !== 0) return rankDifference;
          const aCapacity = a.capacityM3 ?? a.usableSizeM2 * 2.4;
          const bCapacity = b.capacityM3 ?? b.usableSizeM2 * 2.4;
          return a.fit === "too_small" ? bCapacity - aCapacity : aCapacity - bCapacity;
        });
        const value = { status: optionsForBand.length ? "available" : "no_availability", branchId: branch.id, branchGooglePlaceId: branch.googlePlaceId, checkedAt, options: optionsForBand.slice(0, 8), retryable: false } satisfies AvailabilityResult;
        cache.set(key, { at: Date.now(), value });
        return value;
      } catch (error) {
        return unavailable(error instanceof Error && error.name === "AbortError" ? "unavailable" : "unavailable", true);
      } finally { clearTimeout(timer); }
    },
  };
}

export function clearUStorageAvailabilityCache() { cache.clear(); }

export async function validateReservationHandoff(params: {
  branch: UstorageBranch;
  code: string;
  volumeM3?: number;
  adapter?: ReturnType<typeof createUStorageAvailabilityAdapter>;
}): Promise<ReservationHandoffResult> {
  const adapter = params.adapter || createUStorageAvailabilityAdapter({ cacheMs: 0 });
  const availability = await adapter.getAvailability(params.branch, params.volumeM3);
  const option = availability.options.find(candidate => candidate.code === params.code);
  if (!option) return { ok: false, status: availability.status === "available" ? "no_availability" : availability.status };
  const reservationUrl = buildReservationUrl(params.branch, option.code);
  return reservationUrl
    ? { ok: true, option, reservationUrl }
    : { ok: false, status: "unavailable" };
}

/** Lightweight operator health check; callers can schedule this separately
 * from quote traffic without making its result customer-visible. */
export async function checkUStorageAvailabilitySource(branch: UstorageBranch): Promise<{
  healthy: boolean;
  status: AvailabilityStatus;
  checkedAt: string;
}> {
  const result = await createUStorageAvailabilityAdapter({ cacheMs: 0 }).getAvailability(branch);
  return { healthy: result.status === "available" || result.status === "no_availability", status: result.status, checkedAt: result.checkedAt };
}