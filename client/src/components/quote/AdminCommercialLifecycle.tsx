import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, DollarSign, FileText, LockKeyhole, Mail, MapPin, Package, Send, TriangleAlert, Pencil, Paperclip, Download, Eye, Upload, X, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryEditor } from "@/components/quote/InventoryEditor";
import { normalizeQuoteStage, QUOTE_STAGE, QUOTE_STAGE_LABELS, QUOTE_STAGE_TRANSITIONS, type QuoteStage } from "@shared/workflowStages";

type Props = {
  quoteId: string;
  quote?: {
    id?: string;
    workflowMode?: string | null; workflowStatus?: string | null; priceProposalAmount?: string | null;
    finalPrice?: string | null; priceProposalCurrency?: string | null; priceProposalNote?: string | null;
    priceClientResponse?: string | null; priceClientChangeRequest?: string | null; paymentDeadline?: string | null;
    collectionStatus?: string | null; followUpOwner?: { fullName?: string | null; email?: string | null } | null;
    offers?: any[]; offerHistory?: any[]; estimatedCost?: string | null; estimatedCostHigh?: string | null;
    estimatedCurrency?: string | null; moveDate?: string | null; moveAvailabilityStart?: string | null;
    moveAvailabilityEnd?: string | null; fromAddress?: string | null; toAddress?: string | null;
    homeSize?: string | null; storageOption?: string | null; clientNotes?: string | null;
    inventoryItems?: Array<{ id?: string; itemName: string; quantity: number; category?: string | null; room?: string | null }>;
    quoteServices?: Array<{ service?: { id?: string; nameEn?: string; nameEs?: string } }>;
    contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; updatedAt?: string | null; quoteReviewVersion?: number;
    preferredMoveDates?: string[]; blockedMoveDates?: string[];
    needsInsurance?: boolean | null; needsPacking?: boolean | null; needsUnpacking?: boolean | null; needsBox?: boolean | null;
    quoteAddOns?: Array<{ addOn?: { id?: string; nameEn?: string; nameEs?: string } }>;
    user?: { fullName?: string | null; email?: string | null; phone?: string | null } | null;
  };
  lang: "es" | "en";
  onSendPdf?: () => void;
  sendingPdf?: boolean;
  statusHistory?: Array<{
    toStatus: string;
    note: string | null;
    createdAt: string;
  }>;
};

const terminalStages: QuoteStage[] = [QUOTE_STAGE.CLOSED_LOST, QUOTE_STAGE.CANCELLED, QUOTE_STAGE.EXPIRED];
const stages: QuoteStage[] = [QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW, QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION, QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT, QUOTE_STAGE.CLOSED_WON];
const t = (lang: "es" | "en", es: string, en: string) => lang === "es" ? es : en;
const money = (value?: string | null, currency = "MXN") => value ? `${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}` : "—";

async function call(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Request failed");
  return response.json();
}

