import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  assignmentReservations, crewAssignmentReservations, quotes, dispatchAssignments,
  users, assignmentVehicles, partnerVehicles, moverProfiles,
  operationalServices, quoteOfferRevisions, quoteCustomerDecisions, serviceCollections,
  serviceCollectionEvents, serviceChecklistItems, serviceTimelineEvents,
  serviceFeedbackRequests, quoteActivityLog, quoteStatusHistory, COLLECTION_STATUS, RESERVATION_STATUS, SERVICE_CHECKLIST_KEYS,
  SERVICE_STAGE, ratings, inventoryItems,
} from "@shared/schema";
import {
  canTransitionServiceStage,
  canTransitionQuoteStage,
  isQuoteStage,
  normalizeQuoteStage,
  normalizeServiceStage,
  QUOTE_STAGE,
  SERVICE_STAGE_V2,
  type QuoteStage,
} from "@shared/workflowStages";

export class ServiceOperationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function canTransitionService(fromStage: string, toStage: string) {
  return canTransitionServiceStage(fromStage, toStage);
}

const terminalQuoteStages = new Set<string>([
  QUOTE_STAGE.CLOSED_LOST,
  QUOTE_STAGE.CANCELLED,
  QUOTE_STAGE.EXPIRED,
]);

const toSnapshot = (quote: any) => ({
  quoteId: quote.id, quoteNumber: quote.quoteNumber, customerId: quote.userId,
  companyId: quote.companyId, contact: { name: quote.contactName, email: quote.contactEmail, phone: quote.contactPhone },
  addresses: { from: quote.fromAddress, to: quote.toAddress }, moveDate: quote.moveDate,
  preferredMoveDates: quote.preferredMoveDates, blockedMoveDates: quote.blockedMoveDates,
  homeSize: quote.homeSize, storageOption: quote.storageOption, clientNotes: quote.clientNotes,
  price: { amount: quote.finalPrice || quote.priceProposalAmount || quote.suggestedPrice || quote.estimatedCost, currency: quote.priceProposalCurrency || quote.estimatedCurrency || "MXN" },
  capacity: { weightKg: quote.requiredVehicleWeightKg, volumeM3: quote.requiredVehicleVolumeM3, crewCount: quote.requiredCrewCount },
  services: quote.quoteServices || [], addOns: quote.quoteAddOns || [],
});

export async function linkAssignmentToService(quoteId: string, assignmentId: string) {
  return db.update(operationalServices).set({ assignmentId, updatedAt: new Date() }).where(and(eq(operationalServices.quoteId, quoteId), isNull(operationalServices.assignmentId))).returning().then(rows => rows[0]);
}

async function logTimeline(tx: any, serviceId: string, actorId: string | null, type: string, fields: Record<string, unknown> = {}) {
  await tx.insert(serviceTimelineEvents).values({ serviceId, actorId, type, ...fields });
}

async function ensureAcceptedServiceTx(tx: any, quote: any, actorId: string | null) {
  const existing = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
  const assignment = await tx.query.dispatchAssignments.findFirst({
    where: and(eq(dispatchAssignments.quoteId, quote.id), inArray(dispatchAssignments.status, ["accepted", "proposed"])),
  });
  if (existing) {
    if (assignment && !existing.assignmentId) {
      const [linked] = await tx.update(operationalServices)
        .set({ assignmentId: assignment.id, updatedAt: new Date() })
        .where(eq(operationalServices.id, existing.id))
        .returning();
      return linked || existing;
    }
    return existing;
  }
  const price = quote.finalPrice || quote.priceProposalAmount || quote.suggestedPrice || quote.estimatedCost;
  if (!price) throw new ServiceOperationError("An accepted quote must have a final price", 409);
  const [latestOffer] = await tx.select().from(quoteOfferRevisions)
    .where(eq(quoteOfferRevisions.quoteId, quote.id))
    .orderBy(desc(quoteOfferRevisions.version))
    .limit(1);
  const [service] = await tx.insert(operationalServices).values({
    quoteId: quote.id,
    assignmentId: assignment?.id || null,
    customerId: quote.userId,
    companyId: quote.companyId,
    stage: SERVICE_STAGE_V2.CONFIRMED,
    snapshot: toSnapshot(quote),
  }).onConflictDoNothing({ target: operationalServices.quoteId }).returning();
  const row = service || await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
  if (!row) throw new ServiceOperationError("Accepted quote booking could not be created", 500);
  const amount = Number(price);
  await tx.insert(serviceCollections).values({
    serviceId: row.id,
    method: "manual",
    status: amount > 0 ? COLLECTION_STATUS.PENDING : COLLECTION_STATUS.WAIVED,
    amount: String(amount),
    currency: quote.priceProposalCurrency || quote.estimatedCurrency || "MXN",
    deadline: latestOffer?.deadline || null,
    notes: latestOffer?.paymentTerms || null,
  }).onConflictDoNothing({ target: serviceCollections.serviceId });
  await tx.insert(serviceChecklistItems).values(SERVICE_CHECKLIST_KEYS.map(key => ({
    serviceId: row.id, key, required: true,
  }))).onConflictDoNothing();
  await logTimeline(tx, row.id, actorId, "service.booking_created", {
    toStage: row.stage,
    metadata: { quoteId: quote.id, commercialStage: QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT },
  });
  if (amount <= 0) await confirmCollectionTx(tx, row.id, actorId, COLLECTION_STATUS.WAIVED);
  return row;
}

