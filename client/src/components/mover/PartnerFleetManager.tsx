import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Car, CalendarClock, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dispatchRequest } from "./dispatchApi";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";
import { formatDateTime, formatTime, wallClockToUTC, formatDateOnly } from "@shared/timezone";

type TruckType = { id: string; name: string; nameEs: string; capacityKg: number; capacityM3?: string | null; capacityM3Low?: string | null; capacityM3High?: string | null };
type Vehicle = { id: string; name: string; registration?: string | null; vehicleType?: string | null; capacity?: string | null; truckTypeId?: string | null; legacyCapacityNeedsReview?: boolean; legacyCapacityNote?: string | null; truckType?: TruckType | null; isActive: boolean };
type Window = { id: string; vehicleId: string; startsAt: string; endsAt: string; label?: string | null; isAvailable: boolean };

export function PartnerFleetManager() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const qc = useQueryClient();
  const { can, active } = usePartnerCompany();
  const timezone = active?.company.operatingTimezone || "America/Mexico_City";
  const canMutate = can("fleet:manage");
  const canAvailability = can("availability:manage");
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [editingWindow, setEditingWindow] = useState<Window | null>(null);
  const [vehicle, setVehicle] = useState({ name: "", registration: "", truckTypeId: "" });
  const [windowForm, setWindowForm] = useState({ vehicleId: "", date: "", startsAt: "08:00", endsAt: "12:00", label: "" });
  const copy = useMemo(() => es ? {
    fleet: "Flota operativa", fleetHelp: "Activos individuales y sus ventanas reales de disponibilidad.",
    addVehicle: "Agregar vehículo", edit: "Editar", active: "Activo", inactive: "Inactivo", noVehicles: "Aún no hay vehículos.",
    name: "Nombre", registration: "Placas / registro", type: "Tipo", capacity: "Capacidad", save: "Guardar", cancel: "Cancelar",
    window: "Disponibilidad", addWindow: "Agregar ventana", noWindows: "Sin ventanas registradas.", date: "Fecha", start: "Inicio", end: "Fin",
    morning: "Mañana", afternoon: "Tarde", remove: "Desactivar", activate: "Activar", delete: "Eliminar", loading: "Cargando…",
    failed: "No se pudo cargar la flota.", retry: "Reintentar", vehicle: "Vehículo", available: "Disponible", unavailable: "No disponible",
  } : {
    fleet: "Operating fleet", fleetHelp: "Individual assets and their real availability windows.",
    addVehicle: "Add vehicle", edit: "Edit", active: "Active", inactive: "Inactive", noVehicles: "No vehicles yet.",
    name: "Name", registration: "Registration", type: "Type", capacity: "Capacity", save: "Save", cancel: "Cancel",
    window: "Availability", addWindow: "Add window", noWindows: "No windows recorded.", date: "Date", start: "Start", end: "End",
    morning: "Morning", afternoon: "Afternoon", remove: "Deactivate", activate: "Activate", delete: "Delete", loading: "Loading…",
    failed: "Could not load fleet.", retry: "Retry", vehicle: "Vehicle", available: "Available", unavailable: "Unavailable",
  }, [es]);
  const vehicles = useQuery({ queryKey: ["partner-fleet"], queryFn: () => dispatchRequest<Vehicle[]>("/api/partner/dispatch/fleet") });
  const truckTypes = useQuery({ queryKey: ["partner-truck-types"], queryFn: () => dispatchRequest<TruckType[]>("/api/partner/dispatch/truck-types") });
  const windows = useQuery({ queryKey: ["partner-availability"], queryFn: async () => {
    const rows = await dispatchRequest<Array<{ window: Window; vehicle: Vehicle }>>("/api/partner/dispatch/availability");
    return rows.map((row) => ({ ...row.window, vehicle: row.vehicle }));
  }});
  const refresh = () => { qc.invalidateQueries({ queryKey: ["partner-fleet"] }); qc.invalidateQueries({ queryKey: ["partner-availability"] }); };
  const vehicleMutation = useMutation({
    mutationFn: (data: Partial<Vehicle>) => editing ? dispatchRequest(`/api/partner/dispatch/fleet/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) }) : dispatchRequest("/api/partner/dispatch/fleet", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refresh(); setVehicleOpen(false); toast.success(copy.save); }, onError: (e: Error) => toast.error(e.message),
  });
  const toggleMutation = useMutation({
    mutationFn: (v: Vehicle) => v.isActive ? dispatchRequest(`/api/partner/dispatch/fleet/${v.id}`, { method: "DELETE" }) : dispatchRequest(`/api/partner/dispatch/fleet/${v.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }),
    onSuccess: refresh, onError: (e: Error) => toast.error(e.message),
  });
  const windowMutation = useMutation({
    mutationFn: (data: { vehicleId: string; startsAt: string; endsAt: string; label: string; isAvailable: boolean }) => editingWindow ? dispatchRequest(`/api/partner/dispatch/availability/${editingWindow.id}`, { method: "PATCH", body: JSON.stringify(data) }) : dispatchRequest("/api/partner/dispatch/availability", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refresh(); setWindowOpen(false); toast.success(copy.save); }, onError: (e: Error) => toast.error(e.message),
  });
  const deleteWindow = useMutation({ mutationFn: (id: string) => dispatchRequest(`/api/partner/dispatch/availability/${id}`, { method: "DELETE" }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const openVehicle = (v?: Vehicle) => { setEditing(v || null); setVehicle(v ? { name: v.name, registration: v.registration || "", truckTypeId: v.truckTypeId || "" } : { name: "", registration: "", truckTypeId: truckTypes.data?.[0]?.id || "" }); setVehicleOpen(true); };
  const openWindow = (w?: Window, preset?: "morning" | "afternoon") => { setEditingWindow(w || null); const date = w ? formatDateOnly(w.startsAt, { timezone }) : formatDateOnly(new Date(), { timezone }); const startsAt = w ? formatTime(w.startsAt, { timezone }) : preset === "afternoon" ? "13:00" : "08:00"; const endsAt = w ? formatTime(w.endsAt, { timezone }) : preset === "afternoon" ? "17:00" : "12:00"; setWindowForm({ vehicleId: w?.vehicleId || vehicles.data?.find((v) => v.isActive)?.id || "", date, startsAt, endsAt, label: w?.label || (preset === "afternoon" ? copy.afternoon : preset === "morning" ? copy.morning : "") }); setWindowOpen(true); };
  const submitWindow = () => { const startsAt = wallClockToUTC(`${windowForm.date}T${windowForm.startsAt}`, timezone).toISOString(); const endsAt = wallClockToUTC(`${windowForm.date}T${windowForm.endsAt}`, timezone).toISOString(); if (!windowForm.vehicleId || new Date(startsAt) >= new Date(endsAt)) return toast.error(es ? "Revisa vehículo y horario." : "Check vehicle and time range."); windowMutation.mutate({ vehicleId: windowForm.vehicleId, startsAt, endsAt, label: windowForm.label, isAvailable: true }); };

  if (vehicles.isLoading || windows.isLoading || truckTypes.isLoading) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-muted" /></div>;
  if (vehicles.isError || windows.isError || truckTypes.isError) return <Card><CardContent className="py-12 text-center text-muted-foreground"><p>{copy.failed}</p><Button variant="outline" className="mt-3" onClick={() => { vehicles.refetch(); windows.refetch(); truckTypes.refetch(); }}>{copy.retry}</Button></CardContent></Card>;
  return <div className="space-y-6">
     <Card className="border-orange-200/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Car className="h-5 w-5 text-[#EF7521]" />{copy.fleet}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{copy.fleetHelp}{!canMutate && (es ? " Solo lectura." : " Read-only access.")}</p></div>{canMutate && <Button data-testid="button-add-vehicle" onClick={() => openVehicle()}><Plus className="mr-2 h-4 w-4" />{copy.addVehicle}</Button>}</CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
        {vehicles.data?.length ? vehicles.data.map((v) => { const type = v.truckType || truckTypes.data?.find((t) => t.id === v.truckTypeId); return <div key={v.id} className="rounded-lg border bg-card p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{v.name}</p><p className="text-sm text-muted-foreground">{v.registration || "—"} · {type ? `${es ? type.nameEs : type.name} · ${type.capacityKg.toLocaleString()} kg${type.capacityM3 ? ` · ${type.capacityM3} m³` : ""}` : (es ? "Tipo pendiente" : "Type pending")}</p>{v.legacyCapacityNeedsReview && <Badge variant="outline" className="mt-2 border-amber-300 text-amber-700">{es ? "Requiere revisión manual" : "Manual review required"}</Badge>}</div><Badge variant="outline" className={v.isActive ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}>{v.isActive ? copy.active : copy.inactive}</Badge></div>{canMutate && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openVehicle(v)} data-testid={`button-edit-vehicle-${v.id}`}><Pencil className="mr-1 h-3.5 w-3.5" />{copy.edit}</Button><Button size="sm" variant="outline" onClick={() => toggleMutation.mutate(v)} disabled={toggleMutation.isPending} data-testid={`button-toggle-vehicle-${v.id}`}><Power className="mr-1 h-3.5 w-3.5" />{v.isActive ? copy.remove : copy.activate}</Button></div>}</div>}) : <p className="py-8 text-sm text-muted-foreground">{copy.noVehicles}</p>}
    </CardContent></Card>
     <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#502864]" />{copy.window}</CardTitle>{canAvailability && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openWindow(undefined, "morning")} data-testid="button-preset-morning">{copy.morning}</Button><Button size="sm" variant="outline" onClick={() => openWindow(undefined, "afternoon")} data-testid="button-preset-afternoon">{copy.afternoon}</Button><Button size="sm" onClick={() => openWindow()} data-testid="button-add-window"><Plus className="mr-1 h-4 w-4" />{copy.addWindow}</Button></div>}</CardHeader><CardContent className="space-y-2">
        {windows.data?.length ? windows.data.map((w: any) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{w.label || copy.window}</p><p className="text-sm text-muted-foreground">{w.vehicle?.name || "—"} · {formatDateTime(w.startsAt, { timezone })} — {formatTime(w.endsAt, { timezone })} ({timezone})</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={w.isAvailable ? "text-emerald-700" : "text-muted-foreground"}>{w.isAvailable ? copy.available : copy.unavailable}</Badge>{canAvailability && <><Button size="icon" variant="ghost" onClick={() => openWindow(w)} aria-label={copy.edit}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => deleteWindow.mutate(w.id)} aria-label={copy.delete}><Trash2 className="h-4 w-4" /></Button></>}</div></div>) : <p className="py-8 text-sm text-muted-foreground">{copy.noWindows}</p>}
    </CardContent></Card>
     <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? copy.edit : copy.addVehicle}</DialogTitle></DialogHeader><div className="grid gap-4"><Label>{copy.name}<Input value={vehicle.name} onChange={(e) => setVehicle({ ...vehicle, name: e.target.value })} data-testid="input-vehicle-name" /></Label><Label>{copy.registration}<Input value={vehicle.registration} onChange={(e) => setVehicle({ ...vehicle, registration: e.target.value })} /></Label><Label>{es ? "Tipo oficial de camión" : "Official truck type"}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={vehicle.truckTypeId} onChange={(e) => setVehicle({ ...vehicle, truckTypeId: e.target.value })}><option value="">{es ? "Selecciona un tipo" : "Select a type"}</option>{truckTypes.data?.map((type) => <option key={type.id} value={type.id}>{es ? type.nameEs : type.name} · {type.capacityKg.toLocaleString()} kg{type.capacityM3 ? ` · ${type.capacityM3} m³` : ""}</option>)}</select></Label></div><DialogFooter><Button variant="outline" onClick={() => setVehicleOpen(false)}>{copy.cancel}</Button><Button disabled={!vehicle.name.trim() || !vehicle.truckTypeId || vehicleMutation.isPending} onClick={() => vehicleMutation.mutate(vehicle)}>{copy.save}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={windowOpen} onOpenChange={setWindowOpen}><DialogContent><DialogHeader><DialogTitle>{editingWindow ? copy.edit : copy.addWindow}</DialogTitle></DialogHeader><div className="grid gap-4"><Label>{copy.vehicle}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={windowForm.vehicleId} onChange={(e) => setWindowForm({ ...windowForm, vehicleId: e.target.value })}>{vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Label><Label>{copy.date}<Input type="date" value={windowForm.date} onChange={(e) => setWindowForm({ ...windowForm, date: e.target.value })} /></Label><div className="grid grid-cols-2 gap-3"><Label>{copy.start}<Input type="time" value={windowForm.startsAt} onChange={(e) => setWindowForm({ ...windowForm, startsAt: e.target.value })} /></Label><Label>{copy.end}<Input type="time" value={windowForm.endsAt} onChange={(e) => setWindowForm({ ...windowForm, endsAt: e.target.value })} /></Label></div><Label>{es ? "Etiqueta (opcional)" : "Label (optional)"}<Input value={windowForm.label} onChange={(e) => setWindowForm({ ...windowForm, label: e.target.value })} /></Label></div><DialogFooter><Button variant="outline" onClick={() => setWindowOpen(false)}>{copy.cancel}</Button><Button disabled={windowMutation.isPending} onClick={submitWindow}>{copy.save}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}