export function AdminCommercialLifecycle({ quoteId, quote, lang, onSendPdf, sendingPdf, statusHistory = [] }: Props) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const stage = normalizeQuoteStage(quote?.workflowStatus);
  const labels = QUOTE_STAGE_LABELS[stage];
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MXN");
  const [terms, setTerms] = useState("");
  const [deadline, setDeadline] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [transitionNote, setTransitionNote] = useState("");
  const [transitionTarget, setTransitionTarget] = useState<QuoteStage | null>(null);
  const [reason, setReason] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [reopenInventoryOpen, setReopenInventoryOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [workspaceReason, setWorkspaceReason] = useState("");
  const [intake, setIntake] = useState(() => ({
    contactName: quote?.contactName || "", contactEmail: quote?.contactEmail || "", contactPhone: quote?.contactPhone || "",
    fromAddress: quote?.fromAddress || "", toAddress: quote?.toAddress || "", moveDate: quote?.moveDate?.slice(0, 10) || "",
    moveAvailabilityStart: quote?.moveAvailabilityStart || "", moveAvailabilityEnd: quote?.moveAvailabilityEnd || "",
    preferredMoveDates: quote?.preferredMoveDates?.join(", ") || "", blockedMoveDates: quote?.blockedMoveDates?.join(", ") || "",
    homeSize: quote?.homeSize || "", storageOption: quote?.storageOption || "", clientNotes: quote?.clientNotes || "",
    needsInsurance: !!quote?.needsInsurance, needsPacking: !!quote?.needsPacking, needsUnpacking: !!quote?.needsUnpacking, needsBox: !!quote?.needsBox,
  }));
  const [attachmentError, setAttachmentError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [inventoryDraft, setInventoryDraft] = useState<any[]>(quote?.inventoryItems || []);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(quote?.quoteServices?.map(item => item.service?.id).filter(Boolean) as string[] || []);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>(quote?.quoteAddOns?.map(item => item.addOn?.id).filter(Boolean) as string[] || []);

  const offers = useQuery({ queryKey: [`/api/admin/quotes/${quoteId}/offers`], queryFn: async () => {
    const response = await fetch(`/api/admin/quotes/${quoteId}/offers`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load offer history");
    const body = await response.json(); return (body.offers || body.data || body) as any[];
  }});
  const service = useQuery({ queryKey: [`/api/admin/services?quoteId=${quoteId}`], queryFn: async () => {
    const response = await fetch(`/api/admin/services?quoteId=${quoteId}`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not check linked service");
    const body = await response.json(); const rows = body.services || body.data || body;
    return Array.isArray(rows) ? rows[0] || null : null;
  }});
  const attachments = useQuery({ queryKey: [`/api/admin/quotes/${quoteId}/attachments`], queryFn: async () => {
    const response = await fetch(`/api/admin/quotes/${quoteId}/attachments`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load customer files");
    const body = await response.json(); return (body.attachments || body.data || body) as Array<{ id: string; fileName: string; mimeType: string; fileSize: number; createdAt: string }>;
  }});
  const workspace = useQuery({ queryKey: [`/api/admin/quotes/${quoteId}/review-workspace`], enabled: !!quoteId, queryFn: async () => {
    const response = await fetch(`/api/admin/quotes/${quoteId}/review-workspace`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load review permissions");
    return response.json() as Promise<{ editable: boolean; lockReason?: string | null }>;
  }});
  const serviceCatalog = useQuery({ queryKey: ["/api/services"], queryFn: async () => (await fetch("/api/services", { credentials: "include" })).json() });
  const addOnCatalog = useQuery({ queryKey: ["/api/addons"], queryFn: async () => (await fetch("/api/addons", { credentials: "include" })).json() });
  useEffect(() => {
    if (!quote) return;
    setIntake({ contactName: quote.contactName || "", contactEmail: quote.contactEmail || "", contactPhone: quote.contactPhone || "", fromAddress: quote.fromAddress || "", toAddress: quote.toAddress || "", moveDate: quote.moveDate?.slice(0, 10) || "", moveAvailabilityStart: quote.moveAvailabilityStart || "", moveAvailabilityEnd: quote.moveAvailabilityEnd || "", preferredMoveDates: quote.preferredMoveDates?.join(", ") || "", blockedMoveDates: quote.blockedMoveDates?.join(", ") || "", homeSize: quote.homeSize || "", storageOption: quote.storageOption || "", clientNotes: quote.clientNotes || "", needsInsurance: !!quote.needsInsurance, needsPacking: !!quote.needsPacking, needsUnpacking: !!quote.needsUnpacking, needsBox: !!quote.needsBox });
    setInventoryDraft(quote.inventoryItems || []);
    setSelectedServiceIds(quote.quoteServices?.map(item => item.service?.id).filter(Boolean) as string[] || []);
    setSelectedAddOnIds(quote.quoteAddOns?.map(item => item.addOn?.id).filter(Boolean) as string[] || []);
  }, [quote?.id, quote?.updatedAt]);
  const reviewMutation = useMutation({
    mutationFn: async () => {
      const savedInventory = inventoryDraft.map(({ id, quoteId: _quoteId, ...item }) => ({
        ...item,
        ...(id && !String(id).startsWith("draft-") ? { id } : {}),
      }));
      const normalizedIntake = {
        ...intake,
        moveDate: intake.moveDate || null,
        moveAvailabilityStart: intake.moveAvailabilityStart || null,
        moveAvailabilityEnd: intake.moveAvailabilityEnd || null,
        preferredMoveDates: intake.preferredMoveDates.split(",").map(value => value.trim()).filter(Boolean),
        blockedMoveDates: intake.blockedMoveDates.split(",").map(value => value.trim()).filter(Boolean),
        contactName: intake.contactName || null,
        contactEmail: intake.contactEmail || null,
        contactPhone: intake.contactPhone || null,
        storageOption: intake.storageOption || null,
        clientNotes: intake.clientNotes || null,
      };
      const response = await fetch(`/api/admin/quotes/${quoteId}/review-workspace`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedReviewVersion: quote?.quoteReviewVersion || 0, reason: workspaceReason || undefined, intake: normalizedIntake, inventoryItems: savedInventory, serviceIds: selectedServiceIds, addOnIds: selectedAddOnIds }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Could not save workspace");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      setWorkspaceOpen(false); setInventoryOpen(false); setWorkspaceReason("");
    },
  });
  const reopenInventoryMutation = useMutation({
    mutationFn: () => call(`/api/admin/quotes/${quoteId}/reopen-inventory-revision`, {
      expectedReviewVersion: quote?.quoteReviewVersion || 0,
      reason: reopenReason,
    }),
    onSuccess: async () => {
      setWorkspaceReason(reopenReason);
      setReopenInventoryOpen(false);
      setReopenReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/review-workspace`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/history`] }),
      ]);
      setInventoryOpen(true);
    },
  });
  const recalculateMutation = useMutation({
    mutationFn: () => call(`/api/admin/quotes/${quoteId}/review-workspace/recalculate`, {
      expectedReviewVersion: quote?.quoteReviewVersion || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
    },
  });
  const uploadAttachment = async (file: File) => {
    setAttachmentError("");
    if (file.size > 10 * 1024 * 1024) { setAttachmentError(t(lang, "El archivo supera el límite de 10 MB.", "File exceeds the 10 MB limit.")); return; }
    const extension = file.name.split(".").pop()?.toLowerCase();
    const mimeByExtension: Record<string, string> = {
      csv: "text/csv", doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const mimeType = (extension && mimeByExtension[extension]) || file.type;
    const accepted = /^(image\/(jpeg|png|webp)|application\/pdf|text\/plain|text\/csv|application\/msword|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))$/.test(mimeType);
    try {
      if (!accepted) { setAttachmentError(t(lang, "Tipo de archivo no compatible.", "Unsupported file type.")); return; }
      setUploading(true);
      const dataBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("Could not read file")); reader.readAsDataURL(file); });
      const response = await fetch(`/api/admin/quotes/${quoteId}/attachments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType, fileSize: file.size, dataBase64 }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Upload failed");
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/attachments`] });
    } catch (error) { setAttachmentError((error as Error).message); } finally { setUploading(false); }
  };
  const deleteAttachment = async (id: string) => {
    setAttachmentError("");
    try { const response = await fetch(`/api/admin/quotes/${quoteId}/attachments/${id}`, { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error("Delete failed"); queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/attachments`] }); }
    catch (error) { setAttachmentError((error as Error).message); }
  };
  const transition = useMutation({
    mutationFn: async () => {
      if (!transitionTarget) throw new Error("Choose a next stage");
      return call(`/api/admin/services/quotes/${quoteId}/transition`, { toStage: transitionTarget, reason: terminalStages.includes(transitionTarget) ? reason : undefined, note: transitionNote || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/history`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      setTransitionTarget(null); setReason(""); setTransitionNote("");
    },
  });
  const offerAllowed = quote?.workflowMode === "dispatch" && stage === QUOTE_STAGE.UNDER_REVIEW && service.isSuccess && !service.data?.id;
  const offerMutation = useMutation({
    mutationFn: () => {
      if (!offerAllowed) throw new Error("Offer changes are locked at this stage");
      return call(`/api/admin/services/quotes/${quoteId}/offers`, { amount: Number(amount), currency, paymentTerms: terms, deadline: deadline || undefined, note: offerNote || undefined });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/offers`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/history`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/dispatch/quotes/${quoteId}/detail`] }),
      ]);
    },
  });
  const nextStages = useMemo(() => QUOTE_STAGE_TRANSITIONS[stage].filter(target =>
    !([QUOTE_STAGE.SENT, QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT, QUOTE_STAGE.CLOSED_WON] as QuoteStage[]).includes(target)
  ), [stage]);
  const latestOffers = offers.data?.length ? offers.data : quote?.offers || quote?.offerHistory || [];
  const activeOffer = latestOffers[0];
  useEffect(() => {
    if (!activeOffer) return;
    setAmount(String(activeOffer.amount || ""));
    setCurrency(activeOffer.currency || "MXN");
    setTerms(activeOffer.paymentTerms || activeOffer.terms || "");
    setDeadline(activeOffer.deadline ? String(activeOffer.deadline).slice(0, 16) : "");
    setOfferNote(activeOffer.note || "");
  }, [activeOffer?.id]);
  const locked = stage === QUOTE_STAGE.CLOSED_WON || terminalStages.includes(stage) || !!service.data?.id;
  const currentIndex = stages.indexOf(stage);
  const outcomeEntry = terminalStages.includes(stage)
    ? [...statusHistory].reverse().find(entry => normalizeQuoteStage(entry.toStatus) === stage)
    : undefined;
  const stageAction: Record<QuoteStage, string> = {
    draft: t(lang, "Completa contacto, ruta, disponibilidad, inventario y requisitos.", "Complete contact, route, availability, inventory, and requirements."),
    under_review: t(lang, "Valida los datos y prepara una propuesta comercial lista para enviar.", "Validate the intake and prepare a customer-ready proposal."),
    sent: t(lang, "La propuesta está lista para seguimiento y reenvío.", "The proposal is ready for follow-up and resend."),
    awaiting_decision: t(lang, "Espera la decisión del cliente o registra una solicitud de cambio.", "Wait for the customer decision or capture a change request."),
    accepted_pending_booking_payment: t(lang, "Completa la reserva y valida el pago para cerrar la venta.", "Complete booking and validate payment before closing the sale."),
    closed_won: t(lang, "La venta está cerrada. La ejecución continúa en Servicios.", "The sale is closed. Operational execution continues in Services."),
    closed_lost: t(lang, "Resultado registrado. El historial comercial permanece disponible.", "Outcome recorded. Commercial history remains available."),
    cancelled: t(lang, "Cotización cancelada; no hay más acciones comerciales.", "Quote cancelled; no further commercial actions are available."),
    expired: t(lang, "La oferta venció; no hay más acciones comerciales.", "The offer expired; no further actions are available."),
  };
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const editable = workspace.data?.editable === true && !locked && (stage === QUOTE_STAGE.DRAFT || stage === QUOTE_STAGE.UNDER_REVIEW);
  const canReopenInventory = ([QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION] as QuoteStage[]).includes(stage)
    && service.isSuccess && !service.data?.id;
  const openInventory = () => {
    if (canReopenInventory) setReopenInventoryOpen(true);
    else setInventoryOpen(true);
  };
  const changedFields = Object.entries(intake).filter(([key, value]) => value !== ({
    contactName: quote?.contactName || "", contactEmail: quote?.contactEmail || "", contactPhone: quote?.contactPhone || "",
    fromAddress: quote?.fromAddress || "", toAddress: quote?.toAddress || "", moveDate: quote?.moveDate?.slice(0, 10) || "",
    moveAvailabilityStart: quote?.moveAvailabilityStart || "", moveAvailabilityEnd: quote?.moveAvailabilityEnd || "", homeSize: quote?.homeSize || "",
    preferredMoveDates: quote?.preferredMoveDates?.join(", ") || "", blockedMoveDates: quote?.blockedMoveDates?.join(", ") || "",
    storageOption: quote?.storageOption || "", clientNotes: quote?.clientNotes || "", needsInsurance: !!quote?.needsInsurance, needsPacking: !!quote?.needsPacking,
    needsUnpacking: !!quote?.needsUnpacking, needsBox: !!quote?.needsBox,
  } as any)[key]).map(([key]) => key);
  const resetWorkspaceDraft = () => {
    if (!quote) return;
    setIntake({
      contactName: quote.contactName || "", contactEmail: quote.contactEmail || "", contactPhone: quote.contactPhone || "",
      fromAddress: quote.fromAddress || "", toAddress: quote.toAddress || "", moveDate: quote.moveDate?.slice(0, 10) || "",
      moveAvailabilityStart: quote.moveAvailabilityStart || "", moveAvailabilityEnd: quote.moveAvailabilityEnd || "",
      preferredMoveDates: quote.preferredMoveDates?.join(", ") || "", blockedMoveDates: quote.blockedMoveDates?.join(", ") || "",
      homeSize: quote.homeSize || "", storageOption: quote.storageOption || "", clientNotes: quote.clientNotes || "",
      needsInsurance: !!quote.needsInsurance, needsPacking: !!quote.needsPacking, needsUnpacking: !!quote.needsUnpacking, needsBox: !!quote.needsBox,
    });
    setInventoryDraft(quote.inventoryItems || []);
    setSelectedServiceIds(quote.quoteServices?.map(item => item.service?.id).filter(Boolean) as string[] || []);
    setSelectedAddOnIds(quote.quoteAddOns?.map(item => item.addOn?.id).filter(Boolean) as string[] || []);
    setWorkspaceReason("");
  };

  return (
    <>
      <Card className="overflow-hidden border-[#4e2069]/20 bg-[#fffdfa] shadow-sm" data-testid="card-canonical-lifecycle">
        <CardHeader className="border-b border-[#4e2069]/10 bg-[#f7f1f8] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff6c00]">{t(lang, "Tablero comercial", "Commercial cockpit")}</p>
              <CardTitle className="flex items-center gap-2 text-[#24152e]"><DollarSign className="h-5 w-5 text-[#ff6c00]" />{t(lang, "Ciclo de la cotización", "Quote lifecycle")}</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">{stageAction[stage]}</CardDescription>
            </div>
            <Badge className={terminalStages.includes(stage) ? "bg-[#a52b3b] text-white" : "bg-[#4e2069] text-white"}>{lang === "es" ? labels.es : labels.en}</Badge>
          </div>
          <div className="pt-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#6d6075]"><span>{t(lang, "Progreso", "Progress")}</span><span>{currentIndex >= 0 ? `${currentIndex + 1}/${stages.length}` : "—"}</span></div>
            <div className="flex items-center gap-1.5">
              {stages.map((item, index) => <div key={item} className="flex min-w-0 flex-1 items-center gap-1.5">
                <div title={lang === "es" ? QUOTE_STAGE_LABELS[item].es : QUOTE_STAGE_LABELS[item].en} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${index <= currentIndex ? "border-[#ff6c00] bg-[#ff6c00] text-white" : "border-[#d9d0df] bg-white text-[#6d6075]"}`}>{index < currentIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}</div>
                {index < stages.length - 1 && <div className={`h-1 min-w-[8px] flex-1 rounded-full ${index < currentIndex ? "bg-[#ff6c00]" : "bg-[#e5dfe8]"}`} />}
              </div>)}
            </div>
            <div className="mt-2 hidden justify-between text-[10px] text-[#6d6075] md:flex">{stages.map(item => <span key={item} className="max-w-[100px] text-center">{lang === "es" ? QUOTE_STAGE_LABELS[item].es : QUOTE_STAGE_LABELS[item].en}</span>)}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
           <div className="flex flex-col gap-3 rounded-xl border border-[#4e2069]/15 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
             <div className="min-w-0">
               <p className="text-sm font-bold text-[#24152e]">{t(lang, "Espacio de revisión", "Reviewer workspace")}</p>
               <p className="mt-1 text-xs text-[#6d6075]">
                 {quote?.contactName || quote?.user?.fullName || t(lang, "Cliente sin nombre", "Unnamed customer")} · {quote?.contactEmail || quote?.user?.email || "—"} · {quote?.contactPhone || quote?.user?.phone || t(lang, "Sin teléfono", "No phone")}
               </p>
             </div>
             <Button variant={editable ? "default" : "outline"} size="sm" onClick={() => setWorkspaceOpen(true)} aria-label={t(lang, "Abrir datos de intake", "Open intake details")}>
               <Pencil className="mr-2 h-4 w-4" />{editable ? t(lang, "Editar intake", "Edit intake") : t(lang, "Ver intake bloqueado", "View locked intake")}
             </Button>
           </div>
           <div className="grid gap-3 md:grid-cols-2">
             <div className="rounded-xl border border-[#d9d0df] bg-white p-4">
               <div className="mb-3 flex items-center justify-between">
                 <p className="flex items-center gap-2 text-sm font-bold text-[#24152e]"><Package className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Inventario de la conversación", "Conversation inventory")}</p>
                  <Button variant={editable || canReopenInventory ? "default" : "outline"} size="sm" onClick={openInventory} aria-label={t(lang, "Editar inventario", "Edit inventory")}>
                    {editable || canReopenInventory ? <><Pencil className="mr-2 h-4 w-4" />{t(lang, "Editar inventario", "Edit inventory")}</> : t(lang, "Ver inventario bloqueado", "View locked inventory")}
                 </Button>
               </div>
               <p className="text-2xl font-bold text-[#4e2069]">{quote?.inventoryItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} <span className="text-sm font-normal text-[#6d6075]">{t(lang, "unidades", "units")}</span></p>
               <p className="mt-1 text-xs text-[#6d6075]">{quote?.inventoryItems?.length || 0} {t(lang, "registros agrupados por habitación", "records grouped by room")} · {editable ? t(lang, "Control accesible por teclado", "Keyboard-accessible control") : t(lang, "Los cambios están bloqueados", "Changes are locked")}</p>
             </div>
             <div className="rounded-xl border border-[#d9d0df] bg-[#fbf9f6] p-4">
               <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#24152e]"><FileText className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Contexto completo del estimado", "Complete estimate context")}</p>
               <div className="grid gap-2 text-xs sm:grid-cols-2">
                 <span><b>{t(lang, "Disponibilidad", "Availability")}:</b> {date(quote?.moveAvailabilityStart)} — {date(quote?.moveAvailabilityEnd)}</span>
                 <span><b>{t(lang, "Almacenaje", "Storage")}:</b> {quote?.storageOption || t(lang, "No declarado", "Not declared")}</span>
                 <span><b>{t(lang, "Servicios", "Services")}:</b> {quote?.quoteServices?.map(item => lang === "es" ? item.service?.nameEs : item.service?.nameEn).filter(Boolean).join(", ") || t(lang, "Ninguno seleccionado", "None selected")}</span>
                 <span><b>{t(lang, "Adicionales", "Add-ons")}:</b> {quote?.quoteAddOns?.map(item => lang === "es" ? item.addOn?.nameEs : item.addOn?.nameEn).filter(Boolean).join(", ") || t(lang, "Ninguno seleccionado", "None selected")}</span>
                 <span><b>{t(lang, "Requisitos", "Requirements")}:</b> {[quote?.needsInsurance && t(lang, "seguro", "insurance"), quote?.needsPacking && t(lang, "empaque", "packing"), quote?.needsUnpacking && t(lang, "desempaque", "unpacking"), quote?.needsBox && t(lang, "cajas", "boxes")].filter(Boolean).join(", ") || t(lang, "Ninguno declarado", "None declared")}</span>
                 <span><b>{t(lang, "Notas del cliente", "Customer notes")}:</b> {quote?.clientNotes || t(lang, "Sin notas", "No notes")}</span>
               </div>
             </div>
           </div>
           <div className="rounded-xl border border-[#d9d0df] bg-white p-4">
             <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
               <p className="flex items-center gap-2 text-sm font-bold text-[#24152e]"><Paperclip className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Archivos del intake", "Intake files")}</p>
                 <label className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs font-semibold ${editable ? "hover:bg-slate-50" : "cursor-not-allowed opacity-50"}`}>
                 <Upload className="mr-2 h-3.5 w-3.5" />{t(lang, "Subir archivo", "Upload file")}
                 <input type="file" className="sr-only" disabled={!editable || uploading} accept="image/*,.pdf,.txt,.doc,.docx,.csv,.xls,.xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.currentTarget.value = ""; }} />
               </label>
               {uploading && <span className="text-xs text-[#6d6075]">{t(lang, "Subiendo…", "Uploading…")}</span>}
             </div>
             {attachments.isLoading ? <p className="text-xs text-[#6d6075]">{t(lang, "Cargando archivos…", "Loading files…")}</p> :
               attachments.isError ? <p className="text-xs text-[#a52b3b]">{t(lang, "No se pudieron cargar los archivos.", "Files are unavailable.")}</p> :
               !attachments.data?.length ? <p className="text-xs text-[#6d6075]">{t(lang, "No hay imágenes o archivos del cliente.", "No customer images or files retained.")}</p> :
               <div className="grid gap-2 sm:grid-cols-2">{attachments.data.map(file => {
                 const url = `/api/admin/quotes/${quoteId}/attachments/${file.id}/content`;
                 return <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#fbf9f6] p-3">
                   <div className="flex min-w-0 items-center gap-2">{file.mimeType.startsWith("image/") ? <img src={`${url}`} alt={file.fileName} className="h-10 w-10 rounded object-cover" /> : <FileText className="h-5 w-5 shrink-0 text-[#4e2069]" />}<div className="min-w-0"><p className="truncate text-xs font-semibold">{file.fileName}</p><p className="text-[10px] text-[#6d6075]">{file.mimeType} · {(file.fileSize / 1024).toFixed(1)} KB · {date(file.createdAt)}</p></div></div>
                   <span className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label={t(lang, "Vista previa", "Preview")} onClick={() => window.open(url, "_blank")}><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" aria-label={t(lang, "Descargar", "Download")} onClick={() => window.open(`${url}?download=1`, "_blank")}><Download className="h-3.5 w-3.5" /></Button>{editable && <Button variant="ghost" size="icon" aria-label={t(lang, "Eliminar", "Delete")} onClick={() => void deleteAttachment(file.id)}><X className="h-3.5 w-3.5 text-[#a52b3b]" /></Button>}</span>
                 </div>;
               })}</div>}
             {attachmentError && <p className="mt-2 text-xs text-[#a52b3b]">{attachmentError}</p>}
           </div>
          {!locked && nextStages.length > 0 && <div className="flex flex-wrap gap-2 border-b border-[#4e2069]/10 pb-4">
            {nextStages.map(target => <Button key={target} size="sm" variant={target === QUOTE_STAGE.CLOSED_WON ? "default" : "outline"} onClick={() => setTransitionTarget(target)} data-testid={`button-transition-${target}`}><span>{lang === "es" ? QUOTE_STAGE_LABELS[target].es : QUOTE_STAGE_LABELS[target].en}</span><ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>)}
          </div>}

          {(stage === QUOTE_STAGE.DRAFT || stage === QUOTE_STAGE.UNDER_REVIEW) && <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-[#d9d0df] bg-white p-4">
              <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold text-[#24152e]"><MapPin className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Intake operativo", "Operational intake")}</p><Badge variant="outline">{quote?.homeSize || "—"}</Badge></div>
              <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase text-[#6d6075]">{t(lang, "Origen", "Origin")}</p><p className="mt-1 truncate font-medium">{quote?.fromAddress || "—"}</p></div><div><p className="text-[11px] font-semibold uppercase text-[#6d6075]">{t(lang, "Destino", "Destination")}</p><p className="mt-1 truncate font-medium">{quote?.toAddress || "—"}</p></div><div><p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-[#6d6075]"><CalendarDays className="h-3 w-3" />{t(lang, "Fecha / disponibilidad", "Date / availability")}</p><p className="mt-1 font-medium">{date(quote?.moveDate)}{quote?.moveAvailabilityStart ? ` · ${date(quote.moveAvailabilityStart)}` : ""}</p></div><div><p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-[#6d6075]"><Package className="h-3 w-3" />{t(lang, "Particulares", "Particular items")}</p><p className="mt-1 font-medium">{quote?.inventoryItems?.length || 0} {t(lang, "registros", "records")} · {quote?.storageOption || t(lang, "Sin almacenaje", "No storage")}</p></div></div>
              {quote?.clientNotes && <p className="mt-3 border-l-2 border-[#ff6c00] pl-3 text-sm text-[#6d6075]">{quote.clientNotes}</p>}
            </div>
            <div className="rounded-xl border border-[#d9d0df] bg-[#fbf9f6] p-4"><p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#24152e]"><CheckCircle2 className="h-4 w-4 text-[#1e6b50]" />{t(lang, "Estimación IA", "AI estimate")}</p><div className="flex items-end gap-2"><span className="text-2xl font-bold tracking-tight text-[#4e2069]">{money(quote?.estimatedCost, quote?.estimatedCurrency || "MXN")}</span>{quote?.estimatedCostHigh && <span className="pb-1 text-sm text-[#6d6075]">— {money(quote.estimatedCostHigh, quote.estimatedCurrency || "MXN")}</span>}</div><p className="mt-2 text-xs text-[#6d6075]">{quote?.estimatedCost ? t(lang, "Rango sugerido por los datos de intake; validar antes de formalizar.", "Suggested from intake data; validate before formalizing.") : t(lang, "El inventario cambió. Recalcula antes de preparar una nueva oferta.", "Inventory changed. Recalculate before preparing a new offer.")}</p>{stage === QUOTE_STAGE.UNDER_REVIEW && !quote?.estimatedCost && <><Button className="mt-3 w-full sm:w-auto" size="sm" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />{recalculateMutation.isPending ? t(lang, "Recalculando…", "Recalculating…") : t(lang, "Recalcular estimado", "Recalculate estimate")}</Button>{recalculateMutation.error && <p role="alert" className="mt-2 text-xs text-[#a52b3b]">{(recalculateMutation.error as Error).message}</p>}</>}<div className="mt-3 flex flex-wrap gap-1.5">{quote?.quoteServices?.map((serviceItem, index) => <Badge key={index} variant="secondary" className="bg-[#eee6f0] text-[#4e2069]">{lang === "es" ? serviceItem.service?.nameEs : serviceItem.service?.nameEn}</Badge>)}</div></div>
          </div>}

          {stage === QUOTE_STAGE.UNDER_REVIEW && <div className="rounded-xl border border-[#ff6c00]/35 bg-[#fff8f1] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="flex items-center gap-2 text-sm font-bold text-[#24152e]"><FileText className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Propuesta al cliente", "Customer proposal")}</p><p className="text-xs text-[#6d6075]">{t(lang, "Fuente comercial única para el precio, los términos y la nota que recibirá el cliente.", "The single commercial source for the price, terms, and note the customer receives.")}</p></div>{!offerAllowed && <Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />{t(lang, "Bloqueada", "Locked")}</Badge>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><Label>{t(lang, "Precio", "Price")}</Label><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={!offerAllowed} /></div><div><Label>{t(lang, "Moneda", "Currency")}</Label><Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} disabled={!offerAllowed} /></div><div><Label>{t(lang, "Términos de pago", "Payment terms")}</Label><Input value={terms} onChange={e => setTerms(e.target.value)} disabled={!offerAllowed} placeholder={t(lang, "Transferencia / en línea", "Transfer / online")} /></div><div><Label>{t(lang, "Vencimiento", "Expiration")}</Label><Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} disabled={!offerAllowed} /></div></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"><div className="flex-1"><Label>{t(lang, "Nota para el cliente", "Customer-facing note")}</Label><Textarea value={offerNote} onChange={e => setOfferNote(e.target.value)} disabled={!offerAllowed} /></div>{offerAllowed && <Button onClick={() => offerMutation.mutate()} disabled={!amount || offerMutation.isPending}><Send className="mr-2 h-4 w-4" />{t(lang, "Guardar revisión", "Save revision")}</Button>}</div></div>}

          {((stage === QUOTE_STAGE.UNDER_REVIEW && !!activeOffer) || [QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION, QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT, QUOTE_STAGE.CLOSED_WON, ...terminalStages].includes(stage)) && <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-[#d9d0df] bg-white p-4"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold text-[#24152e]"><Mail className="h-4 w-4 text-[#ff6c00]" />{t(lang, "Vista previa del correo", "Email preview")}</p><Badge variant="outline">{quote?.contactEmail || "—"}</Badge></div><div className="rounded-lg bg-[#fbf9f6] p-3 text-sm"><p className="font-semibold">{t(lang, "Tu propuesta de mudanza", "Your moving proposal")}</p><p className="mt-2 text-[#6d6075]">{t(lang, "Hola", "Hello")} {quote?.contactName || t(lang, "cliente", "customer")},</p><p className="mt-2 text-[#6d6075]">{t(lang, "Tu propuesta está lista para revisar.", "Your proposal is ready to review.")}</p><p className="mt-3 font-bold text-[#4e2069]">{money(activeOffer?.amount, activeOffer?.currency || "MXN")}</p>{activeOffer?.note && <p className="mt-2 text-[#6d6075]">{activeOffer.note}</p>}</div>{onSendPdf && <Button className="mt-3 w-full sm:w-auto" variant="outline" onClick={onSendPdf} disabled={sendingPdf || locked || !activeOffer}><Send className="mr-2 h-4 w-4" />{sendingPdf ? t(lang, "Enviando…", "Sending…") : stage === QUOTE_STAGE.SENT || stage === QUOTE_STAGE.AWAITING_DECISION ? t(lang, "Reenviar propuesta", "Resend proposal") : t(lang, "Enviar propuesta", "Send proposal")}</Button>}</div>
            <div className="rounded-xl border border-[#d9d0df] bg-[#fbf9f6] p-4"><p className="mb-3 text-sm font-bold text-[#24152e]">{t(lang, "Propuesta activa e historial", "Active proposal and history")}</p>{activeOffer ? <><p className="text-2xl font-bold text-[#4e2069]">{money(activeOffer.amount, activeOffer.currency || "MXN")}</p><p className="mt-1 text-xs text-[#6d6075]">{activeOffer.paymentTerms || activeOffer.terms || "—"}</p><p className="mt-1 text-xs text-[#6d6075]">{activeOffer.note || "—"}</p></> : <p className="text-sm text-[#6d6075]">{t(lang, "No hay propuesta registrada.", "No proposal recorded.")}</p>}{quote?.priceClientResponse && <Badge className="mt-3 bg-[#eee6f0] text-[#4e2069]">{quote.priceClientResponse}</Badge>}{quote?.priceClientChangeRequest && <p className="mt-3 text-sm text-amber-700">{quote.priceClientChangeRequest}</p>}</div>
          </div>}
          {stage === QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">{t(lang, "Términos acordados e inmutables", "Agreed terms are immutable")}</p><p className="mt-1">{service.data?.collection?.status || quote?.collectionStatus || t(lang, "Reserva y pago pendientes", "Booking and payment pending")} {(service.data?.collection?.deadline || quote?.paymentDeadline) ? `· ${date(service.data?.collection?.deadline || quote?.paymentDeadline)}` : ""}</p></div>}
          {stage === QUOTE_STAGE.CLOSED_WON && <div className="rounded-xl border border-[#1e6b50]/25 bg-[#edf7f1] p-4 text-sm"><p className="font-semibold text-[#1e6b50]"><CheckCircle2 className="mr-1 inline h-4 w-4" />{t(lang, "Venta ganada y términos bloqueados", "Won sale with locked terms")}</p><p className="mt-1">{money(quote?.finalPrice || quote?.priceProposalAmount, quote?.priceProposalCurrency || "MXN")} · {quote?.collectionStatus || t(lang, "Pago registrado", "Payment recorded")}</p>{service.data?.id && <Button variant="link" className="h-auto px-0 text-[#4e2069]" onClick={() => setLocation(`/admin/dashboard/services/${service.data.id}`)}>{t(lang, "Abrir servicio operativo", "Open operational service")}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>}
          {terminalStages.includes(stage) && <div className="rounded-xl border border-[#a52b3b]/20 bg-[#fff0f1] p-4 text-sm text-[#a52b3b]">
            <p className="font-semibold"><TriangleAlert className="mr-1 inline h-4 w-4" />{t(lang, "Resultado final; controles comerciales bloqueados.", "Final outcome; commercial controls are locked.")}</p>
            <p className="mt-2 text-[#6f2631]"><span className="font-semibold">{t(lang, "Motivo:", "Reason:")}</span> {outcomeEntry?.note || t(lang, "No se registró un motivo en el historial.", "No reason was recorded in the history.")}</p>
            {outcomeEntry?.createdAt && <p className="mt-1 text-xs text-[#8f4b55]">{new Date(outcomeEntry.createdAt).toLocaleString(lang === "es" ? "es-MX" : "en-US")}</p>}
          </div>}
          {service.isLoading && <p className="text-xs text-[#6d6075]"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{t(lang, "Verificando servicio vinculado…", "Checking linked service…")}</p>}
          {transition.error && <p className="text-sm text-[#a52b3b]">{(transition.error as Error).message}</p>}
        </CardContent>
      </Card>
       <Dialog open={workspaceOpen} onOpenChange={open => { if (!open) resetWorkspaceDraft(); setWorkspaceOpen(open); }}>
         <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
           <DialogHeader><DialogTitle>{t(lang, "Editar intake de la cotización", "Edit quote intake")}</DialogTitle><DialogDescription>{t(lang, "Guarda explícitamente los cambios. Los cambios de ruta, inventario o servicios pueden afectar el precio y requieren una nueva revisión comercial.", "Save changes explicitly. Route, inventory, or service changes may affect pricing and require a new commercial revision.")}</DialogDescription></DialogHeader>
           {!editable && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />{workspace.data?.lockReason || t(lang, "Los datos están bloqueados por la etapa actual.", "Fields are locked at the current lifecycle stage.")}</div>}
           <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
            <div><Label>{t(lang, "Nombre del cliente", "Customer name")}</Label><Input value={intake.contactName} onChange={e => setIntake(v => ({ ...v, contactName: e.target.value }))} /></div>
            <div><Label>{t(lang, "Correo", "Email")}</Label><Input type="email" value={intake.contactEmail} onChange={e => setIntake(v => ({ ...v, contactEmail: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>{t(lang, "Teléfono", "Phone")}</Label><Input type="tel" value={intake.contactPhone} onChange={e => setIntake(v => ({ ...v, contactPhone: e.target.value }))} /></div>
             <div><Label>{t(lang, "Origen", "Origin")}</Label><Input value={intake.fromAddress} onChange={e => setIntake(v => ({ ...v, fromAddress: e.target.value }))} /></div>
             <div><Label>{t(lang, "Destino", "Destination")}</Label><Input value={intake.toAddress} onChange={e => setIntake(v => ({ ...v, toAddress: e.target.value }))} /></div>
             <div><Label>{t(lang, "Fecha de mudanza", "Move date")}</Label><Input type="date" value={intake.moveDate} onChange={e => setIntake(v => ({ ...v, moveDate: e.target.value }))} /></div>
             <div><Label>{t(lang, "Tamaño de vivienda", "Home size")}</Label><Input value={intake.homeSize} onChange={e => setIntake(v => ({ ...v, homeSize: e.target.value }))} /></div>
             <div><Label>{t(lang, "Inicio de disponibilidad", "Availability start")}</Label><Input value={intake.moveAvailabilityStart} onChange={e => setIntake(v => ({ ...v, moveAvailabilityStart: e.target.value }))} /></div>
             <div><Label>{t(lang, "Fin de disponibilidad", "Availability end")}</Label><Input value={intake.moveAvailabilityEnd} onChange={e => setIntake(v => ({ ...v, moveAvailabilityEnd: e.target.value }))} /></div>
            <div><Label>{t(lang, "Fechas preferidas", "Preferred dates")}</Label><Input value={intake.preferredMoveDates} onChange={e => setIntake(v => ({ ...v, preferredMoveDates: e.target.value }))} placeholder="2026-09-27, 2026-09-28" /></div>
            <div><Label>{t(lang, "Fechas no disponibles", "Blocked dates")}</Label><Input value={intake.blockedMoveDates} onChange={e => setIntake(v => ({ ...v, blockedMoveDates: e.target.value }))} placeholder="2026-09-29" /></div>
             <div><Label>{t(lang, "Almacenaje", "Storage")}</Label><Input value={intake.storageOption} onChange={e => setIntake(v => ({ ...v, storageOption: e.target.value }))} /></div>
             <div className="sm:col-span-2"><Label>{t(lang, "Notas del cliente", "Customer notes")}</Label><Textarea value={intake.clientNotes} onChange={e => setIntake(v => ({ ...v, clientNotes: e.target.value }))} /></div>
           </fieldset>
           <div className="grid gap-2 rounded-lg bg-[#fbf9f6] p-3 sm:grid-cols-2">
             <p className="sm:col-span-2 text-xs font-bold text-[#24152e]">{t(lang, "Servicios solicitados", "Requested services")}</p>
            {([["needsInsurance", "Seguro", "Insurance"], ["needsPacking", "Empaque", "Packing"], ["needsUnpacking", "Desempaque", "Unpacking"], ["needsBox", "Cajas", "Boxes"]] as const).map(([key, es, en]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox disabled={!editable} checked={intake[key]} onCheckedChange={checked => setIntake(v => ({ ...v, [key]: checked === true }))} />{t(lang, es, en)}</label>)}
           </div>
           <div className="grid gap-3 sm:grid-cols-2">
             <div className="rounded-lg border p-3"><p className="mb-2 text-xs font-bold">{t(lang, "Servicios", "Services")}</p>{(serviceCatalog.data?.services || serviceCatalog.data || []).map((item: any) => <label key={item.id} className="flex items-center gap-2 text-sm"><Checkbox disabled={!editable} checked={selectedServiceIds.includes(item.id)} onCheckedChange={checked => setSelectedServiceIds(ids => checked === true ? (ids.includes(item.id) ? ids : [...ids, item.id]) : ids.filter(id => id !== item.id))} />{lang === "es" ? item.nameEs || item.name : item.name}</label>)}</div>
             <div className="rounded-lg border p-3"><p className="mb-2 text-xs font-bold">{t(lang, "Adicionales", "Add-ons")}</p>{(addOnCatalog.data?.addOns || addOnCatalog.data || []).map((item: any) => <label key={item.id} className="flex items-center gap-2 text-sm"><Checkbox disabled={!editable} checked={selectedAddOnIds.includes(item.id)} onCheckedChange={checked => setSelectedAddOnIds(ids => checked === true ? (ids.includes(item.id) ? ids : [...ids, item.id]) : ids.filter(id => id !== item.id))} />{lang === "es" ? item.nameEs || item.name : item.name}</label>)}</div>
           </div>
           {changedFields.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-bold">{t(lang, "Cambios pendientes", "Pending changes")} ({changedFields.length})</p><p className="mt-1">{changedFields.join(", ")}. {t(lang, "La estimación debe recalcularse y una oferta enviada no se modifica.", "The estimate should be recalculated; a sent offer will not be modified.")}</p></div>}
           <div><Label>{t(lang, "Motivo o contexto (opcional)", "Reason or context (optional)")}</Label><Textarea value={workspaceReason} onChange={e => setWorkspaceReason(e.target.value)} placeholder={t(lang, "Corrección confirmada con el cliente…", "Correction confirmed with customer…")} /></div>
           {reviewMutation.error && <p className="text-sm text-[#a52b3b]">{(reviewMutation.error as Error).message}</p>}
           <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { resetWorkspaceDraft(); setWorkspaceOpen(false); }}><X className="mr-2 h-4 w-4" />{t(lang, "Cancelar", "Cancel")}</Button><Button onClick={() => reviewMutation.mutate()} disabled={!editable || reviewMutation.isPending || !intake.fromAddress.trim() || !intake.toAddress.trim()}>{reviewMutation.isPending ? t(lang, "Guardando…", "Saving…") : t(lang, "Guardar cambios", "Save changes")}</Button></div>
         </DialogContent>
       </Dialog>
       <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
         <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader><DialogTitle>{t(lang, "Inventario completo", "Full inventory")}</DialogTitle><DialogDescription>{editable ? t(lang, "Agrega, renombra, recategoriza, ajusta cantidades o elimina artículos. Guarda para invalidar el estimado anterior; después debes recalcular antes de preparar otra oferta.", "Add, rename, recategorize, adjust quantities, or remove items. Saving invalidates the old estimate; recalculate before preparing another offer.") : workspace.data?.lockReason || t(lang, "La etapa actual o un servicio operativo bloquean los cambios.", "The current stage or an operational service locks changes.")}</DialogDescription></DialogHeader>
           <InventoryEditor quoteId={quoteId} items={inventoryDraft.map((item: any) => ({ ...item, id: item.id || `${item.itemName}-${item.room || "room"}`, quoteId }))} isLocked={!editable} draftMode={editable} onDraftItemsChange={setInventoryDraft} defaultCollapsed={false} onRecalculate={() => queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] })} />
           <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setInventoryDraft(quote?.inventoryItems || []); setInventoryOpen(false); }}>{t(lang, "Cancelar", "Cancel")}</Button>{editable && <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>{reviewMutation.isPending ? t(lang, "Guardando…", "Saving…") : t(lang, "Guardar inventario", "Save inventory")}</Button>}</div>
         </DialogContent>
       </Dialog>
       <Dialog open={reopenInventoryOpen} onOpenChange={setReopenInventoryOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>{t(lang, "Reabrir para corregir inventario", "Reopen to revise inventory")}</DialogTitle>
             <DialogDescription>{t(lang, "La oferta enviada y las respuestas del cliente permanecerán en el historial. La cotización volverá a revisión, se invalidará el estimado y será obligatorio recalcular y enviar una nueva revisión.", "The sent offer and customer responses remain in history. The quote returns to review, its estimate is invalidated, and a recalculation plus a new offer revision will be required.")}</DialogDescription>
           </DialogHeader>
           <div className="space-y-2">
             <Label htmlFor="inventory-revision-reason">{t(lang, "Motivo de la corrección", "Reason for revision")}</Label>
             <Textarea id="inventory-revision-reason" autoFocus value={reopenReason} onChange={event => setReopenReason(event.target.value)} placeholder={t(lang, "Describe lo confirmado con el cliente…", "Describe what was confirmed with the customer…")} />
           </div>
           {reopenInventoryMutation.error && <p role="alert" className="text-sm text-[#a52b3b]">{(reopenInventoryMutation.error as Error).message}</p>}
           <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
             <Button variant="outline" onClick={() => setReopenInventoryOpen(false)}>{t(lang, "Cancelar", "Cancel")}</Button>
             <Button onClick={() => reopenInventoryMutation.mutate()} disabled={!reopenReason.trim() || reopenInventoryMutation.isPending}>{reopenInventoryMutation.isPending ? t(lang, "Reabriendo…", "Reopening…") : t(lang, "Confirmar y editar", "Confirm & edit")}</Button>
           </div>
         </DialogContent>
       </Dialog>
      <Dialog open={!!transitionTarget} onOpenChange={open => !open && setTransitionTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>{t(lang, "Confirmar cambio de etapa", "Confirm lifecycle change")}</DialogTitle><DialogDescription>{transitionTarget && `${lang === "es" ? labels.es : labels.en} → ${lang === "es" ? QUOTE_STAGE_LABELS[transitionTarget].es : QUOTE_STAGE_LABELS[transitionTarget].en}`}</DialogDescription></DialogHeader><div className="space-y-3">{transitionTarget && terminalStages.includes(transitionTarget) && <div><Label>{t(lang, "Motivo requerido", "Required reason")}</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} /></div>}{(!transitionTarget || !terminalStages.includes(transitionTarget)) && <div><Label>{t(lang, "Nota (opcional)", "Note (optional)")}</Label><Textarea value={transitionNote} onChange={e => setTransitionNote(e.target.value)} /></div>}<Button className="w-full" onClick={() => transition.mutate()} disabled={transition.isPending || (!!transitionTarget && terminalStages.includes(transitionTarget) && !reason.trim())}>{transition.isPending ? t(lang, "Guardando…", "Saving…") : t(lang, "Confirmar", "Confirm")}</Button></div></DialogContent>
      </Dialog>
    </>
  );
}