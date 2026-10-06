import { db } from "../db";
import {
  assignmentReservations, assignmentVehicles, dispatchAssignments, partnerVehicles, truckTypes,
  partnerCrews, crewAvailabilityWindows, crewAssignmentReservations, assignmentCrews,
  quotes, vehicleAvailabilityWindows, quoteActivityLog, quoteStatusHistory, DISPATCH_STATUS, DISPATCH_ASSIGNMENT_STATUS,
  RESERVATION_STATUS, operationalServices, serviceCollections, serviceCollectionEvents, serviceTimelineEvents, COLLECTION_STATUS,
} from "@shared/schema";
import { and, eq, inArray, lt, gt, lte, gte, sql } from "drizzle-orm";

export class DispatchError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const ensureWindow = (start: Date, end: Date) => {
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) ||
      isNaN(end.getTime()) || start >= end) throw new DispatchError("Invalid half-open time window");
};

/** Creates an assignment and tentative reservations atomically. */
export async function proposeAssignment(input: {
  quoteId: string; moverProfileId: string; vehicleIds: string[]; crewIds?: string[];
  startsAt: Date; endsAt: Date; actorId: string;
}) {
  ensureWindow(input.startsAt, input.endsAt);
  if (!input.vehicleIds.length || new Set(input.vehicleIds).size !== input.vehicleIds.length) {
    throw new DispatchError("At least one distinct vehicle is required");
  }
  return db.transaction(async (tx) => {
    // Serialize all proposals for a quote, even when admins select disjoint fleets.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new DispatchError("Quote not found", 404);
    if (quote.workflowMode !== "dispatch") throw new DispatchError("Quote belongs to the legacy bidding workflow", 409);
    if (quote.priceClientResponse !== "accepted") throw new DispatchError("Client price acceptance is required before dispatch", 409);
    if (!["accepted_pending_booking_payment", DISPATCH_STATUS.DISPATCH_PLANNING, DISPATCH_STATUS.SOLICITED].includes(quote.workflowStatus as any)) throw new DispatchError("Quote is not ready for assignment", 409);
    const vehicles = await tx.select({ vehicle: partnerVehicles, truckType: truckTypes }).from(partnerVehicles)
      .leftJoin(truckTypes, eq(partnerVehicles.truckTypeId, truckTypes.id))
      .where(inArray(partnerVehicles.id, input.vehicleIds));
    if (vehicles.length !== input.vehicleIds.length || vehicles.some(v => !v.vehicle.isActive)) {
      throw new DispatchError("One or more vehicles are unavailable");
    }
    if (vehicles.some(v => v.vehicle.moverProfileId !== input.moverProfileId)) {
      throw new DispatchError("All vehicles must belong to the selected partner");
    }
    const requiredWeight = Number(quote.requiredVehicleWeightKg || 0);
    const requiredVolume = Number(quote.requiredVehicleVolumeM3 || 0);
    const availableWeight = vehicles.reduce((sum, row) => sum + Number(row.truckType?.capacityKg || 0), 0);
    const availableVolume = vehicles.reduce((sum, row) => sum + Number(row.truckType?.capacityM3 || 0), 0);
    if ((requiredWeight > 0 || requiredVolume > 0) && vehicles.some(v => !v.truckType)) {
      throw new DispatchError("Every selected vehicle must use a canonical truck type", 409);
    }
    if (requiredWeight > availableWeight || requiredVolume > availableVolume) {
      throw new DispatchError("Selected vehicles do not satisfy the quote capacity requirements", 409);
    }
    const crewIds = input.crewIds || [];
    if (quote.requiredCrewCount && crewIds.length < quote.requiredCrewCount) {
      throw new DispatchError("The selected crews do not satisfy the quote crew requirement", 409);
    }
    if (crewIds.length) {
      const crews = await tx.select().from(partnerCrews).where(inArray(partnerCrews.id, crewIds));
      if (crews.length !== crewIds.length || crews.some(c => !c.isActive || c.moverProfileId !== input.moverProfileId)) {
        throw new DispatchError("One or more crews are unavailable");
      }
      const crewAvailability = await tx.select({ crewId: crewAvailabilityWindows.crewId }).from(crewAvailabilityWindows)
        .where(and(inArray(crewAvailabilityWindows.crewId, crewIds), eq(crewAvailabilityWindows.isAvailable, true),
          lte(crewAvailabilityWindows.startsAt, input.startsAt), gte(crewAvailabilityWindows.endsAt, input.endsAt)));
      if (new Set(crewAvailability.map(row => row.crewId)).size !== crewIds.length) {
        throw new DispatchError("Crews are not available for the complete window");
      }
      // Serialize proposals touching the same crew before checking overlaps.
      // Sort IDs so multi-crew proposals acquire locks consistently.
      for (const id of [...crewIds].sort()) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      }
      const crewOverlaps = await tx.select({ id: crewAssignmentReservations.id }).from(crewAssignmentReservations)
        .where(and(inArray(crewAssignmentReservations.crewId, crewIds),
          inArray(crewAssignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED]),
          lt(crewAssignmentReservations.startsAt, input.endsAt), gt(crewAssignmentReservations.endsAt, input.startsAt))).limit(1);
      if (crewOverlaps.length) throw new DispatchError("A selected crew is already reserved for this window");
    }
    // Advisory locks are transaction scoped and sorted to avoid deadlocks.
    for (const id of [...input.vehicleIds].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    }
    const overlaps = await tx.select({ id: assignmentReservations.id })
      .from(assignmentReservations)
      .where(and(inArray(assignmentReservations.vehicleId, input.vehicleIds),
        inArray(assignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED]),
        lt(assignmentReservations.startsAt, input.endsAt), gt(assignmentReservations.endsAt, input.startsAt)))
      .limit(1);
    if (overlaps.length) throw new DispatchError("A selected vehicle is already reserved for this window");
    const availability = await tx.select({ vehicleId: vehicleAvailabilityWindows.vehicleId })
      .from(vehicleAvailabilityWindows)
      .where(and(inArray(vehicleAvailabilityWindows.vehicleId, input.vehicleIds),
        eq(vehicleAvailabilityWindows.isAvailable, true),
        lte(vehicleAvailabilityWindows.startsAt, input.startsAt),
        gte(vehicleAvailabilityWindows.endsAt, input.endsAt)));
    if (new Set(availability.map(row => row.vehicleId)).size !== input.vehicleIds.length) {
      throw new DispatchError("Vehicles are not available for the complete window");
    }
    const [assignment] = await tx.insert(dispatchAssignments).values({
      quoteId: input.quoteId, moverProfileId: input.moverProfileId,
      startsAt: input.startsAt, endsAt: input.endsAt, proposedBy: input.actorId,
      status: DISPATCH_ASSIGNMENT_STATUS.PROPOSED,
      crewCountRequired: quote.requiredCrewCount,
      vehicleWeightRequiredKg: quote.requiredVehicleWeightKg,
      vehicleVolumeRequiredM3: quote.requiredVehicleVolumeM3,
      vehicleTypeSnapshot: vehicles.map(row => ({ vehicleId: row.vehicle.id, name: row.vehicle.name, truckTypeId: row.truckType?.id || null, nameEs: row.truckType?.nameEs || null, capacityKg: row.truckType?.capacityKg || null, capacityM3: row.truckType?.capacityM3 || null })),
      crewSnapshot: crewIds.length ? crewIds : null,
    }).returning();
    await tx.insert(assignmentVehicles).values(input.vehicleIds.map(vehicleId => ({ assignmentId: assignment.id, vehicleId })));
    if (crewIds.length) {
      await tx.insert(assignmentCrews).values(crewIds.map(crewId => ({ assignmentId: assignment.id, crewId })));
      await tx.insert(crewAssignmentReservations).values(crewIds.map(crewId => ({
        assignmentId: assignment.id, crewId, startsAt: input.startsAt, endsAt: input.endsAt,
        status: RESERVATION_STATUS.TENTATIVE,
      })));
    }
    await tx.insert(assignmentReservations).values(input.vehicleIds.map(vehicleId => ({
      assignmentId: assignment.id, vehicleId, startsAt: input.startsAt, endsAt: input.endsAt,
      status: RESERVATION_STATUS.TENTATIVE,
    })));
    await tx.update(quotes).set({ workflowStatus: "accepted_pending_booking_payment", updatedAt: new Date() }).where(eq(quotes.id, input.quoteId));
    await tx.insert(quoteActivityLog).values({ quoteId: input.quoteId, actionType: "dispatch.assignment_proposed", actorType: "admin", actorId: input.actorId, description: "Dispatch assignment proposed", metadata: { assignmentId: assignment.id, vehicleIds: input.vehicleIds } });
    await tx.update(operationalServices).set({ assignmentId: assignment.id, updatedAt: new Date() }).where(and(eq(operationalServices.quoteId, input.quoteId), sql`${operationalServices.assignmentId} IS NULL`));
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, input.quoteId) });
    if (service) {
      const collection = await tx.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, service.id) });
      if (collection && [COLLECTION_STATUS.CANCELLED, COLLECTION_STATUS.REJECTED, COLLECTION_STATUS.EXPIRED, COLLECTION_STATUS.FAILED, COLLECTION_STATUS.REFUNDED].includes(collection.status as any)) {
        await tx.update(serviceCollections).set({ status: COLLECTION_STATUS.PENDING, rejectedAt: null, expiredAt: null, refundedAt: null, updatedAt: new Date(), actorId: input.actorId }).where(eq(serviceCollections.id, collection.id));
        await tx.insert(serviceCollectionEvents).values({ collectionId: collection.id, fromStatus: collection.status, toStatus: COLLECTION_STATUS.PENDING, actorId: input.actorId, notes: "Retry after replacement assignment" });
        await tx.update(operationalServices).set({ stage: "confirmed", exceptionReason: null, updatedAt: new Date() }).where(eq(operationalServices.id, service.id));
      }
    }
    return assignment;
  });
}

