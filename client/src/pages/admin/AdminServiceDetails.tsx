import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, CreditCard, Flag, Loader2, MapPin, PackageCheck, Route, Truck, Upload, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useTranslation } from "react-i18next";
import { normalizeServiceStage, SERVICE_STAGE_LABELS } from "@shared/workflowStages";

type Checklist = { key: string; label?: string; labelEs?: string; completed: boolean; notes?: string | null; required?: boolean };
type Service = { id: string; quote?: any; snapshot?: any; collection?: any; collections?: any[]; checklist?: Checklist[]; assignment?: any; resources?: any; stage?: string; readinessStatus?: string; timeline?: any[]; feedback?: any; paymentDeadline?: string | null; alerts?: string[]; [key: string]: any };
const SERVICE_FLOW = ["confirmed", "scheduled", "team_assigned", "en_route", "in_progress", "finished"] as const;
const STAGE_GUIDANCE: Record<string, { es: string; en: string; detailEs: string; detailEn: string }> = {
  confirmed: { es: "Reserva confirmada", en: "Booking confirmed", detailEs: "Verifica fecha, alcance, pago y datos del cliente antes de programar la operación.", detailEn: "Verify the date, scope, payment, and customer details before scheduling operations." },
  scheduled: { es: "Operación programada", en: "Operation scheduled", detailEs: "Confirma la ventana de servicio y completa la preparación requerida.", detailEn: "Confirm the service window and complete all required preparation." },
  team_assigned: { es: "Recursos confirmados", en: "Resources confirmed", detailEs: "Revisa vehículo, cuadrilla, capacidad y contacto operativo antes de la salida.", detailEn: "Review vehicle, crew, capacity, and operating contact before departure." },
  en_route: { es: "Equipo en traslado", en: "Team travelling", detailEs: "Da seguimiento a la llegada y registra cualquier incidencia o retraso.", detailEn: "Track arrival and record any incident or delay." },
  in_progress: { es: "Servicio en ejecución", en: "Service underway", detailEs: "Documenta avances, evidencia y cambios de alcance durante la operación.", detailEn: "Document progress, evidence, and scope changes during the operation." },
  finished: { es: "Servicio finalizado", en: "Service finished", detailEs: "La operación terminó. Revisa evidencia, cierre y solicitud de feedback.", detailEn: "Operations are complete. Review evidence, closure, and the feedback request." },
  on_hold: { es: "Servicio en pausa", en: "Service on hold", detailEs: "Resuelve la incidencia registrada antes de reanudar la operación.", detailEn: "Resolve the recorded incident before resuming operations." },
  cancelled: { es: "Servicio cancelado", en: "Service cancelled", detailEs: "Consulta la razón y el historial para cualquier seguimiento necesario.", detailEn: "Review the reason and history for any required follow-up." },
};
async function request(url: string, method: string, body?: unknown) { const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) { const b = await r.json().catch(() => null); throw new Error(b?.message || "Request failed"); } return r.json(); }
const read = (body: any): Service => {
  const service = body?.service || body?.data || body || {};
  const snapshot = typeof service.snapshot === "string" ? (() => { try { return JSON.parse(service.snapshot); } catch { return {}; } })() : (service.snapshot || {});
  return {
    ...snapshot,
    ...service,
    quote: service.quote || body?.quote || snapshot.quote || snapshot.quoteSnapshot,
    collection: body?.collection || service.collection || snapshot.collection,
    checklist: body?.checklist || service.checklist || snapshot.checklist || [],
    timeline: body?.timeline || service.timeline || [],
    feedback: body?.feedback || service.feedback || snapshot.feedback,
  };
};

