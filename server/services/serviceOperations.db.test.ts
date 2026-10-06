import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  assignmentReservations,
  assignmentVehicles,
  assignmentCrews,
  crewAssignmentReservations,
  dispatchAssignments,
  operationalServices,
  inventoryItems,
  partnerCrews,
  partnerVehicles,
  moverProfiles,
  quoteActivityLog,
  quoteStatusHistory,
  quoteCustomerDecisions,
  quoteOfferRevisions,
  quotes,
  serviceChecklistItems,
  serviceCollections,
  serviceCollectionEvents,
  serviceFeedbackRequests,
  serviceTimelineEvents,
  users,
  vehicleAvailabilityWindows,
  crewAvailabilityWindows,
  SERVICE_CHECKLIST_KEYS,
  SERVICE_STAGE,
  COLLECTION_STATUS,
} from "@shared/schema";
import { SERVICE_STAGE_V2 } from "@shared/workflowStages";
import {
  assertQuoteOfferDeliverable,
  expireCollections,
  handoffAcceptedQuote,
  markQuoteOfferDelivered,
  recordCustomerDecision,
  recordOfferRevision,
  recalculateReviewedQuoteEstimate,
  reopenQuoteForInventoryRevision,
  setChecklist,
  transitionQuoteStage,
  transitionService,
  updateCollection,
} from "./serviceOperations";
import { proposeAssignment, releaseAssignment, respondToAssignment } from "./dispatchService";

type Fixture = {
  admin: string;
  customer: string;
  mover: string;
  quote: string;
  partner?: string;
  vehicle?: string;
  crew?: string;
  assignment?: string;
  service?: string;
};

const fixtures: Fixture[] = [];

async function createQuote(overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [admin, customer, mover] = await db.insert(users).values([
    { email: `service-admin-${suffix}@example.test`, userType: "admin" },
    { email: `service-customer-${suffix}@example.test`, userType: "client", fullName: "Service Test Customer" },
    { email: `service-mover-${suffix}@example.test`, userType: "mover" },
  ]).returning();
  const [quote] = await db.insert(quotes).values({
    userId: customer.id,
    fromAddress: "Origin test address",
    toAddress: "Destination test address",
    homeSize: "medium",
    workflowMode: "dispatch",
    workflowStatus: "accepted_pending_booking_payment",
    serviceMode: "general_point_to_point",
    priceProposalAmount: "2500.00",
    priceProposalCurrency: "MXN",
    estimatedCost: "2000.00",
    estimatedCostHigh: "2800.00",
    priceClientResponse: "accepted",
    priceClientRespondedAt: new Date(),
    ...overrides,
  }).returning();
  const fixture = { admin: admin.id, customer: customer.id, mover: mover.id, quote: quote.id };
  fixtures.push(fixture);
  return { ...fixture, quoteRow: quote };
}

async function addDispatchResources(fixture: Fixture) {
  const [partner] = await db.insert(moverProfiles).values({
    userId: fixture.mover,
    companyName: `Service test partner ${fixture.quote}`,
    partnerStatus: "active",
    onboardingComplete: true,
  }).returning();
  const [vehicle] = await db.insert(partnerVehicles).values({
    moverProfileId: partner.id,
    name: `Service test van ${fixture.quote}`,
  }).returning();
  const [crew] = await db.insert(partnerCrews).values({
    moverProfileId: partner.id,
    name: `Service test crew ${fixture.quote}`,
  }).returning();
  const startsAt = new Date("2042-02-01T08:00:00.000Z");
  const endsAt = new Date("2042-02-01T13:00:00.000Z");
  await db.insert(vehicleAvailabilityWindows).values({ vehicleId: vehicle.id, startsAt, endsAt });
  await db.insert(crewAvailabilityWindows).values({ crewId: crew.id, startsAt, endsAt });
  fixture.partner = partner.id;
  fixture.vehicle = vehicle.id;
  fixture.crew = crew.id;
  return { startsAt, endsAt };
}

async function createService(fixture: Fixture, amount = "2500.00") {
  await db.update(quotes).set({
    priceProposalAmount: amount,
    priceClientResponse: "accepted",
    workflowStatus: "closed_won",
  }).where(eq(quotes.id, fixture.quote));
  const service = await handoffAcceptedQuote(fixture.quote, fixture.customer);
  fixture.service = service.id;
  return service;
}

async function createAssignedService(fixture: Fixture, options: { crew?: boolean } = {}) {
  const window = await addDispatchResources(fixture);
  const assignment = await proposeAssignment({
    quoteId: fixture.quote,
    moverProfileId: fixture.partner!,
    vehicleIds: [fixture.vehicle!],
    crewIds: options.crew ? [fixture.crew!] : [],
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    actorId: fixture.admin,
  });
  fixture.assignment = assignment.id;
  await respondToAssignment({
    assignmentId: assignment.id,
    moverProfileId: fixture.partner!,
    response: "accepted",
    actorId: fixture.mover,
  });
  await createService(fixture);
  return assignment;
}

