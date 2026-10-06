import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  assignmentReservations,
  dispatchAssignments,
  moverProfiles,
  partnerVehicles,
  quoteActivityLog,
  quotes,
  users,
  vehicleAvailabilityWindows,
  truckTypes,
  partnerCrews,
  crewAvailabilityWindows,
  assignmentCrews,
  crewAssignmentReservations,
} from "@shared/schema";
import { proposeAssignment, respondToAssignment } from "./dispatchService";
import { toPartnerSafeQuote } from "./dispatchDtos";

test("partner quote projection excludes client and internal fields", () => {
  const safe = toPartnerSafeQuote({
    id: "quote-id",
    quoteNumber: "Q-1",
    fromAddress: "Origin",
    toAddress: "Destination",
    priceProposalAmount: "2500.00",
    priceProposalCurrency: "MXN",
    contactName: "Private client",
    contactEmail: "private@example.test",
    contactPhone: "555-0100",
    quoteSessionId: "private-session",
    adminNotes: "internal-only",
    utmSource: "internal-attribution",
    referrerUrl: "https://private.example.test",
    estimatedCost: "1000.00",
  });
  assert.equal(safe.fromAddress, "Origin");
  for (const sensitive of [
    "contactName",
    "contactEmail",
    "contactPhone",
    "quoteSessionId",
    "adminNotes",
    "utmSource",
    "referrerUrl",
    "estimatedCost",
  ]) {
    assert.equal(sensitive in safe, false);
  }
});

