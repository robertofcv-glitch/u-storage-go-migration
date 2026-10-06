import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MailPlus, UserMinus, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { getClientSidebarLinks } from "@/lib/clientSidebar";
import { useToast } from "@/hooks/use-toast";

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  return res.json();
}

export default function ClientCompany() {
  const { t, i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [role, setRole] = useState("member");
  const sidebarLinks = getClientSidebarLinks(t);
  const companiesQuery = useQuery<any>({ queryKey: ["/api/client/companies"], queryFn: () => request("/api/client/companies") });
  const members = useQuery<any>({ queryKey: ["/api/client/companies/memberships"], queryFn: () => request("/api/client/companies/memberships"), enabled: !!companiesQuery.data?.activeCompanyId });
  const companies = companiesQuery.data?.companies || [];
  const active = companies.find((item: any) => item.company.id === companiesQuery.data?.activeCompanyId) || companies[0];
  const access = active?.company;
  const membership = active?.membership;
  const list = members.data?.memberships || [];
  const canManage = membership?.role === "owner" || membership?.role === "admin";
  const switchCompany = useMutation({
    mutationFn: (companyId: string) => request("/api/client/companies/active", { method: "PUT", body: JSON.stringify({ companyId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client/companies"] }); qc.invalidateQueries({ queryKey: ["/api/client/companies/memberships"] }); },
    onError: (e: any) => toast({ title: es ? "No se pudo cambiar la empresa" : "Could not switch company", description: e.message, variant: "destructive" }),
  });
  const invite = useMutation({
    mutationFn: () => request("/api/client/companies/memberships", { method: "POST", body: JSON.stringify({ email, role }) }),
    onSuccess: (data) => {
      setEmail("");
      qc.invalidateQueries({ queryKey: ["/api/client/companies/memberships"] });
      const token = data?.inviteToken || data?.token;
      if (token) setInviteLink(data?.inviteLink || `${window.location.origin}/accept-company-invitation/${token}`);
      toast({ title: es ? "Invitación enviada" : "Invitation sent" });
    },
    onError: (e: any) => toast({ title: es ? "Error al invitar" : "Invitation failed", description: e.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: ({ id, data, method = "PATCH" }: { id: string; data?: any; method?: string }) => request(`/api/client/companies/memberships/${id}`, { method, body: data ? JSON.stringify(data) : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/client/companies/memberships"] }),
    onError: (e: any) => toast({ title: es ? "No se pudo actualizar" : "Update failed", description: e.message, variant: "destructive" }),
  });
  const isPersonal = list.length <= 1;

  return <DashboardLayout links={sidebarLinks} userType="client"><div className="mx-auto w-full max-w-5xl space-y-6">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{isPersonal ? (es ? "Acceso de equipo" : "Team access") : (es ? "Empresa y equipo" : "Company & team")}</h1><p className="text-muted-foreground">{isPersonal ? (es ? "Invita a alguien cuando necesites colaborar." : "Invite someone whenever you need to collaborate.") : (es ? "Gestiona el acceso de tu equipo." : "Manage your team's access.")}</p></div>{companies.length > 1 && <select className="h-10 rounded-md border bg-white px-3" value={access?.id} onChange={e => switchCompany.mutate(e.target.value)}>{companies.map((item: any) => <option value={item.company.id} key={item.company.id}>{item.company.name || item.company.companyName}</option>)}</select>}</div>
    {!access ? <Card><CardContent className="py-12 text-center text-muted-foreground">{es ? "No hay acceso de equipo asociado." : "No team access is associated with this account."}</CardContent></Card> :
      <div className={isPersonal ? "space-y-6" : "grid gap-6 lg:grid-cols-[1fr_1.4fr]"}>
        {!isPersonal && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{access.name || access.companyName}</CardTitle></CardHeader><CardContent><Badge variant="outline">{membership?.role}</Badge></CardContent></Card>}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{es ? "Equipo" : "Team"}</CardTitle></CardHeader><CardContent className="space-y-4">
          {canManage && <div className="flex flex-col gap-2 sm:flex-row"><Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={es ? "correo@empresa.com" : "teammate@company.com"} /><select className="rounded-md border px-2" value={role} onChange={e => setRole(e.target.value)}><option value="admin">Admin</option><option value="member">{es ? "Miembro" : "Member"}</option><option value="viewer">{es ? "Solo lectura" : "Viewer"}</option></select><Button disabled={!email || invite.isPending} onClick={() => invite.mutate()}><MailPlus className="mr-2 h-4 w-4" />{es ? "Invitar" : "Invite"}</Button></div>}
          {inviteLink && <div className="rounded-md border bg-muted/40 p-3"><p className="mb-2 text-sm font-medium">{es ? "Enlace de invitación" : "Invitation link"}</p><div className="flex gap-2"><Input readOnly value={inviteLink} /><Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>{es ? "Copiar" : "Copy"}</Button></div></div>}
          {!isPersonal && list.map((entry: any) => { const m = entry.membership || entry; const u = entry.user || entry; return <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3"><div><p className="font-medium">{u.fullName || u.email || m.invitedEmail}</p><p className="text-sm text-muted-foreground">{u.email || m.invitedEmail}</p></div><div className="flex gap-2"><Badge>{m.role} · {m.status}</Badge>{canManage && <><Button size="sm" variant="outline" onClick={() => update.mutate({ id: m.id, data: { status: m.status === "active" ? "suspended" : "active" } })}>{m.status === "active" ? (es ? "Suspender" : "Suspend") : (es ? "Reactivar" : "Reactivate")}</Button><Button size="icon" variant="ghost" onClick={() => update.mutate({ id: m.id, method: "DELETE" })}><UserMinus className="h-4 w-4 text-destructive" /></Button></>}</div></div> })}
        </CardContent></Card>
      </div>}
  </div></DashboardLayout>;
}