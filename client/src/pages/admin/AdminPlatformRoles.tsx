import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Loader2,
  GripVertical,
  LockKeyhole,
  MinusCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { adminSidebarLinks } from "@/lib/adminSidebar";
import { cn } from "@/lib/utils";
import { installNavigationBlocker } from "@/lib/navigationGuard";
import {
  getAdminPermissionWorkspaces,
  getWorkspaceSelection,
  toggleWorkspacePermissions,
} from "@/lib/workspaceCatalog";
import { PLATFORM_ADMIN_PROTECTED_MODULES } from "@shared/platformAdmin";
import {
  ADMIN_WORKSPACE_DEFINITIONS,
  type AdminWorkspaceKey,
  type AdminWorkspaceLayoutItem,
} from "@shared/adminWorkspaces";

type Role = { id: string; slug: string; name: string; description?: string; isSystem: boolean; isActive: boolean; modules: string[]; assignedUsers: number };
type RolesResponse = { roles: Role[]; availableModules: string[] };
type RoleDraft = { name: string; slug: string; description: string; modules: string[] };

const emptyDraft = (): RoleDraft => ({ name: "", slug: "", description: "", modules: [] });
const roleDraft = (role: Role): RoleDraft => ({
  name: role.name,
  slug: role.slug,
  description: role.description || "",
  modules: [...role.modules],
});
const comparableDraft = (draft: RoleDraft) => JSON.stringify({
  ...draft,
  modules: [...draft.modules].sort(),
});
const labels: Record<string, [string, string]> = {
  "module:dashboard": ["Overview", "Resumen"], "module:analytics": ["Analytics", "Analíticas"],
  "module:quotes": ["Quotes", "Cotizaciones"], "module:ratings": ["Ratings", "Calificaciones"],
  "module:activity": ["Activity", "Actividad"], "module:communications": ["Communications", "Comunicaciones"],
  "module:whatsapp": ["WhatsApp", "WhatsApp"], "module:ai_agent": ["Clara", "Clara"],
  "module:inventory": ["Inventory", "Inventario"], "module:pricing": ["Pricing", "Precios"],
  "module:ustorage": ["U-Storage branches", "Sucursales U-Storage"], "module:payments": ["Payments", "Pagos"],
  "module:database": ["Database", "Base de datos"], "module:marketing": ["SEO, marketing & blog", "SEO, marketing y blog"],
  "module:users": ["Users", "Usuarios"], "module:companies": ["Companies", "Empresas"],
  "module:settings": ["Settings", "Configuración"],
};

