import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, lte, notExists, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { getActiveUserId, requireAdmin, requireAdminPermission, requirePlatformPermission, requireAuth, requireMover, requireClient } from "./authMiddleware";
import { requireCompanyPermission, resolveActiveCompany } from "./companyAuthorization";
import { partnerVehicles, vehicleAvailabilityWindows, dispatchAssignments, assignmentVehicles, assignmentReservations, quotes, moverProfiles, quoteActivityLog, operationalServices, serviceCollections, quoteOfferRevisions, DISPATCH_ASSIGNMENT_STATUS, DISPATCH_STATUS, RESERVATION_STATUS, truckTypes, partnerCrews, crewAvailabilityWindows, partnerOperatingSchedules, partnerCalendarExceptions } from "@shared/schema";
import { proposeAssignment, releaseAssignment, respondToAssignment, DispatchError } from "./services/dispatchService";
import { toPartnerSafeQuote } from "./services/dispatchDtos";
import { recordCustomerDecision, rejectDispatchOffer } from "./services/serviceOperations";
import { normalizeQuoteStage, QUOTE_STAGE } from "@shared/workflowStages";

const id = z.string().min(1);
const windowFields = { startsAt: z.coerce.date(), endsAt: z.coerce.date() };
const windowSchema = z.object(windowFields).refine(x => x.startsAt < x.endsAt, "startsAt must precede endsAt");
const vehicleSchema = z.object({ moverProfileId: id, name: z.string().trim().min(1), registration: z.string().optional().nullable(), vehicleType: z.string().optional().nullable(), capacity: z.string().optional().nullable(), truckTypeId: id.optional().nullable(), isActive: z.boolean().optional() });
const crewSchema = z.object({ name: z.string().trim().min(1), role: z.string().trim().max(100).optional(), memberUserId: id.optional().nullable(), isActive: z.boolean().optional() });

function errors(res: any, e: any) {
  if (e instanceof z.ZodError || e instanceof DispatchError) return res.status(e instanceof DispatchError ? e.status : 400).json({ message: e.message });
  console.error("Dispatch API error", e); return res.status(500).json({ message: "Dispatch operation failed" });
}
async function partnerForUser(req: any) {
  const active = req.company ? { company: req.company } : await resolveActiveCompany(req);
  return active?.company;
}

export function projectCalendarResourceRows<TWindow, TResource>(
  rows: Array<{ window: TWindow; resource: TResource }>,
  key: "vehicle" | "crew",
) {
  return rows.map(({ window, resource }) => ({ window, [key]: resource }));
}

export function toCustomerOfferRevision(
  offer: typeof quoteOfferRevisions.$inferSelect | undefined,
  workflowStatus: string | null | undefined,
) {
  const stage = normalizeQuoteStage(workflowStatus);
  const visible = ([
    QUOTE_STAGE.SENT,
    QUOTE_STAGE.AWAITING_DECISION,
    QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT,
    QUOTE_STAGE.CLOSED_WON,
    QUOTE_STAGE.CLOSED_LOST,
    QUOTE_STAGE.EXPIRED,
  ] as string[]).includes(stage);
  if (!offer || !visible) return null;
  return {
    id: offer.id,
    version: offer.version,
    amount: offer.amount,
    currency: offer.currency,
    terms: offer.terms,
    paymentTerms: offer.paymentTerms,
    deadline: offer.deadline,
    note: offer.note,
  };
}

