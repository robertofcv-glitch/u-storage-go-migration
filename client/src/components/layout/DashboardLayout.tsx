import { createContext, useContext, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronLeft, LogOut, User, Settings, ChevronDown, ChevronRight, Globe, Shield, Truck, UserCircle, ArrowLeft, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";
import { getSwitchableDashboardRoles, groupLinksByWorkspace, isNavigationLinkActive, resolveWorkspaceKey, type WorkspaceKey } from "@/lib/workspaceCatalog";
import { runGuardedNavigation } from "@/lib/navigationGuard";
import type { AdminWorkspaceLayoutItem } from "@shared/adminWorkspaces";

function useNoIndex() {
  useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"][data-dashboard]') as HTMLMetaElement;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      robotsMeta.setAttribute('data-dashboard', 'true');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');
    
    return () => {
      const meta = document.querySelector('meta[name="robots"][data-dashboard]');
      if (meta) meta.remove();
    };
  }, []);
}

interface ImpersonateUser {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  userType: string;
  roles: { role: string }[];
  platformRoles?: string[];
  availablePlatformRoles?: { slug: string; name: string }[];
  activePlatformRole?: string | null;
  effectivePermissions?: string[];
}

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: string;
  permission?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  links: SidebarLink[];
  userType: "client" | "mover" | "admin";
}

import { ClaraFloatingChat } from "@/components/ClaraFloatingChat";

const DashboardLayoutContext = createContext(false);

export function DashboardLayout({ children, links, userType }: DashboardLayoutProps) {
  const isNestedLayout = useContext(DashboardLayoutContext);
  if (isNestedLayout) return <>{children}</>;

  return (
    <DashboardLayoutContext.Provider value>
      <DashboardLayoutFrame links={links} userType={userType}>{children}</DashboardLayoutFrame>
    </DashboardLayoutContext.Provider>
  );
}

