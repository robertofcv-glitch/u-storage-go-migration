import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, MapPin, Home, Loader2, ArrowLeft, Calendar, DollarSign, Clock, AlertCircle, Star, CheckCircle, Building2, Gavel, ShieldCheck, Send, RefreshCw, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { InventoryEditor } from "@/components/quote/InventoryEditor";
import { RatingForm, StarRating } from "@/components/ratings/RatingComponents";
import { useState } from "react";
import { StorageMoveContext } from "@/components/quote/StorageMoveContext";
import { normalizeQuoteStage, QUOTE_STAGE, QUOTE_STAGE_LABELS } from "@shared/workflowStages";

interface QuoteDetails {
  id: string; quoteNumber: string | null; fromAddress: string | null; toAddress: string | null;
  moveDate: string | null; homeSize: string | null; workflowStatus: string | null; status: string | null;
  workflowMode?: string | null; isPartial: boolean | null; estimatedCost: string | null; estimatedCostHigh: string | null;
  estimatedCurrency: string | null; needsInsurance: boolean | null; needsPacking: boolean | null;
  needsUnpacking: boolean | null; needsBox: boolean | null; storageOption: string | null; createdAt: string | null;
  updatedAt: string | null; assignedMoverProfileId: string | null;
  assignedMover?: { id: string; companyName: string; userId: string } | null;
  inventoryItems: Array<{ id: string; itemName: string; room: string | null; category: string | null; quantity: number }>;
  userRating?: { id: string; starRating: number; createdAt: string } | null;
  bids?: Array<{ id: string; amount: string; status: string; notes: string | null; adjustmentReason: string | null; createdAt: string; moverProfile: { id: string; companyName: string; companyLogo: string | null; city: string | null; state: string | null } }>;
  priceProposalAmount?: string | null; priceProposalCurrency?: string | null; priceProposalNote?: string | null;
  priceProposalVersion?: number;
  priceClientResponse?: string | null;
  serviceMode?: string | null; storageMoveType?: string | null;
  storageBranchId?: string | null; storageBranchBrand?: string | null; storageBranchGooglePlaceId?: string | null;
  storageBranchName?: string | null; storageBranchAddress?: string | null; storageBranchSnapshot?: unknown;
   storageSizeLabel?: string | null; storageReservationStatus?: string | null;
   storageContractStatus?: string | null; storageRentalIntent?: string | null;
   storageSelectedUnitSnapshot?: { code?: string; usableSizeM2?: number | string; dimensions?: string; floor?: string | number; priceMxn?: number | string; promotion?: string } | null;
   storageAvailabilityStatus?: string | null; storageAvailabilityCheckedAt?: string | null;
    paymentDeadline?: string | null; collectionStatus?: string | null; collectionState?: string | null; collection?: { status?: string | null; deadline?: string | null } | null;
}

interface DispatchDetail {
  quote: Partial<QuoteDetails>;
  activeOffer: {
    id: string;
    version: number;
    amount: string;
    currency: string;
    paymentTerms?: string | null;
    terms?: string | null;
    deadline?: string | null;
    note?: string | null;
  } | null;
  assignment: {
    moverProfileId?: string; startsAt: string; endsAt: string; status: string; vehicleCount?: number;
    vehicles?: Array<{ vehicle?: { name?: string; vehicleType?: string; capacity?: string } }>;
  } | null;
}

