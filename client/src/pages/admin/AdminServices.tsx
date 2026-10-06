import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, CalendarDays, ClipboardList, Clock3, GitBranch, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceStageManagement } from "@/components/admin/ServiceStageManagement";
import { normalizeServiceStage, SERVICE_STAGE_LABELS } from "@shared/workflowStages";

type Service = {
  id: string; quoteId?: string; quoteNumber?: string | null; customerName?: string | null;
  customerEmail?: string | null; branchName?: string | null; companyName?: string | null;
  serviceDate?: string | null; moveDate?: string | null; collectionStatus?: string | null;
  readinessStatus?: string | null; resourceStatus?: string | null; resources?: { vehicles?: any[]; crews?: any[] } | null; stage?: string | null;
  operationalStage?: string | null; alerts?: string[]; paymentDeadline?: string | null;
};
const filters = ["all", "upcoming", "today", "confirmed", "scheduled", "team_assigned", "en_route", "in_progress", "finished", "on_hold", "cancelled"];
const labels: Record<string, [string, string]> = {
  all: ["All services", "Todos los servicios"], upcoming: ["Upcoming", "Próximos"], today: ["Today", "Hoy"],
  confirmed: ["Confirmed", "Confirmados"], scheduled: ["Scheduled", "Programados"], team_assigned: ["Team assigned", "Equipo asignado"],
  en_route: ["En route", "En camino"], in_progress: ["In progress", "En curso"], finished: ["Finished", "Finalizados"],
  on_hold: ["On hold", "En pausa"], cancelled: ["Cancelled", "Cancelados"],
};
const pick = (body: any): Service[] => {
  const rows = Array.isArray(body) ? body : body?.services || body?.data || [];
  return rows.map((row: any) => {
    const snapshot = typeof row.snapshot === "string" ? (() => { try { return JSON.parse(row.snapshot); } catch { return {}; } })() : (row.snapshot || {});
    const collection = row.collection || snapshot.collection;
    return { ...snapshot, ...row, quoteId: row.quoteId || snapshot.quoteId, quoteNumber: row.quoteNumber || snapshot.quoteNumber, customerName: row.customerName || snapshot.customerName || snapshot.contactName || snapshot.user?.fullName, customerEmail: row.customerEmail || snapshot.customerEmail || snapshot.contactEmail, branchName: row.branchName || snapshot.branchName || snapshot.storageBranchName, companyName: row.companyName || snapshot.companyName, serviceDate: row.serviceDate || snapshot.serviceDate || snapshot.moveDate, collectionStatus: row.collectionStatus || collection?.status || snapshot.collectionStatus, readinessStatus: row.readinessStatus || snapshot.readinessStatus, stage: row.stage || row.operationalStage || snapshot.stage, paymentDeadline: row.paymentDeadline || collection?.deadline || snapshot.paymentDeadline, alerts: row.alerts || snapshot.alerts || [], resources: row.resources || snapshot.resources };
  });
};
const dateValue = (s: Service) => s.serviceDate || s.moveDate;