test("dispatch lifecycle reserves, rejects overlap, releases, and confirms multiple vans", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];

  try {
    const [admin, client, mover] = await db.insert(users).values([
      { email: `dispatch-admin-${suffix}@example.test`, userType: "admin" },
      { email: `dispatch-client-${suffix}@example.test`, userType: "client" },
      { email: `dispatch-mover-${suffix}@example.test`, userType: "mover" },
    ]).returning();
    userIds.push(admin.id, client.id, mover.id);

    const [partner] = await db.insert(moverProfiles).values({
      userId: mover.id,
      companyName: `Dispatch test partner ${suffix}`,
      partnerStatus: "active",
    }).returning();
    const vehicles = await db.insert(partnerVehicles).values([
      { moverProfileId: partner.id, name: "Test van A" },
      { moverProfileId: partner.id, name: "Test van B" },
    ]).returning();

    const startsAt = new Date("2035-02-01T08:00:00.000Z");
    const endsAt = new Date("2035-02-01T13:00:00.000Z");
    await db.insert(vehicleAvailabilityWindows).values(vehicles.map(vehicle => ({
      vehicleId: vehicle.id,
      startsAt,
      endsAt: new Date("2035-02-01T18:00:00.000Z"),
      label: "integration-test",
    })));

    const createdQuotes = await db.insert(quotes).values([1, 2, 3].map(index => ({
      userId: client.id,
      fromAddress: `Origin ${index}`,
      toAddress: `Destination ${index}`,
      homeSize: "medium",
      workflowMode: "dispatch",
      workflowStatus: "dispatch_planning",
        serviceMode: "general_point_to_point",
      priceProposalAmount: "2500.00",
      priceClientResponse: "accepted",
      priceClientRespondedAt: new Date(),
    }))).returning();
    quoteIds.push(...createdQuotes.map(quote => quote.id));

    const first = await proposeAssignment({
      quoteId: createdQuotes[0].id,
      moverProfileId: partner.id,
      vehicleIds: vehicles.map(vehicle => vehicle.id),
      startsAt,
      endsAt,
      actorId: admin.id,
    });

    await assert.rejects(
      proposeAssignment({
        quoteId: createdQuotes[1].id,
        moverProfileId: partner.id,
        vehicleIds: [vehicles[0].id],
        startsAt,
        endsAt,
        actorId: admin.id,
      }),
      /already reserved/,
    );

    await assert.rejects(
      respondToAssignment({
        assignmentId: first.id,
        moverProfileId: "not-the-owner",
        response: "accepted",
        actorId: mover.id,
      }),
      /no longer awaiting/,
    );

    await respondToAssignment({
      assignmentId: first.id,
      moverProfileId: partner.id,
      response: "declined",
      note: "Test decline",
      actorId: mover.id,
    });
    const released = await db.select().from(assignmentReservations)
      .where(eq(assignmentReservations.assignmentId, first.id));
    assert.equal(released.length, 2);
    assert.ok(released.every(reservation => reservation.status === "released"));

    const replacement = await proposeAssignment({
      quoteId: createdQuotes[1].id,
      moverProfileId: partner.id,
      vehicleIds: [vehicles[0].id],
      startsAt,
      endsAt,
      actorId: admin.id,
    });
    await respondToAssignment({
      assignmentId: replacement.id,
      moverProfileId: partner.id,
      response: "accepted",
      actorId: mover.id,
    });
    const [confirmed] = await db.select().from(quotes).where(eq(quotes.id, createdQuotes[1].id));
    // Partner acceptance alone is not commercial confirmation. Without a
    // verified, waived, or deferred collection, the payment gate remains open.
    assert.equal(confirmed.workflowStatus, "assignment_pending_partner");
    assert.notEqual(confirmed.status, "confirmed");
    assert.equal(confirmed.assignedMoverProfileId, partner.id);

    // Half-open ranges allow a second assignment to begin exactly when one ends.
    const adjacent = await proposeAssignment({
      quoteId: createdQuotes[2].id,
      moverProfileId: partner.id,
      vehicleIds: [vehicles[0].id],
      startsAt: endsAt,
      endsAt: new Date("2035-02-01T18:00:00.000Z"),
      actorId: admin.id,
    });
    assert.equal(adjacent.status, "proposed");

    // A stale assignment must not be accepted after the quote leaves the
    // accepted-price / pending-partner state.
    await db.update(quotes).set({
      workflowStatus: "price_awaiting_client",
      priceClientResponse: null,
    }).where(eq(quotes.id, createdQuotes[2].id));
    await assert.rejects(
      respondToAssignment({
        assignmentId: adjacent.id,
        moverProfileId: partner.id,
        response: "accepted",
        actorId: mover.id,
      }),
      /no longer awaiting this assignment response/,
    );
    const [stillProposed] = await db.select().from(dispatchAssignments)
      .where(eq(dispatchAssignments.id, adjacent.id));
    assert.equal(stillProposed.status, "proposed");
  } finally {
    if (quoteIds.length) {
      await db.delete(quoteActivityLog).where(inArray(quoteActivityLog.quoteId, quoteIds));
      await db.delete(quotes).where(inArray(quotes.id, quoteIds));
    }
    if (userIds.length) {
      const ownedPartners = await db.select({ id: moverProfiles.id })
        .from(moverProfiles)
        .where(inArray(moverProfiles.userId, userIds));
      if (ownedPartners.length) {
        await db.delete(moverProfiles).where(inArray(moverProfiles.id, ownedPartners.map(row => row.id)));
      }
      await db.delete(users).where(inArray(users.id, userIds));
    }
  }
});