const lockedStages = new Set<string>([
  QUOTE_STAGE.SENT,
  QUOTE_STAGE.AWAITING_DECISION,
  QUOTE_STAGE.ACCEPTED_PENDING_BOOKING_PAYMENT,
  QUOTE_STAGE.CLOSED_WON,
  QUOTE_STAGE.CLOSED_LOST,
  QUOTE_STAGE.CANCELLED,
  QUOTE_STAGE.EXPIRED,
]);
const legacyLockedStatuses = new Set(["bidding_closed", "selection"]);
const statusLabels: Record<string, { es: string; en: string }> = {
  intake: { es: "Recibido", en: "Received" }, triage: { es: "En revisión", en: "Under review" },
  solicited: { es: "Solicitud enviada", en: "Request sent" }, price_awaiting_client: { es: "Tu aprobación", en: "Your approval" },
  dispatch_planning: { es: "Coordinando despacho", en: "Coordinating dispatch" },
  assignment_pending_partner: { es: "Confirmando equipo", en: "Confirming your crew" },
  bidding_open: { es: "Recibiendo ofertas", en: "Receiving bids" }, bidding_closed: { es: "Ofertas cerradas", en: "Bidding closed" },
  selection: { es: "Selección", en: "Selection" }, confirmed: { es: "Confirmado", en: "Confirmed" },
  scheduled: { es: "Programado", en: "Scheduled" }, in_progress: { es: "En proceso", en: "In progress" },
  completed: { es: "Completado", en: "Completed" }, cancelled: { es: "Cancelado", en: "Cancelled" },
  sent: { es: QUOTE_STAGE_LABELS.sent.es, en: QUOTE_STAGE_LABELS.sent.en },
  awaiting_decision: { es: QUOTE_STAGE_LABELS.awaiting_decision.es, en: QUOTE_STAGE_LABELS.awaiting_decision.en },
  accepted_pending_booking_payment: { es: QUOTE_STAGE_LABELS.accepted_pending_booking_payment.es, en: QUOTE_STAGE_LABELS.accepted_pending_booking_payment.en },
  closed_won: { es: QUOTE_STAGE_LABELS.closed_won.es, en: QUOTE_STAGE_LABELS.closed_won.en },
  closed_lost: { es: QUOTE_STAGE_LABELS.closed_lost.es, en: QUOTE_STAGE_LABELS.closed_lost.en },
  expired: { es: QUOTE_STAGE_LABELS.expired.es, en: QUOTE_STAGE_LABELS.expired.en },
};
const homeSizeLabels: Record<string, { es: string; en: string }> = {
  studio: { es: "Estudio", en: "Studio" }, "1br": { es: "1 recámara", en: "1 bedroom" }, "2br": { es: "2 recámaras", en: "2 bedrooms" },
  "3br": { es: "3 recámaras", en: "3 bedrooms" }, "4br": { es: "4+ recámaras", en: "4+ bedrooms" }, house: { es: "Casa", en: "House" },
  office: { es: "Oficina", en: "Office" }, commercial: { es: "Comercial", en: "Commercial" },
};

const copy = (lang: "es" | "en", esText: string, enText: string) => lang === "es" ? esText : enText;

