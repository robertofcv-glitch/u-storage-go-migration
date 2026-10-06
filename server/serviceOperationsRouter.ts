import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { getActiveUserId, requireAdmin, requireAdminPermission, requirePlatformPermission } from "./authMiddleware";
import { operationalServices, quoteOfferRevisions, serviceCollections, SERVICE_STAGE, users } from "@shared/schema";
import {
  ServiceOperationError, expireCollections, getServiceDetail, listOperationalServices, handoffAcceptedQuote,
  recordCustomerDecision, recordOfferRevision, setChecklist, transitionQuoteStage, transitionService, updateCollection,
  reopenQuoteForInventoryRevision,
} from "./services/serviceOperations";

const admin = [requireAdmin, requirePlatformPermission("module:quotes"), requireAdminPermission("canManageQuotes")] as any;
const id = z.string().min(1);
const errors = (res: any, error: any) => {
  if (error instanceof z.ZodError || error instanceof ServiceOperationError) return res.status(error instanceof ServiceOperationError ? error.status : 400).json({ message: error.message });
  console.error("Service operations API error", error);
  return res.status(500).json({ message: "Service operation failed" });
};

export function registerServiceOperationsRouter() {
  const r = Router();
  r.post("/admin/quotes/:quoteId/transition", ...admin, async (req, res) => {
    try {
      const body = z.object({
        toStage: z.string().trim().min(1),
        reason: z.string().max(2000).optional(),
        note: z.string().max(2000).optional(),
      }).parse(req.body);
      res.json(await transitionQuoteStage({
        quoteId: req.params.quoteId,
        toStage: body.toStage,
        reason: body.reason,
        note: body.note,
        actorId: getActiveUserId(req) || null,
      }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/quotes/:quoteId/reopen-inventory-revision", ...admin, async (req, res) => {
    try {
      const body = z.object({
        expectedReviewVersion: z.coerce.number().int().min(0),
        reason: z.string().trim().min(1).max(2000),
      }).strict().parse(req.body);
      const actorId = getActiveUserId(req) || null;
      const actor = actorId ? await db.query.users.findFirst({ where: eq(users.id, actorId) }) : null;
      res.json(await reopenQuoteForInventoryRevision({
        quoteId: req.params.quoteId,
        expectedReviewVersion: body.expectedReviewVersion,
        reason: body.reason,
        actorId,
        actorName: actor?.fullName || actor?.email || null,
      }));
    } catch (e) { errors(res, e); }
  });
  r.get("/admin/services", ...admin, async (req, res) => {
    const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const rows = await listOperationalServices({ quoteId: typeof req.query.quoteId === "string" ? req.query.quoteId : undefined, view: typeof req.query.view === "string" ? req.query.view : stage, search });
    res.json({ services: rows });
  });
  r.get("/admin/services/:serviceId", ...admin, async (req, res) => {
    try { const detail = await getServiceDetail(req.params.serviceId); if (!detail) return res.status(404).json({ message: "Service not found" }); res.json(detail); } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/offer", ...admin, async (req, res) => {
    try {
      const detail = await getServiceDetail(req.params.serviceId);
      if (!detail) return res.status(404).json({ message: "Service not found" });
      const body = z.object({ amount: z.coerce.number().positive(), currency: z.string().length(3).optional(), terms: z.string().max(4000).optional(), paymentTerms: z.string().max(4000).optional(), deadline: z.coerce.date().nullable().optional(), note: z.string().max(2000).optional() }).parse(req.body);
      res.status(201).json(await recordOfferRevision({ ...body, quoteId: detail.service.quoteId, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/quotes/:quoteId/offers", ...admin, async (req, res) => {
    try {
      const body = z.object({ amount: z.coerce.number().positive(), currency: z.string().length(3).optional(), paymentTerms: z.string().max(4000).optional(), deadline: z.coerce.date().nullable().optional(), note: z.string().max(2000).optional() }).parse(req.body);
      res.status(201).json(await recordOfferRevision({ ...body, terms: body.paymentTerms, quoteId: req.params.quoteId, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.get("/admin/quotes/:quoteId/offers", ...admin, async (req, res) => {
    try {
      const rows = await db.select().from(quoteOfferRevisions).where(eq(quoteOfferRevisions.quoteId, req.params.quoteId)).orderBy(desc(quoteOfferRevisions.version));
      res.json({ offers: rows });
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/decision", ...admin, async (req, res) => {
    try {
      const detail = await getServiceDetail(req.params.serviceId);
      if (!detail) return res.status(404).json({ message: "Service not found" });
      res.status(201).json(await recordCustomerDecision({ ...z.object({ decision: z.string(), note: z.string().max(2000).optional(), offerRevisionId: id.optional() }).parse(req.body), quoteId: detail.service.quoteId, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/bank-transfer", ...admin, async (req, res) => {
    try { res.json(await updateCollection(req.params.serviceId, { ...z.object({ externalReference: z.string().max(200).optional(), evidenceReference: z.string().max(500).optional(), notes: z.string().max(2000).optional() }).parse(req.body), status: "awaiting_validation", method: "bank_transfer", actorId: getActiveUserId(req)! })); } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/collections/bank-transfer", ...admin, async (req, res) => {
    try {
      const body = z.object({ amount: z.coerce.number().optional(), reference: z.string().max(200).optional(), evidenceReference: z.string().max(500).optional(), notes: z.string().max(2000).optional() }).parse(req.body);
      res.json(await updateCollection(req.params.serviceId, { status: "awaiting_validation", method: "bank_transfer", externalReference: body.reference, evidenceReference: body.evidenceReference, notes: body.notes, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/hosted-link", ...admin, async (req, res) => {
    try {
      const body = z.object({ provider: z.string().max(100), externalReference: z.string().max(500), deadline: z.coerce.date(), notes: z.string().max(2000).optional() }).parse(req.body);
      res.json(await updateCollection(req.params.serviceId, { ...body, status: "pending", method: "hosted_link", actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/collection/:action", ...admin, async (req, res) => {
    try {
      const action = z.enum(["verify", "reject", "waive", "defer", "refund", "cancel"]).parse(req.params.action);
      const status = ({ verify: "verified", reject: "rejected", waive: "waived", defer: "deferred", refund: "refunded", cancel: "cancelled" } as any)[action];
      const body = z.object({ notes: z.string().max(2000).optional(), evidenceReference: z.string().max(500).optional(), externalReference: z.string().max(200).optional() }).parse(req.body);
      res.json(await updateCollection(req.params.serviceId, { ...body, status, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/collections/:collectionId/validate", ...admin, async (req, res) => {
    try {
      const body = z.object({ decision: z.enum(["verified", "rejected"]), reference: z.string().max(500).optional(), evidenceReference: z.string().max(500).optional(), notes: z.string().max(2000).optional(), reason: z.string().max(2000).optional() }).parse(req.body);
      res.json(await updateCollection(req.params.serviceId, { collectionId: req.params.collectionId, status: body.decision, externalReference: body.reference, evidenceReference: body.evidenceReference, notes: body.notes || body.reason, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/collections/:collectionId/outcome", ...admin, async (req, res) => {
    try {
      const body = z.object({ outcome: z.enum(["verified", "rejected", "expired", "cancelled", "refunded", "waived", "deferred", "failed"]), reference: z.string().max(500).optional(), evidenceReference: z.string().max(500).optional(), notes: z.string().max(2000).optional(), reason: z.string().max(2000).optional() }).parse(req.body);
      res.json(await updateCollection(req.params.serviceId, { collectionId: req.params.collectionId, status: body.outcome, externalReference: body.reference, evidenceReference: body.evidenceReference, notes: body.notes || body.reason, actorId: getActiveUserId(req)! }));
    } catch (e) { errors(res, e); }
  });
  r.patch("/admin/services/:serviceId/checklist/:key", ...admin, async (req, res) => {
    try { res.json(await setChecklist(req.params.serviceId, req.params.key, z.boolean().parse(req.body.completed), getActiveUserId(req)!, req.body.note || req.body.notes, req.body.evidenceReference)); } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/:serviceId/transition", ...admin, async (req, res) => {
    try { const body = z.object({ toStage: z.string(), note: z.string().max(2000).optional(), notes: z.string().max(2000).optional(), reason: z.string().max(2000).optional(), overrideReason: z.string().max(2000).optional(), evidenceReference: z.string().max(500).optional() }).parse(req.body); res.json(await transitionService(req.params.serviceId, body.toStage, getActiveUserId(req)!, body.note || body.notes, body.reason || body.overrideReason, body.evidenceReference)); } catch (e) { errors(res, e); }
  });
  r.get("/admin/services/:serviceId/timeline", ...admin, async (req, res) => {
    try { const detail = await getServiceDetail(req.params.serviceId); if (!detail) return res.status(404).json({ message: "Service not found" }); res.json({ timeline: detail.timeline }); } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/expire", ...admin, async (req, res) => {
    try { res.json({ expired: await expireCollections(new Date(), getActiveUserId(req)! || "system") }); } catch (e) { errors(res, e); }
  });
  r.post("/admin/services/handoff/:quoteId", ...admin, async (req, res) => {
    try { res.status(201).json(await handoffAcceptedQuote(req.params.quoteId, getActiveUserId(req))); } catch (e) { errors(res, e); }
  });
  return r;
}