test("dispatch rejects insufficient canonical capacity and snapshots the selected type", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];
  let partnerId: string | undefined;
  try {
    const [admin, client, mover] = await db.insert(users).values([
      { email: `capacity-admin-${suffix}@example.test`, userType: "admin" },
      { email: `capacity-client-${suffix}@example.test`, userType: "client" },
      { email: `capacity-mover-${suffix}@example.test`, userType: "mover" },
    ]).returning();
    userIds.push(admin.id, client.id, mover.id);
    const [type] = await db.select().from(truckTypes).where(eq(truckTypes.isActive, true)).limit(1);
    assert.ok(type, "seeded canonical truck type required");
    const [partner] = await db.insert(moverProfiles).values({ userId: mover.id, companyName: `Capacity partner ${suffix}`, partnerStatus: "active", onboardingComplete: true }).returning();
    partnerId = partner.id;
    const [vehicle] = await db.insert(partnerVehicles).values({ moverProfileId: partner.id, name: "Canonical truck", truckTypeId: type.id }).returning();
    const [quote] = await db.insert(quotes).values({
      userId: client.id, fromAddress: "Origin", toAddress: "Destination", homeSize: "medium",
      workflowMode: "dispatch", workflowStatus: "dispatch_planning", serviceMode: "general_point_to_point",
      priceProposalAmount: "2500.00", priceClientResponse: "accepted",
      requiredVehicleWeightKg: type.capacityKg + 1,
    }).returning();
    quoteIds.push(quote.id);
    const startsAt = new Date("2036-02-01T08:00:00.000Z");
    const endsAt = new Date("2036-02-01T12:00:00.000Z");
    await db.insert(vehicleAvailabilityWindows).values({ vehicleId: vehicle.id, startsAt, endsAt });
    await assert.rejects(() => proposeAssignment({ quoteId: quote.id, moverProfileId: partner.id, vehicleIds: [vehicle.id], startsAt, endsAt, actorId: admin.id }), /capacity requirements/);
    await db.update(quotes).set({ requiredVehicleWeightKg: type.capacityKg }).where(eq(quotes.id, quote.id));
    const assignment = await proposeAssignment({ quoteId: quote.id, moverProfileId: partner.id, vehicleIds: [vehicle.id], startsAt, endsAt, actorId: admin.id });
    assert.equal((assignment.vehicleTypeSnapshot as any[])[0].truckTypeId, type.id);
    assert.equal((assignment.vehicleTypeSnapshot as any[])[0].capacityKg, type.capacityKg);
  } finally {
    if (quoteIds.length) await db.delete(quoteActivityLog).where(inArray(quoteActivityLog.quoteId, quoteIds));
    if (quoteIds.length) await db.delete(quotes).where(inArray(quotes.id, quoteIds));
    if (partnerId) await db.delete(moverProfiles).where(eq(moverProfiles.id, partnerId));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  }
});

test("dispatch keeps crew resources separate and prevents cross-company or overlapping reservations", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];
  const partnerIds: string[] = [];
  try {
    const [admin, client, moverA, moverB] = await db.insert(users).values([
      { email: `crew-admin-${suffix}@example.test`, userType: "admin" },
      { email: `crew-client-${suffix}@example.test`, userType: "client" },
      { email: `crew-a-${suffix}@example.test`, userType: "mover" },
      { email: `crew-b-${suffix}@example.test`, userType: "mover" },
    ]).returning();
    userIds.push(admin.id, client.id, moverA.id, moverB.id);
    const partners = await db.insert(moverProfiles).values([
      { userId: moverA.id, companyName: `Crew A ${suffix}`, partnerStatus: "active", onboardingComplete: true },
      { userId: moverB.id, companyName: `Crew B ${suffix}`, partnerStatus: "active", onboardingComplete: true },
    ]).returning();
    partnerIds.push(...partners.map(p => p.id));
    const crews = await db.insert(partnerCrews).values([
      { moverProfileId: partners[0].id, name: "Crew A" },
      { moverProfileId: partners[1].id, name: "Crew B" },
    ]).returning();
    const [vehicleType] = await db.select().from(truckTypes).where(eq(truckTypes.isActive, true)).limit(1);
    assert.ok(vehicleType);
    const [vehicle] = await db.insert(partnerVehicles).values({ moverProfileId: partners[0].id, name: "Crew truck", truckTypeId: vehicleType.id }).returning();
    const startsAt = new Date("2037-02-01T08:00:00.000Z");
    const endsAt = new Date("2037-02-01T12:00:00.000Z");
    await db.insert(vehicleAvailabilityWindows).values({ vehicleId: vehicle.id, startsAt, endsAt });
    await db.insert(crewAvailabilityWindows).values(crews.map(crew => ({ crewId: crew.id, startsAt, endsAt })));
    const createdQuotes = await db.insert(quotes).values([1, 2].map(index => ({
      userId: client.id, fromAddress: `Origin ${index}`, toAddress: `Destination ${index}`, homeSize: "medium",
      workflowMode: "dispatch", workflowStatus: "dispatch_planning", serviceMode: "general_point_to_point",
      priceProposalAmount: "2500.00", priceClientResponse: "accepted", requiredCrewCount: 1,
    }))).returning();
    quoteIds.push(...createdQuotes.map(q => q.id));
    const first = await proposeAssignment({ quoteId: createdQuotes[0].id, moverProfileId: partners[0].id, vehicleIds: [vehicle.id], crewIds: [crews[0].id], startsAt, endsAt, actorId: admin.id });
    assert.equal((await db.select().from(assignmentCrews).where(eq(assignmentCrews.assignmentId, first.id))).length, 1);
    await assert.rejects(() => proposeAssignment({ quoteId: createdQuotes[1].id, moverProfileId: partners[0].id, vehicleIds: [vehicle.id], crewIds: [crews[1].id], startsAt, endsAt, actorId: admin.id }), /belong to the selected partner|already reserved|unavailable/);
  } finally {
    if (quoteIds.length) await db.delete(quoteActivityLog).where(inArray(quoteActivityLog.quoteId, quoteIds));
    if (quoteIds.length) await db.delete(quotes).where(inArray(quotes.id, quoteIds));
    if (partnerIds.length) await db.delete(moverProfiles).where(inArray(moverProfiles.id, partnerIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  }
});