export async function handoffAcceptedQuote(quoteId: string, actorId: string | null = null) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    if (normalizeQuoteStage(quote.workflowStatus) !== QUOTE_STAGE.CLOSED_WON) {
      throw new ServiceOperationError("The quote must be closed won after booking and payment before service handoff", 409);
    }
    return ensureAcceptedServiceTx(tx, quote, actorId);
  });
}

export async function transitionQuoteStage(input: {
  quoteId: string;
  toStage: string;
  actorId: string | null;
  reason?: string;
  note?: string;
}) {
  const target = input.toStage.trim().toLowerCase();
  if (!isQuoteStage(target)) throw new ServiceOperationError("Unsupported quote stage", 400);
  const reason = input.reason?.trim() || "";
  const note = input.note?.trim() || "";
  if (terminalQuoteStages.has(target) && !reason) {
    throw new ServiceOperationError("A reason is required for terminal quote outcomes", 400);
  }
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    const fromStage = normalizeQuoteStage(quote.workflowStatus);
    if (([QUOTE_STAGE.SENT, QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT, QUOTE_STAGE.CLOSED_WON] as QuoteStage[]).includes(target)) {
      throw new ServiceOperationError("This stage is completed by its required business action", 409);
    }
    if (!canTransitionQuoteStage(fromStage, target)) {
      throw new ServiceOperationError(`Cannot transition quote from ${fromStage} to ${target}`, 409);
    }
    const [row] = await tx.update(quotes).set({ workflowStatus: target, updatedAt: new Date() }).where(eq(quotes.id, input.quoteId)).returning();
    await tx.insert(quoteStatusHistory).values({
      quoteId: input.quoteId, fromStatus: fromStage, toStatus: target,
      actorType: "admin", actorId: input.actorId, note: reason || note || null,
    });
    await tx.insert(quoteActivityLog).values({
      quoteId: input.quoteId, actionType: "quote.stage_changed", actorType: "admin", actorId: input.actorId,
      description: `Quote stage changed from ${fromStage} to ${target}`,
      descriptionEs: `Etapa cambiada de ${fromStage} a ${target}`,
      metadata: { fromStage, toStage: target, reason: reason || null, note: note || null },
    });
    return row;
  });
  return updated;
}

export async function reopenQuoteForInventoryRevision(input: {
  quoteId: string;
  expectedReviewVersion: number;
  actorId: string | null;
  actorName?: string | null;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new ServiceOperationError("A revision reason is required", 400);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, input.quoteId) });
    if (service) throw new ServiceOperationError("Quote has an operational service and cannot be revised", 409);
    const fromStage = normalizeQuoteStage(quote.workflowStatus);
    if (!([QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION] as QuoteStage[]).includes(fromStage)) {
      throw new ServiceOperationError(`Quote is ${fromStage} and cannot be reopened for inventory revision`, 409);
    }
    if (quote.quoteReviewVersion !== input.expectedReviewVersion) {
      throw new ServiceOperationError("Quote changed while the revision dialog was open", 409);
    }
    const now = new Date();
    const [updated] = await tx.update(quotes).set({
      workflowStatus: QUOTE_STAGE.UNDER_REVIEW,
      priceProposalAmount: null,
      priceProposalVersion: sql`${quotes.priceProposalVersion} + 1`,
      priceProposalNote: null,
      priceProposedAt: null,
      priceProposedBy: null,
      priceClientResponse: null,
      priceClientChangeRequest: null,
      priceClientRespondedAt: null,
      estimatedCost: null,
      estimatedCostHigh: null,
      suggestedPrice: null,
      requiredVehicleWeightKg: null,
      requiredVehicleVolumeM3: null,
      requiredCrewCount: null,
      quoteReviewVersion: sql`${quotes.quoteReviewVersion} + 1`,
      updatedAt: now,
    }).where(and(
      eq(quotes.id, input.quoteId),
      eq(quotes.quoteReviewVersion, input.expectedReviewVersion),
      inArray(quotes.workflowStatus, [
        QUOTE_STAGE.SENT, "bidding_open", "bidding", "solicited",
        QUOTE_STAGE.AWAITING_DECISION, "price_awaiting_client",
      ]),
    )).returning();
    if (!updated) throw new ServiceOperationError("Quote changed while reopening", 409);
    await tx.insert(quoteStatusHistory).values({
      quoteId: input.quoteId, fromStatus: fromStage, toStatus: QUOTE_STAGE.UNDER_REVIEW,
      actorType: "admin", actorId: input.actorId, note: reason,
    });
    await tx.insert(quoteActivityLog).values({
      quoteId: input.quoteId,
      actionType: "quote.inventory_revision_reopened",
      actorType: "admin",
      actorId: input.actorId,
      actorName: input.actorName || null,
      description: "Admin reopened a sent quote for inventory revision",
      descriptionEs: "Administrador reabrió una cotización enviada para revisar el inventario",
      metadata: {
        fromStage,
        toStage: QUOTE_STAGE.UNDER_REVIEW,
        reason,
        previousOfferVersion: quote.priceProposalVersion,
        estimateInvalidated: true,
        reopenedAt: now.toISOString(),
      },
    });
    return updated;
  });
}