export function registerDispatchRouter() {
  const r = Router();
  const admin = [requireAdmin, requirePlatformPermission("module:quotes"), requireAdminPermission("canManageQuotes")];

  r.get("/admin/dispatch/fleet", ...admin, async (_req, res) => res.json(await db.select({ vehicle: partnerVehicles, partner: moverProfiles }).from(partnerVehicles).leftJoin(moverProfiles, eq(partnerVehicles.moverProfileId, moverProfiles.id))));
  r.post("/admin/dispatch/fleet", ...admin, async (req, res) => {
    try { const data = vehicleSchema.extend({ truckTypeId: id }).parse(req.body); const type = await db.query.truckTypes.findFirst({ where: and(eq(truckTypes.id, data.truckTypeId), eq(truckTypes.isActive, true)) }); if (!type) return res.status(400).json({ message: "An active canonical truck type is required" }); const [row] = await db.insert(partnerVehicles).values({ ...data, legacyCapacityNeedsReview: false }).returning(); res.status(201).json(row); } catch (e) { errors(res, e); }
  });
  r.patch("/admin/dispatch/fleet/:id", ...admin, async (req, res) => {
    try { const data = vehicleSchema.partial().omit({ moverProfileId: true }).parse(req.body); const [row] = await db.update(partnerVehicles).set({ ...data, updatedAt: new Date() }).where(eq(partnerVehicles.id, req.params.id)).returning(); if (!row) return res.status(404).json({ message: "Vehicle not found" }); res.json(row); } catch (e) { errors(res, e); }
  });
  r.delete("/admin/dispatch/fleet/:id", ...admin, async (req, res) => { const [row] = await db.update(partnerVehicles).set({ isActive: false, updatedAt: new Date() }).where(eq(partnerVehicles.id, req.params.id)).returning(); if (!row) return res.status(404).json({ message: "Vehicle not found" }); res.json(row); });

  r.get("/admin/dispatch/availability", ...admin, async (req, res) => {
    const q = id.safeParse(req.query.vehicleId);
    const rows = await db.select().from(vehicleAvailabilityWindows).where(q.success ? eq(vehicleAvailabilityWindows.vehicleId, q.data) : undefined).orderBy(desc(vehicleAvailabilityWindows.startsAt));
    res.json(rows);
  });
  r.post("/admin/dispatch/availability", ...admin, async (req, res) => {
    try { const body = z.object({ ...windowFields, vehicleId: id, label: z.string().optional().nullable(), isAvailable: z.boolean().optional() }).parse(req.body); const [row] = await db.insert(vehicleAvailabilityWindows).values(body).returning(); res.status(201).json(row); } catch (e) { errors(res, e); }
  });
  r.patch("/admin/dispatch/availability/:id", ...admin, async (req, res) => {
    try { const data = z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(), label: z.string().optional().nullable(), isAvailable: z.boolean().optional() }).parse(req.body); const [row] = await db.update(vehicleAvailabilityWindows).set({ ...data, updatedAt: new Date() }).where(eq(vehicleAvailabilityWindows.id, req.params.id)).returning(); if (!row) return res.status(404).json({ message: "Availability window not found" }); res.json(row); } catch (e) { errors(res, e); }
  });
  r.delete("/admin/dispatch/availability/:id", ...admin, async (req, res) => { const [row] = await db.delete(vehicleAvailabilityWindows).where(eq(vehicleAvailabilityWindows.id, req.params.id)).returning(); if (!row) return res.status(404).json({ message: "Availability window not found" }); res.json(row); });
  r.get("/admin/dispatch/availability/search", ...admin, async (req, res) => {
    try {
      const q = windowSchema.parse(req.query);
      const rows = await db.select().from(vehicleAvailabilityWindows).where(and(
        eq(vehicleAvailabilityWindows.isAvailable, true),
        lte(vehicleAvailabilityWindows.startsAt, q.startsAt),
        gte(vehicleAvailabilityWindows.endsAt, q.endsAt),
        notExists(
          db.select({ id: assignmentReservations.id })
            .from(assignmentReservations)
            .where(and(
              eq(assignmentReservations.vehicleId, vehicleAvailabilityWindows.vehicleId),
              inArray(assignmentReservations.status, [RESERVATION_STATUS.TENTATIVE, RESERVATION_STATUS.CONFIRMED]),
              sql`${assignmentReservations.startsAt} < ${q.endsAt}`,
              sql`${assignmentReservations.endsAt} > ${q.startsAt}`,
            )),
        ),
      ));
      res.json(rows);
    } catch (e) { errors(res, e); }
  });

  r.post("/admin/dispatch/quotes/:quoteId/assignments", ...admin, async (req, res) => {
    try { const body = z.object({ moverProfileId: id, vehicleIds: z.array(id).min(1), crewIds: z.array(id).optional(), ...windowFields }).parse(req.body); res.status(201).json(await proposeAssignment({ ...body, quoteId: req.params.quoteId, actorId: getActiveUserId(req)! })); } catch (e) { errors(res, e); }
  });
  r.get("/admin/dispatch/quotes/:quoteId/detail", ...admin, async (req, res) => {
    const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.quoteId) });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    const latestOffer = await db.query.quoteOfferRevisions.findFirst({
      where: eq(quoteOfferRevisions.quoteId, quote.id),
      orderBy: [desc(quoteOfferRevisions.version)],
    });
    const activeOffer = toCustomerOfferRevision(latestOffer, quote.workflowStatus);
    const assignments = await db.select({ assignment: dispatchAssignments, partner: moverProfiles }).from(dispatchAssignments).leftJoin(moverProfiles, eq(dispatchAssignments.moverProfileId, moverProfiles.id)).where(eq(dispatchAssignments.quoteId, quote.id));
    const enriched = await Promise.all(assignments.map(async x => ({ ...x.assignment, partner: x.partner, vehicles: await db.select({ vehicle: partnerVehicles, reservation: assignmentReservations }).from(assignmentVehicles).innerJoin(partnerVehicles, eq(assignmentVehicles.vehicleId, partnerVehicles.id)).leftJoin(assignmentReservations, and(eq(assignmentReservations.assignmentId, x.assignment.id), eq(assignmentReservations.vehicleId, partnerVehicles.id))).where(eq(assignmentVehicles.assignmentId, x.assignment.id)) })));
    res.json({ quote, activeOffer: activeOffer || null, assignments: enriched });
  });
  r.post("/admin/dispatch/assignments/:id/cancel", ...admin, async (req, res) => { try { res.json(await releaseAssignment(req.params.id)); } catch (e) { errors(res, e); } });

  r.get("/client/dispatch/quotes/:quoteId/detail", requireClient, async (req, res) => {
    const quote = await db.query.quotes.findFirst({ where: and(eq(quotes.id, req.params.quoteId), eq(quotes.userId, getActiveUserId(req)!)) });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    const activeOffer = await db.query.quoteOfferRevisions.findFirst({
      where: eq(quoteOfferRevisions.quoteId, quote.id),
      orderBy: [desc(quoteOfferRevisions.version)],
    });
    const accepted = quote.priceClientResponse === "accepted";
    const assignment = accepted ? await db.query.dispatchAssignments.findFirst({ where: and(eq(dispatchAssignments.quoteId, quote.id), eq(dispatchAssignments.status, DISPATCH_ASSIGNMENT_STATUS.ACCEPTED)) }) : undefined;
    const vehicles = assignment
      ? await db.select({ vehicle: partnerVehicles })
          .from(assignmentVehicles)
          .innerJoin(partnerVehicles, eq(assignmentVehicles.vehicleId, partnerVehicles.id))
          .where(eq(assignmentVehicles.assignmentId, assignment.id))
      : [];
    const partner = assignment
      ? await db.query.moverProfiles.findFirst({ where: eq(moverProfiles.id, assignment.moverProfileId) })
      : undefined;
    const service = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
    const collection = service ? await db.query.serviceCollections.findFirst({ where: eq(serviceCollections.serviceId, service.id) }) : undefined;
    res.json({
      quote: {
        id: quote.id,
        workflowMode: quote.workflowMode,
        workflowStatus: quote.workflowStatus,
        priceProposalAmount: activeOffer?.amount || null,
        priceProposalVersion: activeOffer?.version || 0,
        priceProposalCurrency: activeOffer?.currency || null,
        priceProposalNote: activeOffer?.note || null,
        priceClientResponse: quote.priceClientResponse,
        assignedMoverProfileId: assignment ? quote.assignedMoverProfileId : null,
        assignedMover: partner ? {
          id: partner.id,
          companyName: partner.companyName,
        } : null,
        collectionStatus: collection?.status || null,
        paymentDeadline: collection?.deadline || null,
      },
      activeOffer,
      assignment: assignment ? { ...assignment, vehicleCount: vehicles.length, vehicles } : null,
    });
  });
  r.post("/client/dispatch/quotes/:quoteId/price-response", requireClient, async (req, res) => {
    try {
      const userId = getActiveUserId(req)!;
      const quote = await db.query.quotes.findFirst({ where: and(eq(quotes.id, req.params.quoteId), eq(quotes.userId, userId)) });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const body = z.object({
        response: z.enum(["accepted", "rejected", "change_requested"]),
        proposalVersion: z.number().int().nonnegative(),
        note: z.string().trim().max(2000).optional(),
      }).refine(value => value.response !== "change_requested" && value.response !== "rejected" || !!value.note, {
        message: "A note is required when requesting a change",
        path: ["note"],
      }).parse(req.body);
      if (quote.workflowMode !== "dispatch" || normalizeQuoteStage(quote.workflowStatus) !== QUOTE_STAGE.AWAITING_DECISION || quote.priceClientResponse) return res.status(409).json({ message: "Quote is not awaiting a client price response" });
      if (quote.priceProposalVersion !== body.proposalVersion) return res.status(409).json({ message: "Quote changed while responding" });
      if (body.response === "rejected") {
        const row = await rejectDispatchOffer({ quoteId: quote.id, proposalVersion: body.proposalVersion, actorId: userId, note: body.note });
        return res.json(row);
      }
      await recordCustomerDecision({
        quoteId: quote.id,
        decision: body.response,
        note: body.note,
        actorId: userId,
        expectedProposalVersion: body.proposalVersion,
      });
      const row = await db.query.quotes.findFirst({ where: eq(quotes.id, quote.id) });
      res.json(row);
    } catch (e) { errors(res, e); }
  });

  r.get("/partner/dispatch/assignments", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); res.json(await db.select().from(dispatchAssignments).where(eq(dispatchAssignments.moverProfileId, p.id)).orderBy(desc(dispatchAssignments.createdAt))); });
  r.get("/partner/dispatch/assignments/:id", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); const [row] = await db.select({ assignment: dispatchAssignments, quote: quotes }).from(dispatchAssignments).innerJoin(quotes, eq(dispatchAssignments.quoteId, quotes.id)).where(and(eq(dispatchAssignments.id, req.params.id), eq(dispatchAssignments.moverProfileId, p.id))); if (!row) return res.status(404).json({ message: "Assignment not found" }); const vehicles = await db.select({ vehicle: partnerVehicles, reservation: assignmentReservations }).from(assignmentVehicles).innerJoin(partnerVehicles, eq(assignmentVehicles.vehicleId, partnerVehicles.id)).leftJoin(assignmentReservations, and(eq(assignmentReservations.assignmentId, row.assignment.id), eq(assignmentReservations.vehicleId, partnerVehicles.id))).where(eq(assignmentVehicles.assignmentId, row.assignment.id)); res.json({ ...row.assignment, quote: toPartnerSafeQuote(row.quote), vehicles }); });
  r.post("/partner/dispatch/assignments/:id/respond", requireCompanyPermission("dispatch:manage"), async (req: any, res) => { try { const p = await partnerForUser(req); const body = z.object({ response: z.enum(["accepted", "declined"]), note: z.string().max(2000).optional() }).parse(req.body); const result = await respondToAssignment({ assignmentId: req.params.id, moverProfileId: p.id, actorId: getActiveUserId(req)!, companyId: req.company.id, membershipId: req.companyMembership.id, ...body } as any); res.json(result); } catch (e) { errors(res, e); } });

  // Partners may manage only their own fleet and windows.
  r.get("/partner/dispatch/fleet", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); res.json(await db.select().from(partnerVehicles).where(eq(partnerVehicles.moverProfileId, p.id))); });
  r.get("/partner/dispatch/truck-types", requireCompanyPermission("company:read"), async (_req, res) => {
    res.json(await db.select().from(truckTypes).where(eq(truckTypes.isActive, true)).orderBy(truckTypes.sortOrder));
  });
  r.post("/partner/dispatch/fleet", requireCompanyPermission("fleet:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = vehicleSchema.omit({ moverProfileId: true }).extend({ truckTypeId: id }).parse(req.body); const type = await db.query.truckTypes.findFirst({ where: and(eq(truckTypes.id, body.truckTypeId), eq(truckTypes.isActive, true)) }); if (!type) return res.status(400).json({ message: "An active canonical truck type is required" }); const [row] = await db.insert(partnerVehicles).values({ ...body, moverProfileId: p.id, legacyCapacityNeedsReview: false }).returning(); res.status(201).json(row); } catch (e) { errors(res, e); } });
  r.patch("/partner/dispatch/fleet/:id", requireCompanyPermission("fleet:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = vehicleSchema.omit({ moverProfileId: true }).partial().parse(req.body); const [row] = await db.update(partnerVehicles).set({ ...body, updatedAt: new Date() }).where(and(eq(partnerVehicles.id, req.params.id), eq(partnerVehicles.moverProfileId, p.id))).returning(); if (!row) return res.status(404).json({ message: "Vehicle not found" }); res.json(row); } catch (e) { errors(res, e); } });
  r.delete("/partner/dispatch/fleet/:id", requireCompanyPermission("fleet:manage"), async (req, res) => { const p = await partnerForUser(req); const [row] = await db.update(partnerVehicles).set({ isActive: false, updatedAt: new Date() }).where(and(eq(partnerVehicles.id, req.params.id), eq(partnerVehicles.moverProfileId, p.id))).returning(); if (!row) return res.status(404).json({ message: "Vehicle not found" }); res.json(row); });
  r.get("/partner/dispatch/availability", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); const rows = await db.select({ window: vehicleAvailabilityWindows, vehicle: partnerVehicles }).from(vehicleAvailabilityWindows).innerJoin(partnerVehicles, eq(vehicleAvailabilityWindows.vehicleId, partnerVehicles.id)).where(eq(partnerVehicles.moverProfileId, p.id)); res.json(rows); });
  r.post("/partner/dispatch/availability", requireCompanyPermission("availability:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = z.object({ ...windowFields, vehicleId: id, label: z.string().optional().nullable(), isAvailable: z.boolean().optional() }).parse(req.body); const vehicle = await db.query.partnerVehicles.findFirst({ where: and(eq(partnerVehicles.id, body.vehicleId), eq(partnerVehicles.moverProfileId, p.id)) }); if (!vehicle) return res.status(404).json({ message: "Vehicle not found" }); const [row] = await db.insert(vehicleAvailabilityWindows).values(body).returning(); res.status(201).json(row); } catch (e) { errors(res, e); } });
  r.patch("/partner/dispatch/availability/:id", requireCompanyPermission("availability:manage"), async (req, res) => {
    try {
      const p = await partnerForUser(req);
      if (!p) return res.status(403).json({ message: "Partner profile required" });
      const body = z.object({
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().optional(),
        label: z.string().optional().nullable(),
        isAvailable: z.boolean().optional(),
      }).parse(req.body);
      const [owned] = await db.select({ window: vehicleAvailabilityWindows })
        .from(vehicleAvailabilityWindows)
        .innerJoin(partnerVehicles, eq(vehicleAvailabilityWindows.vehicleId, partnerVehicles.id))
        .where(and(
          eq(vehicleAvailabilityWindows.id, req.params.id),
          eq(partnerVehicles.moverProfileId, p.id),
        ));
      if (!owned) return res.status(404).json({ message: "Availability window not found" });
      const startsAt = body.startsAt || owned.window.startsAt;
      const endsAt = body.endsAt || owned.window.endsAt;
      windowSchema.parse({ startsAt, endsAt });
      const [row] = await db.update(vehicleAvailabilityWindows)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(vehicleAvailabilityWindows.id, req.params.id))
        .returning();
      res.json(row);
    } catch (e) { errors(res, e); }
  });
  r.delete("/partner/dispatch/availability/:id", requireCompanyPermission("availability:manage"), async (req, res) => { const p = await partnerForUser(req); const owned = await db.select({ id: vehicleAvailabilityWindows.id }).from(vehicleAvailabilityWindows).innerJoin(partnerVehicles, eq(vehicleAvailabilityWindows.vehicleId, partnerVehicles.id)).where(and(eq(vehicleAvailabilityWindows.id, req.params.id), eq(partnerVehicles.moverProfileId, p.id))); if (!owned.length) return res.status(404).json({ message: "Availability window not found" }); await db.delete(vehicleAvailabilityWindows).where(eq(vehicleAvailabilityWindows.id, req.params.id)); res.json({ success: true }); });
  r.get("/partner/dispatch/crews", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); res.json(await db.select().from(partnerCrews).where(eq(partnerCrews.moverProfileId, p.id))); });
  r.post("/partner/dispatch/crews", requireCompanyPermission("fleet:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = crewSchema.parse(req.body); const [row] = await db.insert(partnerCrews).values({ ...body, moverProfileId: p.id }).returning(); res.status(201).json(row); } catch (e) { errors(res, e); } });
  r.patch("/partner/dispatch/crews/:id", requireCompanyPermission("fleet:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = crewSchema.partial().parse(req.body); const [row] = await db.update(partnerCrews).set({ ...body, updatedAt: new Date() }).where(and(eq(partnerCrews.id, req.params.id), eq(partnerCrews.moverProfileId, p.id))).returning(); if (!row) return res.status(404).json({ message: "Crew not found" }); res.json(row); } catch (e) { errors(res, e); } });
  r.get("/partner/dispatch/crew-availability", requireCompanyPermission("company:read"), async (req, res) => { const p = await partnerForUser(req); res.json(await db.select({ window: crewAvailabilityWindows, crew: partnerCrews }).from(crewAvailabilityWindows).innerJoin(partnerCrews, eq(crewAvailabilityWindows.crewId, partnerCrews.id)).where(eq(partnerCrews.moverProfileId, p.id))); });
  r.post("/partner/dispatch/crew-availability", requireCompanyPermission("availability:manage"), async (req, res) => { try { const p = await partnerForUser(req); const body = z.object({ ...windowFields, crewId: id, label: z.string().optional().nullable(), isAvailable: z.boolean().optional() }).parse(req.body); const crew = await db.query.partnerCrews.findFirst({ where: and(eq(partnerCrews.id, body.crewId), eq(partnerCrews.moverProfileId, p.id)) }); if (!crew) return res.status(404).json({ message: "Crew not found" }); const [row] = await db.insert(crewAvailabilityWindows).values(body).returning(); res.status(201).json(row); } catch (e) { errors(res, e); } });
  r.get("/partner/dispatch/calendar", requireCompanyPermission("company:read"), async (req, res) => {
    const p = await partnerForUser(req); const from = req.query.from ? new Date(String(req.query.from)) : new Date(); const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 14 * 86400000);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return res.status(400).json({ message: "Valid from/to calendar dates are required" });
    const [vehicles, crews, schedules, exceptions, assignments] = await Promise.all([
      db.select({ window: vehicleAvailabilityWindows, resource: partnerVehicles }).from(vehicleAvailabilityWindows).innerJoin(partnerVehicles, eq(vehicleAvailabilityWindows.vehicleId, partnerVehicles.id)).where(and(eq(partnerVehicles.moverProfileId, p.id), lte(vehicleAvailabilityWindows.startsAt, to), gte(vehicleAvailabilityWindows.endsAt, from))),
      db.select({ window: crewAvailabilityWindows, resource: partnerCrews }).from(crewAvailabilityWindows).innerJoin(partnerCrews, eq(crewAvailabilityWindows.crewId, partnerCrews.id)).where(and(eq(partnerCrews.moverProfileId, p.id), lte(crewAvailabilityWindows.startsAt, to), gte(crewAvailabilityWindows.endsAt, from))),
      db.select().from(partnerOperatingSchedules).where(eq(partnerOperatingSchedules.moverProfileId, p.id)),
      db.select().from(partnerCalendarExceptions).where(and(eq(partnerCalendarExceptions.moverProfileId, p.id), lte(partnerCalendarExceptions.startsAt, to), gte(partnerCalendarExceptions.endsAt, from))),
      db.select().from(dispatchAssignments).where(and(eq(dispatchAssignments.moverProfileId, p.id), lte(dispatchAssignments.startsAt, to), gte(dispatchAssignments.endsAt, from))),
    ]);
    res.json({ timezone: p.operatingTimezone || "America/Mexico_City", from, to, vehicles: projectCalendarResourceRows(vehicles, "vehicle"), crews: projectCalendarResourceRows(crews, "crew"), schedules, exceptions, assignments });
  });
  r.put("/partner/dispatch/calendar/schedule", requireCompanyPermission("availability:manage"), async (req, res) => {
    try {
      const p = await partnerForUser(req);
      const body = z.object({ dayOfWeek: z.number().int().min(0).max(6), startsAt: z.string().regex(/^\d{2}:\d{2}$/), endsAt: z.string().regex(/^\d{2}:\d{2}$/), timezone: z.string().min(1), isActive: z.boolean().optional() }).parse(req.body);
      if (body.startsAt >= body.endsAt) return res.status(400).json({ message: "Schedule start must precede end" });
      const [row] = await db.insert(partnerOperatingSchedules).values({ ...body, moverProfileId: p.id }).returning();
      res.status(201).json(row);
    } catch (e) { errors(res, e); }
  });
  r.post("/partner/dispatch/calendar/exceptions", requireCompanyPermission("availability:manage"), async (req, res) => {
    try {
      const p = await partnerForUser(req);
      const body = z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date(), kind: z.enum(["blackout", "available"]), label: z.string().optional().nullable(), timezone: z.string().min(1) }).refine(x => x.startsAt < x.endsAt, "startsAt must precede endsAt").parse(req.body);
      const [row] = await db.insert(partnerCalendarExceptions).values({ ...body, moverProfileId: p.id }).returning();
      res.status(201).json(row);
    } catch (e) { errors(res, e); }
  });
  return r;
}