function DashboardLayoutFrame({ children, links, userType }: DashboardLayoutProps) {
  useNoIndex();
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedAdminWorkspace, setSelectedAdminWorkspace] = useState<WorkspaceKey>();
  const queryClient = useQueryClient();
  const companyContext = usePartnerCompany();

  const { data: whatsappUnread } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/whatsapp/unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/admin/whatsapp/unread-count');
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: userType === 'admin',
    refetchInterval: 30000,
  });
  const { data: workspaceLayoutData } = useQuery<{ layout: AdminWorkspaceLayoutItem[] }>({
    queryKey: ['/api/admin/workspace-layout'],
    enabled: userType === 'admin',
  });

  const badgeValues: Record<string, number> = {
    whatsappUnread: whatsappUnread?.count || 0,
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(newLang);
  };

  // Fetch current logged-in user (includes isImpersonated flag)
  const { data: currentUserData } = useQuery<{
    user: ImpersonateUser | null;
    operatorAccess?: Pick<ImpersonateUser, "availablePlatformRoles" | "activePlatformRole" | "effectivePermissions"> | null;
    isImpersonated: boolean;
  }>({
    queryKey: ['/api/impersonate/current'],
  });

  const currentUser = currentUserData?.user;
  const isImpersonated = currentUserData?.isImpersonated || false;
  const availablePlatformRoles = currentUserData?.operatorAccess?.availablePlatformRoles || currentUser?.availablePlatformRoles || [];
  const activePlatformRole = currentUserData?.operatorAccess?.activePlatformRole || currentUser?.activePlatformRole || null;
  const switchPlatformRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await apiRequest("POST", "/api/admin/active-platform-role", { role });
      return res.json();
    },
    onSuccess: async (data: { effectivePermissions?: string[] }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/impersonate/current"] });
      const permittedLinks = links.filter((link) =>
        !link.permission || data.effectivePermissions?.includes("*") || data.effectivePermissions?.includes(link.permission)
      );
      const destination = groupLinksByWorkspace(permittedLinks, "admin", i18n.language, workspaceLayoutData?.layout)[0]?.links[0]?.href;
      if (destination) setLocation(destination);
    },
  });

  // Stop impersonation mutation
  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/impersonate/stop');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/impersonate/current'] });
      setLocation('/admin/dashboard');
      window.location.reload();
    },
  });

  // Logout handler
  const handleLogout = async () => {
    try {
      await Promise.all([
        fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {}),
        fetch("/api/auth/email-logout", { method: "POST", credentials: "include" }).catch(() => {}),
      ]);
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getUserDisplayName = (user: ImpersonateUser) => {
    if (user.fullName) return user.fullName;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    return user.email;
  };

  const getUserInitials = (user: ImpersonateUser) => {
    const name = getUserDisplayName(user);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  const permissionFilteredLinks = userType === "admin" && (currentUser?.platformRoles?.length || currentUser?.effectivePermissions?.length)
    ? links.filter((link) => !link.permission || currentUser.effectivePermissions!.includes("*") || currentUser.effectivePermissions!.includes(link.permission))
    : links;
  const navLinks: SidebarLink[] = userType === "mover" && !permissionFilteredLinks.some((link) => link.href === "/mover/dashboard/company")
    ? [...permissionFilteredLinks, { href: "/mover/dashboard/company", label: i18n.language === "es" ? "Empresa y equipo" : "Company & team", icon: Users }]
    : userType === "client" && !permissionFilteredLinks.some((link) => link.href === "/dashboard/company")
      ? [...permissionFilteredLinks, { href: "/dashboard/company", label: i18n.language === "es" ? "Empresa y equipo" : "Company & team", icon: Users }]
      : permissionFilteredLinks;

  // Get current user's roles for role switcher
  const currentUserRoles = currentUser?.roles?.map(r => r.role) || [];

  const getRoleLabel = (role: string) => {
    if (role === 'home') return i18n.language === 'es' ? 'INICIO' : 'HOME';
    if (role === 'client') return i18n.language === 'es' ? 'CLIENTE' : 'CLIENT';
    if (role === 'mover') return i18n.language === 'es' ? 'SOCIO' : 'PARTNER';
    return 'ADMIN';
  };

  const getRoleIcon = (role: string) => {
    if (role === 'client') return UserCircle;
    if (role === 'mover') return Truck;
    return Shield;
  };

  const getRoleDashboardPath = (role: string) => {
    if (role === 'home') return '/';
    if (role === 'client') return '/dashboard';
    if (role === 'mover') return '/mover/dashboard';
    return '/admin/dashboard';
  };

  const handleRoleSwitch = (role: string) => {
    runGuardedNavigation(() => setLocation(getRoleDashboardPath(role)));
  };

  const allNavigationOptions = getSwitchableDashboardRoles([
    ...currentUserRoles,
    ...(currentUser?.platformRoles?.length ? ["admin"] : []),
  ]);
  const canSwitchRoles = allNavigationOptions.length > 1;
  const workspaceGroups = groupLinksByWorkspace(navLinks, userType, i18n.language, workspaceLayoutData?.layout);
  const resolvedAdminWorkspace = userType === "admin"
    ? resolveWorkspaceKey(workspaceGroups, location, selectedAdminWorkspace)
    : undefined;
  const visibleWorkspaceGroups = userType === "admin"
    ? workspaceGroups.filter((workspace) => workspace.key === resolvedAdminWorkspace)
    : workspaceGroups;
  useEffect(() => {
    if (userType === "admin" && resolvedAdminWorkspace !== selectedAdminWorkspace) {
      setSelectedAdminWorkspace(resolvedAdminWorkspace);
    }
  }, [userType, resolvedAdminWorkspace, selectedAdminWorkspace]);
  const selectAdminWorkspace = (workspaceKey: WorkspaceKey) => {
    const workspace = workspaceGroups.find((group) => group.key === workspaceKey);
    if (!workspace) return;
    setSelectedAdminWorkspace(workspaceKey);
    const destination = workspace.links[0]?.href;
    if (destination) runGuardedNavigation(() => setLocation(destination));
  };
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
  const toggleWorkspace = (key: string) => {
    setCollapsedWorkspaces((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const SidebarContent = ({ expanded = isSidebarOpen, mobile = false }: { expanded?: boolean; mobile?: boolean }) => (
    <div className="flex h-full flex-col gap-4">
      {/* Removed duplicate logo from here since it is now in the top bar */}
      <div className={cn("flex h-14 items-center border-b border-sidebar-border bg-primary px-4 lg:h-[60px]", expanded ? "justify-between" : "justify-center")}>
        {expanded && (canSwitchRoles ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="font-bold text-white pl-2 uppercase tracking-wide text-lg hover:bg-white/10 hover:text-white flex items-center gap-2">
                {getRoleLabel(userType)}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {i18n.language === 'es' ? 'Navegar a' : 'Navigate to'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allNavigationOptions.map((role) => {
                const Icon = getRoleIcon(role);
                const isActive = role !== 'home' && (
                  (role === 'client' && userType === 'client') ||
                  (role === 'mover' && userType === 'mover') ||
                  (role === 'admin' && userType === 'admin')
                );
                return (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => handleRoleSwitch(role)}
                    className={cn("cursor-pointer", isActive && "bg-accent")}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {getRoleLabel(role)}
                    {isActive && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="px-2 text-lg font-bold uppercase tracking-wide text-white">{getRoleLabel(userType)}</div>
        ))}
        {!mobile && <Button variant="ghost" size="icon" className="hidden lg:flex ml-auto text-white hover:bg-white/10 hover:text-white" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>}
      </div>
      
       {userType === "admin" && expanded && workspaceGroups.length > 0 && (
         <div className="border-b border-slate-200 px-3 pb-3">
           <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
               {i18n.language === "es" ? "Espacio de trabajo" : "Workspace"}
           </p>
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-auto w-full justify-between gap-2 px-3 py-2 text-left" disabled={workspaceGroups.length === 1}>
                 <span className="min-w-0 truncate">
                    {workspaceGroups.find((workspace) => workspace.key === resolvedAdminWorkspace)?.label}
                 </span>
                  {workspaceGroups.length > 1 && <ChevronDown className="h-4 w-4 shrink-0" />}
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>{i18n.language === "es" ? "Cambiar espacio de trabajo" : "Switch workspace"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaceGroups.map((workspace) => (
                 <DropdownMenuItem
                    key={workspace.key}
                    onClick={() => selectAdminWorkspace(workspace.key)}
                   className="cursor-pointer"
                 >
                    {workspace.label}
                    {workspace.key === resolvedAdminWorkspace && <span className="ml-auto text-action">✓</span>}
                 </DropdownMenuItem>
               ))}
             </DropdownMenuContent>
           </DropdownMenu>
         </div>
       )}
       {userType === "mover" && companyContext && expanded && companyContext.companies.length > 1 && <div className="border-b border-border px-3 py-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{i18n.language === "es" ? "Empresa activa" : "Active company"}</p><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-auto w-full justify-between gap-2 px-3 py-2 text-left"><span className="min-w-0 truncate">{companyContext.active?.company.companyName || (i18n.language === "es" ? "Sin empresa" : "No company")}</span><ChevronDown className="h-4 w-4 shrink-0" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-56">{companyContext.companies.map((item) => <DropdownMenuItem key={item.company.id} onClick={() => companyContext.switchCompany(item.company.id)} className="cursor-pointer">{item.company.companyName}{item.company.id === companyContext.active?.company.id && <span className="ml-auto text-action">{i18n.language === "es" ? "Activa" : "Active"}</span>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>}
       <div className="flex-1 py-4">
         <nav aria-label={i18n.language === "es" ? "Navegación del panel" : "Dashboard navigation"} className="grid gap-3 px-2">
            {visibleWorkspaceGroups.map((workspace) => {
             const isCollapsed = collapsedWorkspaces.has(workspace.key);
             const hasActiveLink = workspace.links.some((link) => isNavigationLinkActive(link.href, location, navLinks));
            return (
               <div key={workspace.key}>
                 {expanded && <button type="button" aria-expanded={!isCollapsed} aria-controls={`workspace-${workspace.key}${mobile ? "-mobile" : ""}`} onClick={() => toggleWorkspace(workspace.key)} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground", hasActiveLink && "text-foreground")}>
                   {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                   <span>{workspace.label}</span>
                 </button>}
                 <div id={`workspace-${workspace.key}${mobile ? "-mobile" : ""}`} hidden={expanded && isCollapsed} className="grid gap-1">
                 {workspace.links.map((link) => {
                   const isActive = isNavigationLinkActive(link.href, location, navLinks);
                   return <Link
                  key={link.href}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  runGuardedNavigation(() => setLocation(link.href));
                }}
                 aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-accent",
                  isActive && "bg-accent text-foreground font-semibold before:absolute before:left-0 before:h-7 before:w-1 before:rounded-full before:bg-action shadow-sm",
                   !expanded && "justify-center px-2"
                )}
              >
                <link.icon className="h-5 w-5" />
                 {expanded && <span className="flex-1">{link.label}</span>}
                 {expanded && link.badgeKey && badgeValues[link.badgeKey] > 0 && (
                  <Badge className="bg-green-500 text-white text-xs h-5 min-w-[20px] flex items-center justify-center ml-auto">
                    {badgeValues[link.badgeKey]}
                  </Badge>
                )}
                 {!expanded && link.badgeKey && badgeValues[link.badgeKey] > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center">
                    {badgeValues[link.badgeKey]}
                  </span>
                )}
               </Link>;
                 })}
                 </div>
               </div>
             );
           })}
        </nav>
      </div>
    </div>
  );

  // Use current impersonated user if available, otherwise fallback to props
  const displayUser = currentUser;
  const userTitle = displayUser ? getUserDisplayName(displayUser) : (userType === 'client' ? 'Client User' : userType === 'mover' ? 'Mover Partner' : 'Admin User');
  const userInitials = displayUser ? getUserInitials(displayUser) : (userType === 'client' ? 'CU' : userType === 'mover' ? 'MP' : 'AU');
  const userEmail = displayUser?.email || `${userType}@u-storage-go.com`;

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r bg-sidebar lg:block transition-[width] duration-300 overflow-y-auto", isSidebarOpen ? "w-64" : "w-16")}>
         <SidebarContent />
      </aside>
      <div className={cn("flex min-h-screen flex-col min-w-0 overflow-x-hidden transition-[margin] duration-300", isSidebarOpen ? "lg:ml-64" : "lg:ml-16")}>
        <header className="flex h-16 items-center gap-4 border-b border-white/10 bg-primary px-4 lg:px-7 sticky top-0 z-30 shadow-[0_4px_18px_rgba(36,21,46,.14)]">
          <div className="flex items-center gap-4 mr-4">
             <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <img 
                src="/brand/v1/logos/official-reverse.svg"
                alt="U-Storage Go" 
               className="h-8 w-auto object-contain"
                data-testid="img-dashboard-logo"
              />
            </Link>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden text-white hover:bg-white/10 hover:text-white">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-background p-0 w-64">
               <SidebarContent expanded mobile />
            </SheetContent>
          </Sheet>
          
           <div className="w-full flex-1 flex items-center">
             {userType === "mover" && companyContext?.active && <div className="hidden rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/90 md:block"><span className="text-white/50">{i18n.language === "es" ? "Empresa" : "Company"} · </span>{companyContext.active.company.companyName}</div>}
            {/* Page Title or Breadcrumbs could go here if needed */}
          </div>

           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={toggleLanguage} className="rounded-xl text-white hover:bg-white/10 hover:text-white mr-1">
              <Globe className="h-4 w-4" />
              <span className="sr-only">Toggle Language</span>
              <span className="text-xs font-medium ml-1">{i18n.language.toUpperCase()}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="relative h-11 w-full justify-start gap-2 px-2 text-white hover:bg-white/10 hover:text-white rounded-full lg:rounded-xl lg:w-auto lg:px-3">
                  <Avatar className="h-8 w-8 border border-white/20">
                    <AvatarImage src="" alt={userTitle} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start text-sm lg:flex">
                    <span className="font-medium">{userTitle}</span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 text-slate-200 hidden lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 z-[9999]" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userTitle}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                    {displayUser?.roles && displayUser.roles.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {displayUser.roles.map((r) => (
                          <Badge key={r.role} variant="secondary" className="text-xs">
                            {r.role}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userType === "admin" && availablePlatformRoles.length > 1 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {i18n.language === "es" ? "Rol activo" : "Active role"}
                    </DropdownMenuLabel>
                    {availablePlatformRoles.map((role) => (
                      <DropdownMenuItem
                        key={role.slug}
                        onClick={() => runGuardedNavigation(() => switchPlatformRoleMutation.mutate(role.slug))}
                        disabled={switchPlatformRoleMutation.isPending}
                        className="cursor-pointer"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {role.name}
                        {role.slug === activePlatformRole && <span className="ml-auto text-action">✓</span>}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <a href="#profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isImpersonated && (
                  <DropdownMenuItem 
                    onClick={() => stopImpersonationMutation.mutate()}
                    disabled={stopImpersonationMutation.isPending}
                    className="cursor-pointer text-foreground focus:text-foreground bg-accent hover:bg-accent/80 mb-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    <span>{i18n.language === 'es' ? 'Volver a Admin' : 'Return to Admin'}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{i18n.language === 'es' ? 'Cerrar Sesión' : 'Log out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background min-w-0 overflow-x-hidden">
           <div className="workspace-page">{children}</div>
        </main>
        <ClaraFloatingChat />
      </div>
    </div>
  );
}