test("concurrent proposals for one crew serialize even across different vehicles", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];
  let partnerId: string | undefined;
  try {
    const [admin, client, mover] = await db.insert(users).values([
      { email: `crew-race-admin-${suffix}@example.test`, userType: "admin" },
      { email: `crew-race-client-${suffix}@example.test`, userType: "client" },
      { email: `crew-race-mover-${suffix}@example.test`, userType: "mover" },
    ]).returning();
    userIds.push(admin.id, client.id, mover.id);
    const [partner] = await db.insert(moverProfiles).values({
      userId: mover.id, companyName: `Crew race ${suffix}`, partnerStatus: "active", onboardingComplete: true,
    }).returning();
    partnerId = partner.id;
    const [crew] = await db.insert(partnerCrews).values({ moverProfileId: partner.id, name: "Shared crew" }).returning();
    const [truckType] = await db.select().from(truckTypes).where(eq(truckTypes.isActive, true)).limit(1);
    assert.ok(truckType);
    const vehicles = await db.insert(partnerVehicles).values([
      { moverProfileId: partner.id, name: "Race van A", truckTypeId: truckType.id },
      { moverProfileId: partner.id, name: "Race van B", truckTypeId: truckType.id },
    ]).returning();
    const startsAt = new Date("2038-02-01T08:00:00.000Z");
    const endsAt = new Date("2038-02-01T12:00:00.000Z");
    await db.insert(vehicleAvailabilityWindows).values(vehicles.map(vehicle => ({ vehicleId: vehicle.id, startsAt, endsAt })));
    await db.insert(crewAvailabilityWindows).values({ crewId: crew.id, startsAt, endsAt });
    const createdQuotes = await db.insert(quotes).values([1, 2].map(index => ({
      userId: client.id, fromAddress: `Race origin ${index}`, toAddress: `Race destination ${index}`,
      homeSize: "medium", workflowMode: "dispatch", workflowStatus: "dispatch_planning",
      serviceMode: "general_point_to_point", priceProposalAmount: "2500.00",
      priceClientResponse: "accepted", requiredCrewCount: 1,
    }))).returning();
    quoteIds.push(...createdQuotes.map(quote => quote.id));

    const results = await Promise.allSettled(vehicles.map((vehicle, index) => proposeAssignment({
      quoteId: createdQuotes[index].id, moverProfileId: partner.id, vehicleIds: [vehicle.id],
      crewIds: [crew.id], startsAt, endsAt, actorId: admin.id,
    })));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    const reservations = await db.select().from(crewAssignmentReservations).where(eq(crewAssignmentReservations.crewId, crew.id));
    assert.equal(reservations.length, 1);
  } finally {
    if (quoteIds.length) await db.delete(quoteActivityLog).where(inArray(quoteActivityLog.quoteId, quoteIds));
    if (quoteIds.length) await db.delete(quotes).where(inArray(quotes.id, quoteIds));
    if (partnerId) await db.delete(moverProfiles).where(eq(moverProfiles.id, partnerId));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  }
});