export default function ClientQuoteDetails() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "es" ? "es" : "en";
  const locale = lang === "es" ? es : enUS;
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/dashboard/quotes/:quoteId");
  const quoteId = params?.quoteId;
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [isResponding, setIsResponding] = useState(false);

  const sidebarLinks = [
    { href: "/dashboard", label: copy(lang, "Resumen", "Overview"), icon: Home },
    { href: "/dashboard/moves", label: copy(lang, "Mis mudanzas", "My moves"), icon: Truck },
    { href: "/dashboard/quotes", label: copy(lang, "Cotizaciones", "Quotes"), icon: Package },
    { href: "/dashboard/saved", label: copy(lang, "Guardado", "Saved"), icon: MapPin },
  ];
  const { data, isLoading, isError, refetch } = useQuery<{ quote: QuoteDetails }>({
    queryKey: [`/api/client/quotes/${quoteId}`],
    queryFn: async () => { const r = await fetch(`/api/client/quotes/${quoteId}`, { credentials: "include" }); if (!r.ok) throw new Error("quote"); return r.json(); },
    enabled: !!quoteId && !!authUser,
  });
  const isDispatch = data?.quote?.workflowMode === "dispatch";
  const { data: dispatchData, isLoading: dispatchLoading } = useQuery<DispatchDetail>({
    queryKey: [`/api/client/dispatch/quotes/${quoteId}/detail`],
    queryFn: async () => { const r = await fetch(`/api/client/dispatch/quotes/${quoteId}/detail`, { credentials: "include" }); if (!r.ok) throw new Error("dispatch"); return r.json(); },
    enabled: !!quoteId && !!authUser && isDispatch,
  });

  const respond = async (response: "accepted" | "rejected" | "change_requested") => {
    if ((response === "change_requested" || response === "rejected") && !changeNote.trim()) { setActionError(copy(lang, response === "rejected" ? "Agrega una razón para rechazar la propuesta." : "Agrega una nota para solicitar cambios.", response === "rejected" ? "Add a reason for declining the proposal." : "Add a note to request a change.")); return; }
    setIsResponding(true); setActionError("");
    try {
      const r = await fetch(`/api/client/dispatch/quotes/${quoteId}/price-response`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response, proposalVersion: quote.priceProposalVersion, ...(changeNote.trim() ? { note: changeNote.trim() } : {}) }) });
      if (!r.ok) { const body = await r.json().catch(() => null); throw new Error(body?.message || "response"); }
      setChangeNote("");
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: [`/api/client/dispatch/quotes/${quoteId}/detail`] })]);
    } catch (e) { setActionError(e instanceof Error ? e.message : copy(lang, "No pudimos guardar tu respuesta.", "We could not save your response.")); }
    finally { setIsResponding(false); }
  };

  if (isLoading || (isDispatch && dispatchLoading)) return <DashboardLayout links={sidebarLinks} userType="client"><div className="space-y-4 p-2"><div className="h-8 w-56 animate-pulse rounded bg-[#eadfd8]" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-44 animate-pulse rounded-xl bg-[#f1e9e4]" /><div className="h-44 animate-pulse rounded-xl bg-[#f1e9e4]" /></div><div className="h-48 animate-pulse rounded-xl bg-[#f1e9e4]" /></div></DashboardLayout>;
  if (isError || !data?.quote) return <DashboardLayout links={sidebarLinks} userType="client"><div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center"><AlertCircle className="h-12 w-12 text-[#8d3f3a]" /><h2 className="text-xl">{copy(lang, "No encontramos esta cotización", "We couldn't find this quote")}</h2><p className="text-muted-foreground">{copy(lang, "Intenta actualizar o vuelve a tus cotizaciones.", "Try refreshing or return to your quotes.")}</p><div className="flex gap-2"><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />{copy(lang, "Reintentar", "Try again")}</Button><Button onClick={() => setLocation("/dashboard/quotes")}><ArrowLeft className="mr-2 h-4 w-4" />{copy(lang, "Volver", "Back")}</Button></div></div></DashboardLayout>;

  const activeOffer = dispatchData?.activeOffer;
  const quote = {
    ...data.quote,
    ...(dispatchData?.quote || {}),
    ...(activeOffer ? {
      priceProposalAmount: activeOffer.amount,
      priceProposalVersion: activeOffer.version,
      priceProposalCurrency: activeOffer.currency,
      priceProposalNote: activeOffer.note,
      paymentDeadline: activeOffer.deadline,
    } : {}),
  };
  const status = quote.workflowStatus || "intake";
  const canonicalStage = normalizeQuoteStage(status);
  const statusLabel = statusLabels[status]?.[lang] || status;
  const isPriceAwaiting = isDispatch && canonicalStage === QUOTE_STAGE.AWAITING_DECISION && !quote.priceClientResponse;
  const isOfferVisible = isDispatch && !!activeOffer && ([QUOTE_STAGE.SENT, QUOTE_STAGE.AWAITING_DECISION] as string[]).includes(canonicalStage);
  const isPriceRejected = isDispatch && (canonicalStage === QUOTE_STAGE.CLOSED_LOST || canonicalStage === QUOTE_STAGE.CANCELLED || quote.priceClientResponse === "rejected");
  const isAssignmentPending = isDispatch && status === "assignment_pending_partner";
  const isConfirmed = isDispatch && ["confirmed", "scheduled", "in_progress", "completed"].includes(status);
  const assignment = dispatchData?.assignment;
  const assignedPartner = quote.assignedMover;
  const collection = quote.collection;
  const hasCollectionData = Boolean(collection || quote.collectionStatus || quote.collectionState || quote.paymentDeadline);

  return <DashboardLayout links={sidebarLinks} userType="client">
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex items-start gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/quotes")} aria-label={copy(lang, "Volver", "Back")}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8d3f3a]">U-Storage Go</p><Badge className="border-0 bg-[#351d3d] text-[#fff8f2]">{statusLabel}</Badge></div><h1 className="mt-1 text-3xl text-[#241a27]">{quote.quoteNumber || quote.id.slice(0, 8)}</h1>{quote.createdAt && <p className="text-sm text-muted-foreground">{copy(lang, "Creado", "Created")} {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true, locale })}</p>}</div></header>

      {isDispatch && <Card className="overflow-hidden border-[#d9c4bd] bg-[#fff8f2] shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-4"><div className="rounded-full bg-[#351d3d] p-3 text-[#f7b17c]"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="text-lg text-[#351d3d]">{copy(lang, "Un equipo, una respuesta clara", "One team, one clear answer")}</h2><p className="mt-1 text-sm leading-6 text-[#644f59]">{copy(lang, "U-Storage Go coordina tu servicio directamente. No estás comparando subastas: te acompañamos desde la propuesta hasta la confirmación.", "U-Storage Go coordinates your service directly. You are not comparing an auction: we stay accountable from proposal through confirmation.")}</p></div></div></CardContent></Card>}
      {isDispatch && ["solicited", "triage", "intake"].includes(status) && <Card className="border-[#d9c4bd] bg-[#f7f1ed]"><CardContent className="flex items-start gap-4 p-5"><Clock className="mt-1 h-6 w-6 shrink-0 text-[#b85631]" /><div><h2 className="text-lg text-[#351d3d]">{copy(lang, "Estamos revisando tu solicitud", "We are reviewing your request")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy(lang, "Nuestro equipo está validando los detalles de tu mudanza antes de preparar una propuesta clara. No necesitas hacer nada por ahora.", "Our team is validating your move details before preparing a clear proposal. There is nothing you need to do right now.")}</p></div></CardContent></Card>}

       {isOfferVisible && <Card className="border-[#ee9c68] bg-[#fff4eb] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-[#351d3d]"><DollarSign className="h-5 w-5 text-[#b85631]" />{copy(lang, "Propuesta de precio", "Price proposal")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-xl bg-[#351d3d] p-5 text-[#fff8f2]"><p className="text-sm text-[#f4cdb5]">{copy(lang, "Precio propuesto por tu equipo de operaciones", "Price proposed by your operations team")}</p><p className="mt-1 text-4xl font-semibold">{Number(activeOffer.amount).toLocaleString()} <span className="text-base font-normal text-[#f4cdb5]">{activeOffer.currency || "MXN"}</span></p>{activeOffer.note && <p className="mt-3 border-t border-white/20 pt-3 text-sm text-[#f7dfd1]">{activeOffer.note}</p>}</div>{canonicalStage === QUOTE_STAGE.SENT && <p className="text-sm text-muted-foreground">{copy(lang, "La propuesta fue enviada. Te avisaremos cuando esté lista para tu decisión.", "The proposal was sent. We will let you know when it is ready for your decision.")}</p>}{isPriceAwaiting && <><div><label htmlFor="change-note" className="text-sm font-medium">{copy(lang, "Nota para el equipo (obligatoria si solicitas cambios o rechazas)", "Note for the team (required when requesting changes or declining)")}</label><textarea id="change-note" value={changeNote} onChange={e => setChangeNote(e.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-lg border border-[#d9c4bd] bg-[#fffdfb] p-3 text-sm outline-none focus:ring-2 focus:ring-[#ee9c68]" placeholder={copy(lang, "¿Qué te gustaría revisar?", "What would you like us to review?")} /></div>{actionError && <p role="alert" className="text-sm font-medium text-[#8d3f3a]">{actionError}</p>}<div className="flex flex-col gap-2 sm:flex-row"><Button disabled={isResponding} onClick={() => respond("accepted")} className="bg-[#b85631] text-white hover:bg-[#94452a]">{isResponding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{copy(lang, "Aceptar precio", "Accept price")}</Button><Button disabled={isResponding || !changeNote.trim()} variant="outline" onClick={() => respond("change_requested")}><Send className="mr-2 h-4 w-4" />{copy(lang, "Solicitar un cambio", "Request a change")}</Button><Button disabled={isResponding || !changeNote.trim()} variant="outline" onClick={() => respond("rejected")}><AlertCircle className="mr-2 h-4 w-4" />{copy(lang, "Rechazar propuesta", "Decline proposal")}</Button></div></>}</CardContent></Card>}
       {isPriceRejected && <Card className="border-[#d9c4bd] bg-[#f7f1ed]"><CardContent className="flex items-start gap-4 p-5"><AlertCircle className="mt-1 h-6 w-6 shrink-0 text-[#8d3f3a]" /><div><h2 className="text-lg text-[#351d3d]">{copy(lang, "Propuesta rechazada", "Proposal declined")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy(lang, "Esta cotización se cerró porque rechazaste la propuesta de precio. Puedes contactar a soporte si deseas iniciar una nueva solicitud.", "This quote was closed because you declined the price proposal. Contact support if you would like to start a new request.")}</p></div></CardContent></Card>}

      {isAssignmentPending && <Card className="border-[#d9c4bd] bg-[#f7f1ed]"><CardContent className="flex items-start gap-4 p-5"><Clock className="mt-1 h-6 w-6 shrink-0 text-[#b85631]" /><div><h2 className="text-lg text-[#351d3d]">{copy(lang, "Estamos confirmando tu equipo", "We are confirming your moving team")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy(lang, "Tu precio fue aceptado. Nuestro equipo está cerrando la disponibilidad; te mostraremos los datos del socio cuando la asignación esté confirmada.", "Your price was accepted. Our team is finalizing availability; partner details will appear once the assignment is confirmed.")}</p></div></CardContent></Card>}
      {isDispatch && status === "dispatch_planning" && <Card className="border-[#d9c4bd] bg-[#f7f1ed]"><CardContent className="flex items-start gap-4 p-5"><Clock className="mt-1 h-6 w-6 text-[#b85631]" /><p className="text-sm leading-6 text-[#644f59]">{copy(lang, "Precio aceptado. Estamos organizando la asignación y te avisaremos cuando esté confirmada.", "Price accepted. We are arranging the assignment and will let you know when it is confirmed.")}</p></CardContent></Card>}

      {isConfirmed && <Card className="border-[#a9c9b5] bg-[#f1f8f2]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#28513b]"><CheckCircle className="h-5 w-5" />{copy(lang, "Servicio confirmado", "Service confirmed")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#52745e]">{copy(lang, "Socio confirmado", "Confirmed partner")}</p><p className="mt-1 font-semibold">{assignedPartner?.companyName || copy(lang, "Socio confirmado", "Confirmed partner")}</p></div>{assignment && <><div><p className="text-xs font-semibold uppercase tracking-wider text-[#52745e]">{copy(lang, "Horario", "Schedule")}</p><p className="mt-1 font-semibold">{format(new Date(assignment.startsAt), "PPP p", { locale })} – {format(new Date(assignment.endsAt), "p", { locale })}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-[#52745e]">{copy(lang, "Vehículos asignados", "Allocated vans")}</p><p className="mt-1 flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" />{assignment.vehicleCount || assignment.vehicles?.length || 0}</p>{assignment.vehicles?.length ? <p className="mt-1 text-sm text-muted-foreground">{assignment.vehicles.map(v => [v.vehicle?.name, v.vehicle?.vehicleType, v.vehicle?.capacity].filter(Boolean).join(" · ")).join(", ")}</p> : null}</div></>}</CardContent></Card>}

       <StorageMoveContext quote={quote} lang={lang} compact />
       {hasCollectionData && <Card className="border-[#ee9c68] bg-[#fff8f2]"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="text-sm font-semibold text-[#351d3d]">{copy(lang, "Estado del pago", "Payment status")}</p><p className="mt-1 text-sm text-muted-foreground">{collection?.status || quote.collectionStatus || quote.collectionState || copy(lang, "Pendiente", "Pending")}</p></div>{(quote.paymentDeadline || collection?.deadline) && <div className="text-right"><p className="text-xs uppercase tracking-wider text-muted-foreground">{copy(lang, "Fecha límite", "Deadline")}</p><p className="mt-1 flex items-center gap-1 font-semibold text-[#8d3f3a]"><Clock className="h-4 w-4" />{format(new Date(quote.paymentDeadline || collection?.deadline || ""), "PPP p", { locale })}</p></div>}</CardContent></Card>}
       <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#b85631]" />{copy(lang, "Ubicaciones", "Locations")}</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-sm text-muted-foreground">{copy(lang, "Origen", "Origin")}</p><p className="mt-1">{quote.fromAddress || "-"}</p></div><div><p className="text-sm text-muted-foreground">{copy(lang, "Destino", "Destination")}</p><p className="mt-1">{quote.toAddress || "-"}</p></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-[#b85631]" />{copy(lang, "Detalles de la mudanza", "Move details")}</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">{copy(lang, "Fecha", "Date")}</p><p className="mt-1">{quote.moveDate ? format(new Date(quote.moveDate), "PPP", { locale }) : "-"}</p></div><div><p className="text-sm text-muted-foreground">{copy(lang, "Tamaño", "Size")}</p><p className="mt-1 flex items-center gap-2"><Home className="h-4 w-4" />{homeSizeLabels[quote.homeSize || ""]?.[lang] || quote.homeSize || "-"}</p></div></div>{(quote.needsInsurance || quote.needsPacking || quote.needsUnpacking || quote.needsBox || quote.storageOption) && <div className="mt-4 flex flex-wrap gap-2">{quote.needsInsurance && <Badge variant="secondary">{copy(lang, "Seguro", "Insurance")}</Badge>}{quote.needsPacking && <Badge variant="secondary">{copy(lang, "Empaque", "Packing")}</Badge>}{quote.needsUnpacking && <Badge variant="secondary">{copy(lang, "Desempaque", "Unpacking")}</Badge>}{quote.needsBox && <Badge variant="secondary">{copy(lang, "Cajas", "Boxes")}</Badge>}{quote.storageOption && <Badge variant="secondary">{copy(lang, "Almacenaje", "Storage")}</Badge>}</div>}</CardContent></Card></div>

      {!isDispatch && quote.bids?.length ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5" />{copy(lang, "Ofertas recibidas", "Offers received")} ({quote.bids.length})</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{quote.bids.map(bid => <Card key={bid.id} className={bid.status === "selected" || bid.status === "accepted" ? "border-2 border-[#a9c9b5] bg-[#f1f8f2]" : ""}><CardContent className="p-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#351d3d]/10">{bid.moverProfile.companyLogo ? <img src={bid.moverProfile.companyLogo} alt={bid.moverProfile.companyName} className="h-11 w-11 rounded-full object-cover" /> : <Building2 className="h-5 w-5 text-[#351d3d]" />}</div><div><h3 className="font-semibold">{bid.moverProfile.companyName}</h3><p className="text-xs text-muted-foreground">{[bid.moverProfile.city, bid.moverProfile.state].filter(Boolean).join(", ")}</p></div></div><p className="mt-4 rounded-lg bg-[#f9e0ce] p-3 text-center text-2xl font-semibold">{Number(bid.amount).toLocaleString()} <span className="text-xs">MXN</span></p>{bid.notes && <p className="mt-3 text-sm text-muted-foreground">{bid.notes}</p>}</CardContent></Card>)}</div></CardContent></Card> : null}

      {quote.estimatedCost && !isPriceAwaiting && <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{copy(lang, "Estimación", "Estimate")}</p><p className="text-2xl font-semibold">{Number(quote.estimatedCost).toLocaleString()} – {Number(quote.estimatedCostHigh || quote.estimatedCost).toLocaleString()} <span className="text-sm font-normal">{quote.estimatedCurrency || "MXN"}</span></p></div><Info className="h-5 w-5 text-[#b85631]" /></CardContent></Card>}

      <InventoryEditor quoteId={quote.id} items={(quote.inventoryItems || []).map(item => ({ ...item, quoteId: quote.id }))} isLocked={lockedStages.has(canonicalStage) || legacyLockedStatuses.has(status)} onItemsChange={() => refetch()} onRecalculate={() => refetch()} defaultCollapsed />
      {(lockedStages.has(canonicalStage) || legacyLockedStatuses.has(status)) && <Card className="border-[#e7c58f] bg-[#fff7e5]"><CardContent className="flex items-start gap-3 p-4 text-sm text-[#725421]"><Clock className="mt-0.5 h-5 w-5 shrink-0" /><p>{copy(lang, "El inventario está bloqueado porque tu solicitud ya entró en coordinación operativa. Así protegemos el precio y la asignación acordados. Si necesitas un cambio, contacta a soporte.", "Inventory is locked because your request is already in operational coordination. This protects the agreed price and assignment. Contact support if you need a change.")}</p></CardContent></Card>}

      {quote.workflowStatus === "completed" && <>{quote.userRating || ratingSubmitted ? <Card className="border-[#a9c9b5] bg-[#f1f8f2]"><CardContent className="flex flex-col items-center gap-3 p-6 text-center"><CheckCircle className="h-10 w-10 text-[#39734e]" /><h2>{copy(lang, "Gracias por tu calificación", "Thank you for your rating")}</h2>{quote.userRating && <StarRating rating={quote.userRating.starRating} size="md" showLabel />}</CardContent></Card> : quote.assignedMover ? <RatingForm quoteId={quote.id} targetUserId={quote.assignedMover.userId} moverProfileId={quote.assignedMoverProfileId || undefined} direction="client_to_partner" companyName={quote.assignedMover.companyName} onSuccess={() => { setRatingSubmitted(true); refetch(); }} /> : <Card><CardContent className="flex items-center gap-3 p-5"><Star className="h-5 w-5 text-[#b85631]" /><p>{copy(lang, "La calificación estará disponible cuando se asigne un socio.", "Rating will be available once a partner is assigned.")}</p></CardContent></Card>}</>}
    </div>
  </DashboardLayout>;
}