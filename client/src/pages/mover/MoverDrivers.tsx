import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Power, Clock, CalendarDays } from "lucide-react";
import { dispatchRequest } from "@/components/mover/dispatchApi";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";
import { formatDateTime, formatTime, wallClockToUTC } from "@shared/timezone";

type Crew = { id: string; name: string; role?: string | null; isActive: boolean };
type CrewWindow = { window: { id: string; crewId: string; startsAt: string; endsAt: string; isAvailable: boolean }; crew: Crew };

export default function MoverDrivers() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const { can, active } = usePartnerCompany();
  const timezone = active?.company.operatingTimezone || "America/Mexico_City";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [crewId, setCrewId] = useState("");
  const [startsAt, setStartsAt] = useState("08:00");
  const [endsAt, setEndsAt] = useState("17:00");
  const crews = useQuery({ queryKey: ["partner-crews"], queryFn: () => dispatchRequest<Crew[]>("/api/partner/dispatch/crews") });
  const availability = useQuery({ queryKey: ["partner-crew-availability"], queryFn: () => dispatchRequest<CrewWindow[]>("/api/partner/dispatch/crew-availability") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["partner-crews"] }); qc.invalidateQueries({ queryKey: ["partner-crew-availability"] }); };
  const create = useMutation({ mutationFn: () => dispatchRequest("/api/partner/dispatch/crews", { method: "POST", body: JSON.stringify({ name, role: role || null }) }), onSuccess: () => { setName(""); setRole(""); refresh(); } });
  const toggle = useMutation({ mutationFn: (crew: Crew) => dispatchRequest(`/api/partner/dispatch/crews/${crew.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !crew.isActive }) }), onSuccess: refresh });
  const addAvailability = useMutation({ mutationFn: () => dispatchRequest("/api/partner/dispatch/crew-availability", { method: "POST", body: JSON.stringify({ crewId, startsAt: wallClockToUTC(`${date}T${startsAt}`, timezone).toISOString(), endsAt: wallClockToUTC(`${date}T${endsAt}`, timezone).toISOString(), isAvailable: true }) }), onSuccess: () => { availability.refetch(); setCrewId(""); } });
  const sidebarLinks = [{ href: "/mover/dashboard/drivers", label: es ? "Cuadrillas" : "Crews", icon: Users }, { href: "/mover/dashboard/calendar", label: es ? "Calendario operativo" : "Operations calendar", icon: CalendarDays }];
  const canManage = can("fleet:manage");
  const canAvailability = can("availability:manage");
  return <DashboardLayout links={sidebarLinks} userType="mover"><div className="mx-auto w-full max-w-5xl space-y-6">
    <div><p className="workspace-kicker">{es ? "Recursos operativos" : "Operational resources"}</p><h1 className="text-3xl text-[var(--usg-ink)]">{es ? "Cuadrillas" : "Crews"}</h1><p className="text-muted-foreground">{es ? "Personas asignables a servicios; separado de los miembros que acceden a la cuenta." : "Dispatchable people, kept separate from company account members."}</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[var(--usg-purple)]" />{es ? "Personal operativo" : "Operational crew"}</CardTitle></CardHeader><CardContent className="space-y-4">{canManage && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder={es ? "Nombre" : "Name"} value={name} onChange={(e) => setName(e.target.value)} /><Input placeholder={es ? "Rol" : "Role"} value={role} onChange={(e) => setRole(e.target.value)} /><Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}><Plus className="mr-1 h-4 w-4" />{es ? "Agregar" : "Add"}</Button></div>}{crews.data?.map((crew) => <div key={crew.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{crew.name}</p><p className="text-sm text-muted-foreground">{crew.role || (es ? "Cuadrilla" : "Crew")}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{crew.isActive ? (es ? "Activo" : "Active") : (es ? "Inactivo" : "Inactive")}</Badge>{canManage && <Button size="icon" variant="ghost" onClick={() => toggle.mutate(crew)}><Power className="h-4 w-4" /></Button>}</div></div>)}{!crews.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">{es ? "Aún no hay cuadrillas." : "No crews yet."}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-[var(--usg-orange)]" />{es ? "Disponibilidad de cuadrillas" : "Crew availability"}</CardTitle></CardHeader><CardContent className="space-y-4">{canAvailability && <div className="grid gap-2 sm:grid-cols-2"><select className="h-10 rounded-md border bg-background px-3" value={crewId} onChange={(e) => setCrewId(e.target.value)}><option value="">{es ? "Selecciona cuadrilla" : "Select crew"}</option>{crews.data?.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /><Input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /><Button className="sm:col-span-2" disabled={!crewId || addAvailability.isPending} onClick={() => addAvailability.mutate()}><Plus className="mr-1 h-4 w-4" />{es ? "Guardar horario" : "Save availability"}</Button></div>}<p className="text-xs text-muted-foreground">{es ? `Zona horaria: ${timezone}` : `Time zone: ${timezone}`}</p>{availability.data?.map(({ window, crew }) => <div key={window.id} className="rounded-lg border p-3"><p className="font-medium">{crew.name}</p><p className="text-sm text-muted-foreground">{formatDateTime(window.startsAt, { timezone })} — {formatTime(window.endsAt, { timezone })}</p></div>)}{!availability.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">{es ? "Sin horarios registrados." : "No availability recorded."}</p>}</CardContent></Card>
    </div>
  </div></DashboardLayout>;
}