export async function recalculateReviewedQuoteEstimate(input: {
  quoteId: string;
  expectedReviewVersion: number;
  actorId: string | null;
  actorName?: string | null;
}) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
    const stage = normalizeQuoteStage(quote.workflowStatus);
    if (service || stage !== QUOTE_STAGE.UNDER_REVIEW) {
      throw new ServiceOperationError(service ? "Quote has an operational service" : `Quote is ${stage} and cannot be recalculated`, 409);
    }
    if (quote.quoteReviewVersion !== input.expectedReviewVersion) {
      throw new ServiceOperationError("Inventory changed before recalculation started", 409);
    }
    const items = await tx.select().from(inventoryItems).where(eq(inventoryItems.quoteId, quote.id));
    const originCity = quote.fromAddress?.split(",")[1]?.trim() || undefined;
    const originCountry = quote.fromAddress?.includes("México") ? "México" : undefined;
    const pricing = await storage.getResolvedPricing(originCity, originCountry);
    const categories = await storage.getInventoryCategories();
    const categoryWeights = new Map(categories.map(category => [
      category.key,
      Number.parseFloat(category.avgWeightKg?.toString() || "20"),
    ]));
    const totalWeight = items.reduce((sum, item) =>
      sum + (categoryWeights.get(item.category || "other") || 20) * (item.quantity || 1), 0);
    const sortedTrucks = [...pricing.truckPricing].sort((a, b) => a.capacityKg - b.capacityKg);
    const largestTruck = sortedTrucks.at(-1);
    let selectedTruck: typeof sortedTrucks[number] | undefined = sortedTrucks[0];
    let truckCount = 1;
    if (totalWeight <= (largestTruck?.capacityKg || 10000)) {
      selectedTruck = sortedTrucks.find(truck => truck.capacityKg >= totalWeight) || selectedTruck;
    } else {
      selectedTruck = largestTruck;
      truckCount = Math.ceil(totalWeight / (largestTruck?.capacityKg || 10000));
    }
    const baseCost = (selectedTruck?.baseRate || 3000) * truckCount;
    const totalCost = baseCost + (selectedTruck?.baseServiceHours || 4) * (selectedTruck?.hourlyRate || 200);
    const lowEstimate = Math.round(totalCost * 0.9);
    const highEstimate = Math.round(totalCost * 1.3);
    const now = new Date();
    const [updated] = await tx.update(quotes).set({
      estimatedCost: totalCost.toFixed(2),
      estimatedCostHigh: highEstimate.toFixed(2),
      estimatedCurrency: pricing.currency || "MXN",
      updatedAt: now,
    }).where(and(
      eq(quotes.id, quote.id),
      eq(quotes.workflowStatus, quote.workflowStatus!),
      eq(quotes.quoteReviewVersion, input.expectedReviewVersion),
    )).returning();
    if (!updated) throw new ServiceOperationError("Inventory changed during recalculation", 409);
    await tx.insert(quoteActivityLog).values({
      quoteId: quote.id,
      actionType: "quote.estimate_recalculated",
      actorType: "admin",
      actorId: input.actorId,
      actorName: input.actorName || null,
      description: "Quote estimate recalculated from reviewed inventory",
      descriptionEs: "Estimación recalculada con el inventario revisado",
      metadata: {
        reviewVersion: input.expectedReviewVersion,
        estimate: { low: lowEstimate, high: highEstimate, currency: pricing.currency || "MXN" },
        totalWeightKg: totalWeight,
        recalculatedAt: now.toISOString(),
      },
    });
    return {
      quote: updated,
      estimate: { low: lowEstimate, high: highEstimate, currency: pricing.currency || "MXN" },
    };
  });
}

export async function markQuoteOfferDelivered(input: { quoteId: string; actorId: string | null; recipient?: string }) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    const fromStage = normalizeQuoteStage(quote.workflowStatus);
    if (!([QUOTE_STAGE.UNDER_REVIEW, QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION] as QuoteStage[]).includes(fromStage)) {
      throw new ServiceOperationError("The quote cannot be delivered at this stage", 409);
    }
    const [offer] = await tx.select({ id: quoteOfferRevisions.id }).from(quoteOfferRevisions)
      .where(eq(quoteOfferRevisions.quoteId, input.quoteId))
      .orderBy(desc(quoteOfferRevisions.version))
      .limit(1);
    if (!offer) throw new ServiceOperationError("Prepare a formal offer before sending it", 409);
    if (fromStage === QUOTE_STAGE.UNDER_REVIEW) {
      await tx.update(quotes).set({ workflowStatus: QUOTE_STAGE.SENT, updatedAt: new Date() })
        .where(eq(quotes.id, input.quoteId));
      await tx.insert(quoteStatusHistory).values({
        quoteId: input.quoteId,
        fromStatus: fromStage,
        toStatus: QUOTE_STAGE.SENT,
        actorType: "admin",
        actorId: input.actorId,
        note: "Offer delivered to customer",
      });
    }
    await tx.insert(quoteCustomerDecisions).values({
      quoteId: input.quoteId,
      offerRevisionId: offer.id,
      decision: fromStage === QUOTE_STAGE.UNDER_REVIEW ? "offer_sent" : "offer_resent",
      actorId: input.actorId,
      note: input.recipient ? `Delivered to ${input.recipient}` : undefined,
    });
    await tx.insert(quoteActivityLog).values({
      quoteId: input.quoteId,
      actionType: fromStage === QUOTE_STAGE.UNDER_REVIEW ? "quote.offer_sent" : "quote.offer_resent",
      actorType: "admin",
      actorId: input.actorId,
      description: fromStage === QUOTE_STAGE.UNDER_REVIEW ? "Formal offer delivered to customer" : "Formal offer resent to customer",
      metadata: { offerRevisionId: offer.id, recipient: input.recipient || null },
    });
    return tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
  });
}