export async function releaseAssignment(assignmentId: string, status: string = DISPATCH_ASSIGNMENT_STATUS.CANCELLED) {
  return db.transaction(async tx => {
    const [assignment] = await tx.update(dispatchAssignments)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(dispatchAssignments.id, assignmentId),
        eq(dispatchAssignments.status, DISPATCH_ASSIGNMENT_STATUS.PROPOSED),
      )).returning();
    if (!assignment) throw new DispatchError("Only a pending assignment can be cancelled", 409);
    await tx.update(assignmentReservations).set({ status: RESERVATION_STATUS.RELEASED, releasedAt: new Date() })
      .where(and(eq(assignmentReservations.assignmentId, assignmentId),
        inArray(assignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED])));
    await tx.update(crewAssignmentReservations).set({ status: RESERVATION_STATUS.RELEASED, releasedAt: new Date() })
      .where(and(eq(crewAssignmentReservations.assignmentId, assignmentId),
        inArray(crewAssignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED])));
    const linkedService = await tx.query.operationalServices.findFirst({ where: and(eq(operationalServices.quoteId, assignment.quoteId), eq(operationalServices.assignmentId, assignmentId)) });
    if (linkedService) {
      await tx.update(operationalServices).set({ assignmentId: null, updatedAt: new Date() }).where(eq(operationalServices.id, linkedService.id));
      await tx.insert(serviceTimelineEvents).values({ serviceId: linkedService.id, type: "assignment.released", note: "Admin cancelled assignment", metadata: { assignmentId } });
    }
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, assignment.quoteId) });
    if (quote && quote.workflowMode === "dispatch" && ![DISPATCH_STATUS.COMPLETED, DISPATCH_STATUS.CANCELLED].includes(quote.workflowStatus as any)) {
      await tx.update(quotes).set({ workflowStatus: "accepted_pending_booking_payment", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
    }
    await tx.insert(quoteActivityLog).values({ quoteId: assignment.quoteId, actionType: "dispatch.assignment_released", actorType: "admin", description: "Dispatch assignment released", metadata: { assignmentId, status } });
    return assignment;
  });
}