async function createProposedService(fixture: Fixture, options: { crew?: boolean } = {}) {
  const window = await addDispatchResources(fixture);
  const assignment = await proposeAssignment({
    quoteId: fixture.quote,
    moverProfileId: fixture.partner!,
    vehicleIds: [fixture.vehicle!],
    crewIds: options.crew ? [fixture.crew!] : [],
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    actorId: fixture.admin,
  });
  fixture.assignment = assignment.id;
  return assignment;
}

async function cleanup() {
  const pending = fixtures.splice(0);
  const quoteIds = pending.map(fixture => fixture.quote);
  const userIds = pending.flatMap(fixture => [fixture.admin, fixture.customer, fixture.mover]);
  if (!quoteIds.length) return;

  // Discover all services from their quote ownership, rather than relying on
  // the fixture's returned service ID (which may be absent after a failed
  // concurrent handoff).
  const services = await db.select({ id: operationalServices.id, assignmentId: operationalServices.assignmentId })
    .from(operationalServices).where(inArray(operationalServices.quoteId, quoteIds));
  const assignmentRows = await db.select({ id: dispatchAssignments.id })
    .from(dispatchAssignments).where(inArray(dispatchAssignments.quoteId, quoteIds));
  const assignmentIds = [...new Set([
    ...services.flatMap(service => service.assignmentId ? [service.assignmentId] : []),
    ...assignmentRows.map(assignment => assignment.id),
  ])];

  if (services.length) {
    const serviceIds = services.map(service => service.id);
    const collections = await db.select({ id: serviceCollections.id })
      .from(serviceCollections).where(inArray(serviceCollections.serviceId, serviceIds));
    if (collections.length) {
      await db.delete(serviceCollectionEvents).where(inArray(serviceCollectionEvents.collectionId, collections.map(collection => collection.id)));
      await db.delete(serviceCollections).where(inArray(serviceCollections.id, collections.map(collection => collection.id)));
    }
    await db.delete(serviceFeedbackRequests).where(inArray(serviceFeedbackRequests.serviceId, serviceIds));
    await db.delete(serviceChecklistItems).where(inArray(serviceChecklistItems.serviceId, serviceIds));
    await db.delete(serviceTimelineEvents).where(inArray(serviceTimelineEvents.serviceId, serviceIds));
    await db.delete(operationalServices).where(inArray(operationalServices.id, serviceIds));
  }
  if (assignmentIds.length) {
    await db.delete(assignmentReservations).where(inArray(assignmentReservations.assignmentId, assignmentIds));
    await db.delete(crewAssignmentReservations).where(inArray(crewAssignmentReservations.assignmentId, assignmentIds));
    await db.delete(assignmentVehicles).where(inArray(assignmentVehicles.assignmentId, assignmentIds));
    await db.delete(assignmentCrews).where(inArray(assignmentCrews.assignmentId, assignmentIds));
    await db.delete(dispatchAssignments).where(inArray(dispatchAssignments.id, assignmentIds));
  }
  await db.delete(quoteCustomerDecisions).where(inArray(quoteCustomerDecisions.quoteId, quoteIds));
  await db.delete(quoteStatusHistory).where(inArray(quoteStatusHistory.quoteId, quoteIds));
  await db.delete(quoteOfferRevisions).where(inArray(quoteOfferRevisions.quoteId, quoteIds));
  await db.delete(quoteActivityLog).where(inArray(quoteActivityLog.quoteId, quoteIds));
  await db.delete(inventoryItems).where(inArray(inventoryItems.quoteId, quoteIds));
  await db.delete(quotes).where(inArray(quotes.id, quoteIds));
  const partners = await db.select({ id: moverProfiles.id }).from(moverProfiles).where(inArray(moverProfiles.userId, userIds));
  if (partners.length) await db.delete(moverProfiles).where(inArray(moverProfiles.id, partners.map(partner => partner.id)));
  await db.delete(users).where(inArray(users.id, userIds));
}

test.afterEach(cleanup);

test("accepted quote handoff is idempotent and preserves customer ownership", async () => {
  const fixture = await createQuote();
  await db.update(quotes).set({ workflowStatus: "closed_won" }).where(eq(quotes.id, fixture.quote));
  const results = await Promise.all([
    handoffAcceptedQuote(fixture.quote, fixture.customer),
    handoffAcceptedQuote(fixture.quote, fixture.customer),
    handoffAcceptedQuote(fixture.quote, fixture.customer),
  ]);
  const services = await db.select().from(operationalServices).where(eq(operationalServices.quoteId, fixture.quote));
  const collections = await db.select().from(serviceCollections).where(eq(serviceCollections.serviceId, results[0].id));
  const checklist = await db.select().from(serviceChecklistItems).where(eq(serviceChecklistItems.serviceId, results[0].id));
  assert.equal(new Set(results.map(row => row.id)).size, 1);
  assert.equal(services.length, 1);
  assert.equal(collections.length, 1);
  assert.equal(checklist.length, SERVICE_CHECKLIST_KEYS.length);
  assert.equal((services[0].snapshot as any).customerId, fixture.customer);
  assert.equal(services[0].customerId, fixture.customer);
});