export async function assertQuoteOfferDeliverable(quoteId: string) {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote) throw new ServiceOperationError("Quote not found", 404);
  const stage = normalizeQuoteStage(quote.workflowStatus);
  if (!([QUOTE_STAGE.UNDER_REVIEW, QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION] as QuoteStage[]).includes(stage)) {
    throw new ServiceOperationError("The quote cannot be delivered at this stage", 409);
  }
  const [offer] = await db.select({ id: quoteOfferRevisions.id }).from(quoteOfferRevisions)
    .where(eq(quoteOfferRevisions.quoteId, quoteId))
    .orderBy(desc(quoteOfferRevisions.version))
    .limit(1);
  if (!offer) throw new ServiceOperationError("Prepare a formal offer before sending it", 409);
  return { quote, offer };
}

export async function recordOfferRevision(input: { quoteId: string; amount: string | number; currency?: string; terms?: string; paymentTerms?: string; deadline?: Date | null; note?: string; actorId: string }) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const current = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!current) throw new ServiceOperationError("Quote not found", 404);
    const handedOff = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, input.quoteId) });
    if (handedOff) throw new ServiceOperationError("Quote terms are immutable after service handoff", 409);
    const currentStage = normalizeQuoteStage(current.workflowStatus);
    if (current.workflowMode !== "dispatch" || currentStage !== QUOTE_STAGE.UNDER_REVIEW) {
      throw new ServiceOperationError("Quote is not eligible for dispatch repricing", 409);
    }
    if (!current.estimatedCost || !current.estimatedCostHigh) {
      throw new ServiceOperationError("Recalculate the estimate before preparing a new offer", 409);
    }
    const [latest] = await tx.select({ version: sql<number>`coalesce(max(${quoteOfferRevisions.version}), 0)`.as("version") }).from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, input.quoteId));
    const [revision] = await tx.insert(quoteOfferRevisions).values({ quoteId: input.quoteId, version: Number(latest?.version || 0) + 1, amount: String(input.amount), currency: input.currency || "MXN", terms: input.terms, paymentTerms: input.paymentTerms, deadline: input.deadline || null, note: input.note, sentBy: input.actorId }).returning();
    await tx.update(quotes).set({
      priceProposalAmount: String(input.amount),
      priceProposalCurrency: input.currency || "MXN",
      priceProposalNote: input.note || null,
      priceProposedAt: revision.sentAt,
      priceProposedBy: input.actorId,
      priceProposalVersion: revision.version,
      priceClientResponse: null,
      priceClientChangeRequest: null,
      priceClientRespondedAt: null,
      workflowStatus: QUOTE_STAGE.UNDER_REVIEW,
      updatedAt: new Date(),
    }).where(eq(quotes.id, input.quoteId));
    await tx.insert(quoteStatusHistory).values({
      quoteId: input.quoteId, fromStatus: currentStage, toStatus: QUOTE_STAGE.UNDER_REVIEW,
      actorType: "admin", actorId: input.actorId, note: input.note || "Formal offer prepared",
    });
    await tx.insert(quoteActivityLog).values({ quoteId: input.quoteId, actionType: "quote.offer_prepared", actorType: "admin", actorId: input.actorId, description: "Admin prepared formal offer", metadata: { amount: input.amount, currency: input.currency || "MXN", offerRevisionId: revision.id } });
    return revision;
  });
}

export async function recordCustomerDecision(input: { quoteId: string; decision: string; note?: string; actorId: string; offerRevisionId?: string; expectedProposalVersion?: number }) {
  if (!["accepted", "rejected", "change_requested"].includes(input.decision)) throw new ServiceOperationError("Unsupported customer decision");
  if (input.decision === "rejected" && !input.note?.trim()) throw new ServiceOperationError("A reason is required when rejecting an offer", 400);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    if (quote.priceClientResponse ||
        (input.expectedProposalVersion !== undefined && quote.priceProposalVersion !== input.expectedProposalVersion)) {
      throw new ServiceOperationError("Quote changed while responding", 409);
    }
    const fromStage = normalizeQuoteStage(quote.workflowStatus);
    const toStage = input.decision === "accepted"
      ? QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT
      : input.decision === "rejected" ? QUOTE_STAGE.CLOSED_LOST : QUOTE_STAGE.UNDER_REVIEW;
    if (!canTransitionQuoteStage(fromStage, toStage)) {
      throw new ServiceOperationError(`Cannot apply ${input.decision} from ${fromStage}`, 409);
    }
    let revisionId = input.offerRevisionId;
    if (!revisionId) {
      const [latest] = await tx.select({ id: quoteOfferRevisions.id }).from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, input.quoteId)).orderBy(desc(quoteOfferRevisions.version)).limit(1);
      revisionId = latest?.id;
    }
    const [decision] = await tx.insert(quoteCustomerDecisions).values({ quoteId: input.quoteId, decision: input.decision, note: input.note, actorId: input.actorId, offerRevisionId: revisionId || null }).returning();
    const [updatedQuote] = await tx.update(quotes).set({
      workflowStatus: toStage,
      ...(toStage === QUOTE_STAGE.CLOSED_LOST ? { status: QUOTE_STAGE.CLOSED_LOST } : {}),
      priceClientResponse: input.decision,
      priceClientChangeRequest: input.decision === "change_requested" ? input.note || null : null,
      priceClientRespondedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(quotes.id, input.quoteId),
      isNull(quotes.priceClientResponse),
      eq(quotes.workflowStatus, quote.workflowStatus!),
      ...(input.expectedProposalVersion !== undefined ? [eq(quotes.priceProposalVersion, input.expectedProposalVersion)] : []),
    )).returning();
    if (!updatedQuote) throw new ServiceOperationError("Quote changed while responding", 409);
    await tx.insert(quoteStatusHistory).values({
      quoteId: input.quoteId, fromStatus: fromStage, toStatus: toStage,
      actorType: "client", actorId: input.actorId, note: input.note,
    });
    await tx.insert(quoteActivityLog).values({
      quoteId: input.quoteId, actionType: "quote.customer_decision", actorType: "client", actorId: input.actorId,
      description: `Customer ${input.decision} the offer`, metadata: { fromStage, toStage, note: input.note || null, offerRevisionId: revisionId || null },
    });
    if (toStage === QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT) {
      await ensureAcceptedServiceTx(tx, updatedQuote, input.actorId);
    }
    return decision;
  });
}

