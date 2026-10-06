import test from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, wallClockToUTC } from "./timezone";

test("wall-clock values are converted using the supplied IANA zone", () => {
  const utc = wallClockToUTC("2025-01-15T08:00", "America/Mexico_City");
  assert.equal(utc.toISOString(), "2025-01-15T14:00:00.000Z");
});

test("UTC instants render in the supplied company zone", () => {
  assert.match(
    formatDateTime("2025-01-15T14:00:00.000Z", { timezone: "America/Mexico_City" }),
    /Jan 15, 2025.*08:00|15 (?:de enero de|ene) 2025.*08:00/,
  );
});