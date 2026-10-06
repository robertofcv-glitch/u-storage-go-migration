import assert from "node:assert/strict";
import test from "node:test";
import { ustorageBranches, ustorageSettings } from "@shared/schema";
import {
  assertNoDerivedEligibilityFields,
  QuoteEligibilityError,
  resolveQuoteEligibility,
} from "./quoteEligibilityService";

const branch = (overrides: Record<string, unknown> = {}) => ({
  id: "branch-1",
  externalId: "official-1",
  brand: "U-Storage",
  name: "U-Storage Centro",
  address: "Canonical branch address",
  googlePlaceId: "place-1",
  mapsUrl: "https://maps.example/branch-1",
  lat: "19.4",
  lng: "-99.1",
  sourceVersion: "catalog-v1",
  catalogStatus: "official",
  isActive: true,
  ...overrides,
});

function executor(options: {
  settings?: Record<string, unknown> | null;
  branches?: Record<string, unknown>[];
  fail?: boolean;
}) {
  const settings = options.settings === null
    ? undefined
    : {
      branchMovesEnabled: true,
      generalMovesEnabled: true,
      intoStorageEnabled: true,
      outOfStorageEnabled: true,
      ...(options.settings ?? {}),
    };
  return {
    select: () => ({
      from: (table: unknown) => {
        const isSettings = table === ustorageSettings;
        const rows = isSettings ? (settings ? [settings] : []) : (options.branches ?? []);
        const query = {
          where: () => query,
          limit: () => query,
          for: () => query,
          then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
        };
        return query;
      },
    }),
  };
}

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof QuoteEligibilityError && error.code === code,
  );
}

const addresses = { fromAddress: "Customer origin", toAddress: "Customer destination" };

test("restricted eligibility derives both storage directions and canonical branch data", async () => {
  const db = executor({ branches: [branch()] });
  const inbound = await resolveQuoteEligibility(
    { ...addresses, toBranchId: "branch-1" },
    undefined,
    db,
  );
  assert.equal(inbound.storageMoveType, "into_storage");
  assert.equal(inbound.toAddress, "Canonical branch address");
  assert.equal(inbound.fromAddress, addresses.fromAddress);

  const outbound = await resolveQuoteEligibility(
    { ...addresses, fromBranchId: "branch-1" },
    undefined,
    db,
  );
  assert.equal(outbound.storageMoveType, "out_of_storage");
  assert.equal(outbound.fromAddress, "Canonical branch address");
  assert.equal(outbound.toAddress, addresses.toAddress);
});

test("inactive, unapproved, missing, and incomplete branches fail closed", async () => {
  for (const candidate of [
    branch({ isActive: false }),
    branch({ catalogStatus: "pending" }),
    branch({ catalogStatus: "missing" }),
    branch({ address: null }),
    branch({ googlePlaceId: null }),
    branch({ lat: null }),
    branch({ lng: null }),
  ]) {
    await rejectsWithCode(
      resolveQuoteEligibility({ ...addresses, toBranchId: "branch-1" }, undefined, executor({ branches: [candidate] })),
      candidate.address === null || candidate.googlePlaceId === null ||
        candidate.lat === null || candidate.lng === null
        ? "BRANCH_DATA_INCOMPLETE"
        : "BRANCH_UNAVAILABLE",
    );
  }
  await rejectsWithCode(
    resolveQuoteEligibility({ ...addresses, toBranchId: "missing" }, undefined, executor({ branches: [] })),
    "BRANCH_NOT_FOUND",
  );
});

test("contradictory endpoints and official-looking free text cannot bypass branch policy", async () => {
  const db = executor({ settings: { generalMovesEnabled: false }, branches: [branch()] });
  await rejectsWithCode(
    resolveQuoteEligibility({ ...addresses, fromBranchId: "branch-1", toBranchId: "branch-1" }, undefined, db),
    "INVALID_ENDPOINT_COMBINATION",
  );
  await rejectsWithCode(
    resolveQuoteEligibility({
      fromAddress: "U-Storage Centro, Canonical branch address",
      toAddress: "Customer destination",
    }, undefined, db),
    "GENERAL_MOVES_DISABLED",
  );
});

test("direction and general availability transitions are enforced server-side", async () => {
  await rejectsWithCode(
    resolveQuoteEligibility(
      { ...addresses, toBranchId: "branch-1" },
      undefined,
      executor({ settings: { intoStorageEnabled: false }, branches: [branch()] }),
    ),
    "DIRECTION_DISABLED",
  );
  await rejectsWithCode(
    resolveQuoteEligibility(
      { ...addresses, fromBranchId: "branch-1" },
      undefined,
      executor({ settings: { outOfStorageEnabled: false }, branches: [branch()] }),
    ),
    "DIRECTION_DISABLED",
  );

  const disabled = executor({ settings: { generalMovesEnabled: false } });
  await rejectsWithCode(resolveQuoteEligibility(addresses, undefined, disabled), "GENERAL_MOVES_DISABLED");
  const enabled = await resolveQuoteEligibility(
    addresses,
    undefined,
    executor({ settings: { generalMovesEnabled: true } }),
  );
  assert.equal(enabled.serviceMode, "general_point_to_point");
});

test("draft branch selection can change, while derived fields remain tamper-proof", async () => {
  const first = branch();
  const second = branch({
    id: "branch-2",
    externalId: "official-2",
    name: "U-Storage Norte",
    address: "Second canonical address",
    googlePlaceId: "place-2",
  });
  const existing = {
    ...addresses,
    storageBranchId: first.id,
    storageMoveType: "into_storage",
    isPartial: true,
  } as any;
  const changed = await resolveQuoteEligibility(
    { toBranchId: second.id },
    existing,
    executor({ branches: [second] }),
  );
  assert.equal(changed.storageBranchId, second.id);
  assert.equal(changed.storageBranchAddress, second.address);

  assert.throws(
    () => assertNoDerivedEligibilityFields({ toBranchId: second.id, storageBranchId: first.id }),
    (error: unknown) => error instanceof QuoteEligibilityError && error.code === "INVALID_REQUEST",
  );
});

test("availability outages fail closed instead of authorizing a move", async () => {
  const unavailableExecutor = {
    select: () => {
      throw new Error("database unavailable");
    },
  };
  await rejectsWithCode(
    resolveQuoteEligibility(addresses, undefined, unavailableExecutor),
    "ELIGIBILITY_UNAVAILABLE",
  );
});