export async function respondToAssignment(input: { assignmentId: string; moverProfileId: string; response: "accepted" | "declined"; note?: string; actorId: string; companyId?: string; membershipId?: string }) {
  return db.transaction(async tx => {
    const [assignment] = await tx.update(dispatchAssignments).set({
      status: input.response === "accepted" ? DISPATCH_ASSIGNMENT_STATUS.ACCEPTED : DISPATCH_ASSIGNMENT_STATUS.DECLINED,
      responseNote: input.note || null, respondedAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(dispatchAssignments.id, input.assignmentId), eq(dispatchAssignments.moverProfileId, input.moverProfileId), eq(dispatchAssignments.status, DISPATCH_ASSIGNMENT_STATUS.PROPOSED))).returning();
    if (!assignment) throw new DispatchError("Assignment is no longer awaiting a response", 409);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, assignment.quoteId) });
    if (!quote) throw new DispatchError("Quote not found", 404);
    if (quote.workflowMode !== "dispatch" ||
        !["accepted_pending_booking_payment", DISPATCH_STATUS.ASSIGNMENT_PENDING_PARTNER].includes(quote.workflowStatus as any) ||
        quote.priceClientResponse !== "accepted") {
      throw new DispatchError("The quote is no longer awaiting this assignment response", 409);
    }
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, assignment.quoteId) });
    const collection = service ? await tx.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, service.id) }) : undefined;
    const paymentConfirmed = !!collection && [COLLECTION_STATUS.VERIFIED, COLLECTION_STATUS.WAIVED, COLLECTION_STATUS.DEFERRED].includes(collection.status as any);
    await tx.update(assignmentReservations).set({
      status: input.response === "accepted" ? (paymentConfirmed ? RESERVATION_STATUS.CONFIRMED : RESERVATION_STATUS.TENTATIVE) : RESERVATION_STATUS.RELEASED,
      releasedAt: input.response === "declined" ? new Date() : null,
    }).where(and(eq(assignmentReservations.assignmentId, assignment.id), eq(assignmentReservations.status, RESERVATION_STATUS.TENTATIVE)));
    await tx.update(crewAssignmentReservations).set({
      status: input.response === "accepted" ? (paymentConfirmed ? RESERVATION_STATUS.CONFIRMED : RESERVATION_STATUS.TENTATIVE) : RESERVATION_STATUS.RELEASED,
      releasedAt: input.response === "declined" ? new Date() : null,
    }).where(and(eq(crewAssignmentReservations.assignmentId, assignment.id), eq(crewAssignmentReservations.status, RESERVATION_STATUS.TENTATIVE)));
    if (input.response === "accepted") {
      await tx.update(quotes).set({
        assignedMoverProfileId: assignment.moverProfileId, finalPrice: quote.priceProposalAmount,
        clientConfirmedAt: quote.priceClientRespondedAt || new Date(), partnerFinalizedAt: new Date(),
        workflowStatus: paymentConfirmed ? "closed_won" : "accepted_pending_booking_payment", updatedAt: new Date(),
      }).where(eq(quotes.id, quote.id));
      if (paymentConfirmed && quote.workflowStatus !== "closed_won") {
        await tx.insert(quoteStatusHistory).values({
          quoteId: quote.id,
          fromStatus: quote.workflowStatus,
          toStatus: "closed_won",
          actorType: "mover",
          actorId: input.actorId,
          note: `Booking accepted with collection ${collection!.status}`,
        });
      }
    } else if (![DISPATCH_STATUS.CONFIRMED, DISPATCH_STATUS.COMPLETED].includes(quote.workflowStatus as any)) {
      await tx.update(quotes).set({ workflowStatus: "accepted_pending_booking_payment", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
    }
    if (input.response === "accepted" && !paymentConfirmed) {
      await tx.update(quotes).set({ workflowStatus: "accepted_pending_booking_payment", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
    }
    if (input.response === "declined") {
      const linkedService = await tx.query.operationalServices.findFirst({ where: and(eq(operationalServices.quoteId, assignment.quoteId), eq(operationalServices.assignmentId, assignment.id)) });
      if (linkedService) {
        await tx.update(operationalServices).set({ assignmentId: null, updatedAt: new Date() }).where(eq(operationalServices.id, linkedService.id));
        await tx.insert(serviceTimelineEvents).values({ serviceId: linkedService.id, type: "assignment.declined", note: input.note || "Partner declined assignment", metadata: { assignmentId: assignment.id } });
      }
    }
     await tx.insert(quoteActivityLog).values({ quoteId: assignment.quoteId, actionType: "dispatch.assignment_responded", actorType: "mover", actorId: input.actorId, description: `Partner ${input.response} dispatch assignment`, metadata: { assignmentId: assignment.id, companyId: input.companyId || null, membershipId: input.membershipId || null } });
    return assignment;
  });
}