test("concurrent offer revisions are immutable and monotonically versioned", async () => {
  const fixture = await createQuote({ priceClientResponse: null, workflowStatus: "under_review" });
  const revisions = await Promise.all(Array.from({ length: 5 }, (_, index) => recordOfferRevision({
    quoteId: fixture.quote,
    amount: 1000 + index,
    actorId: fixture.admin,
    note: `revision-${index}`,
  })));
  const rows = await db.select().from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, fixture.quote));
  assert.deepEqual(rows.map(row => row.version).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.equal(new Set(revisions.map(row => row.id)).size, 5);
  assert.equal(new Set(rows.map(row => row.amount)).size, 5);
  assert.ok(rows.every(row => row.note?.startsWith("revision-")));
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "under_review");
  const assignments = await db.select().from(dispatchAssignments).where(eq(dispatchAssignments.quoteId, fixture.quote));
  assert.equal(assignments.length, 0);
});

test("latest offer moves from preparation through delivery to a customer decision", async () => {
  const fixture = await createQuote({ priceClientResponse: null, workflowStatus: "under_review" });
  await assert.rejects(() => assertQuoteOfferDeliverable(fixture.quote), /Prepare a formal offer/);
  const first = await recordOfferRevision({ quoteId: fixture.quote, amount: 1800, actorId: fixture.admin });
  const latest = await recordOfferRevision({ quoteId: fixture.quote, amount: 1950, actorId: fixture.admin });
  await assertQuoteOfferDeliverable(fixture.quote);
  let [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "under_review");
  await markQuoteOfferDelivered({ quoteId: fixture.quote, actorId: fixture.admin, recipient: "customer@example.test" });
  [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "sent");
  await transitionQuoteStage({
    quoteId: fixture.quote,
    toStage: "awaiting_decision",
    actorId: fixture.admin,
  });
  await assert.rejects(() => recordCustomerDecision({
    quoteId: fixture.quote,
    decision: "accepted",
    actorId: fixture.customer,
    offerRevisionId: first.id,
    expectedProposalVersion: first.version,
  }), /changed while responding/);
  await recordCustomerDecision({
    quoteId: fixture.quote,
    decision: "accepted",
    actorId: fixture.customer,
    offerRevisionId: latest.id,
    expectedProposalVersion: latest.version,
  });
  [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "accepted_pending_booking_payment");
  assert.equal(quote.priceClientResponse, "accepted");
  const [decision] = await db.select().from(quoteCustomerDecisions)
    .where(and(eq(quoteCustomerDecisions.quoteId, fixture.quote), eq(quoteCustomerDecisions.decision, "accepted")));
  assert.equal(decision.offerRevisionId, latest.id);
});

test("sent quote inventory revisions reopen safely without rewriting offer history", async () => {
  const fixture = await createQuote({
    workflowStatus: "sent",
    quoteReviewVersion: 4,
    priceClientResponse: null,
    priceProposalVersion: 1,
  });
  const firstOffer = await db.insert(quoteOfferRevisions).values({
    quoteId: fixture.quote, version: 1, amount: "2000.00", currency: "MXN", sentBy: fixture.admin,
  }).returning();
  await db.insert(quoteCustomerDecisions).values({
    quoteId: fixture.quote, offerRevisionId: firstOffer[0].id, decision: "offer_sent", actorId: fixture.admin,
  });
  const reopened = await reopenQuoteForInventoryRevision({
    quoteId: fixture.quote,
    expectedReviewVersion: 4,
    actorId: fixture.admin,
    reason: "Customer corrected the sofa quantity",
  });
  assert.equal(reopened.workflowStatus, "under_review");
  assert.equal(reopened.quoteReviewVersion, 5);
  assert.equal(reopened.estimatedCost, null);
  assert.equal(reopened.priceProposalAmount, null);
  assert.equal((await db.select().from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, fixture.quote))).length, 1);
  assert.equal((await db.select().from(quoteCustomerDecisions).where(eq(quoteCustomerDecisions.quoteId, fixture.quote))).length, 1);
  await assert.rejects(() => recordOfferRevision({
    quoteId: fixture.quote, amount: "2200.00", actorId: fixture.admin,
  }), /Recalculate the estimate/);
});

