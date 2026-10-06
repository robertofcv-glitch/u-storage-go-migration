import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Eye, Search, Shield, Users, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  normalizeCompanies, normalizeUsers, OrganizationCompany, OrganizationUser,
  useCreateOrganization, useInviteOrganizationUser, useOrganizationQueries,
} from "@/lib/organization";

const PAGE_SIZE = 10;
const display = (u: OrganizationUser) => u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "—";
const companyName = (c: Partial<OrganizationCompany>) => c.name || c.companyName || "—";
const selectClass = "h-10 rounded-md border bg-background px-3 text-sm";

export function AdminCompaniesUsers() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const initialUserView = location.includes("tab=users") || location.includes("profile=admin") || location.includes("profile=mover");
  const [tab, setTab] = useState<"companies" | "users">(initialUserView ? "users" : "companies");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "all", profile: "all", platformRole: "all", classification: "all", membershipRole: "all", invitation: "all" });
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState(""); const [kind, setKind] = useState("client"); const [ownerUserId, setOwnerUserId] = useState("");
  const [email, setEmail] = useState(""); const [memberRole, setMemberRole] = useState("member"); const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [inviteLinks, setInviteLinks] = useState<string[]>([]);
  const active = useQuery<{ user?: { effectivePermissions?: string[]; platformRoles?: string[] } }>({ queryKey: ["/api/impersonate/current"] });
  const permissions = active.data?.user?.effectivePermissions || [];
  const superAdmin = permissions.includes("*") || active.data?.user?.platformRoles?.includes("super_admin") || false;
  const canManageCompanies = superAdmin || permissions.includes("module:companies");
  const canManageUsers = superAdmin || permissions.includes("module:users");
  const { companies, users } = useOrganizationQueries(query, {
    companies: active.isSuccess && canManageCompanies,
    users: active.isSuccess && canManageUsers,
  });
  const create = useCreateOrganization();
  const invite = useInviteOrganizationUser();
  const companyList = normalizeCompanies(companies.data).filter(c =>
    (!query.trim() || `${companyName(c)} ${c.id}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filters.classification === "all" || (c.classification || "client") === filters.classification) &&
    (filters.status === "all" || (c.status || (c.isActive === false ? "inactive" : "active")) === filters.status));
  const userList = normalizeUsers(users.data).filter(u => {
    const memberships = u.memberships || [];
    const roles = (u.platformRoles || u.roles?.map(r => r.role) || []);
    const profiles = u.profiles || (u.userType ? [u.userType] : []);
    const invitation = memberships.some(m => (m.membership?.status || m.membership?.invitedEmail ? "invited" : "none") === "invited") ? "invited" : "none";
    const haystack = `${display(u)} ${u.email || ""} ${memberships.map(m => companyName(m.company || {})).join(" ")}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) &&
      (filters.status === "all" || (u.status || "active") === filters.status) &&
      (filters.profile === "all" || profiles.includes(filters.profile)) &&
      (filters.platformRole === "all" || roles.includes(filters.platformRole)) &&
      (filters.membershipRole === "all" || memberships.some(m => m.membership?.role === filters.membershipRole)) &&
      (filters.invitation === "all" || invitation === filters.invitation);
  });
  const rows = tab === "companies" ? companyList : userList;
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const setFilter = (key: keyof typeof filters, value: string) => { setPage(1); setFilters(current => ({ ...current, [key]: value })); };
  const reset = () => { setQuery(""); setPage(1); setFilters({ status: "all", profile: "all", platformRole: "all", classification: "all", membershipRole: "all", invitation: "all" }); };
  const label = (value: string) => value.replaceAll("_", " ");
  const classificationLabel = (value: string) => value === "both" ? (es ? "Ambas" : "Both") : value === "partner" ? (es ? "Socio" : "Partner") : (es ? "Cliente" : "Client");
  useEffect(() => {
    if (location.includes("profile=admin")) {
      setTab("users");
      setFilters(current => ({ ...current, profile: "admin" }));
    } else if (location.includes("profile=mover")) {
      setTab("users");
      setFilters(current => ({ ...current, profile: "mover" }));
    } else if (location.includes("tab=users")) {
      setTab("users");
    }
  }, [location]);
  useEffect(() => {
    if (!active.isSuccess) return;
    if (tab === "companies" && !canManageCompanies && canManageUsers) setTab("users");
    if (tab === "users" && !canManageUsers && canManageCompanies) setTab("companies");
  }, [active.isSuccess, canManageCompanies, canManageUsers, tab]);
  const currentQuery = tab === "companies" ? companies : users;

  return <div className="min-w-0 space-y-6">
    <header><h1 className="text-2xl font-bold">{es ? "Empresas y usuarios" : "Companies & users"}</h1><p className="text-muted-foreground">{es ? "Centro canónico de organizaciones, relaciones y acceso." : "Canonical command center for organizations, relationships and access."}</p></header>
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={es ? "Vista de organización" : "Organization view"}>
      {canManageCompanies && <Button role="tab" aria-selected={tab === "companies"} variant={tab === "companies" ? "default" : "outline"} onClick={() => { setTab("companies"); setPage(1); }}><Building2 className="mr-2 h-4 w-4" />{es ? "Empresas" : "Companies"}</Button>}
      {canManageUsers && <Button role="tab" aria-selected={tab === "users"} variant={tab === "users" ? "default" : "outline"} onClick={() => { setTab("users"); setPage(1); }}><Users className="mr-2 h-4 w-4" />{es ? "Usuarios" : "Users"}</Button>}
      {canManageUsers && <Button variant="outline" onClick={() => { setTab("users"); setFilter("profile", "admin"); setLocation("/admin/dashboard/usuarios?profile=admin"); }}><Shield className="mr-2 h-4 w-4" />{es ? "Administradores" : "Administrators"}</Button>}
      {tab === "companies" && canManageCompanies ? <Button onClick={() => setCreateOpen(true)}>{es ? "Crear empresa" : "Create company"}</Button> : tab === "users" && canManageUsers && canManageCompanies ? <Button onClick={() => setInviteOpen(true)}>{es ? "Invitar usuario" : "Invite user"}</Button> : null}
      <div className="relative ml-auto min-w-[220px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={es ? "Buscar organizaciones" : "Search organizations"} className="pl-9" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder={es ? "Buscar..." : "Search..."} /></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <select aria-label={es ? "Estado" : "Status"} className={selectClass} value={filters.status} onChange={e => setFilter("status", e.target.value)}><option value="all">{es ? "Todos los estados" : "All statuses"}</option><option value="active">{es ? "Activo" : "Active"}</option><option value="inactive">{es ? "Inactivo" : "Inactive"}</option><option value="suspended">{es ? "Suspendido" : "Suspended"}</option></select>
      {tab === "companies" ? <select aria-label={es ? "Clasificación" : "Classification"} className={selectClass} value={filters.classification} onChange={e => setFilter("classification", e.target.value)}><option value="all">{es ? "Todas las clasificaciones" : "All classifications"}</option>{["client", "partner", "both"].map(v => <option key={v} value={v}>{classificationLabel(v)}</option>)}</select> : <>
        <select aria-label={es ? "Perfil" : "Profile"} className={selectClass} value={filters.profile} onChange={e => setFilter("profile", e.target.value)}><option value="all">{es ? "Todos los perfiles" : "All profiles"}</option><option value="client">{es ? "Usuario" : "User"}</option><option value="mover">{es ? "Socio" : "Partner"}</option><option value="admin">{es ? "Administrador" : "Admin"}</option></select>
        <select aria-label={es ? "Rol de plataforma" : "Platform role"} className={selectClass} value={filters.platformRole} onChange={e => setFilter("platformRole", e.target.value)}><option value="all">{es ? "Todos los roles de plataforma" : "All platform roles"}</option>{["super_admin", "operations", "commercial", "accounting", "customer_service"].map(v => <option key={v} value={v}>{label(v)}</option>)}</select>
        <select aria-label={es ? "Rol de membresía" : "Membership role"} className={selectClass} value={filters.membershipRole} onChange={e => setFilter("membershipRole", e.target.value)}><option value="all">{es ? "Todos los roles de empresa" : "All company roles"}</option>{["owner", "admin", "member", "viewer", "dispatcher", "fleet_manager", "accountant"].map(v => <option key={v} value={v}>{label(v)}</option>)}</select>
        <select aria-label={es ? "Invitación" : "Invitation"} className={selectClass} value={filters.invitation} onChange={e => setFilter("invitation", e.target.value)}><option value="all">{es ? "Todas las invitaciones" : "All invitations"}</option><option value="invited">{es ? "Pendiente" : "Pending"}</option><option value="none">{es ? "Sin invitación" : "No invitation"}</option></select>
      </>}
      <Button variant="ghost" size="sm" onClick={reset}><RefreshCw className="mr-1 h-4 w-4" />{es ? "Limpiar" : "Reset"}</Button>
    </div>
    <Card><CardHeader><CardTitle>{rows.length} {tab === "companies" ? (es ? "empresas" : "companies") : (es ? "usuarios" : "users")}</CardTitle></CardHeader><CardContent className="space-y-2 overflow-x-auto">
      {(active.isLoading || currentQuery.isLoading) ? <p className="py-10 text-center text-muted-foreground" role="status">{es ? "Cargando..." : "Loading..."}</p> :
        (!canManageCompanies && !canManageUsers) ? <p className="py-10 text-center text-muted-foreground">{es ? "Tu rol activo no tiene acceso a Empresas ni Usuarios." : "Your active role does not have access to Companies or Users."}</p> :
        currentQuery.isError ? <div className="py-10 text-center text-destructive"><p>{es ? "No se pudieron cargar los datos de esta vista." : "Could not load data for this view."}</p><Button variant="outline" className="mt-3" onClick={() => currentQuery.refetch()}>{es ? "Reintentar" : "Retry"}</Button></div> :
        !paged.length ? <p className="py-10 text-center text-muted-foreground">{es ? "No se encontraron resultados." : "No results found."}</p> : paged.map(item => tab === "companies" ?
          <div key={(item as OrganizationCompany).id} className="flex min-w-[520px] flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div><p className="font-medium">{companyName(item as OrganizationCompany)}</p><p className="text-sm text-muted-foreground">{(item as OrganizationCompany).memberCount != null ? `${(item as OrganizationCompany).memberCount} ${es ? "miembros" : "members"}` : (item as OrganizationCompany).id}</p></div>
            <div className="flex items-center gap-2"><Badge>{classificationLabel((item as OrganizationCompany).classification || "client")}</Badge><Badge variant="outline">{(item as OrganizationCompany).isActive === false ? (es ? "Inactiva" : "Inactive") : (es ? "Activa" : "Active")}</Badge><Button size="sm" variant="outline" onClick={() => setLocation(`/admin/dashboard/companies/${(item as OrganizationCompany).id}`)}><Eye className="mr-1 h-4 w-4" />{es ? "Ver" : "View"}</Button></div>
          </div> :
          <div key={(item as OrganizationUser).id} className="flex min-w-[520px] flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div><p className="font-medium">{display(item as OrganizationUser)}</p><p className="text-sm text-muted-foreground">{(item as OrganizationUser).email} · {(item as OrganizationUser).memberships?.length || 0} {es ? "relaciones" : "relationships"}</p></div>
            <div className="flex flex-wrap items-center gap-2">{(item as OrganizationUser).platformRoles?.slice(0, 2).map(r => <Badge key={r} variant="secondary">{label(r)}</Badge>)}{(item as OrganizationUser).memberships?.slice(0, 2).map(m => <Badge variant="outline" key={m.membership?.id || m.company?.id}>{companyName(m.company || {})} · {m.membership?.role || "member"}</Badge>)}<Button size="sm" variant="outline" onClick={() => setLocation(`/admin/dashboard/users/${(item as OrganizationUser).id}`)}><Eye className="mr-1 h-4 w-4" />{es ? "Ver usuario" : "View user"}</Button></div>
          </div>)}
      {pages > 1 && <div className="flex items-center justify-between border-t pt-4"><span className="text-sm text-muted-foreground">{es ? `Página ${page} de ${pages}` : `Page ${page} of ${pages}`}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>{es ? "Anterior" : "Previous"}</Button><Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(page + 1)}>{es ? "Siguiente" : "Next"}</Button></div></div>}
    </CardContent></Card>
    {inviteLinks.map((link, i) => <div key={link} className="flex gap-2 rounded border p-3"><Input aria-label={`${es ? "Enlace de invitación" : "Invitation link"} ${i + 1}`} readOnly value={link} /><Button variant="outline" onClick={() => navigator.clipboard.writeText(link)}>{es ? "Copiar" : "Copy"}</Button></div>)}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>{es ? "Crear empresa" : "Create company"}</DialogTitle></DialogHeader><div className="space-y-3"><Input aria-label={es ? "Nombre de empresa" : "Company name"} value={name} onChange={e => setName(e.target.value)} placeholder={es ? "Nombre de empresa" : "Company name"} /><select className="h-10 w-full rounded-md border px-3" value={kind} onChange={e => setKind(e.target.value)}><option value="client">{es ? "Cliente" : "Client"}</option><option value="partner">{es ? "Socio" : "Partner"}</option><option value="both">{es ? "Ambas" : "Both"}</option></select><select className="h-10 w-full rounded-md border px-3" value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)}><option value="">{es ? "Selecciona propietario" : "Select owner"}</option>{normalizeUsers(users.data).map(u => <option key={u.id} value={u.id}>{display(u)}</option>)}</select></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>{es ? "Cancelar" : "Cancel"}</Button><Button disabled={!name || !ownerUserId || create.isPending} onClick={() => create.mutate({ name, classification: kind, ownerUserId }, { onSuccess: () => { setCreateOpen(false); setName(""); toast({ title: es ? "Empresa creada" : "Company created" }); }, onError: e => toast({ title: e.message, variant: "destructive" }) })}>{es ? "Crear" : "Create"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent><DialogHeader><DialogTitle>{es ? "Invitar usuario" : "Invite user"}</DialogTitle></DialogHeader><div className="space-y-3"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /><select className="h-10 w-full rounded-md border px-3" value={memberRole} onChange={e => setMemberRole(e.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select>{normalizeCompanies(companies.data).map(c => <label className="flex gap-2 text-sm" key={c.id}><input type="checkbox" checked={selectedCompanies.includes(c.id)} onChange={e => setSelectedCompanies(e.target.checked ? [...selectedCompanies, c.id] : selectedCompanies.filter(id => id !== c.id))} />{companyName(c)}</label>)}</div><DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>{es ? "Cancelar" : "Cancel"}</Button><Button disabled={!email || !selectedCompanies.length || invite.isPending} onClick={() => invite.mutate({ email, memberships: selectedCompanies.map(companyId => ({ companyId, role: memberRole })) }, { onSuccess: (data: any) => { setInviteOpen(false); setEmail(""); setSelectedCompanies([]); setInviteLinks((data?.inviteTokens || []).map((item: any) => `${window.location.origin}/accept-company-invitation/${item.token || item}`)); toast({ title: es ? "Invitación enviada" : "Invitation sent" }); }, onError: e => toast({ title: e.message, variant: "destructive" }) })}>{es ? "Invitar" : "Invite"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}