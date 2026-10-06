import { useQuery } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";

interface UserWithRoles {
  id: string;
  email: string;
  fullName?: string;
  userType?: string;
  roles: { role: string; isActive?: boolean }[];
  platformRoles?: string[];
  effectivePermissions?: string[];
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
  allowCompanyMembership?: boolean;
  allowClientCompanyMembership?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, redirectTo = "/login", allowCompanyMembership = false, allowClientCompanyMembership = false }: ProtectedRouteProps) {
  const [location] = useLocation();
  const company = usePartnerCompany();

  const { data, isLoading, error } = useQuery<{ user: UserWithRoles | null; isImpersonated: boolean }>({
    queryKey: ['/api/impersonate/current'],
    retry: false,
    staleTime: 30000,
  });
  const clientCompanies = useQuery<{ activeCompanyId: string | null }>({
    queryKey: ["/api/client/companies"],
    queryFn: async () => {
      const response = await fetch("/api/client/companies", { credentials: "include" });
      if (!response.ok) return { activeCompanyId: null };
      return response.json();
    },
    enabled: allowClientCompanyMembership && !!data?.user,
    retry: false,
    staleTime: 30000,
  });

  if (isLoading || (allowCompanyMembership && company.loading) || (allowClientCompanyMembership && clientCompanies.isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.user) {
    return <Redirect to={redirectTo} />;
  }

  const userRoles = [
    ...(data.user.roles?.filter(r => r.isActive !== false).map(r => r.role) || []),
    ...(data.user.platformRoles || []),
  ];

  const hasAccess = allowedRoles.some(role =>
    userRoles.includes(role)
  ) || (allowCompanyMembership && !!company.active)
    || (allowClientCompanyMembership && !!clientCompanies.data?.activeCompanyId);

  if (!hasAccess) {
    const defaultPath = userRoles.includes('admin') ? '/admin/dashboard' :
                        userRoles.includes('mover') ? '/mover/dashboard' :
                        userRoles.includes('client') ? '/dashboard' : '/';
    return <Redirect to={defaultPath} />;
  }

  const adminModulePermissions: Array<[string, string]> = [
    ["/admin/dashboard/whatsapp-inbox", "module:whatsapp"],
    ["/admin/dashboard/communications", "module:communications"],
    ["/admin/dashboard/seo-marketing", "module:marketing"],
    ["/admin/dashboard/usuarios", "module:users"],
    ["/admin/dashboard/roles", "module:role_management"],
    ["/admin/dashboard/users", "module:users"],
    ["/admin/dashboard/movers", "module:companies"],
    ["/admin/dashboard/admins", "module:users"],
    ["/admin/dashboard/workflow-statuses", "module:settings"],
    ["/admin/dashboard/analytics", "module:analytics"],
    ["/admin/dashboard/quotes", "module:quotes"],
    ["/admin/dashboard/ratings", "module:ratings"],
    ["/admin/dashboard/activity", "module:activity"],
    ["/admin/dashboard/ai-agent", "module:ai_agent"],
    ["/admin/dashboard/inventory", "module:inventory"],
    ["/admin/dashboard/pricing", "module:pricing"],
    ["/admin/dashboard/ustorage", "module:ustorage"],
    ["/admin/dashboard/payments", "module:payments"],
    ["/admin/dashboard/database", "module:database"],
    ["/admin/dashboard/blog", "module:marketing"],
    ["/admin/dashboard/settings", "module:settings"],
    ["/admin/dashboard", "module:dashboard"],
  ];
  const requiredModule = location.startsWith("/admin/")
    ? adminModulePermissions.find(([prefix]) => location === prefix || location.startsWith(`${prefix}/`))?.[1]
    : undefined;
  const modulePermissions = data.user.effectivePermissions || [];
  if (requiredModule && ((data.user.platformRoles?.length || 0) > 0 || modulePermissions.length > 0) &&
      !modulePermissions.includes("*") && !modulePermissions.includes(requiredModule)) {
    return <Redirect to="/admin/dashboard" />;
  }

  return <>{children}</>;
}

export function ClientRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['client', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}

export function ClientCompanyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['client', 'admin']} allowClientCompanyMembership>
      {children}
    </ProtectedRoute>
  );
}

export function MoverRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['mover', 'admin']} allowCompanyMembership>
      {children}
    </ProtectedRoute>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'operations', 'commercial', 'accounting', 'customer_service']}>
      {children}
    </ProtectedRoute>
  );
}
