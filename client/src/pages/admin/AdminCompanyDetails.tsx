import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Building2, MailPlus, UserMinus, ShieldAlert } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import type { OrganizationImpactPreview } from "@shared/organization";

async function req(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Request failed");
  return response.json();
}

export default function AdminCompanyDetails() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/dashboard/companies/:companyId");
  const id = params?.companyId;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const detail = useQuery<any>({ queryKey: [`/api/admin/companies/${id}`], queryFn: () => req(`/api/admin/companies/${id}`), enabled: !!id });
  const company = detail.data?.company || detail.data;
  const memberships = detail.data?.memberships || company?.memberships || [];
  const classification = company?.classification || "client";
  const isClientOnly = classification === "client";
  const owner = memberships.find((entry: any) => (entry.membership || entry).role === "owner");
  const lifecycleOperation = company?.isActive === false ? "reactivate" : "suspend";
  const impact = useQuery<OrganizationImpactPreview>({
    queryKey: [`/api/admin/companies/${id}/impact-preview`, lifecycleOperation],
    queryFn: () => req(`/api/admin/companies/${id}/impact-preview?operation=${lifecycleOperation}`),
    enabled: lifecycleOpen && !!id,
  });
  useEffect(() => { if (company?.name) setName(company.name); }, [company?.id, company?.name]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [`/api/admin/companies/${id}`] });
    qc.invalidateQueries({ queryKey: ["/api/admin/companies"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
  };
  const save = useMutation({
    mutationFn: (data: any) => req(`/api/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { refresh(); toast({ title: es ? "Empresa actualizada" : "Company updated" }); },
    onError: (error: any) => toast({ title: es ? "No se pudo actualizar" : "Update failed", description: error.message, variant: "destructive" }),
  });
  const lifecycle = useMutation({
    mutationFn: (isActive: boolean) => req(`/api/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: (_data, isActive) => { refresh(); setLifecycleOpen(false); toast({ title: isActive ? (es ? "Empresa reactivada" : "Company reactivated") : (es ? "Empresa suspendida" : "Company suspended") }); },
    onError: (error: any) => toast({ title: es ? "No se pudo cambiar el estado" : "Status change failed", description: error.message, variant: "destructive" }),
  });
  const member = useMutation({
    mutationFn: ({ membershipId, method, data }: any) => req(`/api/admin/companies/${id}/memberships${membershipId ? `/${membershipId}` : ""}`, { method, body: data && JSON.stringify(data) }),
    onSuccess: (data: any, variables: any) => {
      refresh();
      const token = data?.inviteToken || data?.token;
      if (variables.method === "POST" && token) setInviteLink(data?.inviteLink || `${window.location.origin}/accept-company-invitation/${token}`);
      toast({ title: variables.method === "POST" ? (es ? "Invitación creada" : "Invitation created") : (es ? "Membresía actualizada" : "Membership updated") });
    },
    onError: (error: any) => toast({ title: es ? "No se pudo completar" : "Request failed", description: error.message, variant: "destructive" }),
  });
  if (detail.isLoading) return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="py-12 text-center text-muted-foreground">{es ? "Cargando empresa…" : "Loading company…"}</div></DashboardLayout>;
  if (!company) return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="py-12 text-center">{es ? "Empresa no encontrada" : "Company not found"}</div></DashboardLayout>;

  return <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin"><div className="space-y-6">
    <Button variant="ghost" onClick={() => setLocation("/admin/dashboard/usuarios")}><ArrowLeft className="mr-2 h-4 w-4" />{es ? "Volver a organizaciones" : "Back to organizations"}</Button>
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Building2 />{company.name || company.companyName || (es ? "Empresa sin nombre" : "Unnamed company")}</CardTitle><CardDescription className="mt-1">{company.email || company.contactEmail || "—"} · {es ? "Resumen de organización" : "Organization summary"}</CardDescription></div><Badge variant={company.isActive === false ? "secondary" : "default"}>{company.isActive === false ? (es ? "Suspendida" : "Suspended") : (es ? "Activa" : "Active")}</Badge></div></CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">{classification === "both" ? (es ? "Cliente y socio" : "Client & partner") : classification === "partner" ? (es ? "Socio" : "Partner") : (es ? "Cliente" : "Client")}</Badge><span className="text-muted-foreground">{memberships.length} {es ? "miembro(s)" : "member(s)"}</span><span className="text-muted-foreground">{es ? "Propietario: " : "Owner: "}{owner ? (owner.user || owner).fullName || (owner.user || owner).email || "—" : (es ? "No asignado" : "Unassigned")}</span></div>
        <Button variant={company.isActive === false ? "default" : "destructive"} onClick={() => setLifecycleOpen(true)} disabled={lifecycle.isPending}>{company.isActive === false ? (es ? "Reactivar empresa" : "Reactivate company") : (es ? "Suspender empresa" : "Suspend company")}</Button>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>{es ? "Perfil y clasificación" : "Profile & classification"}</CardTitle><CardDescription>{es ? "La clasificación define las operaciones y roles disponibles; no cambia el acceso de plataforma." : "Classification defines operations and available roles; it does not change platform access."}</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Input aria-label={es ? "Nombre de empresa" : "Company name"} value={name || company.name || ""} onChange={event => setName(event.target.value)} /><select aria-label={es ? "Clasificación" : "Classification"} className="rounded-md border px-2" value={classification} onChange={event => save.mutate({ classification: event.target.value })}><option value="client">{es ? "Cliente" : "Client"}</option><option value="partner">{es ? "Socio" : "Partner"}</option><option value="both">{es ? "Cliente y socio" : "Both"}</option></select><Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ name: name.trim() })}>{es ? "Guardar perfil" : "Save profile"}</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>{es ? "Miembros y propietarios" : "Members & ownership"}</CardTitle><CardDescription>{es ? "Estos roles son de la empresa, no roles administrativos de plataforma." : "These are company roles, not platform administration roles."}</CardDescription></CardHeader><CardContent className="space-y-3">
      <div className="flex gap-2"><Input aria-label={es ? "Correo para invitar" : "Invite email"} value={email} onChange={event => setEmail(event.target.value)} placeholder="email@example.com" /><Button disabled={!email || member.isPending} onClick={() => { member.mutate({ method: "POST", data: { email, role: isClientOnly ? "member" : "viewer" } }); setEmail(""); }}><MailPlus className="mr-2 h-4 w-4" />{es ? "Invitar" : "Invite"}</Button></div>
      {inviteLink && <div className="rounded-md border bg-muted/40 p-3"><p className="mb-2 text-sm font-medium">{es ? "Enlace de invitación" : "Invitation link"}</p><div className="flex gap-2"><Input readOnly value={inviteLink} /><Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>{es ? "Copiar" : "Copy"}</Button></div></div>}
      {memberships.map((entry: any) => { const membership = entry.membership || entry; const user = entry.user || entry; const isOwner = membership.role === "owner"; return <div className="flex flex-wrap justify-between gap-2 border-b py-2" key={membership.id}><span className="flex items-center gap-2">{user.fullName || user.email || membership.invitedEmail || "—"} {isOwner && <Badge variant="outline">{es ? "Propietario" : "Owner"}</Badge>}</span><div className="flex gap-2"><select aria-label={es ? "Rol del miembro" : "Member role"} className="rounded border px-1 text-sm" value={membership.role} onChange={event => member.mutate({ membershipId: membership.id, method: "PATCH", data: { role: event.target.value } })}><option value="owner">Owner</option><option value="admin">Admin</option>{isClientOnly ? <><option value="member">Member</option><option value="viewer">Viewer</option></> : <><option value="dispatcher">Dispatcher</option><option value="fleet_manager">Fleet manager</option><option value="accountant">Accountant</option><option value="viewer">Viewer</option></>}</select><select aria-label={es ? "Estado de membresía" : "Membership status"} className="rounded border px-1 text-sm" value={membership.status} onChange={event => member.mutate({ membershipId: membership.id, method: "PATCH", data: { status: event.target.value } })}><option value="active">Active</option><option value="suspended">Suspended</option><option value="invited">Invited</option></select><Button size="icon" variant="ghost" disabled={isOwner} title={isOwner ? (es ? "Transfiere la propiedad antes de quitarlo" : "Transfer ownership before removing") : undefined} onClick={() => member.mutate({ membershipId: membership.id, method: "DELETE" })}><UserMinus className="h-4 w-4 text-destructive" /></Button></div></div>; })}
    </CardContent></Card>
    <AlertDialog open={lifecycleOpen} onOpenChange={setLifecycleOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><ShieldAlert className="mr-2 inline h-5 w-5" />{company.isActive === false ? (es ? "¿Reactivar esta empresa?" : "Reactivate this company?") : (es ? "¿Suspender esta empresa?" : "Suspend this company?")}</AlertDialogTitle><AlertDialogDescription>{impact.isLoading ? (es ? "Calculando el impacto…" : "Calculating impact…") : company.isActive === false ? (es ? `La empresa y ${impact.data?.affectedUsers ?? memberships.length} usuario(s) podrán operar de nuevo.` : `The company and ${impact.data?.affectedUsers ?? memberships.length} user(s) can operate again.`) : (es ? `Se detendrán las operaciones para ${impact.data?.affectedUsers ?? memberships.length} usuario(s) y ${impact.data?.affectedQuotes ?? 0} cotización(es). Las membresías, invitaciones y datos se conservarán.` : `Operations will stop for ${impact.data?.affectedUsers ?? memberships.length} user(s) and ${impact.data?.affectedQuotes ?? 0} quote(s). Memberships, invitations, and data will be preserved.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{es ? "Cancelar" : "Cancel"}</AlertDialogCancel><AlertDialogAction disabled={impact.isLoading} onClick={() => lifecycle.mutate(company.isActive === false)}>{company.isActive === false ? (es ? "Confirmar reactivación" : "Confirm reactivation") : (es ? "Confirmar suspensión" : "Confirm suspension")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
}