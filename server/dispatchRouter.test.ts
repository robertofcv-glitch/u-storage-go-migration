import assert from "node:assert/strict";
import test from "node:test";
import { projectCalendarResourceRows, toCustomerOfferRevision } from "./dispatchRouter";

test("calendar resource projection keeps vehicle and crew rows explicitly nested", () => {
  const vehicleWindow = { id: "vehicle-window", startsAt: new Date("2039-01-01T08:00:00Z") };
  const vehicle = { id: "vehicle-1", name: "Van 1" };
  const crewWindow = { id: "crew-window", startsAt: new Date("2039-01-01T08:00:00Z") };
  const crew = { id: "crew-1", name: "Crew 1" };

  assert.deepEqual(projectCalendarResourceRows([{ window: vehicleWindow, resource: vehicle }], "vehicle"), [
    { window: vehicleWindow, vehicle },
  ]);
  assert.deepEqual(projectCalendarResourceRows([{ window: crewWindow, resource: crew }], "crew"), [
    { window: crewWindow, crew },
  ]);
});

test("customer offer projection hides drafts and removes internal metadata", () => {
  const offer = {
    id: "offer-1",
    quoteId: "quote-1",
    version: 2,
    amount: "1950.00",
    currency: "MXN",
    terms: "Valid for this move",
    paymentTerms: "Bank transfer",
    deadline: new Date("2039-01-10T00:00:00Z"),
    note: "Customer-facing note",
    sentAt: new Date(),
    sentBy: "internal-admin-id",
  };

  assert.equal(toCustomerOfferRevision(offer, "under_review"), null);
  assert.deepEqual(toCustomerOfferRevision(offer, "sent"), {
    id: offer.id,
    version: offer.version,
    amount: offer.amount,
    currency: offer.currency,
    terms: offer.terms,
    paymentTerms: offer.paymentTerms,
    deadline: offer.deadline,
    note: offer.note,
  });
});