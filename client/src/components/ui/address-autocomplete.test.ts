import assert from "node:assert/strict";
import test from "node:test";
import {
  isBranchBrowseQuery,
  parsePlaceLocation,
  sortByDistance,
} from "../../lib/addressAutocomplete";

test("recognizes localized branch browsing labels", () => {
  for (const label of [
    "Sucursal",
    "Sucursales",
    "Sucursal oficial",
    "Sucursales oficiales",
    "Branch",
    "Branches",
    "Official branch",
    "Official branches",
  ]) {
    assert.equal(isBranchBrowseQuery(label), true, label);
  }
});

test("does not treat real branch searches as browsing labels", () => {
  for (const query of ["Polanco", "Anzures", "U-Storage", "Av. del Imán"]) {
    assert.equal(isBranchBrowseQuery(query), false, query);
  }
});

test("parses valid Google place coordinates and rejects incomplete details", () => {
  assert.deepEqual(
    parsePlaceLocation({ location: { latitude: 19.4326, longitude: -99.1332 } }),
    { lat: 19.4326, lng: -99.1332 },
  );
  assert.equal(parsePlaceLocation({ location: { latitude: "missing" } }), null);
  assert.equal(parsePlaceLocation(null), null);
});

test("sorts official branches by distance without mutating the source list", () => {
  const branches = [
    { id: "far", lat: 19.6, lng: -99.2 },
    { id: "near", lat: 19.433, lng: -99.133 },
  ];
  const sorted = sortByDistance(branches, { lat: 19.4326, lng: -99.1332 });

  assert.deepEqual(sorted.map((branch) => branch.id), ["near", "far"]);
  assert.equal(branches[0].distanceKm, undefined);
  assert.ok((sorted[0].distanceKm ?? Infinity) < (sorted[1].distanceKm ?? 0));
});