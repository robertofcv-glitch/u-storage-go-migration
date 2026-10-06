import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { ustorageBranches } from "@shared/schema";
import { QuoteEligibilityError } from "./quoteEligibilityService";
import { buildStorageProximityResult } from "./ustorageBranchService";

test("quote writes enforce policy, derive direction, canonicalize, and support safe branch changes", async () => {
  const originalSettings = await storage.getUstorageSettings();
  const [branch] = await db
    .select()
    .from(ustorageBranches)
    .where(and(
      eq(ustorageBranches.catalogStatus, "official"),
      eq(ustorageBranches.isActive, true),
    ))
    .limit(1);
  assert(branch?.address && branch.googlePlaceId, "an active official branch is required");

  const quoteIds: string[] = [];
  try {
    await storage.updateUstorageSettings({
      branchMovesEnabled: true,
      generalMovesEnabled: false,
      intoStorageEnabled: true,
      outOfStorageEnabled: true,
    });

    await assert.rejects(
      storage.createQuote({
        fromAddress: "General origin",
        toAddress: "General destination",
        homeSize: "medium",
      }),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "GENERAL_MOVES_DISABLED",
    );

    const deferredAssistedDraft = await storage.createQuote({
      fromAddress: "Pending",
      toAddress: "Pending",
      homeSize: "Pending",
      quoteOrigin: "assisted",
      isPartial: true,
    }, { deferEligibility: true });
    quoteIds.push(deferredAssistedDraft.id);
    assert.equal(deferredAssistedDraft.isPartial, true);
    assert.equal(deferredAssistedDraft.serviceMode, "general_point_to_point");
    assert.equal(deferredAssistedDraft.eligibilityCheckedAt, null);

    const created = await storage.createQuote({
      fromAddress: "Customer origin",
      toAddress: "Untrusted branch address",
      toBranchId: branch.id,
      homeSize: "medium",
      isPartial: true,
    });
    quoteIds.push(created.id);
    assert.equal(created.serviceMode, "branch_connected");
    assert.equal(created.storageMoveType, "into_storage");
    assert.equal(created.toAddress, branch.address);
    assert.equal(created.storageBranchGooglePlaceId, branch.googlePlaceId);
    assert.equal((created.storageBranchSnapshot as any)?.id, branch.id);

    const historical = await storage.createQuote({
      fromAddress: "Historical origin",
      toAddress: "Historical destination",
      toBranchId: branch.id,
      homeSize: "medium",
    });
    quoteIds.push(historical.id);
    const historicalSnapshot = historical.storageBranchSnapshot;
    await storage.updateQuote(historical.id, { isPartial: false });
    await storage.updateUstorageBranch(branch.id, {
      name: `${branch.name} (catalog refresh)`,
      address: `${branch.address} (catalog refresh)`,
    });
    const afterCatalogRefresh = await storage.getQuote(historical.id);
    assert.deepEqual(afterCatalogRefresh?.storageBranchSnapshot, historicalSnapshot);
    assert.equal(afterCatalogRefresh?.storageBranchAddress, branch.address);
    await assert.rejects(
      storage.updateQuote(historical.id, { isPartial: true }),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "CONTEXT_LOCKED",
    );
    await assert.rejects(
      storage.updateQuote(historical.id, {
        isPartial: true,
        toBranchId: branch.id,
        toAddress: "Tampered after reopen",
      }),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "CONTEXT_LOCKED",
    );
    await storage.updateUstorageBranch(branch.id, {
      name: branch.name,
      address: branch.address,
    });

    const switched = await storage.updateQuote(created.id, {
      fromBranchId: branch.id,
      toBranchId: null,
    });
    assert.equal(switched.storageMoveType, "out_of_storage");
    assert.equal(switched.fromAddress, branch.address);

    await assert.rejects(
      storage.updateQuote(created.id, {
        fromBranchId: null,
        toBranchId: null,
      }),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "GENERAL_MOVES_DISABLED",
    );
    await assert.rejects(
      storage.updateQuote(created.id, { storageMoveType: "into_storage" } as any),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "INVALID_REQUEST",
    );
    await assert.rejects(
      storage.createQuote({
        fromAddress: "Tampered origin",
        toAddress: "Tampered destination",
        storageBranchId: branch.id,
        storageMoveType: "into_storage",
      } as any),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "INVALID_REQUEST",
    );

    await storage.updateUstorageSettings({ generalMovesEnabled: true });
    const general = await storage.updateQuote(created.id, {
      fromBranchId: null,
      toBranchId: null,
    });
    assert.equal(general.serviceMode, "general_point_to_point");
    assert.equal(general.storageBranchId, null);
    assert.equal(general.storageBranchSnapshot, null);

    const finalized = await storage.updateQuote(created.id, { isPartial: false });
    assert.equal(finalized.isPartial, false);
    await assert.rejects(
      storage.updateQuote(created.id, {
        toAddress: "A later address must not replace booked context",
      }),
      (error: unknown) =>
        error instanceof QuoteEligibilityError && error.code === "CONTEXT_LOCKED",
    );
  } finally {
    for (const quoteId of quoteIds) await storage.deleteQuote(quoteId);
    await storage.updateUstorageSettings({
      branchMovesEnabled: originalSettings.branchMovesEnabled,
      generalMovesEnabled: originalSettings.generalMovesEnabled,
      intoStorageEnabled: originalSettings.intoStorageEnabled,
      outOfStorageEnabled: originalSettings.outOfStorageEnabled,
      matchRadiusKm: originalSettings.matchRadiusKm,
    });
  }
});

