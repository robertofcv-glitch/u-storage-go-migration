import assert from "node:assert/strict";
import test from "node:test";
import {
  isClaraResponse,
  isInventoryParserResponse,
  isPresetInventoryResponse,
} from "./aiContracts";

test("Clara response rejects malformed item and collection shapes", () => {
  assert.equal(isClaraResponse({}), false);
  assert.equal(isClaraResponse({ message: "" }), false);
  assert.equal(isClaraResponse({ message: "ok", newItems: {} }), false);
  assert.equal(isClaraResponse({ newItems: [{ quantity: 1 }] }), false);
  assert.equal(isClaraResponse({ removeItems: [{}] }), false);
  assert.equal(isClaraResponse({ truckRecommendation: { totalWeightKg: 65 } }), false);
  assert.equal(isClaraResponse({ estimatedCost: { low: 100, high: "120", currency: "MXN" } }), false);
  assert.equal(isClaraResponse({
    message: "ok",
    newItems: [{ name: "Sofa", quantity: 1, room: "sala", category: "sofas" }],
    removeItems: [{ name: "Chair" }],
    truckRecommendation: {
      totalWeightKg: 65,
      recommendedTruck: "1.5 Ton",
      truckCount: 1,
      includedMovers: 2,
      estimatedHours: 3,
    },
    estimatedCost: { low: 100, high: 120, currency: "MXN" },
    isComplete: false,
  }), true);
});

test("inventory parser response requires an array of named items", () => {
  assert.equal(isInventoryParserResponse({}), false);
  assert.equal(isInventoryParserResponse([{}]), false);
  assert.equal(isInventoryParserResponse([]), true);
  assert.equal(isInventoryParserResponse([{ name: "Mesa", quantity: 1 }]), true);
});

test("preset response requires every home size and complete items", () => {
  const item = {
    itemName: "Queen Bed",
    itemNameEs: "Cama Queen",
    roomKey: "bedroom_1",
    categoryKey: "beds_medium",
    defaultQuantity: 1,
  };
  assert.equal(isPresetInventoryResponse({ studio: [item] }), false);
  assert.equal(isPresetInventoryResponse({
    studio: [item],
    "1br": [item],
    "2br": [item],
    "3br": [item],
    "4br": [item],
  }), true);
});