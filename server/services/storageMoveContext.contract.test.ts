import assert from "node:assert/strict";
import test from "node:test";
import { getStorageMoveContext } from "@shared/storageMoveContext";
import { mapQuoteToSalesforceLead } from "./salesforceService";
import { toSalesforceApiPayload } from "./salesforceService";
import { toPartnerSafeQuote } from "./dispatchDtos";
import { quoteOperationsCsv, toQuoteOperationsRow } from "./quoteOperationsExport";
import { renderStorageMoveContext } from "../emailService";

const branch = {
  id: "branch-1",
  externalId: "UST-001",
  brand: "U-Storage",
  name: "U-Storage Polanco",
  address: "Av. Canonica 10, CDMX",
  googlePlaceId: "ChIJcanonical",
};

function quote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    quoteNumber: "Q-001",
    contactName: "Ana Pérez",
    contactEmail: "ana@example.test",
    contactPhone: "5550100",
    fromAddress: "Origin",
    toAddress: "Destination",
    homeSize: "medium",
    serviceMode: "branch_connected",
    storageMoveType: "into_storage",
    storageBranchSnapshot: branch,
    storageAccepted: true,
    storageSizeLabel: "Mediana",
    ...overrides,
  } as any;
}

test("into-storage contract is identical in Salesforce and partner handoffs", () => {
  const input = quote();
  const context = getStorageMoveContext(input);
  const lead = mapQuoteToSalesforceLead(input);
  const partner = toPartnerSafeQuote(input);

  assert.equal(context.direction, "into_storage");
  assert.deepEqual(partner.moveContext, context);
  assert.deepEqual(getStorageMoveContext(partner), context);
  assert.equal(lead.ServiceMode, "branch_connected");
  assert.equal(lead.MoveDirection, "into_storage");
  assert.equal(lead.StorageBranchId, branch.id);
  assert.equal(lead.StorageBranchExternalId, branch.externalId);
  assert.equal(lead.StorageBranchAddress, branch.address);
  assert.equal(lead.StorageBranchGooglePlaceId, branch.googlePlaceId);
  assert.deepEqual(JSON.parse(lead.MoveContext), context);
  assert.equal(toQuoteOperationsRow(input).branch_google_place_id, branch.googlePlaceId);
  assert.match(quoteOperationsCsv([input]), /branch_google_place_id/);
  const emailBlock = renderStorageMoveContext(context, "es");
  assert.match(emailBlock, /Hacia bodega/);
  assert.match(emailBlock, /U-Storage Polanco/);
  assert.match(emailBlock, /ChIJcanonical/);
});

test("operations CSV neutralizes spreadsheet formulas in public quote fields", () => {
  const csv = quoteOperationsCsv([
    quote({ fromAddress: "=HYPERLINK(\"https://attacker.invalid\")" }),
  ]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/attacker\.invalid""\)"/);
});

test("out-of-storage contract preserves the canonical branch snapshot", () => {
  const input = quote({
    storageMoveType: "out_of_storage",
    fromAddress: branch.address,
    toAddress: "Destination",
  });
  const context = getStorageMoveContext(input);
  const lead = mapQuoteToSalesforceLead(input);

  assert.equal(context.direction, "out_of_storage");
  assert.equal(context.branch?.address, branch.address);
  assert.equal(lead.MoveDirection, "out_of_storage");
  assert.equal(lead.StorageBranchName, branch.name);
  assert.equal(lead.StorageBranchBrand, branch.brand);
});

test("general moves explicitly carry a branch-free context", () => {
  const input = quote({
    serviceMode: "general_point_to_point",
    storageMoveType: null,
    storageBranchSnapshot: null,
    storageBranchId: null,
    storageBranchName: null,
    storageBranchBrand: null,
    storageBranchAddress: null,
    storageBranchGooglePlaceId: null,
  });
  const context = getStorageMoveContext(input);
  const lead = mapQuoteToSalesforceLead(input);
  const partner = toPartnerSafeQuote(input);

  assert.equal(context.serviceMode, "general_point_to_point");
  assert.equal(context.direction, null);
  assert.equal(context.branch, null);
  assert.deepEqual(partner.moveContext, context);
  assert.equal(lead.StorageBranchId, null);
  assert.equal(lead.StorageBranchAddress, null);
  assert.deepEqual(JSON.parse(lead.MoveContext), context);
  assert.equal(toQuoteOperationsRow(input).is_storage_connected, "false");
  assert.equal(toQuoteOperationsRow(input).branch_brand, "");
  const emailBlock = renderStorageMoveContext(context, "en");
  assert.match(emailBlock, /General move/);
  assert.doesNotMatch(emailBlock, /Storage branch:/);
});

test("Salesforce delivery strips internal context keys but preserves them in Description", () => {
  const lead = mapQuoteToSalesforceLead(quote());
  const apiPayload = toSalesforceApiPayload(lead);
  assert.deepEqual(Object.keys(apiPayload).sort(), [
    "Company", "Description", "Email", "FirstName", "LastName", "LeadSource", "Phone",
  ]);
  assert.match(apiPayload.Description, /Google Place ID: ChIJcanonical/);
});