test("migration bootstraps one default policy row on an empty database", async () => {
  const migration = await readFile("migrations/0005_quote_service_eligibility.sql", "utf8");
  assert.match(migration, /INSERT INTO ustorage_settings[\s\S]*WHERE NOT EXISTS \(SELECT 1 FROM ustorage_settings\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_ustorage_settings_singleton/);
});

test("QuoteWizard uses endpoint selectors and never submits derived classification fields", async () => {
  const wizard = await readFile("client/src/components/quote/QuoteWizard.tsx", "utf8");
  assert.match(wizard, /fromBranchId/);
  assert.match(wizard, /toBranchId/);
  assert.doesNotMatch(wizard, /storageBranchId/);
  assert.doesNotMatch(wizard, /storageMoveType/);
});

test("proximity classification keeps only policy-enabled directions", () => {
  const fromBranch = {
    id: "from-branch",
    name: "Origin branch",
    region: "North",
    address: "Origin branch address",
  } as any;
  const toBranch = {
    id: "to-branch",
    name: "Destination branch",
    region: "South",
    address: "Destination branch address",
  } as any;
  const nearby = {
    branchMovesEnabled: true,
    generalMovesEnabled: false,
    fromNear: { branch: fromBranch, distanceKm: 0.2 },
    toNear: { branch: toBranch, distanceKm: 0.1 },
    radiusKm: 2,
  };

  const inboundOnly = buildStorageProximityResult({
    ...nearby,
    intoStorageEnabled: true,
    outOfStorageEnabled: false,
  });
  assert.equal(inboundOnly.fromMatch, null);
  assert.equal(inboundOnly.toMatch?.id, toBranch.id);

  const outboundOnly = buildStorageProximityResult({
    ...nearby,
    intoStorageEnabled: false,
    outOfStorageEnabled: true,
  });
  assert.equal(outboundOnly.fromMatch?.id, fromBranch.id);
  assert.equal(outboundOnly.toMatch, null);

  const bothDisabled = buildStorageProximityResult({
    ...nearby,
    intoStorageEnabled: false,
    outOfStorageEnabled: false,
  });
  assert.equal(bothDisabled.valid, false);
  assert.equal(bothDisabled.fromMatch, null);
  assert.equal(bothDisabled.toMatch, null);

  const generalFallback = buildStorageProximityResult({
    ...nearby,
    generalMovesEnabled: true,
    intoStorageEnabled: false,
    outOfStorageEnabled: false,
  });
  assert.equal(generalFallback.valid, true);
});