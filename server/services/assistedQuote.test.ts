import assert from "node:assert/strict";
import test from "node:test";
import { assistedQuoteDraftSchema, duplicateMatch, normalizeEmail, normalizePhone } from "./assistedQuote";

test("assisted quote contact normalization is deterministic", () => {
  assert.equal(normalizeEmail("  SALES@Example.COM "), "sales@example.com");
  assert.equal(normalizePhone("+52 (55) 1234-5678"), "525512345678");
});

test("duplicate warnings require exact normalized email or phone", () => {
  assert.deepEqual(
    duplicateMatch({ email: "A@Example.com" }, { id: "u1", email: "a@example.com" }),
    { email: true, phone: false, id: "u1" },
  );
  assert.equal(duplicateMatch({ phone: "555-1234" }, { phone: "555-1235" }).phone, false);
});

test("assisted draft contract accepts the shared wizard autosave payload", () => {
  const result = assistedQuoteDraftSchema.safeParse({
    id: "ignored-public-partial-id",
    assistedSessionId: "draft-1",
    quoteSessionId: "isolated-session",
    contactName: "Walk-in lead",
    contactPhone: "+52 55 5555 5555",
    fromAddress: "Origen 1",
    toAddress: "Destino 2",
    moveDate: "2026-10-10",
    moveAvailabilityStart: "2026-10-10",
    moveAvailabilityEnd: "2026-10-12",
    preferredMoveDates: ["2026-10-10"],
    blockedMoveDates: [],
    homeSize: "2br",
    storageOption: "none",
    inventoryItems: [{ id: "chair", name: "Chair", room: "living", category: "chairs", quantity: 2 }],
    estimatedCost: 1250,
    estimatedCostHigh: 1600,
    estimatedCurrency: "MXN",
    storageContractStatus: "not_applicable",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contactName, "Walk-in lead");
    assert.equal(result.data.inventoryItems?.[0].quantity, 2);
    assert.equal("assistedSessionId" in result.data, false);
  }
});

test("assisted draft contract rejects invalid persisted inventory", () => {
  const result = assistedQuoteDraftSchema.safeParse({
    contactName: "Lead",
    contactPhone: "555",
    inventoryItems: [{ name: "", quantity: 0 }],
  });
  assert.equal(result.success, false);
});