export async function rejectDispatchOffer(input: { quoteId: string; proposalVersion: number; actorId: string; note?: string }) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + input.quoteId}, 0))`);
    const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, input.quoteId) });
    if (!quote) throw new ServiceOperationError("Quote not found", 404);
    if (quote.workflowMode !== "dispatch" || normalizeQuoteStage(quote.workflowStatus) !== QUOTE_STAGE.AWAITING_DECISION || quote.priceClientResponse ||
        quote.priceProposalVersion !== input.proposalVersion) {
      throw new ServiceOperationError("Quote is not awaiting this price response", 409);
    }
    const [row] = await tx.update(quotes).set({
      priceClientResponse: "rejected",
      priceClientChangeRequest: input.note || null,
      priceClientRespondedAt: new Date(),
      workflowStatus: QUOTE_STAGE.CLOSED_LOST,
      status: QUOTE_STAGE.CLOSED_LOST,
      updatedAt: new Date(),
    }).where(and(
      eq(quotes.id, input.quoteId),
      eq(quotes.workflowStatus, quote.workflowStatus!),
      eq(quotes.priceProposalVersion, input.proposalVersion),
      isNull(quotes.priceClientResponse),
    )).returning();
    if (!row) throw new ServiceOperationError("Quote changed while responding", 409);
    const [revision] = await tx.select({ id: quoteOfferRevisions.id }).from(quoteOfferRevisions)
      .where(and(eq(quoteOfferRevisions.quoteId, input.quoteId), eq(quoteOfferRevisions.version, input.proposalVersion))).limit(1);
    await tx.insert(quoteCustomerDecisions).values({
      quoteId: input.quoteId, decision: "rejected", note: input.note, actorId: input.actorId, offerRevisionId: revision?.id || null,
    });
    await tx.insert(quoteStatusHistory).values({
      quoteId: input.quoteId, fromStatus: QUOTE_STAGE.AWAITING_DECISION, toStatus: QUOTE_STAGE.CLOSED_LOST,
      actorType: "client", actorId: input.actorId, note: input.note,
    });
    await tx.insert(quoteActivityLog).values({
      quoteId: input.quoteId, actionType: "dispatch.price_responded", actorType: "client", actorId: input.actorId,
      description: "Client rejected dispatch price", metadata: { note: input.note || null, proposalVersion: input.proposalVersion },
    });
    return row;
  });
}

export async function transitionService(serviceId: string, toStage: string, actorId: string, note?: string, overrideReason?: string, evidenceReference?: string) {
  return db.transaction(async tx => {
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.id, serviceId) });
    if (!service) throw new ServiceOperationError("Service not found", 404);
    const normalizedFromStage = normalizeServiceStage(service.stage);
    const normalizedToStage = normalizeServiceStage(toStage);
    if (!canTransitionServiceStage(normalizedFromStage, normalizedToStage)) throw new ServiceOperationError(`Cannot transition service from ${service.stage} to ${toStage}`, 409);
    if (normalizedToStage === SERVICE_STAGE_V2.TEAM_ASSIGNED) {
      const missing = await tx.select({ key: serviceChecklistItems.key }).from(serviceChecklistItems).where(and(eq(serviceChecklistItems.serviceId, serviceId), eq(serviceChecklistItems.required, true), eq(serviceChecklistItems.completed, false)));
      if (missing.length) throw new ServiceOperationError(`Required checklist incomplete: ${missing.map(x => x.key).join(", ")}`, 409);
    }
    if (normalizedToStage === SERVICE_STAGE_V2.IN_PROGRESS && normalizedFromStage !== SERVICE_STAGE_V2.EN_ROUTE) throw new ServiceOperationError("Service must be en route before starting", 409);
    if (["cancelled", "on_hold"].includes(normalizedToStage) && !note?.trim() && !overrideReason?.trim()) throw new ServiceOperationError("A reason is required", 400);
    const now = new Date();
    const patch: any = { stage: normalizedToStage, updatedAt: now };
    if (normalizedToStage === SERVICE_STAGE_V2.IN_PROGRESS) patch.startedAt = now;
    if (normalizedToStage === SERVICE_STAGE_V2.FINISHED) patch.finishedAt = now;
    if (normalizedToStage === SERVICE_STAGE_V2.FINISHED) patch.completedAt = now;
    if (normalizedToStage === SERVICE_STAGE_V2.CANCELLED) { patch.cancelledAt = now; patch.cancellationReason = note || overrideReason; }
    if (normalizedToStage === SERVICE_STAGE_V2.ON_HOLD) patch.exceptionReason = note || overrideReason;
    const [updated] = await tx.update(operationalServices).set(patch).where(eq(operationalServices.id, serviceId)).returning();
    await logTimeline(tx, serviceId, actorId, "service.stage_changed", { fromStage: service.stage, toStage, note: note || overrideReason, evidenceReference });
    if (normalizedToStage === SERVICE_STAGE_V2.FINISHED) {
      const existingRating = await tx.query.ratings.findFirst({ where: eq(ratings.quoteId, service.quoteId) });
      const feedback = await tx.insert(serviceFeedbackRequests).values({ serviceId, quoteId: service.quoteId, ratingId: existingRating?.id || null }).onConflictDoNothing({ target: serviceFeedbackRequests.serviceId }).returning();
      if (feedback.length) await logTimeline(tx, serviceId, actorId, "service.feedback_issued");
    }
    return updated;
  });
}

async function releaseReservationsTx(tx: any, service: any) {
  if (!service.assignmentId) return;
  await tx.update(assignmentReservations).set({ status: RESERVATION_STATUS.RELEASED, releasedAt: new Date() }).where(and(eq(assignmentReservations.assignmentId, service.assignmentId), inArray(assignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED])));
  await tx.update(crewAssignmentReservations).set({ status: RESERVATION_STATUS.RELEASED, releasedAt: new Date() }).where(and(eq(crewAssignmentReservations.assignmentId, service.assignmentId), inArray(crewAssignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED])));
}

async function confirmCollectionTx(tx: any, serviceId: string, actorId: string | null, status: string, fromStatus?: string | null) {
  const collection = await tx.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, serviceId) });
  if (!collection) throw new ServiceOperationError("Collection not found", 404);
  const previous = fromStatus ?? collection.status;
  const [updated] = await tx.update(serviceCollections).set({ status, verifiedAt: status === COLLECTION_STATUS.VERIFIED ? (collection.verifiedAt || new Date()) : collection.verifiedAt, actorId, updatedAt: new Date() }).where(eq(serviceCollections.id, collection.id)).returning();
  if (previous !== status) await tx.insert(serviceCollectionEvents).values({ collectionId: collection.id, fromStatus: previous, toStatus: status, actorId });
  const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.id, serviceId) });
  if (service && [COLLECTION_STATUS.VERIFIED, COLLECTION_STATUS.WAIVED, COLLECTION_STATUS.DEFERRED].includes(status as any) && service.assignmentId) {
    await tx.update(assignmentReservations).set({ status: RESERVATION_STATUS.CONFIRMED }).where(and(eq(assignmentReservations.assignmentId, service.assignmentId), eq(assignmentReservations.status, RESERVATION_STATUS.TENTATIVE)));
    await tx.update(crewAssignmentReservations).set({ status: RESERVATION_STATUS.CONFIRMED }).where(and(eq(crewAssignmentReservations.assignmentId, service.assignmentId), eq(crewAssignmentReservations.status, RESERVATION_STATUS.TENTATIVE)));
    const assignment = await tx.query.dispatchAssignments.findFirst({ where: eq(dispatchAssignments.id, service.assignmentId) });
    if (assignment?.status === "accepted") {
      const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, service.quoteId) });
      await tx.update(quotes).set({ status: "confirmed", workflowStatus: "closed_won", clientConfirmedAt: sql`coalesce(${quotes.clientConfirmedAt}, now())`, updatedAt: new Date() }).where(eq(quotes.id, service.quoteId));
      if (quote && normalizeQuoteStage(quote.workflowStatus) !== QUOTE_STAGE.CLOSED_WON) {
        await tx.insert(quoteStatusHistory).values({
          quoteId: service.quoteId,
          fromStatus: normalizeQuoteStage(quote.workflowStatus),
          toStatus: QUOTE_STAGE.CLOSED_WON,
          actorType: actorId ? "admin" : "system",
          actorId,
          note: `Booking accepted and collection ${status}`,
        });
      }
      await tx.insert(quoteActivityLog).values({ quoteId: service.quoteId, actionType: "dispatch.payment_confirmed", actorType: "system", description: "Payment confirmed for accepted assignment", metadata: { serviceId, collectionStatus: status } });
    }
  }
  if (service && ["verified", "waived", "deferred"].includes(status) && normalizeServiceStage(service.stage) === SERVICE_STAGE_V2.ON_HOLD) {
    await tx.update(operationalServices).set({ stage: SERVICE_STAGE_V2.CONFIRMED, exceptionReason: null, updatedAt: new Date() }).where(eq(operationalServices.id, serviceId));
  }
  return updated;
}

export async function updateCollection(serviceId: string, input: { status: string; actorId: string; collectionId?: string; method?: string; provider?: string; externalReference?: string; evidenceReference?: string; notes?: string; deadline?: Date }) {
  if (!Object.values(COLLECTION_STATUS).includes(input.status as any)) throw new ServiceOperationError("Unsupported collection status");
  return db.transaction(async tx => {
    const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.id, serviceId) });
    if (!service) throw new ServiceOperationError("Service not found", 404);
    const collection = await tx.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, serviceId) });
    if (!collection || (input.collectionId && collection.id !== input.collectionId)) throw new ServiceOperationError("Collection does not belong to service", 404);
    const terminal = [COLLECTION_STATUS.CANCELLED, COLLECTION_STATUS.REJECTED, COLLECTION_STATUS.EXPIRED, COLLECTION_STATUS.FAILED, COLLECTION_STATUS.REFUNDED].includes(input.status as any);
    if ([COLLECTION_STATUS.REJECTED, COLLECTION_STATUS.CANCELLED, COLLECTION_STATUS.REFUNDED].includes(input.status as any) && !input.notes?.trim()) throw new ServiceOperationError("A reason is required", 400);
    const [updated] = await tx.update(serviceCollections).set({
      status: input.status, method: input.method || collection.method, provider: input.provider ?? collection.provider,
      externalReference: input.externalReference ?? collection.externalReference, evidenceReference: input.evidenceReference ?? collection.evidenceReference,
      notes: input.notes ?? collection.notes, deadline: input.deadline || collection.deadline, actorId: input.actorId, submittedAt: input.status === COLLECTION_STATUS.AWAITING_VALIDATION ? new Date() : collection.submittedAt,
      rejectedAt: input.status === COLLECTION_STATUS.REJECTED ? new Date() : collection.rejectedAt,
      expiredAt: input.status === COLLECTION_STATUS.EXPIRED ? new Date() : collection.expiredAt,
      refundedAt: input.status === COLLECTION_STATUS.REFUNDED ? new Date() : collection.refundedAt,
      updatedAt: new Date(),
    }).where(eq(serviceCollections.id, collection.id)).returning();
    if (input.status === COLLECTION_STATUS.VERIFIED || input.status === COLLECTION_STATUS.WAIVED || input.status === COLLECTION_STATUS.DEFERRED) {
      await confirmCollectionTx(tx, serviceId, input.actorId, input.status, collection.status);
    } else if (collection.status !== input.status) {
      await tx.insert(serviceCollectionEvents).values({ collectionId: collection.id, fromStatus: collection.status, toStatus: input.status, method: input.method || collection.method, provider: input.provider, externalReference: input.externalReference, evidenceReference: input.evidenceReference, notes: input.notes, actorId: input.actorId });
    }
    if (terminal) {
      await releaseReservationsTx(tx, service);
      const recoverable = [COLLECTION_STATUS.CANCELLED, COLLECTION_STATUS.REJECTED, COLLECTION_STATUS.EXPIRED, COLLECTION_STATUS.FAILED, COLLECTION_STATUS.REFUNDED].includes(input.status as any);
      if (recoverable && normalizeServiceStage(service.stage) !== SERVICE_STAGE_V2.FINISHED) {
        const oldAssignmentId = service.assignmentId;
        if (oldAssignmentId) {
          await tx.update(dispatchAssignments).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(dispatchAssignments.id, oldAssignmentId), inArray(dispatchAssignments.status, ["proposed", "accepted"])));
          await tx.update(operationalServices).set({ stage: SERVICE_STAGE_V2.ON_HOLD, assignmentId: null, exceptionReason: `Collection ${input.status}: ${input.notes || "failure"}`, updatedAt: new Date() }).where(eq(operationalServices.id, serviceId));
          await tx.update(quotes).set({
            assignedMoverProfileId: null, partnerFinalizedAt: null, partnerSelectedAt: null,
            selectedBidId: null, partnerSelectionStatus: "pending", workflowStatus: "accepted_pending_booking_payment",
            status: "dispatch_planning", updatedAt: new Date(),
          }).where(eq(quotes.id, service.quoteId));
          await logTimeline(tx, serviceId, input.actorId, "collection.recovery", {
            note: input.notes || `Collection ${input.status}`,
            metadata: { status: input.status, oldAssignmentId, reason: input.notes || null },
          });
          await tx.insert(quoteActivityLog).values({ quoteId: service.quoteId, actionType: "dispatch.collection_recovery", actorType: "admin", actorId: input.actorId, description: "Collection failure detached assignment for retry", metadata: { serviceId, status: input.status, oldAssignmentId, reason: input.notes || null } });
        } else {
          await tx.update(operationalServices).set({ stage: SERVICE_STAGE_V2.ON_HOLD, exceptionReason: `Collection ${input.status}: ${input.notes || "failure"}`, updatedAt: new Date() }).where(eq(operationalServices.id, serviceId));
        }
      }
    }
    await logTimeline(tx, serviceId, input.actorId, "collection.updated", { metadata: { status: input.status } });
    return updated;
  });
}

export async function expireCollections(now = new Date(), actorId = "system") {
  const rows = await db.select({ collection: serviceCollections }).from(serviceCollections).where(and(lt(serviceCollections.deadline, now), inArray(serviceCollections.status, [COLLECTION_STATUS.PENDING, COLLECTION_STATUS.AWAITING_VALIDATION])));
  for (const row of rows) await updateCollection(row.collection.serviceId, { status: COLLECTION_STATUS.EXPIRED, actorId, notes: "Payment deadline expired" });
  return rows.length;
}

let expiryWorkerStarted = false;
let expiryWorkerRunning = false;
export function startCollectionExpiryWorker(intervalMs = 60_000) {
  if (expiryWorkerStarted) return;
  expiryWorkerStarted = true;
  const tick = async () => {
    if (expiryWorkerRunning) return;
    expiryWorkerRunning = true;
    try { await expireCollections(new Date(), "system"); } finally { expiryWorkerRunning = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

export async function setChecklist(serviceId: string, key: string, completed: boolean, actorId: string, note?: string, evidenceReference?: string) {
  if (!(SERVICE_CHECKLIST_KEYS as readonly string[]).includes(key)) throw new ServiceOperationError("Unknown checklist item");
  const value = evidenceReference ? `${note || ""}${note ? "\n" : ""}Evidence: ${evidenceReference}` : note || null;
  return db.insert(serviceChecklistItems).values({ serviceId, key, required: true, completed, completedBy: completed ? actorId : null, completedAt: completed ? new Date() : null, note: value }).onConflictDoUpdate({ target: [serviceChecklistItems.serviceId, serviceChecklistItems.key], set: { completed, completedBy: completed ? actorId : null, completedAt: completed ? new Date() : null, note: value, updatedAt: new Date() } }).returning().then(rows => rows[0]);
}

export async function getServiceDetail(serviceId: string) {
  const service = await db.query.operationalServices.findFirst({ where: eq(operationalServices.id, serviceId) });
  if (!service) return null;
  const [collection, checklist, timeline, feedback, quote, assignment, offerRevisions, customerDecisions] = await Promise.all([
    db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, serviceId) }),
    db.select().from(serviceChecklistItems).where(eq(serviceChecklistItems.serviceId, serviceId)).orderBy(serviceChecklistItems.key),
    db.select().from(serviceTimelineEvents).where(eq(serviceTimelineEvents.serviceId, serviceId)).orderBy(desc(serviceTimelineEvents.createdAt)),
    db.query.serviceFeedbackRequests.findFirst({ where: eq(serviceFeedbackRequests.serviceId, serviceId) }),
    db.query.quotes.findFirst({ where: eq(quotes.id, service.quoteId) }),
    service.assignmentId ? db.query.dispatchAssignments.findFirst({ where: eq(dispatchAssignments.id, service.assignmentId) }) : Promise.resolve(undefined),
    db.select().from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, service.quoteId)).orderBy(desc(quoteOfferRevisions.version)),
    db.select().from(quoteCustomerDecisions).where(eq(quoteCustomerDecisions.quoteId, service.quoteId)).orderBy(desc(quoteCustomerDecisions.createdAt)),
  ]);
  const customer = service.customerId ? await db.query.users.findFirst({ where: eq(users.id, service.customerId) }) : undefined;
  const resources = assignment ? await db.select({ vehicle: partnerVehicles }).from(assignmentVehicles).innerJoin(partnerVehicles, eq(assignmentVehicles.vehicleId, partnerVehicles.id)).where(eq(assignmentVehicles.assignmentId, assignment.id)) : [];
  const readiness = checklist.length ? (checklist.filter(item => item.required && item.completed).length === checklist.filter(item => item.required).length ? "ready" : "incomplete") : "incomplete";
  const paymentDeadline = collection?.deadline || null;
  const alerts = [
    ...(readiness !== "ready" ? ["Required readiness items incomplete"] : []),
    ...(collection && ["pending", "awaiting_validation"].includes(collection.status) ? ["Payment pending"] : []),
    ...(paymentDeadline && new Date(paymentDeadline) < new Date() && !["verified", "waived", "deferred"].includes(collection?.status || "") ? ["Payment deadline expired"] : []),
  ];
  const queueFields = {
    quoteId: service.quoteId, quoteNumber: quote?.quoteNumber || (service.snapshot as any)?.quoteNumber || null,
    customerName: customer?.fullName || (service.snapshot as any)?.contact?.name || null,
    customerEmail: customer?.email || (service.snapshot as any)?.contact?.email || null,
    moveDate: (service.snapshot as any)?.moveDate || null,
  };
  return {
    service: { ...service, ...queueFields, quote, customer, collection, checklist, assignment, resources, readinessStatus: readiness, paymentDeadline, alerts },
    quote, customer, collection, checklist, assignment, resources, readinessStatus: readiness, paymentDeadline, alerts, timeline, feedback, offerRevisions, customerDecisions,
  };
}

export async function listOperationalServices(input: { quoteId?: string; view?: string; search?: string }) {
  const rows = await db.select().from(operationalServices)
    .where(input.quoteId ? eq(operationalServices.quoteId, input.quoteId) : undefined)
    .orderBy(desc(operationalServices.updatedAt));
  const details = await Promise.all(rows.map(row => getServiceDetail(row.id)));
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return details.filter((detail): detail is NonNullable<typeof detail> => !!detail).filter(detail => {
    if (!input.quoteId && normalizeQuoteStage(detail.quote?.workflowStatus) !== QUOTE_STAGE.CLOSED_WON) return false;
    const stage = normalizeServiceStage(detail.service.stage);
    const date = detail.service.snapshot && (detail.service.snapshot as any).moveDate ? new Date((detail.service.snapshot as any).moveDate) : null;
    const view = input.view || "all";
    const matchView = view === "all"
      || (view === "upcoming" && !!date && date >= now)
      || (view === "today" && !!date && date >= start && date < end)
      || view === stage;
    const text = JSON.stringify({ snapshot: detail.service.snapshot, customer: detail.customer, quote: detail.quote }).toLowerCase();
    return matchView && (!input.search || text.includes(input.search.toLowerCase()));
  }).map(detail => detail.service);
}