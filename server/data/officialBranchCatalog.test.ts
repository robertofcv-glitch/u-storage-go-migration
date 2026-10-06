import assert from "node:assert/strict";
import test from "node:test";
import {
  loadOfficialBranchCatalog,
  OFFICIAL_BRANCH_CATALOG_VERSION,
  OFFICIAL_BRANCH_SOURCE_SHA256,
} from "./officialBranchCatalog";

test("official catalog is the launch version with the expected branch split", async () => {
  const catalog = await loadOfficialBranchCatalog();
  const brands = catalog.reduce<Record<string, number>>((counts, branch) => {
    counts[branch.brand] = (counts[branch.brand] || 0) + 1;
    return counts;
  }, {});

  assert.equal(catalog.length, 49);
  assert.deepEqual(brands, { "U-Storage": 39, Guardabox: 10 });
  assert.equal(OFFICIAL_BRANCH_CATALOG_VERSION, "2026-08-24");
  assert.equal(
    OFFICIAL_BRANCH_SOURCE_SHA256,
    "f7b65eeb090431e96d6971a96955b350ab73c940c3d3b87c4c532a5bfcd78592",
  );

  const placeIds = new Set<string>();
  for (const branch of catalog) {
    for (const field of [
      "externalId",
      "brand",
      "name",
      "region",
      "url",
      "mapsUrl",
      "address",
      "lat",
      "lng",
      "googlePlaceId",
      "verificationNote",
    ] as const) {
      assert.ok(branch[field].trim(), `${field} is required for ${branch.name}`);
    }
    assert.ok(!placeIds.has(branch.googlePlaceId), `duplicate place ID: ${branch.googlePlaceId}`);
    placeIds.add(branch.googlePlaceId);
    assert.match(branch.mapsUrl, /^https?:\/\//);
    assert.match(branch.url, /^https?:\/\//);
    assert.ok(Number.isFinite(Number(branch.lat)));
    assert.ok(Number.isFinite(Number(branch.lng)));
  }

  assert.equal(catalog.find((branch) => branch.name.startsWith("Calzada"))?.externalId, "53");
  assert.equal(catalog.find((branch) => branch.name.startsWith("Río San"))?.externalId, "39");
});