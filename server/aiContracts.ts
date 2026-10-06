type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optional(value: unknown, predicate: (candidate: unknown) => boolean): boolean {
  return value === undefined || predicate(value);
}

export function isInventoryParserItem(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.name)) return false;
  return optional(value.quantity, isFiniteNumber)
    && optional(value.room, isNonEmptyString)
    && optional(value.category, isNonEmptyString)
    && optional(value.estimatedWeightKg, isFiniteNumber)
    && optional(value.estimatedVolumeM3, isFiniteNumber);
}

export function isInventoryParserResponse(value: unknown): boolean {
  return Array.isArray(value) && value.every(isInventoryParserItem);
}

function isRemoval(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.name);
}

function isTruckRecommendation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.totalWeightKg)
    && optional(value.totalVolumeM3, isFiniteNumber)
    && isNonEmptyString(value.recommendedTruck)
    && isFiniteNumber(value.truckCount)
    && isFiniteNumber(value.includedMovers)
    && isFiniteNumber(value.estimatedHours)
    && optional(value.constrainingFactor, isNonEmptyString)
    && optional(value.weightBasedTruckCount, isFiniteNumber)
    && optional(value.volumeBasedTruckCount, isFiniteNumber);
}

function isEstimatedCost(value: unknown): boolean {
  return isRecord(value)
    && isFiniteNumber(value.low)
    && isFiniteNumber(value.high)
    && isNonEmptyString(value.currency);
}

export function isClaraResponse(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.message)) return false;
  if (!optional(value.newItems, (candidate) =>
    Array.isArray(candidate) && candidate.every(isInventoryParserItem))) return false;
  if (!optional(value.removeItems, (candidate) =>
    candidate === "all" || (Array.isArray(candidate) && candidate.every(isRemoval)))) return false;
  if (!optional(value.truckRecommendation, (candidate) =>
    candidate === null || isTruckRecommendation(candidate))) return false;
  if (!optional(value.estimatedCost, (candidate) =>
    candidate === null || isEstimatedCost(candidate))) return false;
  return optional(value.isComplete, (candidate) => typeof candidate === "boolean");
}

const PRESET_HOME_SIZES = ["studio", "1br", "2br", "3br", "4br"] as const;

function isPresetItem(value: unknown): boolean {
  return isRecord(value)
    && isNonEmptyString(value.itemName)
    && isNonEmptyString(value.itemNameEs)
    && isNonEmptyString(value.roomKey)
    && isNonEmptyString(value.categoryKey)
    && isFiniteNumber(value.defaultQuantity);
}

export function isPresetInventoryResponse(value: unknown): boolean {
  return isRecord(value) && PRESET_HOME_SIZES.every((homeSize) =>
    Array.isArray(value[homeSize]) && value[homeSize].every(isPresetItem));
}