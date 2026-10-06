import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Clock3, History, LockKeyhole, RefreshCw, Search, ShieldCheck, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Lang = "es" | "en";
type Vehicle = { id: string; name: string; registration?: string | null; vehicleType?: string | null; capacity?: string | null; moverProfileId: string; isActive: boolean };
type Window = { id: string; vehicleId: string; startsAt: string; endsAt: string; isAvailable: boolean };
type FleetRow = { vehicle: Vehicle; partner: { id: string; companyName: string } | null };
type Assignment = { id: string; moverProfileId: string; startsAt: string; endsAt: string; status: string; responseNote?: string | null; partner: { companyName: string } | null; vehicles: Array<{ vehicle: Vehicle; reservation?: { status: string } | null }> };
type DispatchDetail = { quote: { workflowMode: string; workflowStatus: string; priceProposalAmount?: string | null; priceProposalVersion?: number; priceProposalCurrency?: string | null; priceProposalNote?: string | null; priceClientResponse?: string | null; priceClientChangeRequest?: string | null }; assignments: Assignment[] };

const copy = {
  es: { title: "Planificación de despacho", sub: "Selecciona fecha, disponibilidad, flota y equipo después de que el cliente acepte la propuesta.", dispatch: "Operación", plan: "Planificación de despacho", window: "Ventana operativa", morning: "Mañana · 08:00–13:00", afternoon: "Tarde · 13:00–18:00", search: "Buscar vehículo o matrícula", available: "Vehículos disponibles", partner: "Socio", choose: "Selecciona vehículos de un solo socio", propose: "Proponer asignación", locked: "La selección bloqueará inventario temporalmente hasta la respuesta del socio.", acceptanceRequired: "La asignación estará disponible cuando el cliente acepte la propuesta comercial vigente.", history: "Historial de asignaciones", noHistory: "Aún no hay asignaciones", cancel: "Cancelar", conflict: "Conflicto de disponibilidad", response: "Respuesta del socio", noVehicles: "No hay vehículos para esta ventana.", success: "Operación actualizada", error: "No se pudo completar la operación" },
  en: { title: "Dispatch planning", sub: "Select service time, availability, fleet, and crew after the customer accepts the proposal.", dispatch: "Operations", plan: "Dispatch planning", window: "Operating window", morning: "Morning · 08:00–13:00", afternoon: "Afternoon · 13:00–18:00", search: "Search vehicle or registration", available: "Available vehicles", partner: "Partner", choose: "Select vehicles from one partner", propose: "Propose assignment", locked: "Selection will temporarily lock inventory until the partner responds.", acceptanceRequired: "Assignment becomes available after the customer accepts the current commercial proposal.", history: "Assignment history", noHistory: "No assignments yet", cancel: "Cancel", conflict: "Availability conflict", response: "Partner response", noVehicles: "No vehicles for this window.", success: "Operation updated", error: "Operation could not be completed" },
};
const statusLabels: Record<string, { es: string; en: string }> = {
  solicited: { es: "Solicitado", en: "Solicited" },
  price_awaiting_client: { es: "Esperando precio", en: "Awaiting price" },
  dispatch_planning: { es: "Planificación", en: "Planning" },
  assignment_pending_partner: { es: "Esperando socio", en: "Awaiting partner" },
  confirmed: { es: "Confirmado", en: "Confirmed" },
  scheduled: { es: "Programado", en: "Scheduled" },
  in_progress: { es: "En curso", en: "In progress" },
  completed: { es: "Completado", en: "Completed" },
  cancelled: { es: "Cancelado", en: "Cancelled" },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Dispatch operation failed");
  return res.json();
}

function isoRange(date: string, period: "morning" | "afternoon") {
  const [start, end] = period === "morning" ? ["08:00", "13:00"] : ["13:00", "18:00"];
  return { startsAt: new Date(`${date}T${start}:00`).toISOString(), endsAt: new Date(`${date}T${end}:00`).toISOString() };
}