test("inventory revision reopening rejects stale versions, accepted quotes, and service-linked quotes", async () => {
  const sent = await createQuote({ workflowStatus: "awaiting_decision", quoteReviewVersion: 2, priceClientResponse: null });
  await assert.rejects(() => reopenQuoteForInventoryRevision({
    quoteId: sent.quote, expectedReviewVersion: 1, actorId: sent.admin, reason: "Correction",
  }), /changed while/);
  const accepted = await createQuote();
  await assert.rejects(() => reopenQuoteForInventoryRevision({
    quoteId: accepted.quote, expectedReviewVersion: 0, actorId: accepted.admin, reason: "Correction",
  }), /cannot be reopened/);
  const linked = await createQuote({ workflowStatus: "sent", priceClientResponse: null });
  await db.update(quotes).set({ workflowStatus: "closed_won" }).where(eq(quotes.id, linked.quote));
  await createService(linked);
  await db.update(quotes).set({ workflowStatus: "sent" }).where(eq(quotes.id, linked.quote));
  await assert.rejects(() => reopenQuoteForInventoryRevision({
    quoteId: linked.quote, expectedReviewVersion: 0, actorId: linked.admin, reason: "Correction",
  }), /operational service/);
});

test("reopening and a customer response serialize so a superseded offer cannot decide the quote", async () => {
  const fixture = await createQuote({
    workflowStatus: "awaiting_decision",
    quoteReviewVersion: 0,
    priceClientResponse: null,
    priceProposalVersion: 1,
  });
  const [offer] = await db.insert(quoteOfferRevisions).values({
    quoteId: fixture.quote, version: 1, amount: "2000.00", currency: "MXN", sentBy: fixture.admin,
  }).returning();
  const outcomes = await Promise.allSettled([
    reopenQuoteForInventoryRevision({
      quoteId: fixture.quote,
      expectedReviewVersion: 0,
      actorId: fixture.admin,
      reason: "Customer corrected inventory",
    }),
    recordCustomerDecision({
      quoteId: fixture.quote,
      decision: "rejected",
      note: "Customer declined the original offer",
      actorId: fixture.customer,
      offerRevisionId: offer.id,
      expectedProposalVersion: 1,
    }),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(outcome => outcome.status === "rejected").length, 1);
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.ok(["under_review", "closed_lost"].includes(quote.workflowStatus!));
  if (quote.workflowStatus === "under_review") assert.equal(quote.priceClientResponse, null);
  if (quote.workflowStatus === "closed_lost") assert.equal(quote.quoteReviewVersion, 0);
});

test("inventory saves cannot leave a stale in-flight recalculation on the quote", async () => {
  const fixture = await createQuote({
    workflowStatus: "under_review",
    quoteReviewVersion: 0,
    priceClientResponse: null,
  });
  const [item] = await db.insert(inventoryItems).values({
    quoteId: fixture.quote, itemName: "Sofa", category: "sofas_large", quantity: 1,
  }).returning();
  const outcomes = await Promise.allSettled([
    recalculateReviewedQuoteEstimate({
      quoteId: fixture.quote,
      expectedReviewVersion: 0,
      actorId: fixture.admin,
    }),
    db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + fixture.quote}, 0))`);
      await tx.update(inventoryItems).set({ quantity: 2 }).where(eq(inventoryItems.id, item.id));
      await tx.update(quotes).set({
        estimatedCost: null,
        estimatedCostHigh: null,
        quoteReviewVersion: sql`${quotes.quoteReviewVersion} + 1`,
      }).where(and(eq(quotes.id, fixture.quote), eq(quotes.quoteReviewVersion, 0)));
    }),
  ]);
  assert.equal(outcomes[1].status, "fulfilled");
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.quoteReviewVersion, 1);
  assert.equal(quote.estimatedCost, null);
  assert.equal(quote.estimatedCostHigh, null);
});

test("collection verification confirms tentative vehicle holds and is idempotent", async () => {
  const fixture = await createQuote();
  await createAssignedService(fixture);
  const [before] = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, fixture.assignment!));
  assert.equal(before.status, "tentative");
  await updateCollection(fixture.service!, {
    collectionId: (await db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, fixture.service!) }))!.id,
    status: COLLECTION_STATUS.VERIFIED,
    actorId: fixture.admin,
    externalReference: "BANK-VERIFIED-1",
  });
  await updateCollection(fixture.service!, {
    status: COLLECTION_STATUS.VERIFIED,
    actorId: fixture.admin,
    externalReference: "BANK-VERIFIED-1",
  });
  const [reservation] = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, fixture.assignment!));
  const [service] = await db.select().from(operationalServices).where(eq(operationalServices.id, fixture.service!));
  const events = await db.select().from(serviceCollectionEvents).where(eq(serviceCollectionEvents.collectionId, (await db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, fixture.service!) }))!.id));
  assert.equal(reservation.status, "confirmed");
  assert.equal(service.stage, SERVICE_STAGE_V2.CONFIRMED);
  assert.equal(events.filter(event => event.toStatus === COLLECTION_STATUS.VERIFIED).length, 1);
});

test("expired and rejected collections release vehicle and crew holds", async () => {
  const expired = await createQuote();
  await createAssignedService(expired, { crew: true });
  await db.update(serviceCollections).set({ deadline: new Date("2000-01-01T00:00:00.000Z") }).where(eq(serviceCollections.serviceId, expired.service!));
  assert.equal(await expireCollections(new Date("2000-01-02T00:00:00.000Z"), expired.admin), 1);
  const expiredVehicle = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, expired.assignment!));
  const expiredCrew = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, expired.assignment!));
  const [expiredService] = await db.select().from(operationalServices).where(eq(operationalServices.id, expired.service!));
  assert.ok(expiredVehicle.every(row => row.status === "released"));
  assert.ok(expiredCrew.every(row => row.status === "released"));
  assert.equal(expiredService.stage, SERVICE_STAGE_V2.ON_HOLD);

  const rejected = await createQuote();
  await createAssignedService(rejected, { crew: true });
  await updateCollection(rejected.service!, { status: COLLECTION_STATUS.REJECTED, actorId: rejected.admin, notes: "Evidence rejected" });
  const rejectedVehicle = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, rejected.assignment!));
  const rejectedCrew = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, rejected.assignment!));
  assert.ok(rejectedVehicle.every(row => row.status === "released"));
  assert.ok(rejectedCrew.every(row => row.status === "released"));
});

test("team-assigned transition is blocked until every required checklist item is complete", async () => {
  const fixture = await createQuote({ priceProposalAmount: "0" });
  await createService(fixture, "0");
  await transitionService(fixture.service!, SERVICE_STAGE_V2.SCHEDULED, fixture.admin);
  await assert.rejects(() => transitionService(fixture.service!, SERVICE_STAGE_V2.TEAM_ASSIGNED, fixture.admin), /Required checklist incomplete/);
  for (const key of SERVICE_CHECKLIST_KEYS) await setChecklist(fixture.service!, key, true, fixture.admin);
  const ready = await transitionService(fixture.service!, SERVICE_STAGE_V2.TEAM_ASSIGNED, fixture.admin);
  assert.equal(ready.stage, SERVICE_STAGE_V2.TEAM_ASSIGNED);
});

test("finished transition issues one feedback request and one timeline event", async () => {
  const fixture = await createQuote({ priceProposalAmount: "0" });
  await createService(fixture, "0");
  await transitionService(fixture.service!, SERVICE_STAGE_V2.SCHEDULED, fixture.admin);
  for (const key of SERVICE_CHECKLIST_KEYS) await setChecklist(fixture.service!, key, true, fixture.admin);
  await transitionService(fixture.service!, SERVICE_STAGE_V2.TEAM_ASSIGNED, fixture.admin);
  await transitionService(fixture.service!, SERVICE_STAGE_V2.EN_ROUTE, fixture.admin);
  await transitionService(fixture.service!, SERVICE_STAGE_V2.IN_PROGRESS, fixture.admin);
  await transitionService(fixture.service!, SERVICE_STAGE_V2.FINISHED, fixture.admin, "Finished");
  const feedback = await db.select().from(serviceFeedbackRequests).where(eq(serviceFeedbackRequests.serviceId, fixture.service!));
  const timeline = await db.select().from(serviceTimelineEvents).where(and(eq(serviceTimelineEvents.serviceId, fixture.service!), eq(serviceTimelineEvents.type, "service.feedback_issued")));
  assert.equal(feedback.length, 1);
  assert.equal(timeline.length, 1);
});

test("collection IDs cannot be used across service ownership boundaries", async () => {
  const first = await createQuote();
  const second = await createQuote();
  await createService(first);
  await createService(second);
  const secondCollection = await db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, second.service!) });
  await assert.rejects(() => updateCollection(first.service!, {
    collectionId: secondCollection!.id,
    status: COLLECTION_STATUS.VERIFIED,
    actorId: first.admin,
  }), /does not belong to service/);
});

test("offer revisions are rejected after handoff without mutating quote or service terms", async () => {
  const fixture = await createQuote({ priceProposalAmount: "2750.00", priceProposalVersion: 3 });
  await createService(fixture, "2750.00");
  const [beforeQuote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  const [beforeService] = await db.select().from(operationalServices).where(eq(operationalServices.id, fixture.service!));
  const [beforeCollection] = await db.select().from(serviceCollections).where(eq(serviceCollections.serviceId, fixture.service!));
  await assert.rejects(() => recordOfferRevision({
    quoteId: fixture.quote, amount: "9999.00", actorId: fixture.admin, note: "Must not revise",
  }), (error: any) => error?.status === 409);
  const [afterQuote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  const [afterService] = await db.select().from(operationalServices).where(eq(operationalServices.id, fixture.service!));
  const [afterCollection] = await db.select().from(serviceCollections).where(eq(serviceCollections.serviceId, fixture.service!));
  assert.equal(afterQuote.priceProposalVersion, beforeQuote.priceProposalVersion);
  assert.equal(afterQuote.priceClientResponse, beforeQuote.priceClientResponse);
  assert.equal(afterQuote.priceProposalAmount, beforeQuote.priceProposalAmount);
  assert.deepEqual(afterService.snapshot, beforeService.snapshot);
  assert.equal(afterCollection.amount, beforeCollection.amount);
});

test("collection rejection and expiry recover linked assignments and permit replacement proposals", async () => {
  const rejected = await createQuote();
  await createAssignedService(rejected, { crew: true });
  await updateCollection(rejected.service!, {
    status: COLLECTION_STATUS.VERIFIED, actorId: rejected.admin, externalReference: "verified-before-rejection",
  });
  await updateCollection(rejected.service!, {
    status: COLLECTION_STATUS.REJECTED, actorId: rejected.admin, notes: "Verification failed",
  });
  const [rejectedAssignment] = await db.select().from(dispatchAssignments).where(eq(dispatchAssignments.id, rejected.assignment!));
  const [rejectedService] = await db.select().from(operationalServices).where(eq(operationalServices.id, rejected.service!));
  const [rejectedQuote] = await db.select().from(quotes).where(eq(quotes.id, rejected.quote));
  const rejectedVehicle = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, rejected.assignment!));
  const rejectedCrew = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, rejected.assignment!));
  assert.equal(rejectedAssignment.status, "cancelled");
  assert.equal(rejectedService.assignmentId, null);
  assert.equal(rejectedService.stage, SERVICE_STAGE_V2.ON_HOLD);
  assert.equal(rejectedQuote.workflowStatus, "accepted_pending_booking_payment");
  assert.equal(rejectedQuote.assignedMoverProfileId, null);
  assert.ok(rejectedVehicle.every(row => row.status === "released"));
  assert.ok(rejectedCrew.every(row => row.status === "released"));

  // Repeating the same terminal outcome must not create another recovery record.
  await updateCollection(rejected.service!, {
    status: COLLECTION_STATUS.REJECTED, actorId: rejected.admin, notes: "Verification failed",
  });
  const [collection] = await db.select().from(serviceCollections).where(eq(serviceCollections.serviceId, rejected.service!));
  const recoveryEvents = await db.select().from(serviceTimelineEvents).where(and(
    eq(serviceTimelineEvents.serviceId, rejected.service!), eq(serviceTimelineEvents.type, "collection.recovery"),
  ));
  const recoveryAudits = await db.select().from(quoteActivityLog).where(and(
    eq(quoteActivityLog.quoteId, rejected.quote!), eq(quoteActivityLog.actionType, "dispatch.collection_recovery"),
  ));
  const collectionEvents = await db.select().from(serviceCollectionEvents).where(and(
    eq(serviceCollectionEvents.collectionId, collection.id), eq(serviceCollectionEvents.toStatus, COLLECTION_STATUS.REJECTED),
  ));
  assert.equal(recoveryEvents.length, 1);
  assert.equal(recoveryAudits.length, 1);
  assert.equal(collectionEvents.length, 1);

  const replacement = await proposeAssignment({
    quoteId: rejected.quote,
    moverProfileId: rejected.partner!,
    vehicleIds: [rejected.vehicle!],
    crewIds: [rejected.crew!],
    startsAt: new Date("2042-02-01T08:00:00.000Z"),
    endsAt: new Date("2042-02-01T13:00:00.000Z"),
    actorId: rejected.admin,
  });
  const [relinkedService] = await db.select().from(operationalServices).where(eq(operationalServices.id, rejected.service!));
  const [pendingCollection] = await db.select().from(serviceCollections).where(eq(serviceCollections.serviceId, rejected.service!));
  assert.equal(replacement.id, relinkedService.assignmentId);
  assert.equal(relinkedService.stage, SERVICE_STAGE_V2.CONFIRMED);
  assert.equal(pendingCollection.status, COLLECTION_STATUS.PENDING);

  const expired = await createQuote();
  await createAssignedService(expired, { crew: true });
  await db.update(serviceCollections).set({ deadline: new Date("2000-01-01T00:00:00.000Z") })
    .where(eq(serviceCollections.serviceId, expired.service!));
  assert.equal(await expireCollections(new Date("2000-01-02T00:00:00.000Z"), expired.admin), 1);
  const [expiredAssignment] = await db.select().from(dispatchAssignments).where(eq(dispatchAssignments.id, expired.assignment!));
  const [expiredService] = await db.select().from(operationalServices).where(eq(operationalServices.id, expired.service!));
  const [expiredQuote] = await db.select().from(quotes).where(eq(quotes.id, expired.quote));
  assert.equal(expiredAssignment.status, "cancelled");
  assert.equal(expiredService.assignmentId, null);
  assert.equal(expiredService.stage, SERVICE_STAGE_V2.ON_HOLD);
  assert.equal(expiredQuote.workflowStatus, "accepted_pending_booking_payment");
  assert.equal(expiredQuote.assignedMoverProfileId, null);
});

test("admin cancellation releases proposed holds and detaches the service for replacement", async () => {
  const fixture = await createQuote();
  await createProposedService(fixture, { crew: true });
  await releaseAssignment(fixture.assignment!);
  const [oldAssignment] = await db.select().from(dispatchAssignments).where(eq(dispatchAssignments.id, fixture.assignment!));
  const vehicleHolds = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, fixture.assignment!));
  const crewHolds = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, fixture.assignment!));
  assert.equal(oldAssignment.status, "cancelled");
  assert.ok(vehicleHolds.every(row => row.status === "released"));
  assert.ok(crewHolds.every(row => row.status === "released"));

  const replacement = await proposeAssignment({
    quoteId: fixture.quote, moverProfileId: fixture.partner!, vehicleIds: [fixture.vehicle!],
    crewIds: [fixture.crew!], startsAt: new Date("2042-02-01T08:00:00.000Z"),
    endsAt: new Date("2042-02-01T13:00:00.000Z"), actorId: fixture.admin,
  });
  assert.equal(replacement.quoteId, fixture.quote);
});

test("partner decline detaches the service and keeps replacement holds tentative until payment verification", async () => {
  const fixture = await createQuote();
  await createProposedService(fixture, { crew: true });
  await respondToAssignment({
    assignmentId: fixture.assignment!, moverProfileId: fixture.partner!, response: "declined",
    note: "Partner unavailable", actorId: fixture.mover,
  });
  const oldVehicleHolds = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, fixture.assignment!));
  const oldCrewHolds = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, fixture.assignment!));
  assert.ok(oldVehicleHolds.every(row => row.status === "released"));
  assert.ok(oldCrewHolds.every(row => row.status === "released"));

  const replacement = await proposeAssignment({
    quoteId: fixture.quote, moverProfileId: fixture.partner!, vehicleIds: [fixture.vehicle!],
    crewIds: [fixture.crew!], startsAt: new Date("2042-02-01T08:00:00.000Z"),
    endsAt: new Date("2042-02-01T13:00:00.000Z"), actorId: fixture.admin,
  });
  await respondToAssignment({
    assignmentId: replacement.id, moverProfileId: fixture.partner!, response: "accepted", actorId: fixture.mover,
  });
  let [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  let replacementVehicleHolds = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, replacement.id));
  let replacementCrewHolds = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, replacement.id));
  assert.equal(quote.workflowStatus, "accepted_pending_booking_payment");
  assert.ok(replacementVehicleHolds.every(row => row.status === "tentative"));
  assert.ok(replacementCrewHolds.every(row => row.status === "tentative"));

  await createService(fixture);
  await updateCollection(fixture.service!, { status: COLLECTION_STATUS.VERIFIED, actorId: fixture.admin });
  [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  replacementVehicleHolds = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, replacement.id));
  replacementCrewHolds = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, replacement.id));
  assert.equal(quote.workflowStatus, "closed_won");
  assert.ok(replacementVehicleHolds.every(row => row.status === "confirmed"));
  assert.ok(replacementCrewHolds.every(row => row.status === "confirmed"));
  const oldVehicleAfter = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, fixture.assignment!));
  assert.ok(oldVehicleAfter.every(row => row.status === "released"));
});

test("payment verification preserves the canonical won quote stage", async () => {
  const fixture = await createQuote();
  const window = await addDispatchResources(fixture);
  const assignment = await proposeAssignment({
    quoteId: fixture.quote, moverProfileId: fixture.partner!, vehicleIds: [fixture.vehicle!],
    crewIds: [fixture.crew!], startsAt: window.startsAt, endsAt: window.endsAt, actorId: fixture.admin,
  });
  fixture.assignment = assignment.id;
  await respondToAssignment({
    assignmentId: assignment.id, moverProfileId: fixture.partner!, response: "accepted", actorId: fixture.mover,
  });
  await createService(fixture);
  await updateCollection(fixture.service!, { status: COLLECTION_STATUS.VERIFIED, actorId: fixture.admin });
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  const vehicleHolds = await db.select().from(assignmentReservations).where(eq(assignmentReservations.assignmentId, assignment.id));
  const crewHolds = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.assignmentId, assignment.id));
  assert.equal(quote.workflowStatus, "closed_won");
  assert.ok(vehicleHolds.every(row => row.status === "confirmed"));
  assert.ok(crewHolds.every(row => row.status === "confirmed"));
});

test("accepted quotes become won only after booking acceptance and payment verification", async () => {
  const fixture = await createQuote({
    workflowStatus: "awaiting_decision",
    priceClientResponse: null,
    priceProposalVersion: 1,
  });
  const window = await addDispatchResources(fixture);
  await recordCustomerDecision({
    quoteId: fixture.quote,
    decision: "accepted",
    actorId: fixture.customer,
    expectedProposalVersion: 1,
  });
  const service = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, fixture.quote) });
  assert.ok(service);
  let [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "accepted_pending_booking_payment");

  const assignment = await proposeAssignment({
    quoteId: fixture.quote,
    moverProfileId: fixture.partner!,
    vehicleIds: [fixture.vehicle!],
    crewIds: [fixture.crew!],
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    actorId: fixture.admin,
  });
  await respondToAssignment({
    assignmentId: assignment.id,
    moverProfileId: fixture.partner!,
    response: "accepted",
    actorId: fixture.mover,
  });
  [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "accepted_pending_booking_payment");

  await updateCollection(service!.id, { status: COLLECTION_STATUS.VERIFIED, actorId: fixture.admin });
  [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "closed_won");
  const history = await db.select().from(quoteStatusHistory).where(eq(quoteStatusHistory.quoteId, fixture.quote));
  assert.equal(history.at(-1)?.toStatus, "closed_won");
});

test("customer acceptance creates booking and payment records without exposing a won quote", async () => {
  const fixture = await createQuote({ workflowStatus: "awaiting_decision", priceClientResponse: null });
  await recordCustomerDecision({ quoteId: fixture.quote, decision: "accepted", actorId: fixture.customer });
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  const services = await db.select().from(operationalServices).where(eq(operationalServices.quoteId, fixture.quote));
  const history = await db.select().from(quoteStatusHistory).where(eq(quoteStatusHistory.quoteId, fixture.quote));
  assert.equal(quote.workflowStatus, "accepted_pending_booking_payment");
  assert.equal(services.length, 1);
  const collection = await db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, services[0].id) });
  assert.equal(collection?.status, COLLECTION_STATUS.PENDING);
  assert.equal(history.at(-1)?.toStatus, "accepted_pending_booking_payment");
});

test("only one concurrent response can decide the current offer", async () => {
  const fixture = await createQuote({
    workflowStatus: "awaiting_decision",
    priceClientResponse: null,
    priceProposalVersion: 3,
  });
  const responses = await Promise.allSettled([
    recordCustomerDecision({
      quoteId: fixture.quote,
      decision: "accepted",
      actorId: fixture.customer,
      expectedProposalVersion: 3,
    }),
    recordCustomerDecision({
      quoteId: fixture.quote,
      decision: "change_requested",
      note: "Please adjust the date",
      actorId: fixture.customer,
      expectedProposalVersion: 3,
    }),
  ]);
  assert.equal(responses.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(responses.filter(result => result.status === "rejected").length, 1);
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  const decisions = await db.select().from(quoteCustomerDecisions).where(eq(quoteCustomerDecisions.quoteId, fixture.quote));
  assert.equal(decisions.length, 1);
  assert.ok(["accepted", "change_requested"].includes(quote.priceClientResponse || ""));
});

test("customer rejection records a canonical lost outcome and requires a reason", async () => {
  const fixture = await createQuote({ workflowStatus: "awaiting_decision", priceClientResponse: null });
  await assert.rejects(
    () => recordCustomerDecision({ quoteId: fixture.quote, decision: "rejected", actorId: fixture.customer }),
    /reason is required/,
  );
  await recordCustomerDecision({ quoteId: fixture.quote, decision: "rejected", note: "Budget was not approved", actorId: fixture.customer });
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, fixture.quote));
  assert.equal(quote.workflowStatus, "closed_lost");
  assert.equal(quote.status, "closed_lost");
});

test("handoff refuses accepted quotes until they are explicitly closed won", async () => {
  const fixture = await createQuote({ workflowStatus: "accepted_pending_booking_payment" });
  await assert.rejects(
    () => handoffAcceptedQuote(fixture.quote, fixture.admin),
    (error: any) => error?.status === 409,
  );
  const services = await db.select().from(operationalServices).where(eq(operationalServices.quoteId, fixture.quote));
  assert.equal(services.length, 0);
});

test("canonical admin transitions reject invalid jumps and require terminal reasons", async () => {
  const fixture = await createQuote({ workflowStatus: "draft" });
  await assert.rejects(
    () => transitionQuoteStage({ quoteId: fixture.quote, toStage: "closed_won", actorId: fixture.admin }),
    (error: any) => error?.status === 409,
  );
  await assert.rejects(
    () => transitionQuoteStage({ quoteId: fixture.quote, toStage: "cancelled", actorId: fixture.admin }),
    /reason is required/,
  );
  const reviewFixture = await createQuote({ workflowStatus: "under_review", priceClientResponse: null });
  await assert.rejects(
    () => transitionQuoteStage({ quoteId: reviewFixture.quote, toStage: "sent", actorId: reviewFixture.admin }),
    /required business action/,
  );
  const cancelled = await transitionQuoteStage({
    quoteId: fixture.quote,
    toStage: "cancelled",
    actorId: fixture.admin,
    reason: "Duplicate request",
  });
  assert.equal(cancelled.workflowStatus, "cancelled");
  const history = await db.select().from(quoteStatusHistory).where(eq(quoteStatusHistory.quoteId, fixture.quote));
  assert.equal(history.at(-1)?.note, "Duplicate request");
});