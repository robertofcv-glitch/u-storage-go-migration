const BRANCH_BROWSE_LABELS = new Set([
  "sucursal",
  "sucursales",
  "sucursal oficial",
  "sucursales oficiales",
  "branch",
  "branches",
  "official branch",
  "official branches",
]);

export interface AddressLocation {
  lat: number;
  lng: number;
}

export interface LocatableBranch {
  lat: number | string;
  lng: number | string;
  distanceKm?: number;
}

export function isBranchBrowseQuery(input: string): boolean {
  return BRANCH_BROWSE_LABELS.has(input.trim().toLocaleLowerCase());
}

export function parsePlaceLocation(details: unknown): AddressLocation | null {
  if (!details || typeof details !== "object") return null;
  const location = (details as { location?: { latitude?: unknown; longitude?: unknown } }).location;
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function sortByDistance<T extends LocatableBranch>(
  items: T[],
  nearbyLocation: AddressLocation | null | undefined,
): T[] {
  if (!nearbyLocation) return items;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  return items
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ...item, distanceKm: undefined };
      }
      const dLat = toRadians(lat - nearbyLocation.lat);
      const dLng = toRadians(lng - nearbyLocation.lng);
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(nearbyLocation.lat))
        * Math.cos(toRadians(lat))
        * Math.sin(dLng / 2) ** 2;
      return {
        ...item,
        distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
      };
    })
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}