export function AdminDispatchConsole({ quoteId, quote, lang }: { quoteId: string; quote: { workflowMode?: string | null; workflowStatus?: string | null; priceProposalAmount?: string | null; priceProposalCurrency?: string | null; priceProposalNote?: string | null; priceClientResponse?: string | null; priceClientChangeRequest?: string | null; suggestedPrice?: string | null }; lang: Lang }) {
  const t = copy[lang];
  const qc = useQueryClient();
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState<"morning" | "afternoon">("morning");
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  const detail = useQuery<DispatchDetail>({ queryKey: [`/api/admin/dispatch/quotes/${quoteId}/detail`], queryFn: () => api(`/api/admin/dispatch/quotes/${quoteId}/detail`) });
  const fleet = useQuery<FleetRow[]>({ queryKey: ["/api/admin/dispatch/fleet"], queryFn: () => api("/api/admin/dispatch/fleet") });
  const range = date ? isoRange(date, period) : null;
  const availability = useQuery<Window[]>({ queryKey: ["/api/admin/dispatch/availability/search", range?.startsAt, range?.endsAt], queryFn: () => api(`/api/admin/dispatch/availability/search?startsAt=${encodeURIComponent(range!.startsAt)}&endsAt=${encodeURIComponent(range!.endsAt)}`), enabled: !!range });

  const available = useMemo(() => {
    const ids = new Set((availability.data || []).filter(w => w.isAvailable).map(w => w.vehicleId));
    return (fleet.data || []).filter(row => row.vehicle.isActive && ids.has(row.vehicle.id) && (!search || `${row.vehicle.name} ${row.vehicle.registration || ""}`.toLowerCase().includes(search.toLowerCase())));
  }, [availability.data, fleet.data, search]);
  const grouped = useMemo(() => available.reduce<Record<string, FleetRow[]>>((acc, row) => { const key = row.partner?.id || row.vehicle.moverProfileId; (acc[key] ||= []).push(row); return acc; }, {}), [available]);
  const assignments = detail.data?.assignments || [];
  const customerAccepted = (detail.data?.quote.priceClientResponse ?? quote.priceClientResponse) === "accepted";
  const planning = quote.workflowStatus === "dispatch_planning" || quote.workflowStatus === "assignment_pending_partner";

  const mutation = useMutation({
    mutationFn: async ({ kind, body, id }: { kind: "assignment" | "cancel"; body?: unknown; id?: string }) => {
      if (kind === "cancel") return api(`/api/admin/dispatch/assignments/${id}/cancel`, { method: "POST" });
      return api(`/api/admin/dispatch/quotes/${quoteId}/assignments`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { setError(""); qc.invalidateQueries({ queryKey: [`/api/admin/dispatch/quotes/${quoteId}/detail`] }); qc.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] }); toast({ title: t.success }); },
    onError: (e: Error) => { setError(e.message); toast({ title: t.error, description: e.message, variant: "destructive" }); },
  });

  const toggleVehicle = (row: FleetRow) => {
    const id = row.vehicle.id;
    if (partnerId && partnerId !== row.vehicle.moverProfileId) return;
    setSelected(current => {
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setPartnerId(next.length ? row.vehicle.moverProfileId : null);
      return next;
    });
  };
  const propose = () => {
    if (!range || !partnerId || selected.length === 0) return;
    mutation.mutate({ kind: "assignment", body: { moverProfileId: partnerId, vehicleIds: selected, ...range } });
  };

  return <section className="space-y-4" data-testid="dispatch-console">
    <div className="rounded-xl border border-[#d9c8e4] bg-[linear-gradient(110deg,#24132f,#3d1e4a)] px-5 py-4 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6a36c]"><Truck className="h-4 w-4" />{t.dispatch}</div><h2 className="mt-1 text-xl font-semibold">{t.title}</h2><p className="text-sm text-white/70">{t.sub}</p></div>
        <Badge className="border border-white/20 bg-white/10 text-white">{statusLabels[quote.workflowStatus || ""]?.[lang] || quote.workflowStatus || t.dispatch}</Badge>
      </div>
    </div>
    <div>
      <Card className="border-[#eadfd5]">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-[#ef7521]" />{t.plan}</CardTitle><CardDescription>{t.window} — ISO boundaries are sent to the dispatch service.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]"><div><Label htmlFor="dispatch-date">{lang === "es" ? "Fecha" : "Date"}</Label><Input id="dispatch-date" data-testid="dispatch-date-input" type="date" value={date} onChange={e => { setDate(e.target.value); setSelected([]); setPartnerId(null); }} className="mt-1" /></div><div><Label>{t.window}</Label><select aria-label={t.window} data-testid="dispatch-period-select" value={period} onChange={e => { setPeriod(e.target.value as "morning" | "afternoon"); setSelected([]); }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="morning">{t.morning}</option><option value="afternoon">{t.afternoon}</option></select></div></div>
          <div className="rounded-lg bg-[#faf6f1] p-3 text-xs text-[#6e625b]"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{range ? `${new Date(range.startsAt).toLocaleString()} → ${new Date(range.endsAt).toLocaleString()}` : (lang === "es" ? "Elige una fecha para buscar inventario." : "Choose a date to search inventory.")}</div>
           {!customerAccepted && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><LockKeyhole className="h-4 w-4" />{t.acceptanceRequired}</div>}
           {customerAccepted && planning && <div className="flex items-center gap-2 rounded-lg border border-[#d6eadb] bg-[#f1faf3] p-3 text-sm text-[#245c35]"><ShieldCheck className="h-4 w-4" />{t.locked}</div>}
        </CardContent>
      </Card>
    </div>
    <Card className="border-[#eadfd5]">
      <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-[#ef7521]" />{t.available}</CardTitle><CardDescription>{t.choose}</CardDescription></div><div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={t.search} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="dispatch-vehicle-search" /></div></div></CardHeader>
      <CardContent>
        {!date ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{lang === "es" ? "Selecciona fecha y ventana para consultar flota." : "Select a date and window to query the fleet."}</div> : availability.isLoading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />{lang === "es" ? "Consultando inventario..." : "Checking inventory..."}</div> : Object.keys(grouped).length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.noVehicles}</div> : <div className="space-y-3">
          {Object.entries(grouped).map(([key, rows]) => { const partner = rows[0].partner; const locked = !!partnerId && partnerId !== rows[0].vehicle.moverProfileId; return <div key={key} className={`rounded-lg border ${locked ? "opacity-45" : "border-[#e5d9cf]"}`}><div className="flex items-center justify-between border-b bg-[#fcfaf8] px-3 py-2"><span className="text-sm font-semibold">{partner?.companyName || t.partner}</span><Badge variant="outline">{rows.length} {lang === "es" ? "disponibles" : "available"}</Badge></div><div className="grid gap-2 p-2 md:grid-cols-2">{rows.map(row => <button type="button" key={row.vehicle.id} disabled={locked} onClick={() => toggleVehicle(row)} data-testid={`dispatch-vehicle-${row.vehicle.id}`} className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${selected.includes(row.vehicle.id) ? "border-[#ef7521] bg-[#fff3e9]" : "border-transparent bg-[#f8f7f5] hover:border-[#ef7521]"}`}><span className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${selected.includes(row.vehicle.id) ? "bg-[#ef7521] text-white" : "bg-[#eadfd5] text-[#493d35]"}`}>{selected.includes(row.vehicle.id) ? <Check className="h-4 w-4" /> : <Truck className="h-4 w-4" />}</span><span><span className="block text-sm font-medium">{row.vehicle.name}</span><span className="block text-xs text-muted-foreground">{row.vehicle.registration || row.vehicle.vehicleType || "—"}{row.vehicle.capacity ? ` · ${row.vehicle.capacity}` : ""}</span></span></span><ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" /></button>)}</div></div> })}
        </div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-muted-foreground">{selected.length} {lang === "es" ? "vehículos seleccionados" : "vehicles selected"}</span><Button onClick={propose} disabled={!customerAccepted || !range || !partnerId || selected.length === 0 || mutation.isPending} data-testid="dispatch-propose-assignment"><LockKeyhole className="mr-2 h-4 w-4" />{t.propose}</Button></div>
      </CardContent>
    </Card>
    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{t.conflict}:</strong> {error}</span></div>}
    <Card className="border-[#eadfd5]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-[#ef7521]" />{t.history}</CardTitle></CardHeader><CardContent className="space-y-2">{assignments.length === 0 ? <p className="text-sm text-muted-foreground">{t.noHistory}</p> : assignments.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[#fcfaf8] p-3"><div><div className="flex items-center gap-2 text-sm font-semibold">{a.partner?.companyName || t.partner}<Badge variant="outline">{a.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(a.startsAt).toLocaleString()} → {new Date(a.endsAt).toLocaleTimeString()} · {a.vehicles?.map(v => v.vehicle.name).join(", ")}</p>{a.responseNote && <p className="mt-1 text-xs text-amber-700">{t.response}: {a.responseNote}</p>}</div>{a.status === "proposed" && <Button variant="outline" size="sm" onClick={() => mutation.mutate({ kind: "cancel", id: a.id })} disabled={mutation.isPending} data-testid={`dispatch-cancel-${a.id}`}><X className="mr-1 h-3.5 w-3.5" />{t.cancel}</Button>}</div>)}</CardContent></Card>
  </section>;
}