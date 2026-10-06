import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wizardPath = new URL("../../client/src/components/quote/QuoteWizard.tsx", import.meta.url);
const source = await readFile(wizardPath, "utf8");

test("move-out skips the rental question and keeps add-ons in the services step", () => {
  assert.match(source, /data-testid="storage-move-out"/);
  assert.match(source, /storageRec\?\.moveType === 'out_of_storage'/);
  assert.match(source, /quote\.form\.addons\.title/);
});

test("move-in records existing-contract and needs-unit decisions separately", () => {
  assert.match(source, /value="existing"/);
  assert.match(source, /value="needs_unit"/);
  assert.ok(source.indexOf('value="needs_unit"') < source.indexOf('value="existing"'));
  assert.match(source, /Quiero reservar una bodega U-Storage/);
  assert.match(source, /Ya tengo una bodega/);
  assert.match(source, /storageContractStatus: status/);
  assert.match(source, /storageRentalIntent/);
});

test("move-in defaults to reserving a unit and renders availability immediately", () => {
  assert.match(source, /rec\?\.moveType === 'into_storage'\s*\?\s*'needs_unit'/);
  assert.match(source, /setStorageContractStatus\(defaultContractStatus\)/);
  assert.match(source, /form\.setValue\('storage', 'need'\)/);
  assert.match(source, /storageContractStatus === 'needs_unit'/);
});

test("needs-storage renders selectable recommended live options and a safe handoff", () => {
  assert.match(source, /data-testid="storage-availability-options"/);
  assert.match(source, /option\.recommended/);
  assert.match(source, /storageSelectedUnitCode: option\.code/);
  assert.match(source, /fetch\('\/api\/ustorage\/reservation-handoff'/);
  assert.match(source, /if \(!response\.ok \|\| !handoff\?\.reservationUrl\)/);
  assert.match(source, /storageReservationStatus: 'handed_off'/);
  assert.match(source, /reservationWindow\.location\.replace\(handoff\.reservationUrl\)/);
  assert.doesNotMatch(source, /reservationUrl.*(?:contactName|contactEmail|contactPhone)/);
});

test("live-data failures, wrong branches, and no availability do not block the quote", () => {
  assert.match(source, /status === 'wrong_branch'/);
  assert.match(source, /status === 'no_availability'/);
  assert.match(source, /No pudimos consultar disponibilidad ahora/);
  assert.match(source, /Tu cotización puede continuar/);
  assert.match(source, /setStorageAvailabilityRetry/);
});

test("Step 4 option and decision layouts remain single-column on narrow screens", () => {
  assert.match(source, /className="grid grid-cols-1 gap-3 sm:grid-cols-2"/);
  assert.match(source, /className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"/);
});

test("a stale browser quote ID is cleared and recreated instead of blocking the wizard", () => {
  assert.match(source, /res\.status === 404 && partialQuoteId && data\.message === "Quote not found"/);
  assert.match(source, /setPartialQuoteId\(null\)/);
  assert.match(source, /postPartialQuote\(null\)/);
});

test("the U-Storage reservation handoff opens in a new tab without losing quote progress", () => {
  assert.match(source, /window\.open\('about:blank', '_blank'\)/);
  assert.match(source, /reservationWindow\.opener = null/);
  assert.match(source, /reservationWindow\.location\.replace\(handoff\.reservationUrl\)/);
  assert.doesNotMatch(source, /window\.location\.assign\(handoff\.reservationUrl\)/);
});

test("entering services clears stale storage results before rendering the new experience", () => {
  assert.match(source, /currentStepType === 'inventory' && stepOrder\[newStep - 1\] === 'services'/);
  assert.match(source, /setStorageRec\(null\)/);
  assert.match(source, /setStorageRecLoading\(true\)/);
  assert.match(source, /if \(stepType !== 'services'\) return/);
  assert.doesNotMatch(source, /stepType !== 'services' \|\| storageRecLoading/);
  assert.match(source, /!storageRecLoading && !storageRec && \(/);
});