export default function AdminPlatformRoles() {
  const { i18n } = useTranslation();
  const es = i18n.language === "es";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { data } = useQuery<RolesResponse>({ queryKey: ["/api/admin/platform-roles"] });
  const { data: workspaceLayoutData } = useQuery<{ layout: AdminWorkspaceLayoutItem[] }>({
    queryKey: ["/api/admin/workspace-layout"],
  });
  const [indexTab, setIndexTab] = useState<"workspaces" | "roles">("workspaces");
  const [workspaceDraft, setWorkspaceDraft] = useState<AdminWorkspaceLayoutItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const allowNavigationRef = useRef(false);
  const historyGuardIdRef = useRef(`role-editor-${Date.now()}`);
  const historySentinelInstalledRef = useRef(false);
  const historySentinelConsumingRef = useRef(false);
  const afterSentinelConsumeRef = useRef<Array<() => void>>([]);
  const languageIsSpanishRef = useRef(es);
  languageIsSpanishRef.current = es;
  const [openWorkspaces, setOpenWorkspaces] = useState<Set<string>>(new Set());
  const [openOrganizerWorkspaces, setOpenOrganizerWorkspaces] = useState<Set<string>>(
    new Set(ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => workspace.key)),
  );
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const rolesBasePath = "/admin/dashboard/roles";
  const routeSuffix = location.startsWith(`${rolesBasePath}/`) ? location.slice(rolesBasePath.length + 1) : "";
  const isRoleIndex = !routeSuffix;
  const isCreating = routeSuffix === "new";
  const selectedId = !isRoleIndex && !isCreating ? decodeURIComponent(routeSuffix) : null;
  const selected = data?.roles.find((role) => role.id === selectedId);
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft);
  const beginEdit = (role: Role) => {
    setLocation(`${rolesBasePath}/${encodeURIComponent(role.id)}`);
  };
  const beginCreate = () => {
    setLocation(`${rolesBasePath}/new`);
  };
  const displayed = draft;
  const baseline = selected ? roleDraft(selected) : emptyDraft();
  const isDirty = isCreating
    ? comparableDraft(displayed) !== comparableDraft(emptyDraft())
    : !!selected && comparableDraft(displayed) !== comparableDraft(baseline);
  const requestNavigation = (target: string) => {
    if (!isDirty) {
      setLocation(target);
      return;
    }
    setPendingNavigation(target);
    setDiscardDialogOpen(true);
  };
  const consumeHistorySentinel = (afterConsume?: () => void) => {
    if (afterConsume) afterSentinelConsumeRef.current.push(afterConsume);
    const finishConsumption = () => {
      const callbacks = afterSentinelConsumeRef.current.splice(0);
      callbacks.forEach((callback) => callback());
    };
    if (historySentinelConsumingRef.current) return;
    const guardId = historyGuardIdRef.current;
    const isCurrentSentinel = window.history.state?.__roleEditorGuardSentinel === guardId;
    if (!historySentinelInstalledRef.current || !isCurrentSentinel) {
      historySentinelInstalledRef.current = false;
      finishConsumption();
      return;
    }
    historySentinelInstalledRef.current = false;
    historySentinelConsumingRef.current = true;
    allowNavigationRef.current = true;
    window.addEventListener("popstate", () => {
      historySentinelConsumingRef.current = false;
      allowNavigationRef.current = false;
      finishConsumption();
    }, { once: true });
    window.history.back();
  };

  useEffect(() => {
    if (isCreating) {
      setDraft(emptyDraft());
      setOpenWorkspaces(new Set());
    } else if (selected) {
      setDraft(roleDraft(selected));
      setOpenWorkspaces(new Set());
    }
  }, [isCreating, selected?.id]);

  useEffect(() => {
    if (workspaceLayoutData?.layout) setWorkspaceDraft(workspaceLayoutData.layout);
  }, [workspaceLayoutData?.layout]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    return installNavigationBlocker((navigate) => {
      const shouldLeave = window.confirm(
        languageIsSpanishRef.current
          ? "Hay cambios sin guardar. ¿Quieres descartarlos y salir?"
          : "You have unsaved changes. Discard them and leave?",
      );
      if (shouldLeave) consumeHistorySentinel(navigate);
    });
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const interceptInternalLinks = (event: MouseEvent) => {
      if (allowNavigationRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.download) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      const nextPath = `${target.pathname}${target.search}${target.hash}`;
      if (nextPath === location) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(nextPath);
      setDiscardDialogOpen(true);
    };

    document.addEventListener("click", interceptInternalLinks, true);
    return () => {
      document.removeEventListener("click", interceptInternalLinks, true);
    };
  }, [isDirty, location]);

  useEffect(() => {
    if (!isDirty || historySentinelInstalledRef.current) return;
    const guardId = historyGuardIdRef.current;
    const currentState = window.history.state || {};
    const guardedUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    window.history.replaceState(
      { ...currentState, __roleEditorGuardBase: guardId },
      "",
      guardedUrl,
    );
    window.history.pushState(
      { ...currentState, __roleEditorGuardSentinel: guardId },
      "",
      guardedUrl,
    );
    historySentinelInstalledRef.current = true;

    const interceptGuardedBack = (event: PopStateEvent) => {
      if (allowNavigationRef.current || event.state?.__roleEditorGuardBase !== guardId) return;
      const shouldLeave = window.confirm(
        es
          ? "Hay cambios sin guardar. ¿Quieres descartarlos y salir?"
          : "You have unsaved changes. Discard them and leave?",
      );
      if (shouldLeave) {
        allowNavigationRef.current = true;
        historySentinelInstalledRef.current = false;
        window.history.back();
      } else {
        window.history.pushState(
          { ...currentState, __roleEditorGuardSentinel: guardId },
          "",
          guardedUrl,
        );
      }
    };

    window.addEventListener("popstate", interceptGuardedBack);
    return () => window.removeEventListener("popstate", interceptGuardedBack);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty && historySentinelInstalledRef.current) consumeHistorySentinel();
  }, [isDirty]);

  useEffect(() => {
    if (data && selectedId && !selected) setLocation(rolesBasePath);
  }, [data, selected, selectedId, setLocation]);

  useEffect(() => {
    allowNavigationRef.current = false;
  }, [location]);

  const mutation = useMutation({
    mutationFn: async () => {
      const url = selected ? `/api/admin/platform-roles/${selected.id}` : "/api/admin/platform-roles";
      const response = await apiRequest(selected ? "PATCH" : "POST", url, displayed);
      return response.json() as Promise<Role>;
    },
    onSuccess: async (savedRole) => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/platform-roles"] });
      setDraft({
        name: savedRole.name,
        slug: savedRole.slug,
        description: savedRole.description || "",
        modules: [...displayed.modules],
      });
      const savedRolePath = `${rolesBasePath}/${encodeURIComponent(savedRole.id)}`;
      consumeHistorySentinel(() => {
        if (savedRolePath !== location) setLocation(savedRolePath);
      });
      toast({
        title: es ? "Rol guardado" : "Role saved",
        description: es ? "Los permisos ya están actualizados." : "The permissions are now up to date.",
      });
    },
    onError: (error: any) => toast({ title: es ? "No se pudo guardar" : "Could not save", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/platform-roles/${id}`),
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setDraft(emptyDraft());
      await qc.invalidateQueries({ queryKey: ["/api/admin/platform-roles"] });
      consumeHistorySentinel(() => setLocation(rolesBasePath));
      toast({ title: es ? "Rol eliminado" : "Role deleted" });
    },
    onError: (error: any) => toast({ title: es ? "No se pudo eliminar" : "Could not delete", description: error.message, variant: "destructive" }),
  });
  const modules = useMemo(() => data?.availableModules || [], [data]);
  const workspaces = useMemo(
    () => getAdminPermissionWorkspaces(adminSidebarLinks, modules, i18n.language, workspaceLayoutData?.layout),
    [i18n.language, modules, workspaceLayoutData?.layout],
  );
  const protectedModules = PLATFORM_ADMIN_PROTECTED_MODULES as readonly string[];
  const isSuperAdminRole = selected?.slug === "super_admin";
  const selectedModules = isSuperAdminRole ? modules : displayed.modules;
  const toggle = (module: string) => setDraft((current) => ({ ...current, modules: current.modules.includes(module) ? current.modules.filter((item) => item !== module) : [...current.modules, module] }));
  const toggleWorkspace = (workspaceModules: string[]) => setDraft((current) => ({
    ...current,
    modules: toggleWorkspacePermissions(current.modules, workspaceModules, protectedModules),
  }));
  const toggleWorkspaceOpen = (key: string) => setOpenWorkspaces((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const normalizeWorkspaceDraft = (layout: AdminWorkspaceLayoutItem[]) =>
    ADMIN_WORKSPACE_DEFINITIONS.flatMap((workspace) =>
      layout
        .filter((item) => item.workspaceKey === workspace.key)
        .sort((a, b) => a.position - b.position)
        .map((item, position) => ({ ...item, position })),
    );
  const moveSectionToWorkspace = (href: string, workspaceKey: AdminWorkspaceKey) => {
    setWorkspaceDraft((current) => normalizeWorkspaceDraft(current.map((item) =>
      item.href === href ? { ...item, workspaceKey, position: Number.MAX_SAFE_INTEGER } : item,
    )));
  };
  const moveSection = (href: string, direction: -1 | 1) => {
    setWorkspaceDraft((current) => {
      const item = current.find((entry) => entry.href === href);
      if (!item) return current;
      const group = current.filter((entry) => entry.workspaceKey === item.workspaceKey).sort((a, b) => a.position - b.position);
      const index = group.findIndex((entry) => entry.href === href);
      const target = index + direction;
      if (target < 0 || target >= group.length) return current;
      [group[index], group[target]] = [group[target], group[index]];
      const positions = new Map(group.map((entry, position) => [entry.href, position]));
      return normalizeWorkspaceDraft(current.map((entry) =>
        entry.workspaceKey === item.workspaceKey ? { ...entry, position: positions.get(entry.href) ?? entry.position } : entry,
      ));
    });
  };
  const dropSection = (href: string, targetWorkspaceKey: AdminWorkspaceKey, targetIndex?: number) => {
    setWorkspaceDraft((current) => {
      const dragged = current.find((entry) => entry.href === href);
      if (!dragged) return current;
      const withoutDragged = current.filter((entry) => entry.href !== href);
      const targetGroup = withoutDragged
        .filter((entry) => entry.workspaceKey === targetWorkspaceKey)
        .sort((a, b) => a.position - b.position);
      const insertionIndex = Math.max(0, Math.min(targetIndex ?? targetGroup.length, targetGroup.length));
      targetGroup.splice(insertionIndex, 0, { ...dragged, workspaceKey: targetWorkspaceKey });
      const positions = new Map(targetGroup.map((entry, position) => [entry.href, position]));
      return normalizeWorkspaceDraft([
        ...withoutDragged.map((entry) =>
          entry.workspaceKey === targetWorkspaceKey
            ? { ...entry, position: positions.get(entry.href) ?? entry.position }
            : entry,
        ),
        ...targetGroup.filter((entry) => entry.href === href),
      ]);
    });
  };
  const toggleOrganizerWorkspace = (key: string) => setOpenOrganizerWorkspaces((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const workspaceLayoutDirty = JSON.stringify(normalizeWorkspaceDraft(workspaceDraft))
    !== JSON.stringify(normalizeWorkspaceDraft(workspaceLayoutData?.layout || []));
  const saveWorkspaceLayout = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/admin/workspace-layout", { layout: normalizeWorkspaceDraft(workspaceDraft) });
      return response.json() as Promise<{ layout: AdminWorkspaceLayoutItem[] }>;
    },
    onSuccess: async ({ layout }) => {
      setWorkspaceDraft(layout);
      await qc.invalidateQueries({ queryKey: ["/api/admin/workspace-layout"] });
      toast({
        title: es ? "Espacios actualizados" : "Workspaces updated",
        description: es ? "La navegación y los roles ya usan la nueva organización." : "Navigation and roles now use the new organization.",
      });
    },
    onError: (error: any) => toast({
      title: es ? "No se pudo guardar" : "Could not save",
      description: error.message,
      variant: "destructive",
    }),
  });

  useEffect(() => {
    if (!isRoleIndex || indexTab !== "workspaces" || !workspaceLayoutDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    const removeNavigationBlocker = installNavigationBlocker((navigate) => {
      const shouldLeave = window.confirm(
        es
          ? "Hay cambios sin guardar en los espacios de trabajo. ¿Quieres descartarlos?"
          : "There are unsaved workspace changes. Discard them?",
      );
      if (shouldLeave) navigate();
    });
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      removeNavigationBlocker();
    };
  }, [es, indexTab, isRoleIndex, workspaceLayoutDirty]);

  if (isRoleIndex) {
    return (
      <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="workspace-hero">
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-action">
                  {es ? "Control de acceso" : "Access control"}
                </p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  {es ? "Roles y visibilidad" : "Roles & visibility"}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
                  {es
                    ? "Selecciona un rol para revisar sus espacios de trabajo y permisos."
                    : "Select a role to review its workspaces and permissions."}
                </p>
              </div>
              {indexTab === "roles" && (
                <Button
                  onClick={beginCreate}
                  className="w-full border border-white/20 bg-white text-primary hover:bg-white/90 sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {es ? "Nuevo rol" : "New role"}
                </Button>
              )}
            </div>
          </header>

          <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-2 sm:flex-row" role="tablist">
            <Button
              type="button"
              variant={indexTab === "workspaces" ? "default" : "ghost"}
              onClick={() => setIndexTab("workspaces")}
              role="tab"
              aria-selected={indexTab === "workspaces"}
            >
              {es ? "Espacios de trabajo" : "Workspaces"}
            </Button>
            <Button
              type="button"
              variant={indexTab === "roles" ? "default" : "ghost"}
              onClick={() => {
                if (!workspaceLayoutDirty || window.confirm(
                  es
                    ? "Hay cambios sin guardar. ¿Quieres descartarlos y abrir Roles y acceso?"
                    : "There are unsaved changes. Discard them and open Roles & access?",
                )) {
                  setWorkspaceDraft(workspaceLayoutData?.layout || []);
                  setIndexTab("roles");
                }
              }}
              role="tab"
              aria-selected={indexTab === "roles"}
            >
              {es ? "Roles y acceso" : "Roles & access"}
            </Button>
          </div>

          {indexTab === "roles" ? (
          <Card className="workspace-card overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{es ? "Roles administrativos" : "Admin roles"}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data?.roles.length || 0} {es ? "roles configurados" : "configured roles"}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {es ? "Acceso por rol" : "Role-based access"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {data?.roles.map((role) => {
                const roleWorkspaces = getAdminPermissionWorkspaces(adminSidebarLinks, modules, i18n.language, workspaceLayoutData?.layout)
                  .filter((workspace) => getWorkspaceSelection(
                    role.modules.includes("*") ? modules : role.modules,
                    workspace.permissions,
                  ) !== "none");
                const accessLabel = role.modules.includes("*")
                  ? (es ? "Acceso total" : "Full access")
                  : `${role.modules.length} ${es ? "secciones" : "sections"}`;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => beginEdit(role)}
                    className="group flex w-full flex-col gap-4 px-4 py-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:px-6"
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={cn(
                        "mt-0.5 rounded-xl p-2.5",
                        role.isSystem ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{role.name}</span>
                          {role.isSystem && (
                            <Badge variant="secondary">{es ? "Sistema" : "System"}</Badge>
                          )}
                        </span>
                        <span className="mt-1 line-clamp-2 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {role.description || (es ? "Sin descripción." : "No description.")}
                        </span>
                        <span className="mt-3 flex flex-wrap gap-2">
                          {roleWorkspaces.slice(0, 4).map((workspace) => (
                            <Badge key={workspace.key} variant="outline" className="font-normal">
                              {workspace.label}
                            </Badge>
                          ))}
                          {roleWorkspaces.length > 4 && (
                            <Badge variant="outline" className="font-normal">+{roleWorkspaces.length - 4}</Badge>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="flex w-full items-center justify-between gap-4 border-t pt-3 sm:w-auto sm:min-w-52 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <span>
                        <span className="block text-sm font-semibold">{accessLabel}</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {role.assignedUsers} {es ? "personas" : "people"}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          ) : (
            <div className="space-y-4">
              <Card className="workspace-card">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{es ? "Organización de secciones" : "Section organization"}</CardTitle>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {es
                          ? "Mueve cada sección al espacio donde debe aparecer. El cambio actualiza la navegación y la forma en que se muestran los permisos."
                          : "Move each section to the workspace where it belongs. Changes update navigation and permission summaries."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setWorkspaceDraft(workspaceLayoutData?.layout || [])}
                        disabled={!workspaceLayoutDirty || saveWorkspaceLayout.isPending}
                      >
                        {es ? "Descartar" : "Discard"}
                      </Button>
                      <Button
                        onClick={() => saveWorkspaceLayout.mutate()}
                        disabled={!workspaceLayoutDirty || saveWorkspaceLayout.isPending}
                      >
                        {saveWorkspaceLayout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {es ? "Guardar organización" : "Save organization"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card className="workspace-card overflow-hidden">
                <CardContent className="divide-y p-0">
                  {ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => {
                    const sections = workspaceDraft
                      .filter((item) => item.workspaceKey === workspace.key)
                      .sort((a, b) => a.position - b.position);
                    const isOpen = openOrganizerWorkspaces.has(workspace.key);
                    return (
                      <section
                        key={workspace.key}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingSection) dropSection(draggingSection, workspace.key);
                          setDraggingSection(null);
                        }}
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
                            isOpen && "bg-muted/20",
                          )}
                          onClick={() => toggleOrganizerWorkspace(workspace.key)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{es ? workspace.label.es : workspace.label.en}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {isOpen
                                ? (es ? "Arrastra secciones para reorganizar" : "Drag sections to reorganize")
                                : (es ? "Mostrar secciones" : "Show sections")}
                            </span>
                          </span>
                          <Badge variant="outline" className="shrink-0 tabular-nums">
                            {sections.length} {es ? "secciones" : "sections"}
                          </Badge>
                        </button>
                        {isOpen && (
                          <div className="border-t bg-background/60">
                            {sections.length === 0 ? (
                              <div className="px-12 py-4 text-sm text-muted-foreground">
                                {es ? "Suelta una sección aquí." : "Drop a section here."}
                              </div>
                            ) : sections.map((section, index) => {
                              const sidebarSection = adminSidebarLinks.find((link) => link.href === section.href);
                              const Icon = sidebarSection?.icon;
                              return (
                                <div
                                  key={section.href}
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", section.href);
                                    setDraggingSection(section.href);
                                  }}
                                  onDragEnd={() => setDraggingSection(null)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const href = draggingSection || event.dataTransfer.getData("text/plain");
                                    if (href && href !== section.href) dropSection(href, workspace.key, index);
                                    setDraggingSection(null);
                                  }}
                                  className={cn(
                                    "group flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:px-5",
                                    draggingSection === section.href && "opacity-45",
                                  )}
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-3">
                                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60 group-hover:text-muted-foreground" aria-hidden="true" />
                                    {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                                    <span className="min-w-0 truncate font-medium">
                                      {es ? sidebarSection?.labelEs : sidebarSection?.label}
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-1 sm:ml-auto">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => moveSection(section.href, -1)}
                                      disabled={index === 0}
                                      aria-label={es ? "Mover arriba" : "Move up"}
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => moveSection(section.href, 1)}
                                      disabled={index === sections.length - 1}
                                      aria-label={es ? "Mover abajo" : "Move down"}
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Select
                                      value={section.workspaceKey}
                                      onValueChange={(value) => moveSectionToWorkspace(section.href, value as AdminWorkspaceKey)}
                                    >
                                      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label={es ? "Mover a otro espacio" : "Move to another workspace"}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ADMIN_WORKSPACE_DEFINITIONS.map((option) => (
                                          <SelectItem key={option.key} value={option.key}>
                                            {es ? option.label.es : option.label.en}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="workspace-hero">
          <div className="relative z-10">
            <Button
              variant="ghost"
              onClick={() => requestNavigation(rolesBasePath)}
              className="-ml-3 mb-4 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {es ? "Volver a roles" : "Back to roles"}
            </Button>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-action">
                {es ? "Control de acceso" : "Access control"}
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                {selected?.name || (es ? "Nuevo rol" : "New role")}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
                {es
                  ? "Configura sus espacios de trabajo y ajusta secciones específicas cuando sea necesario."
                  : "Configure its workspaces and adjust individual sections when needed."}
              </p>
            </div>
              {selected?.isSystem && (
                <Badge className="w-fit border border-white/20 bg-white/10 text-white hover:bg-white/10">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {es ? "Rol del sistema" : "System role"}
                </Badge>
              )}
            </div>
          </div>
        </header>

        <div>
          <Card className="workspace-card overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{selected ? (es ? "Editar rol" : "Edit role") : (es ? "Crear rol" : "Create role")}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected
                      ? (es ? `Configura el acceso de ${selected.name}.` : `Configure access for ${selected.name}.`)
                      : (es ? "Define un nombre y selecciona sus espacios." : "Choose a name and select its workspaces.")}
                  </p>
                </div>
                {isDirty && !isSuperAdminRole && (
                  <Badge variant="outline" className="border-action/40 bg-action/10 text-foreground">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-action" />
                    {es ? "Cambios sin guardar" : "Unsaved changes"}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-7 p-4 sm:p-6">
              <section aria-labelledby="role-details-heading" className="space-y-4">
                <div>
                  <h2 id="role-details-heading" className="text-sm font-semibold">{es ? "Información del rol" : "Role details"}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {es ? "Usa un nombre claro que describa la responsabilidad." : "Use a clear name that describes the responsibility."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">{es ? "Nombre" : "Name"}</Label>
                    <Input
                      id="role-name"
                      value={displayed.name}
                      disabled={isSuperAdminRole}
                      placeholder={es ? "Ej. Coordinación operativa" : "e.g. Operations coordination"}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-slug">Slug</Label>
                    <Input
                      id="role-slug"
                      value={displayed.slug}
                      disabled={!!selected}
                      placeholder="operations_team"
                      aria-describedby="role-slug-help"
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        slug: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      }))}
                    />
                    <p id="role-slug-help" className="text-xs text-muted-foreground">
                      {selected
                        ? (es ? "El identificador no cambia después de crear el rol." : "The identifier cannot change after creation.")
                        : (es ? "Solo letras minúsculas, números y guiones bajos." : "Lowercase letters, numbers, and underscores only.")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">{es ? "Descripción" : "Description"}</Label>
                  <Textarea
                    id="role-description"
                    value={displayed.description}
                    disabled={isSuperAdminRole}
                    className="min-h-24 resize-y"
                    placeholder={es ? "Explica para quién es este rol y qué responsabilidad cubre." : "Explain who this role is for and what responsibility it covers."}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
              </section>

              <section aria-labelledby="workspace-access-heading" className="space-y-4 border-t pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="workspace-access-heading" className="text-sm font-semibold">
                      {es ? "Espacios administrativos" : "Admin workspaces"}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      {es
                        ? "Activa un espacio completo o abre sus secciones para crear excepciones."
                        : "Enable a complete workspace, or open its sections to create exceptions."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs" aria-label={es ? "Leyenda de acceso" : "Access legend"}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />{es ? "Completo" : "Full"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-action/10 px-2.5 py-1 font-medium text-foreground">
                      <MinusCircle className="h-3.5 w-3.5 text-action" />{es ? "Parcial" : "Partial"}
                    </span>
                  </div>
                </div>

                {isSuperAdminRole && (
                  <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
                    <span className="rounded-full bg-primary/10 p-2 text-primary">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold">{es ? "Acceso total protegido" : "Protected full access"}</p>
                      <p className="mt-1 text-muted-foreground">
                        {es ? "Super Admin es inmutable y siempre puede acceder a todas las secciones." : "Super Admin is immutable and always has access to every section."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {workspaces.map((workspace) => {
                    const selection = getWorkspaceSelection(selectedModules, workspace.permissions);
                    const protectedWorkspace = workspace.permissions.every((module) => protectedModules.includes(module));
                    const isOpen = openWorkspaces.has(workspace.key);
                    const statusLabel = selection === "all"
                      ? (es ? "Acceso completo" : "Full access")
                      : selection === "partial"
                        ? (es ? "Acceso parcial" : "Partial access")
                        : (es ? "Sin acceso" : "No access");
                    const enabledCount = workspace.permissions.filter((module) => selectedModules.includes(module)).length;

                    return (
                      <Collapsible
                        key={workspace.key}
                        open={isOpen}
                        onOpenChange={() => toggleWorkspaceOpen(workspace.key)}
                        className={cn(
                          "overflow-hidden rounded-xl border transition-colors",
                          selection === "all" && "border-success/30 bg-success/[0.03]",
                          selection === "partial" && "border-action/40 bg-action/[0.03]",
                        )}
                      >
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                            <Checkbox
                              checked={selection === "partial" ? "indeterminate" : selection === "all"}
                              disabled={isSuperAdminRole || protectedWorkspace}
                              onCheckedChange={() => toggleWorkspace(workspace.permissions)}
                              aria-label={`${workspace.label}: ${statusLabel}`}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2 font-semibold">
                                {workspace.label}
                                {protectedWorkspace && (
                                  <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-900">
                                    <LockKeyhole className="h-3 w-3" />
                                    {es ? "Protegido" : "Protected"}
                                  </Badge>
                                )}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {statusLabel} · {enabledCount}/{workspace.permissions.length} {es ? "secciones" : "sections"}
                              </span>
                            </span>
                          </label>
                          <CollapsibleTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="w-full justify-between sm:w-auto">
                              {es ? "Ajustar secciones" : "Adjust sections"}
                              <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                            </Button>
                          </CollapsibleTrigger>
                        </div>

                        {protectedWorkspace && !isSuperAdminRole && (
                          <p className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
                            {es
                              ? "Por seguridad, Sistema y Base de datos se conceden individualmente en las secciones."
                              : "For safety, System and Database access must be granted individually below."}
                          </p>
                        )}

                        <CollapsibleContent className="border-t bg-background/70 p-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {workspace.permissions.map((module) => {
                              const checked = selectedModules.includes(module);
                              const protectedModule = protectedModules.includes(module);
                              return (
                                <label
                                  key={module}
                                  className={cn(
                                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                                    checked ? "border-primary/25 bg-primary/5" : "hover:bg-muted/50",
                                    isSuperAdminRole && "cursor-not-allowed opacity-70",
                                  )}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={isSuperAdminRole}
                                    onCheckedChange={() => toggle(module)}
                                    aria-label={labels[module]?.[es ? 1 : 0] || module}
                                  />
                                  <span className="min-w-0 flex-1 text-sm font-medium">{labels[module]?.[es ? 1 : 0] || module}</span>
                                  {protectedModule && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />}
                                </label>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </section>
            </CardContent>

            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t bg-card/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                {selected && !selected.isSystem && (
                  <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {es ? "Eliminar rol" : "Delete role"}
                  </Button>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {isDirty && selected && !isSuperAdminRole && (
                  <Button variant="ghost" onClick={() => consumeHistorySentinel(() => setDraft(roleDraft(selected)))}>
                    {es ? "Descartar cambios" : "Discard changes"}
                  </Button>
                )}
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={isSuperAdminRole || !isDirty || !displayed.name.trim() || (!selected && !displayed.slug.trim()) || mutation.isPending}
                  className="min-w-36"
                >
                  {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {mutation.isPending ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar rol" : "Save role")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{es ? "¿Eliminar este rol?" : "Delete this role?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {es
                ? `Se eliminará “${selected?.name || ""}”. Esta acción no se puede deshacer y puede afectar a ${selected?.assignedUsers || 0} personas asignadas.`
                : `“${selected?.name || ""}” will be deleted. This cannot be undone and may affect ${selected?.assignedUsers || 0} assigned people.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{es ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending || !selected}
              onClick={(event) => {
                event.preventDefault();
                if (selected) remove.mutate(selected.id);
              }}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {es ? "Eliminar definitivamente" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardDialogOpen} onOpenChange={(open) => {
        setDiscardDialogOpen(open);
        if (!open) setPendingNavigation(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{es ? "¿Salir sin guardar?" : "Leave without saving?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {es
                ? "Los cambios realizados en este rol se perderán."
                : "The changes made to this role will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{es ? "Seguir editando" : "Keep editing"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const destination = pendingNavigation || rolesBasePath;
                consumeHistorySentinel(() => {
                  setLocation(destination);
                  setPendingNavigation(null);
                });
              }}
            >
              {es ? "Descartar y salir" : "Discard and leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}