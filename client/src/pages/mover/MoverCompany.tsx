import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, MailPlus, ShieldCheck, UserMinus, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";
import { dispatchRequest } from "@/components/mover/dispatchApi";

export default function MoverCompany() {
  const { t, i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const { active, can } = usePartnerCompany();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [inviteLink, setInviteLink] = useState("");
  const canEditCompany = can("company:manage");
  const canManageMembers = can("members:manage");
  const roster = useQuery({ queryKey: ["partner-company-members"], queryFn: () => dispatchRequest<{ members: Array<{ membership: { id: string; role: string; status: string; invitedEmail?: string }; user?: { email?: string; fullName?: string } }> }>("/api/partner/company/members") });
  const company = useQuery({ queryKey: ["partner-company"], queryFn: () => dispatchRequest<{ company: any; membership: any; permissions: string[] | Record<string, boolean> }>("/api/partner/company") });
  const profileMutation = useMutation({ mutationFn: (data: { description: string }) => dispatchRequest("/api/partner/company", { method: "PATCH", body: JSON.stringify(data) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-company"] }) });
  const inviteMutation = useMutation({
    mutationFn: () => dispatchRequest<{ inviteToken?: string }>("/api/partner/company/invitations", { method: "POST", body: JSON.stringify({ email, role }) }),
    onSuccess: (data) => {
      setEmail("");
      setInviteLink(data.inviteToken ? `${window.location.origin}/mover/invitations/${data.inviteToken}` : "");
      roster.refetch();
    },
  });
  const memberMutation = useMutation({ mutationFn: ({ id, method, data }: { id: string; method: "PATCH" | "DELETE"; data?: object }) => dispatchRequest(`/api/partner/company/members/${id}`, { method, body: data ? JSON.stringify(data) : undefined }), onSuccess: () => roster.refetch() });
  const sidebarLinks = [{ href: "/mover/dashboard", label: es ? "Resumen" : "Overview", icon: Building2 }, { href: "/mover/dashboard/company", label: es ? "Empresa y equipo" : "Company & team", icon: Users }, { href: "/mover/dashboard/jobs", label: t("dashboard.mover.nav.jobs"), icon: ShieldCheck }];
  if (!active) return <DashboardLayout links={sidebarLinks} userType="mover"><Card><CardContent className="py-16 text-center text-muted-foreground">{es ? "No hay empresas activas asociadas a tu cuenta." : "No active partner companies are linked to your account."}</CardContent></Card></DashboardLayout>;
  return <DashboardLayout links={sidebarLinks} userType="mover"><div className="mx-auto w-full max-w-5xl space-y-6">
     <div><p className="workspace-kicker">{es ? "Contexto de socio" : "Partner context"}</p><h1 className="text-3xl text-[var(--usg-ink)]">{active.company.companyName}</h1><p className="mt-1 text-muted-foreground">{es ? "Perfil operativo y acceso del equipo." : "Operational profile and team access."}</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
       <Card className="workspace-card"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[var(--usg-orange)]" />{es ? "Perfil de empresa" : "Company profile"}</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>{es ? "Nombre" : "Name"}</Label><Input className="mt-1" value={company.data?.company?.companyName || active.company.companyName} readOnly /></div><div><Label>{es ? "Descripción operativa" : "Operational description"}</Label><Textarea className="mt-1" value={description || company.data?.company?.description || ""} onChange={(e) => setDescription(e.target.value)} disabled={!canEditCompany} placeholder={es ? "Qué tipo de mudanzas coordina tu equipo" : "What kind of moves your team coordinates"} /></div>{canEditCompany && <Button onClick={() => profileMutation.mutate({ description })} disabled={profileMutation.isPending}>{es ? "Guardar perfil" : "Save profile"}</Button>}<div className="flex flex-wrap gap-2"><Badge variant="outline">{active.membership.role}</Badge><Badge variant={active.company.verified ? "default" : "secondary"}>{active.company.verified ? (es ? "Verificada" : "Verified") : (es ? "En revisión" : "Under review")}</Badge></div></CardContent></Card>
      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[var(--usg-purple)]" />{es ? "Equipo" : "Team"}</CardTitle><span className="text-sm text-muted-foreground">{roster.data?.members.length || 0}</span></CardHeader><CardContent className="space-y-4">{canManageMembers && <div className="rounded-lg bg-muted/50 p-3"><p className="mb-2 text-sm font-medium">{es ? "Invitar a una persona" : "Invite a teammate"}</p><div className="flex flex-col gap-2 sm:flex-row"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" type="email" /><select className="h-10 rounded-md border bg-background px-3" value={role} onChange={(e) => setRole(e.target.value)}><option value="viewer">{es ? "Solo lectura" : "Viewer"}</option><option value="accountant">{es ? "Contabilidad" : "Accountant"}</option><option value="fleet_manager">{es ? "Gestor de flota" : "Fleet manager"}</option><option value="dispatcher">{es ? "Operaciones" : "Dispatcher"}</option><option value="admin">{es ? "Administrador" : "Admin"}</option></select><Button onClick={() => inviteMutation.mutate()} disabled={!email || inviteMutation.isPending}><MailPlus className="mr-2 h-4 w-4" />{es ? "Invitar" : "Invite"}</Button></div>{inviteLink && <div className="mt-3 space-y-1"><Label>{es ? "Enlace de invitación (se muestra una sola vez)" : "Invitation link (shown once)"}</Label><div className="flex gap-2"><Input readOnly value={inviteLink} /><Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>{es ? "Copiar" : "Copy"}</Button></div></div>}</div>}{roster.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : roster.isError ? <div className="py-8 text-center text-sm text-muted-foreground">{es ? "No se pudo cargar el equipo." : "The team could not be loaded."}<Button variant="link" onClick={() => roster.refetch()}>{es ? "Reintentar" : "Retry"}</Button></div> : roster.data?.members.length ? roster.data.members.map(({ membership, user }) => <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"><div><p className="font-medium">{user?.fullName || user?.email || (es ? "Invitación pendiente" : "Pending invitation")}</p><p className="text-sm text-muted-foreground">{user?.email || membership.invitedEmail}</p></div><div className="flex flex-wrap items-center gap-2">{canManageMembers && membership.id !== active.membership.id && membership.role !== "owner" ? <select className="h-8 rounded-md border bg-background px-2 text-sm" value={membership.role} onChange={(event) => memberMutation.mutate({ id: membership.id, method: "PATCH", data: { role: event.target.value } })}><option value="viewer">{es ? "Solo lectura" : "Viewer"}</option><option value="accountant">{es ? "Contabilidad" : "Accountant"}</option><option value="fleet_manager">{es ? "Gestor de flota" : "Fleet manager"}</option><option value="dispatcher">{es ? "Operaciones" : "Dispatcher"}</option><option value="admin">{es ? "Administrador" : "Admin"}</option></select> : <Badge variant="outline">{membership.role}</Badge>}<Badge variant={membership.status === "active" ? "default" : "secondary"}>{membership.status}</Badge>{canManageMembers && membership.id !== active.membership.id && <><Button size="sm" variant="outline" onClick={() => memberMutation.mutate({ id: membership.id, method: "PATCH", data: { status: membership.status === "active" ? "suspended" : "active" } })}>{membership.status === "active" ? (es ? "Suspender" : "Suspend") : (es ? "Reactivar" : "Reactivate")}</Button><Button size="icon" variant="ghost" aria-label={es ? "Eliminar miembro" : "Remove member"} onClick={() => memberMutation.mutate({ id: membership.id, method: "DELETE" })}><UserMinus className="h-4 w-4 text-destructive" /></Button></>}</div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">{es ? "Todavía no hay miembros." : "No team members yet."}</p>}</CardContent></Card>
    </div>
  </div></DashboardLayout>;
}