export default function AdminServices() {
  const { i18n } = useTranslation(); const lang = i18n.language === "es" ? "es" : "en";
  const [, setLocation] = useLocation(); const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["/api/admin/services", filter], queryFn: async () => {
    const r = await fetch(`/api/admin/services?view=${filter}`, { credentials: "include" }); if (!r.ok) throw new Error("services"); return r.json();
  }});
  const services = useMemo(() => pick(query.data).filter((s) => {
    const text = `${s.customerName || ""} ${s.customerEmail || ""} ${s.quoteNumber || ""} ${s.branchName || ""} ${s.companyName || ""}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  }), [query.data, search]);
  const title = lang === "es" ? "Servicios" : "Services";
   return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="space-y-5">
    <header><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b85631]"><ClipboardList className="h-4 w-4" />{lang === "es" ? "Operaciones" : "Operations"}</div><h1 className="mt-1 text-3xl font-semibold text-[#351d3d]">{title}</h1><p className="text-muted-foreground">{lang === "es" ? "Gestiona cada servicio después de la venta y hasta su cierre." : "Manage every service from sale handoff through completion."}</p></header>
     <Tabs defaultValue="services" className="w-full">
       <TabsList>
         <TabsTrigger value="services" data-testid="tab-services"><ClipboardList className="mr-2 h-4 w-4" />{lang === "es" ? "Servicios" : "Services"}<Badge variant="secondary" className="ml-2">{services.length}</Badge></TabsTrigger>
         <TabsTrigger value="stages" data-testid="tab-service-stages"><GitBranch className="mr-2 h-4 w-4" />{lang === "es" ? "Etapas del servicio" : "Service stages"}</TabsTrigger>
       </TabsList>
       <TabsContent value="services" className="mt-4 space-y-4">
       <div className="flex flex-wrap gap-3"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "es" ? "Buscar cliente, cotización o sucursal" : "Search customer, quote or branch"} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger><SelectContent>{filters.map(f => <SelectItem key={f} value={f}>{labels[f][lang === "es" ? 1 : 0]}</SelectItem>)}</SelectContent></Select></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />{title}<Badge variant="secondary">{services.length}</Badge></CardTitle></CardHeader><CardContent className="p-0">
      {query.isLoading ? <div className="p-8 text-center text-muted-foreground">{lang === "es" ? "Cargando servicios…" : "Loading services…"}</div> :
       query.isError ? <div className="p-8 text-center text-red-700">{lang === "es" ? "No se pudieron cargar los servicios." : "Services could not be loaded."}</div> :
       services.length === 0 ? <div className="p-8 text-center text-muted-foreground">{lang === "es" ? "No hay servicios para este filtro." : "No services match this filter."}</div> :
       <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/40"><tr>{["Customer","Quote","Branch / company","Date","Collection","Readiness","Resources","Stage","Alerts"].map((x, i) => <th key={x} className="whitespace-nowrap p-3 text-left font-semibold">{lang === "es" ? ["Cliente","Cotización","Sucursal / empresa","Fecha","Cobro","Preparación","Recursos","Etapa","Alertas"][i] : x}</th>)}</tr></thead><tbody>
         {services.map(s => { const date = dateValue(s); const deadline = s.paymentDeadline && new Date(s.paymentDeadline); const urgent = deadline && !isNaN(deadline.getTime()) && deadline.getTime() < Date.now() + 48 * 3600000; return <tr key={s.id} onClick={() => setLocation(`/admin/dashboard/services/${s.id}`)} className="cursor-pointer border-b hover:bg-muted/30">
           <td className="p-3"><div className="font-medium">{s.customerName || s.customerEmail || "—"}</div>{urgent && <div className="mt-1 flex items-center gap-1 text-xs text-amber-700"><Clock3 className="h-3 w-3" />{lang === "es" ? "Plazo cercano" : "Deadline soon"}</div>}</td>
           <td className="p-3 font-medium">{s.quoteNumber || s.quoteId?.slice(0, 8) || "—"}</td><td className="p-3">{s.branchName || s.companyName || "—"}</td>
           <td className="whitespace-nowrap p-3">{date ? <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(date).toLocaleDateString()}</span> : "—"}</td>
           <td className="p-3"><Badge variant={s.collectionStatus === "verified" || s.collectionStatus === "paid" ? "default" : "outline"}>{s.collectionStatus || "—"}</Badge></td>
           <td className="p-3"><Badge variant={s.readinessStatus === "ready" ? "default" : "outline"}>{s.readinessStatus || "—"}</Badge></td>
    <td className="p-3"><span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{s.resourceStatus || (s.resources ? `${s.resources.vehicles?.length || 0} / ${s.resources.crews?.length || 0}` : "—")}</span></td><td className="p-3"><Badge variant="secondary">{SERVICE_STAGE_LABELS[normalizeServiceStage(s.stage || s.operationalStage)][lang === "es" ? "es" : "en"]}</Badge></td>
           <td className="p-3">{s.alerts?.length ? <Badge className="bg-amber-100 text-amber-900"><AlertTriangle className="mr-1 h-3 w-3" />{s.alerts.length}</Badge> : "—"}</td>
         </tr>})}</tbody></table></div>}
     </CardContent></Card>
       </TabsContent>
        <TabsContent value="stages" className="mt-4"><ServiceStageManagement /></TabsContent>
     </Tabs>
  </div></DashboardLayout>;
}