function ServiceStageActions({
  stage,
  pending,
  hasReason,
  lang,
  onTransition,
}: {
  stage: string;
  pending: boolean;
  hasReason: boolean;
  lang: "es" | "en";
  onTransition: (stage: string) => void;
}) {
  const primary = {
    confirmed: { next: "scheduled", es: "Programar servicio", en: "Schedule service" },
    scheduled: { next: "team_assigned", es: "Confirmar equipo asignado", en: "Confirm assigned team" },
    team_assigned: { next: "en_route", es: "Marcar en camino", en: "Mark en route" },
    en_route: { next: "in_progress", es: "Iniciar servicio", en: "Start service" },
    in_progress: { next: "finished", es: "Finalizar servicio", en: "Finish service" },
  }[stage];
  const terminal = stage === "finished" || stage === "cancelled";

  return (
    <div className="flex flex-wrap gap-2">
      {primary && (
        <Button onClick={() => onTransition(primary.next)} disabled={pending}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {lang === "es" ? primary.es : primary.en}
        </Button>
      )}
      {stage === "on_hold" && (
        <Button variant="outline" onClick={() => onTransition("confirmed")} disabled={pending}>
          {lang === "es" ? "Reanudar como confirmado" : "Resume as confirmed"}
        </Button>
      )}
      {!terminal && stage !== "on_hold" && (
        <Button variant="outline" onClick={() => onTransition("on_hold")} disabled={pending || !hasReason}>
          <XCircle className="mr-2 h-4 w-4" />
          {lang === "es" ? "Poner en pausa" : "Put on hold"}
        </Button>
      )}
      {!terminal && (
        <Button variant="destructive" onClick={() => onTransition("cancelled")} disabled={pending || !hasReason}>
          {lang === "es" ? "Cancelar" : "Cancel"}
        </Button>
      )}
    </div>
  );
}

