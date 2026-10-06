import assert from "node:assert/strict";
import test from "node:test";
import {
  firstNonBlockedAvailableDate,
  legacyMoveDateForPreferences,
  moveDatePreferencesSchema,
} from "./moveDatePreferences";

test("accepts every day in a 14-day inclusive range", () => {
  const preferredDates = Array.from({ length: 14 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `2030-06-${day}`;
  });
  const result = moveDatePreferencesSchema.safeParse({
    availabilityStart: "2030-06-01",
    availabilityEnd: "2030-06-14",
    preferredDates,
    blockedDates: [],
  });
  assert.equal(result.success, true);
});

test("rejects a range longer than 14 calendar days", () => {
  const result = moveDatePreferencesSchema.safeParse({
    availabilityStart: "2030-06-01",
    availabilityEnd: "2030-06-15",
    preferredDates: ["2030-06-01"],
    blockedDates: [],
  });
  assert.equal(result.success, false);
});

test("rejects duplicate, out-of-range, and impossible dates", () => {
  for (const preferredDates of [
    ["2030-06-02", "2030-06-02"],
    ["2030-06-20"],
    ["2030-02-31"],
  ]) {
    const result = moveDatePreferencesSchema.safeParse({
      availabilityStart: "2030-06-01",
      availabilityEnd: "2030-06-14",
      preferredDates,
      blockedDates: [],
    });
    assert.equal(result.success, false);
  }
});

test("accepts blocked dates inside the range", () => {
  const result = moveDatePreferencesSchema.safeParse({
    availabilityStart: "2030-06-01",
    availabilityEnd: "2030-06-05",
    preferredDates: ["2030-06-01", "2030-06-03"],
    blockedDates: ["2030-06-02", "2030-06-04"],
  });
  assert.equal(result.success, true);
});

test("accepts a multi-day range with no preferred dates", () => {
  const result = moveDatePreferencesSchema.safeParse({
    availabilityStart: "2030-06-01",
    availabilityEnd: "2030-06-05",
    preferredDates: [],
    blockedDates: ["2030-06-02"],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.preferredDates, []);
    assert.equal(legacyMoveDateForPreferences(result.data), "2030-06-01");
  }
});

test("a single available day is automatically preferred", () => {
  const result = moveDatePreferencesSchema.safeParse({
    availabilityStart: "2030-06-03",
    availabilityEnd: "2030-06-03",
    preferredDates: [],
    blockedDates: [],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.preferredDates, ["2030-06-03"]);
  }
});

test("legacy fallback skips blocked days without creating a preference", () => {
  assert.equal(
    firstNonBlockedAvailableDate("2030-06-01", "2030-06-05", ["2030-06-01", "2030-06-02"]),
    "2030-06-03",
  );
  const result = moveDatePreferencesSchema.parse({
    availabilityStart: "2030-06-01",
    availabilityEnd: "2030-06-05",
    preferredDates: [],
    blockedDates: ["2030-06-01", "2030-06-02"],
  });
  assert.deepEqual(result.preferredDates, []);
  assert.equal(legacyMoveDateForPreferences(result), "2030-06-03");
});

test("rejects blocked preferred dates, out-of-range blocks, and blocking the full range", () => {
  for (const blockedDates of [
    ["2030-06-01"],
    ["2030-06-06"],
    ["2030-06-01", "2030-06-02", "2030-06-03", "2030-06-04", "2030-06-05"],
  ]) {
    const result = moveDatePreferencesSchema.safeParse({
      availabilityStart: "2030-06-01",
      availabilityEnd: "2030-06-05",
      preferredDates: ["2030-06-01"],
      blockedDates,
    });
    assert.equal(result.success, false);
  }
});