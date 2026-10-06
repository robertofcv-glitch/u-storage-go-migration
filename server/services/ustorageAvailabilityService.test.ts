import test from "node:test";
import assert from "node:assert/strict";
import { buildReservationUrl, clearUStorageAvailabilityCache, createUStorageAvailabilityAdapter, normalizeAvailabilityPayload, validateReservationHandoff } from "./ustorageAvailabilityService";

const branch = {
  id: "branch-a", googlePlaceId: "place-a", isActive: true, catalogStatus: "official",
  externalId: "19", lat: "19.4", lng: "-99.1", url: "https://u-storage.com.mx/sucursal/a",
} as any;

test("normalizes, filters wrong branches, and deduplicates public units", () => {
  const options = normalizeAvailabilityPayload({
    units: [
      { code: "A-1", googlePlaceId: "place-a", sizeM2: "10", price: "$2,500", floor: "PB" },
      { code: "A-1", googlePlaceId: "place-a", sizeM2: "10" },
      { code: "B-1", googlePlaceId: "place-b", sizeM2: "12" },
    ],
  }, branch, new Date("2026-01-01T00:00:00Z"));
  assert.equal(options?.length, 1);
  assert.equal(options?.[0].priceMxn, 2500);
  assert.equal(options?.[0].reservationUrl, "https://u-storage.com.mx/sucursal/a?code=A-1");
});

test("normalizes the current public mejor response without retaining its raw HTML", () => {
  const options = normalizeAvailabilityPayload({
    error: false,
    bode: 20588,
    suc: { id: "19" },
    info: {
      id_bodega: "20588",
      me: 5.04,
      heig: "2.4",
      vol: 12.096,
      meddes: "1.4x3.6",
      ubc: "3ro.",
      preciointernet: "2612.74",
      promomas: "Precio Web: 10% descuento",
      filtro: "<img src='x'><b>Zona de fácil acceso.</b><hr><b>Forma regular.</b>",
    },
  }, branch, new Date("2026-09-19T12:00:00Z"));
  assert.equal(options?.length, 1);
  assert.deepEqual(options?.[0].characteristics, ["Zona de fácil acceso.", "Forma regular."]);
  assert.equal(options?.[0].branchGooglePlaceId, "place-a");
  assert.equal(options?.[0].heightM, 2.4);
  assert.equal(options?.[0].capacityM3, 12.096);
  assert.equal(options?.[0].reservationUrl, "https://u-storage.com.mx/sucursal/a?code=20588");
});