export default function AdminServiceDetails() {
  const { i18n } = useTranslation(); const lang = i18n.language === "es" ? "es" : "en"; const [, setLocation] = useLocation(); const [, params] = useRoute("/admin/dashboard/services/:serviceId"); const id = params?.serviceId; const qc = useQueryClient();
  const [note, setNote] = useState(""); const [reason, setReason] = useState(""); const [evidence, setEvidence] = useState(""); const [transfer, setTransfer] = useState({ amount: "", reference: "", evidenceReference: "", notes: "" }); const [review, setReview] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: [`/api/admin/services/${id}`], enabled: !!id, queryFn: async () => read(await request(`/api/admin/services/${id}`, "GET")) });
  const mutate = useMutation({ mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) => request(url, method, body), onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/admin/services/${id}`] }); qc.invalidateQueries({ queryKey: ["/api/admin/services"] }); setNote(""); setEvidence(""); } });
  const service = query.data as Service | undefined; const quote = service?.quote || service?.snapshot || service || {}; const collection = service?.collection || service?.collections?.[0]; const paymentDeadline = service?.paymentDeadline || collection?.deadline || quote.paymentDeadline; const stage = normalizeServiceStage(service?.stage); const stageText = lang === "es" ? SERVICE_STAGE_LABELS[stage].es : SERVICE_STAGE_LABELS[stage].en;
   const act = (toStage: string) => {
     const canonicalStage: Record<string, string> = { pre_service: "scheduled", ready: "team_assigned", post_service: "finished", completed: "finished", exception: "on_hold" };
     toStage = canonicalStage[toStage] || toStage;
     if ((toStage === "on_hold" || toStage === "cancelled") && !reason.trim()) return;
    mutate.mutate({ url: `/api/admin/services/${id}/transition`, method: "POST", body: { toStage, reason: reason || undefined, notes: note || undefined, evidenceReference: evidence || undefined } });
  };
  const title = lang === "es" ? "Detalle del servicio" : "Service detail";
  if (query.isLoading) return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="p-8 text-muted-foreground">{lang === "es" ? "Cargando…" : "Loading…"}</div></DashboardLayout>;
  if (query.isError || !service) return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="p-8 text-red-700">{lang === "es" ? "No se pudo cargar el servicio." : "Service could not be loaded."}</div></DashboardLayout>;
  const checklist = service.checklist || []; const collections = service.collections || (service.collection ? [service.collection] : []);
  const snapshot = service.snapshot || {};
  const addresses = snapshot.addresses || {};
  const price = snapshot.price || {};
  const capacity = snapshot.capacity || {};
  const currentFlowIndex = SERVICE_FLOW.indexOf(stage as typeof SERVICE_FLOW[number]);
  const completedChecklist = checklist.filter(item => item.completed).length;
  const requiredChecklist = checklist.filter(item => item.required !== false).length;
  const guidance = STAGE_GUIDANCE[stage];
  const vehicles = Array.isArray(service.resources) ? service.resources.map((item: any) => item.vehicle || item) : (service.resources?.vehicles || []);
  return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="flex flex-1 items-start gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/admin/dashboard/services")}><ArrowLeft className="h-5 w-5" /></Button><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b85631]">{lang === "es" ? "Operaciones · Servicios" : "Operations · Services"}</p><h1 className="mt-1 text-3xl font-semibold text-[#351d3d]">{title}</h1><p className="text-muted-foreground">{quote.quoteNumber || snapshot.quoteNumber || service.id}</p></div></div><div className="flex items-center gap-2 self-end sm:self-auto"><Button variant="outline" onClick={() => setLocation(`/admin/dashboard/quotes/${service.quoteId || quote.id}`)}>{lang === "es" ? "Ver cotización" : "View quote"}</Button><Badge className="bg-[#351d3d] px-3 py-1.5 text-white">{stageText}</Badge></div></header>
    {service.alerts?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{service.alerts.join(" · ")}</div> : null}
    <Card className="overflow-hidden border-[#d9c4bd]">
      <CardHeader className="bg-[#fff8f2] pb-4"><CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-[#b85631]" />{lang === "es" ? "Progreso del servicio" : "Service progress"}</CardTitle><p className="text-sm text-muted-foreground">{lang === "es" ? guidance.detailEs : guidance.detailEn}</p></CardHeader>
      <CardContent className="pt-6">
        <div className="relative">
          <div className="absolute left-4 right-4 top-4 h-1 rounded-full bg-muted" />
          {currentFlowIndex >= 0 && <div className="absolute left-4 top-4 h-1 rounded-full bg-[#b85631] transition-all" style={{ width: `calc(${Math.max(currentFlowIndex, 0) / (SERVICE_FLOW.length - 1) * 100}% - ${currentFlowIndex === SERVICE_FLOW.length - 1 ? "2rem" : "0rem"})` }} />}
          <div className="relative grid grid-cols-6 gap-1">
            {SERVICE_FLOW.map((flowStage, index) => { const label = SERVICE_STAGE_LABELS[flowStage]; const reached = currentFlowIndex >= index; const active = stage === flowStage; return <div key={flowStage} className="flex min-w-0 flex-col items-center text-center"><div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold ${reached ? "border-[#b85631] bg-[#b85631] text-white" : "border-muted-foreground/30 text-muted-foreground"} ${active ? "ring-4 ring-[#b85631]/20" : ""}`}>{reached && index < currentFlowIndex ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</div><span className={`mt-2 hidden text-xs font-medium sm:block ${active ? "text-[#351d3d]" : "text-muted-foreground"}`}>{lang === "es" ? label.es : label.en}</span></div>; })}
          </div>
        </div>
        {(stage === "on_hold" || stage === "cancelled") && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="font-semibold text-amber-900">{lang === "es" ? guidance.es : guidance.en}</p><p className="text-sm text-amber-800">{service.exceptionReason || service.cancellationReason || (lang === "es" ? guidance.detailEs : guidance.detailEn)}</p></div>}
      </CardContent>
    </Card>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardContent className="flex items-center gap-3 pt-6"><CalendarDays className="h-8 w-8 text-[#b85631]" /><div><p className="text-xs uppercase text-muted-foreground">{lang === "es" ? "Fecha del servicio" : "Service date"}</p><p className="font-semibold">{snapshot.moveDate || quote.moveDate ? new Date(snapshot.moveDate || quote.moveDate).toLocaleDateString() : "—"}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 pt-6"><PackageCheck className="h-8 w-8 text-[#b85631]" /><div><p className="text-xs uppercase text-muted-foreground">{lang === "es" ? "Preparación" : "Readiness"}</p><p className="font-semibold">{completedChecklist}/{requiredChecklist} {lang === "es" ? "completados" : "complete"}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 pt-6"><Truck className="h-8 w-8 text-[#b85631]" /><div><p className="text-xs uppercase text-muted-foreground">{lang === "es" ? "Vehículos" : "Vehicles"}</p><p className="font-semibold">{vehicles.length || service.assignment?.vehicleCount || 0}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 pt-6"><Users className="h-8 w-8 text-[#b85631]" /><div><p className="text-xs uppercase text-muted-foreground">{lang === "es" ? "Cuadrillas" : "Crews"}</p><p className="font-semibold">{service.assignment?.crewCountRequired || service.assignment?.crewCount || capacity.crewCount || 0}</p></div></CardContent></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>{lang === "es" ? "Cliente y alcance" : "Customer & scope"}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p className="font-semibold">{quote.customerName || quote.user?.fullName || quote.contactName || quote.user?.email || "—"}</p><p>{quote.fromAddress || "—"} → {quote.toAddress || "—"}</p><p>{lang === "es" ? "Fecha" : "Date"}: {quote.moveDate ? new Date(quote.moveDate).toLocaleString() : "—"}</p><p>{quote.storageBranchName || quote.branchName || quote.companyName || "—"}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{lang === "es" ? "Cobro" : "Collection"}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{lang === "es" ? "Estado" : "State"}: </span><Badge variant="outline">{collection?.status || collection?.state || quote.collectionStatus || "—"}</Badge></p><p>{lang === "es" ? "Plazo" : "Deadline"}: <strong>{paymentDeadline ? new Date(paymentDeadline).toLocaleString() : "—"}</strong></p><p>{lang === "es" ? "Importe" : "Amount"}: {quote.finalPrice || quote.priceProposalAmount || "—"} {quote.priceProposalCurrency || "MXN"}</p></CardContent></Card>
       <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />{lang === "es" ? "Recursos y capacidad" : "Resources & capacity"}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{service.assignment?.partnerName || service.assignment?.companyName || quote.assignedMover?.companyName || "—"}</p>{vehicles.length ? vehicles.map((vehicle: any) => <p key={vehicle.id} className="rounded bg-muted/50 px-2 py-1">{vehicle.name || vehicle.licensePlate || vehicle.id}</p>) : <p className="text-muted-foreground">{lang === "es" ? "Sin vehículos registrados" : "No vehicles recorded"}</p>}<p>{lang === "es" ? "Capacidad requerida" : "Required capacity"}: {capacity.weightKg || "—"} kg · {capacity.volumeM3 || "—"} m³</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />{lang === "es" ? "Ruta y alcance operativo" : "Route & operational scope"}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{lang === "es" ? "Origen" : "Origin"}</p><p className="mt-1 font-medium">{addresses.from || quote.fromAddress || "—"}</p></div><div className="rounded-lg border p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{lang === "es" ? "Destino" : "Destination"}</p><p className="mt-1 font-medium">{addresses.to || quote.toAddress || "—"}</p></div><div><p className="text-sm text-muted-foreground">{lang === "es" ? "Precio confirmado" : "Confirmed price"}</p><p className="text-lg font-semibold">{price.amount || quote.finalPrice || quote.priceProposalAmount || "—"} {price.currency || quote.priceProposalCurrency || "MXN"}</p></div><div><p className="text-sm text-muted-foreground">{lang === "es" ? "Notas del cliente" : "Customer notes"}</p><p className="whitespace-pre-wrap">{snapshot.clientNotes || quote.clientNotes || "—"}</p></div></CardContent></Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4" />{lang === "es" ? "Controles operativos" : "Operational controls"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label>{lang === "es" ? "Razón (obligatoria para pausa/cancelación)" : "Reason (required for hold/cancellation)"}</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div><Label>{lang === "es" ? "Nota de acción" : "Action note"}</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={lang === "es" ? "Contexto…" : "Context…"} /></div>
          <div><Label>{lang === "es" ? "Referencia de evidencia" : "Evidence reference"}</Label><Input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="URL, folio or file reference" /></div>
        </div>
        <ServiceStageActions stage={stage} pending={mutate.isPending} hasReason={Boolean(reason.trim())} lang={lang} onTransition={act} />
        {mutate.isPending && <p className="text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />{lang === "es" ? "Guardando…" : "Saving…"}</p>}
        {mutate.error && <p className="text-sm text-red-700">{(mutate.error as Error).message}</p>}
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>{lang === "es" ? "Lista de preparación" : "Readiness checklist"}</CardTitle></CardHeader><CardContent className="space-y-2">{checklist.length ? checklist.map(item => <div key={item.key} className="flex items-center gap-3 rounded border p-3"><Button size="sm" variant={item.completed ? "default" : "outline"} onClick={() => mutate.mutate({ url: `/api/admin/services/${id}/checklist/${encodeURIComponent(item.key)}`, method: "PATCH", body: { completed: !item.completed, notes: note || undefined, evidenceReference: evidence || undefined } })}>{item.completed ? "✓" : "○"}</Button><span className={item.completed ? "line-through text-muted-foreground" : ""}>{lang === "es" ? item.labelEs || item.label || item.key : item.label || item.key}{item.required && !item.completed ? <Badge className="ml-2 bg-amber-100 text-amber-900">{lang === "es" ? "Requerido" : "Required"}</Badge> : null}</span></div>) : <p className="text-sm text-muted-foreground">{lang === "es" ? "No hay elementos configurados." : "No checklist items configured."}</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />{lang === "es" ? "Transferencia bancaria" : "Bank transfer"}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><Input placeholder={lang === "es" ? "Importe" : "Amount"} value={transfer.amount} onChange={e => setTransfer({ ...transfer, amount: e.target.value })} /><Input placeholder={lang === "es" ? "Referencia" : "Reference"} value={transfer.reference} onChange={e => setTransfer({ ...transfer, reference: e.target.value })} /><Input placeholder={lang === "es" ? "Referencia de evidencia" : "Evidence reference"} value={transfer.evidenceReference} onChange={e => setTransfer({ ...transfer, evidenceReference: e.target.value })} /></div><Textarea placeholder={lang === "es" ? "Notas" : "Notes"} value={transfer.notes} onChange={e => setTransfer({ ...transfer, notes: e.target.value })} /><Button variant="outline" onClick={() => mutate.mutate({ url: `/api/admin/services/${id}/collections/bank-transfer`, method: "POST", body: { amount: Number(transfer.amount), reference: transfer.reference, evidenceReference: transfer.evidenceReference, notes: transfer.notes } })}>{lang === "es" ? "Registrar transferencia" : "Record transfer"}</Button>{collections.map(c => { const state = c.status || c.state; const awaiting = ["pending", "awaiting_validation"].includes(state); return <div key={c.id} className="rounded border p-3 text-sm"><div className="flex justify-between"><span>{c.method || c.type || "bank_transfer"} · {state || "—"}</span><span>{c.reference || c.externalReference || "—"}</span></div>{awaiting && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => mutate.mutate({ url: `/api/admin/services/${id}/collections/${c.id}/validate`, method: "POST", body: { decision: "verified", reference: review[c.id] || c.reference, notes: review[c.id] } })}>{lang === "es" ? "Validar" : "Verify"}</Button><Button size="sm" variant="outline" onClick={() => mutate.mutate({ url: `/api/admin/services/${id}/collections/${c.id}/validate`, method: "POST", body: { decision: "rejected", reason: review[c.id] } })} disabled={!review[c.id]?.trim()}>{lang === "es" ? "Rechazar" : "Reject"}</Button><Input className="max-w-[180px]" placeholder={lang === "es" ? "Nota / razón" : "Note / reason"} value={review[c.id] || ""} onChange={e => setReview({ ...review, [c.id]: e.target.value })} /></div>}<div className="mt-2 flex flex-wrap gap-2">{(["waived", "deferred", "refunded", "cancelled"] as const).map(outcome => <Button key={outcome} size="sm" variant="ghost" disabled={!review[c.id]?.trim()} onClick={() => mutate.mutate({ url: `/api/admin/services/${id}/collections/${c.id}/outcome`, method: "POST", body: { outcome, reason: review[c.id], notes: review[c.id] } })}>{outcome}</Button>)}</div></div>})}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>{lang === "es" ? "Línea de tiempo y feedback" : "Timeline & feedback"}</CardTitle></CardHeader><CardContent className="space-y-3">{service.timeline?.length ? service.timeline.map((event: any, i: number) => <div key={event.id || i} className="flex gap-3 border-l-2 border-[#d9c4bd] pl-4"><Clock3 className="h-4 w-4 text-[#b85631]" /><div><p className="font-medium">{event.label || event.action || event.actionType || "Update"}</p><p className="text-xs text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""} · {event.actorName || event.actor || ""}</p><p className="text-sm text-muted-foreground">{event.notes || event.description || ""}</p></div></div>) : <p className="text-sm text-muted-foreground">{lang === "es" ? "Sin eventos todavía." : "No events yet."}</p>}<div className="rounded-lg bg-muted/50 p-3 text-sm"><strong>{lang === "es" ? "Feedback" : "Feedback"}:</strong> {service.feedback?.status || service.feedback?.state || (lang === "es" ? "Pendiente de emitir" : "Pending issuance")}</div></CardContent></Card>
  </div></DashboardLayout>;
}