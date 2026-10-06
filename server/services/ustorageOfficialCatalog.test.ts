import assert from "node:assert/strict";
import test from "node:test";
import { loadOfficialBranchCatalog } from "../data/officialBranchCatalog";
import { reconcileOfficialBranchCatalog } from "./ustorageBranchService";

test("official sync reconciles renamed locations and preserves reviewed activation", async () => {
  const official = await loadOfficialBranchCatalog();
  const renamed = official.find((branch) => branch.name === "Polanco")!;
  const existing = {
    id: "reviewed-polanco",
    externalId: renamed.externalId,
    googlePlaceId: renamed.googlePlaceId,
    brand: renamed.brand,
    name: "Polanco (reviewed label)",
    region: renamed.region,
    address: renamed.address,
    url: renamed.url,
    mapsUrl: renamed.mapsUrl,
    lat: renamed.lat,
    lng: renamed.lng,
    verificationNote: renamed.verificationNote,
    sourceVersion: "older-version",
    catalogStatus: "official",
    isActive: true,
    priceFromMxn: "999",
  } as any;
  const rows = [existing] as any[];
  let creates = 0;
  let updates = 0;
  const executor = {
    getAll: async () => rows,
    find: async (placeId: string, externalId: string) =>
      rows.find((row) => row.googlePlaceId === placeId || row.externalId === externalId),
    create: async (data: any) => {
      const created = { id: `created-${++creates}`, ...data };
      rows.push(created);
      return created;
    },
    update: async (id: string, data: any) => {
      const row = rows.find((candidate) => candidate.id === id)!;
      Object.assign(row, data);
      updates++;
      return row;
    },
  };

    const result = await reconcileOfficialBranchCatalog(official, executor);
    assert.equal(result.total, 49);
    assert.equal(result.created, 48);
    assert.equal(result.updated, 1);
    assert.equal(result.deactivated, 0);
    assert.equal(existing.name, renamed.name);
    assert.equal(existing.sourceVersion, "2026-08-24");
    assert.equal(existing.isActive, true);
    assert.equal(existing.priceFromMxn, "999");
    assert.equal(creates, 48);

    const second = await reconcileOfficialBranchCatalog(official, executor);
    assert.deepEqual(second, {
      total: 49,
      created: 0,
      updated: 0,
      deactivated: 0,
      sourceVersion: "2026-08-24",
    });
    assert.equal(updates, 1);
    assert.equal(creates, 48);
    assert.equal(existing.isActive, true);
});