test("returns graceful format, rate-limit, and no-availability statuses", async () => {
  clearUStorageAvailabilityCache();
  const responses = [
    new Response("{bad", { status: 200 }),
    new Response("", { status: 429 }),
    new Response(JSON.stringify({ units: [] }), { status: 200 }),
  ];
  const adapter = createUStorageAvailabilityAdapter({
    endpoint: "https://example.test/availability",
    fetcher: async () => responses.shift()!,
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal((await adapter.getAvailability(branch)).status, "format_error");
  assert.equal((await adapter.getAvailability(branch)).status, "rate_limited");
  assert.equal((await adapter.getAvailability(branch, 1)).status, "no_availability");
});

test("rejects a response containing only units from a different branch", async () => {
  clearUStorageAvailabilityCache();
  const adapter = createUStorageAvailabilityAdapter({
    endpoint: "https://example.test/availability",
    fetcher: async () => new Response(JSON.stringify({
      units: [{ code: "B-1", googlePlaceId: "place-b", sizeM2: 5 }],
    })),
  });
  const result = await adapter.getAvailability(branch, 10);
  assert.equal(result.status, "wrong_branch");
  assert.deepEqual(result.options, []);
});

test("keeps undersized options visible without recommending one that cannot fit", async () => {
  clearUStorageAvailabilityCache();
  const adapter = createUStorageAvailabilityAdapter({
    endpoint: "https://example.test/availability",
    fetcher: async () => new Response(JSON.stringify({
      units: [
        { code: "small-1", googlePlaceId: "place-a", sizeM2: 3, heightM: 2.4, capacityM3: 7.2 },
        { code: "small-2", googlePlaceId: "place-a", sizeM2: 6, heightM: 2.4, capacityM3: 14.4 },
      ],
    })),
  });
  const result = await adapter.getAvailability(branch, 30);
  assert.equal(result.status, "available");
  assert.equal(result.options.length, 2);
  assert.equal(result.options.every(option => option.fit === "too_small"), true);
  assert.equal(result.options.some(option => option.recommended), false);
});

test("orders units from best fit to extra room to too small", async () => {
  clearUStorageAvailabilityCache();
  const adapter = createUStorageAvailabilityAdapter({
    endpoint: "https://example.test/availability",
    fetcher: async () => new Response(JSON.stringify({
      units: [
        { code: "too-small", googlePlaceId: "place-a", sizeM2: 3, capacityM3: 8 },
        { code: "extra-large", googlePlaceId: "place-a", sizeM2: 10, capacityM3: 28 },
        { code: "perfect", googlePlaceId: "place-a", sizeM2: 6, capacityM3: 16 },
        { code: "extra-small", googlePlaceId: "place-a", sizeM2: 8, capacityM3: 20 },
      ],
    })),
  });
  const result = await adapter.getAvailability(branch, 15);
  assert.deepEqual(result.options.map(option => option.code), [
    "perfect",
    "extra-small",
    "extra-large",
    "too-small",
  ]);
  assert.deepEqual(result.options.map(option => option.fit), [
    "recommended",
    "larger",
    "larger",
    "too_small",
  ]);
});

test("reservation URLs are official and contain only the unit code", () => {
  assert.equal(buildReservationUrl(branch, "u-42"), "https://u-storage.com.mx/sucursal/a?code=u-42");
  assert.equal(buildReservationUrl({ ...branch, url: "https://evil.test/a" }, "u-42"), "");
});

test("reservation handoff revalidates the selected unit with its recommendation volume", async () => {
  let receivedVolume: number | undefined;
  const adapter = {
    async getAvailability(_branch: any, volumeM3?: number) {
      receivedVolume = volumeM3;
      return {
        status: "available" as const,
        branchId: "branch-a",
        branchGooglePlaceId: "place-a",
        checkedAt: "2026-09-19T12:00:00Z",
        retryable: false,
        options: [{
          code: "20588", usableSizeM2: 5.04, dimensions: "1.4x3.6", floor: "3ro.",
          priceMxn: 2612.74, promotion: null, characteristics: [], branchGooglePlaceId: "place-a",
          checkedAt: "2026-09-19T12:00:00Z", reservationUrl: "https://u-storage.com.mx/sucursal/a?code=20588",
          recommended: true,
        }],
      };
    },
  };
  const result = await validateReservationHandoff({ branch, code: "20588", volumeM3: 12, adapter });
  assert.equal(receivedVolume, 12);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.reservationUrl, "https://u-storage.com.mx/sucursal/a?code=20588");
});

test("reservation handoff refuses a unit withdrawn after selection", async () => {
  const adapter = {
    async getAvailability() {
      return {
        status: "available" as const,
        branchId: "branch-a",
        branchGooglePlaceId: "place-a",
        checkedAt: "2026-09-19T12:00:00Z",
        retryable: false,
        options: [],
      };
    },
  };
  const result = await validateReservationHandoff({ branch, code: "withdrawn", volumeM3: 12, adapter });
  assert.deepEqual(result, { ok: false, status: "no_availability" });
});

test("reservation handoff with zero cache bypasses a just-primed recommendation", async () => {
  clearUStorageAvailabilityCache();
  const endpoint = "https://example.test/live-availability";
  const availablePayload = {
    units: [{ code: "fresh-1", googlePlaceId: "place-a", sizeM2: 5 }],
  };
  const recommendationAdapter = createUStorageAvailabilityAdapter({
    endpoint,
    fetcher: async () => new Response(JSON.stringify(availablePayload)),
  });
  assert.equal((await recommendationAdapter.getAvailability(branch, 10)).status, "available");

  let upstreamChecks = 0;
  const handoffAdapter = createUStorageAvailabilityAdapter({
    endpoint,
    cacheMs: 0,
    fetcher: async () => {
      upstreamChecks++;
      return new Response(JSON.stringify({ units: [] }));
    },
  });
  const result = await validateReservationHandoff({
    branch,
    code: "fresh-1",
    volumeM3: 10,
    adapter: handoffAdapter,
  });
  assert.equal(upstreamChecks, 1);
  assert.deepEqual(result, { ok: false, status: "no_availability" });
});