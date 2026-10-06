import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRoute, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { adminSidebarLinks } from "@/lib/adminSidebar";
import { getAdminPermissionWorkspaces } from "@/lib/workspaceCatalog";
import type { AdminWorkspaceLayoutItem } from "@shared/adminWorkspaces";
import type { OrganizationImpactPreview } from "@shared/organization";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { 
  ArrowLeft, User, Mail, Phone, Globe, Calendar, Shield, Building2,
  Save, Loader2, FileText, Activity, MapPin, Star, MessageCircle, Lock, Truck, ChevronRight
} from "lucide-react";

interface UserDetails {
  id: string;
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  userType: string;
  preferredLanguage: string | null;
  isActive: boolean | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  profileImageUrl: string | null;
}

interface UserRole {
  id: string;
  role: string;
  isActive: boolean;
  grantedAt: string;
}

interface PlatformRole {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  modules: string[];
  isSystem: boolean;
  isActive: boolean;
}

interface RolesResponse {
  roles: UserRole[];
  platformRoles: PlatformRole[];
  effectivePermissions: string[];
}

interface PlatformAccess {
  platformRoles: string[];
  activePlatformRole: string | null;
}

interface Quote {
  id: string;
  quoteNumber: string;
  fromAddress: string;
  toAddress: string;
  status: string;
  workflowStatus: string;
  createdAt: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string | null;
  state: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface Rating {
  id: string;
  starRating: number;
  direction: string;
  createdAt: string;
  comments?: {
    publicComment: string | null;
    privateComment: string | null;
  } | null;
  aiTags?: Array<{
    id: string;
    sentiment: string;
    tag: string;
    tagEs?: string | null;
  }> | null;
  rater?: {
    fullName: string | null;
    email: string | null;
  } | null;
  target?: {
    fullName: string | null;
    email: string | null;
  } | null;
  quote?: {
    quoteNumber: string | null;
  } | null;
}

const roleColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  mover: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
};

export default function AdminUserDetails() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/dashboard/users/:userId");
  const userId = params?.userId;
  const locale = i18n.language === 'es' ? es : enUS;
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activeProfile, setActiveProfile] = useState<'client' | 'mover' | 'admin'>('client');
  const [adminRoleDraft, setAdminRoleDraft] = useState('');
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const adminAccessRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredLanguage: 'es',
    isActive: true,
  });

  const { data: userData, isLoading } = useQuery<{ user: UserDetails }>({
    queryKey: [`/api/admin/users/${userId}`],
    enabled: !!userId,
  });

  const { data: rolesData } = useQuery<RolesResponse>({
    queryKey: [`/api/admin/users/${userId}/roles`],
    enabled: !!userId,
  });

  const { data: currentUserData } = useQuery<{
    user: ({ platformRoles?: string[]; activePlatformRole?: string | null } & Record<string, unknown>) | null;
    operatorAccess?: PlatformAccess | null;
  }>({
    queryKey: ['/api/impersonate/current'],
  });
  const { data: workspaceLayoutData } = useQuery<{ layout: AdminWorkspaceLayoutItem[] }>({
    queryKey: ['/api/admin/workspace-layout'],
  });
  const operatorAccess = currentUserData?.operatorAccess || currentUserData?.user || null;
  const operatorPlatformRoles = operatorAccess?.platformRoles || [];
  const ownsSuperAdminRole = operatorPlatformRoles.includes('super_admin');
  const canManagePlatformRoles = operatorAccess?.activePlatformRole === 'super_admin';
  const { data: platformRoleCatalog } = useQuery<{ roles: PlatformRole[] }>({
    queryKey: ['/api/admin/platform-roles'],
    enabled: canManagePlatformRoles,
  });

  const { data: membershipsData } = useQuery<{ memberships: Array<any> }>({
    queryKey: [`/api/admin/users/${userId}/memberships`],
    enabled: !!userId,
  });

  const { data: quotesData } = useQuery<{ quotes: Quote[] }>({
    queryKey: [`/api/admin/users/${userId}/quotes`],
    enabled: !!userId,
  });

  const { data: addressesData } = useQuery<{ addresses: SavedAddress[] }>({
    queryKey: [`/api/admin/users/${userId}/addresses`],
    enabled: !!userId,
  });

  const { data: activityData } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: [`/api/admin/users/${userId}/activity`],
    enabled: !!userId,
  });

  const { data: ratingsData } = useQuery<{ receivedRatings: Rating[]; givenRatings: Rating[] }>({
    queryKey: [`/api/admin/users/${userId}/ratings`],
    enabled: !!userId,
  });

  const user = userData?.user;
  const roles = rolesData?.roles || [];
  const assignedPlatformRoles = rolesData?.platformRoles || [];
  const activeRoleNames = roles.filter((role) => role.isActive).map((role) => role.role);
  const hasClientProfile = true;
  const hasPartnerProfile = activeRoleNames.includes('mover');
  const hasAdminProfile = activeRoleNames.includes('admin') || assignedPlatformRoles.length > 0 || canManagePlatformRoles;
  const availableProfiles = useMemo(() => [
    ...(hasClientProfile ? ['client' as const] : []),
    ...(hasPartnerProfile ? ['mover' as const] : []),
    ...(hasAdminProfile ? ['admin' as const] : []),
  ], [hasAdminProfile, hasClientProfile, hasPartnerProfile]);
  const concreteAdminModules = useMemo(() => Array.from(new Set(
    adminSidebarLinks.flatMap((link) => [link.permission, ...(link.relatedPermissions || [])])
      .filter((permission): permission is string => !!permission && permission !== '*'),
  )), []);

  useEffect(() => {
    if (availableProfiles.length && !availableProfiles.includes(activeProfile)) {
      setActiveProfile(availableProfiles[0]);
    }
  }, [activeProfile, availableProfiles]);

  useEffect(() => {
    setAdminRoleDraft(assignedPlatformRoles[0]?.slug || '');
  }, [assignedPlatformRoles[0]?.slug]);
  const openAdminAccess = () => {
    setActiveProfile('admin');
    requestAnimationFrame(() => adminAccessRef.current?.focus());
  };
  const memberships = membershipsData?.memberships || [];
  const lifecycleOperation = user?.isActive === false ? 'reactivate' : 'suspend';
  const { data: lifecycleImpact, isLoading: lifecycleImpactLoading } = useQuery<OrganizationImpactPreview>({
    queryKey: [`/api/admin/organization/users/${userId}/impact-preview`, lifecycleOperation],
    queryFn: () => fetch(`/api/admin/organization/users/${userId}/impact-preview?operation=${lifecycleOperation}`, { credentials: 'include' }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to load impact preview');
      return res.json();
    }),
    enabled: lifecycleOpen && !!userId,
  });
  const profileMemberships = memberships.filter((entry) => {
    const membership = entry.membership || entry;
    const company = entry.company || membership.company;
    return activeProfile === 'mover'
      ? company?.classification === 'partner'
      : activeProfile === 'client'
        ? company?.classification !== 'partner'
        : false;
  });
  const membershipMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; status?: string } }) => fetch(`/api/admin/users/${userId}/memberships/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to update membership'); return res.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/memberships`] }),
    onError: (error: any) => toast({ title: lang === 'es' ? 'No se pudo actualizar la membresía' : 'Membership update failed', description: error.message, variant: 'destructive' }),
  });
  const quotes = quotesData?.quotes || [];
  const addresses = addressesData?.addresses || [];
  const activity = activityData?.logs || [];
  const receivedRatings = ratingsData?.receivedRatings || [];
  const givenRatings = ratingsData?.givenRatings || [];

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      setIsEditing(false);
      toast({
        title: lang === 'es' ? 'Usuario actualizado' : 'User updated',
        description: lang === 'es' ? 'Los cambios se guardaron correctamente' : 'Changes saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (isActive: boolean) => fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to update status');
      return res.json();
    }),
    onSuccess: (_data, isActive) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/memberships`] });
      setLifecycleOpen(false);
      toast({ title: isActive
        ? (lang === 'es' ? 'Usuario reactivado' : 'User reactivated')
        : (lang === 'es' ? 'Usuario suspendido' : 'User suspended'),
        description: isActive
          ? (lang === 'es' ? 'El acceso de la cuenta vuelve a estar disponible.' : 'Account access is available again.')
          : (lang === 'es' ? 'El acceso de la cuenta queda bloqueado; las membresías se conservan.' : 'Account access is blocked; memberships are preserved.') });
    },
    onError: (error: any) => toast({ title: lang === 'es' ? 'No se pudo cambiar el estado' : 'Status change failed', description: error.message, variant: 'destructive' }),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ role, action }: { role: string; action: 'add' | 'remove' }) => {
      const url = action === 'add' 
        ? `/api/admin/users/${userId}/roles`
        : `/api/admin/users/${userId}/roles/${role}`;
      const res = await fetch(url, {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'add' ? JSON.stringify({ role }) : undefined,
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/roles`] });
      toast({
        title: lang === 'es' ? 'Rol actualizado' : 'Role updated',
      });
    },
  });

  const updateAdminRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/admin/admins/${userId}/platform-role`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update admin role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/roles`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impersonate/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/workspace-layout'] });
      toast({
        title: lang === 'es' ? 'Rol administrativo actualizado' : 'Admin role updated',
        description: lang === 'es' ? 'El acceso al panel ya refleja el nuevo rol.' : 'Dashboard access now reflects the new role.',
      });
    },
    onError: (error: any) => toast({
      title: lang === 'es' ? 'No se pudo actualizar el rol' : 'Could not update role',
      description: error.message,
      variant: 'destructive',
    }),
  });

  const startEditing = () => {
    if (user) {
      setEditForm({
        fullName: user.fullName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        preferredLanguage: user.preferredLanguage || 'es',
        isActive: user.isActive !== false,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const sidebarLinks = getAdminSidebarLinks(lang);

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {lang === 'es' ? 'El usuario solicitado no existe' : 'The requested user does not exist'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation('/admin/dashboard/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a usuarios' : 'Back to users'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
         <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/admin/dashboard/users')} data-testid="button-back-users">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a usuarios' : 'Back to users'}
          </Button>
          {activeProfile === 'client' && (!isEditing ? (
            <Button onClick={startEditing} data-testid="button-edit-user">
              {lang === 'es' ? 'Editar usuario' : 'Edit user'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-user">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Save className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Guardar' : 'Save'}
              </Button>
            </div>

          ))}
        </div>
         <Card className="border-primary/20 bg-primary/5" data-testid="card-user-identity-summary">
           <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
             <div>
               <div className="flex flex-wrap items-center gap-2">
                 <h1 className="text-xl font-semibold">{user.fullName || user.email || (lang === 'es' ? 'Usuario sin nombre' : 'Unnamed user')}</h1>
                 <Badge variant={user.isActive === false ? 'secondary' : 'default'}>{user.isActive === false ? (lang === 'es' ? 'Suspendido' : 'Suspended') : (lang === 'es' ? 'Activo' : 'Active')}</Badge>
               </div>
               <p className="text-sm text-muted-foreground">{user.email || '—'} · {lang === 'es' ? 'Identidad de usuario' : 'User identity'}</p>
               <p className="mt-1 text-xs text-muted-foreground">{assignedPlatformRoles.length} {lang === 'es' ? 'rol(es) de plataforma' : 'platform role(s)'} · {memberships.length} {lang === 'es' ? 'membresía(s) de empresa' : 'company membership(s)'}</p>
             </div>
             <Button variant={user.isActive === false ? 'default' : 'destructive'} onClick={() => setLifecycleOpen(true)} disabled={lifecycleMutation.isPending} data-testid="button-user-lifecycle">
               {user.isActive === false ? (lang === 'es' ? 'Reactivar usuario' : 'Reactivate user') : (lang === 'es' ? 'Suspender usuario' : 'Suspend user')}
             </Button>
           </CardContent>
         </Card>

        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-2" role="tablist" aria-label={lang === 'es' ? 'Perfiles del usuario' : 'User profiles'}>
          {hasClientProfile && (
            <Button
              type="button"
              variant={activeProfile === 'client' ? 'default' : 'ghost'}
              onClick={() => setActiveProfile('client')}
              role="tab"
              aria-selected={activeProfile === 'client'}
            >
              <User className="mr-2 h-4 w-4" />
              {lang === 'es' ? 'Usuario' : 'User'}
            </Button>
          )}
          {hasPartnerProfile && (
            <Button
              type="button"
              variant={activeProfile === 'mover' ? 'default' : 'ghost'}
              onClick={() => setActiveProfile('mover')}
              role="tab"
              aria-selected={activeProfile === 'mover'}
            >
              <Truck className="mr-2 h-4 w-4" />
              {lang === 'es' ? 'Socio' : 'Partner'}
            </Button>
          )}
          {hasAdminProfile && (
            <Button
              type="button"
              variant={activeProfile === 'admin' ? 'default' : 'ghost'}
              onClick={() => setActiveProfile('admin')}
              role="tab"
              aria-selected={activeProfile === 'admin'}
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </Button>
          )}
        </div>

        <div className={activeProfile === 'client' ? "grid gap-6 md:grid-cols-2" : "hidden"}>
          <Card data-testid="card-user-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {lang === 'es' ? 'Información Personal' : 'Personal Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Nombre completo' : 'Full name'}</Label>
                      <Input
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        data-testid="input-fullname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Email' : 'Email'}</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Teléfono' : 'Phone'}</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Idioma preferido' : 'Preferred language'}</Label>
                      <Select
                        value={editForm.preferredLanguage}
                        onValueChange={(value) => setEditForm({ ...editForm, preferredLanguage: value })}
                      >
                        <SelectTrigger data-testid="select-language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>{lang === 'es' ? 'Usuario activo' : 'Active user'}</Label>
                    <Switch
                      checked={editForm.isActive}
                       disabled
                      data-testid="switch-active"
                    />
                  </div>
                   <p className="text-xs text-muted-foreground">
                     {lang === 'es' ? 'El estado se cambia únicamente con la acción segura de suspender/reactivar y su confirmación.' : 'Status changes are only available through the safe suspend/reactivate action and confirmation.'}
                   </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{user.fullName || 'N/A'}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{user.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{user.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{user.preferredLanguage === 'es' ? 'Español' : 'English'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lang === 'es' ? 'Registrado: ' : 'Registered: '}
                        {format(new Date(user.createdAt), 'PP', { locale })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive 
                        ? (lang === 'es' ? 'Activo' : 'Active')
                        : (lang === 'es' ? 'Inactivo' : 'Inactive')}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-user-roles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {lang === 'es' ? 'Roles y Permisos' : 'Roles & Permissions'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Gestiona los roles asignados a este usuario'
                  : 'Manage roles assigned to this user'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['client', 'mover', 'admin'].map((role) => {
                  const hasRole = roles.some(r => r.role === role && r.isActive);
                  return (
                    <div key={role} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors[role]}>
                          {role === 'client' 
                            ? (lang === 'es' ? 'Cliente' : 'Client')
                            : role === 'mover'
                            ? (lang === 'es' ? 'Socio' : 'Partner')
                            : 'Admin'}
                        </Badge>
                        {role === 'admin' && (
                          <span className="text-sm text-muted-foreground">
                            {hasRole || assignedPlatformRoles.length > 0
                              ? (lang === 'es' ? 'Acceso asignado' : 'Access assigned')
                              : (lang === 'es' ? 'Sin acceso administrativo' : 'No administrative access')}
                          </span>
                        )}
                      </div>
                      {role === 'admin' ? (
                        canManagePlatformRoles ? (
                          <Button type="button" variant="outline" size="sm" onClick={openAdminAccess} data-testid="button-manage-admin-access">
                            {lang === 'es' ? 'Gestionar acceso administrativo' : 'Manage admin access'}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="max-w-sm text-sm text-muted-foreground">
                            {ownsSuperAdminRole
                              ? (lang === 'es' ? 'Cambia tu rol activo a Super Admin para gestionar este acceso.' : 'Switch your active role to Super Admin to manage this access.')
                              : (lang === 'es' ? 'Solo Super Admin puede gestionar este acceso.' : 'Only Super Admin can manage this access.')}
                          </span>
                        )
                      ) : (
                        <Switch
                          checked={hasRole}
                          onCheckedChange={(checked) => toggleRoleMutation.mutate({ role, action: checked ? 'add' : 'remove' })}
                          disabled={toggleRoleMutation.isPending}
                          data-testid={`switch-role-${role}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={activeProfile === 'mover' || activeProfile === 'client' ? "" : "hidden"} data-testid="card-user-company-memberships">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {lang === 'es' ? 'Membresías de empresa' : 'Company memberships'}
            </CardTitle>
            <CardDescription>
              {lang === 'es' ? 'Acceso organizacional independiente de los roles de plataforma.' : 'Organization access is independent from platform roles.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profileMemberships.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">{lang === 'es' ? 'Sin membresías de empresa' : 'No company memberships'}</p>
            ) : (
              <div className="space-y-2">{profileMemberships.map((entry) => {
                const membership = entry.membership || entry;
                const company = entry.company || membership.company;
                return (
                <div key={membership.id} className="flex items-center justify-between rounded-lg border p-3">
                  <span>{company?.companyName || company?.name || membership.companyName || '—'}</span>
                  <div className="flex gap-2"><select className="rounded border px-1 text-sm" value={membership.role} onChange={(e) => membershipMutation.mutate({ id: membership.id, data: { role: e.target.value } })}><option value="owner">Owner</option><option value="admin">Admin</option>{company?.classification === 'partner' ? <><option value="dispatcher">Dispatcher</option><option value="fleet_manager">Fleet manager</option><option value="accountant">Accountant</option><option value="viewer">Viewer</option></> : <><option value="member">Member</option><option value="viewer">Viewer</option></>}</select><select className="rounded border px-1 text-sm" value={membership.status} onChange={(e) => membershipMutation.mutate({ id: membership.id, data: { status: e.target.value } })}><option value="active">Active</option><option value="suspended">Suspended</option><option value="invited">Invited</option></select></div>
                </div>
                );
              })}</div>
            )}
          </CardContent>
        </Card>

        {activeProfile === 'admin' && (
          <div className="space-y-6">
            <Card ref={adminAccessRef} tabIndex={-1} data-testid="card-admin-access">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {lang === 'es' ? 'Acceso administrativo' : 'Administrative access'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es'
                    ? 'El rol determina los espacios y secciones visibles en el panel administrativo.'
                    : 'The role determines which workspaces and sections are visible in the admin dashboard.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {canManagePlatformRoles && platformRoleCatalog?.roles?.length ? (
                  <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="admin-platform-role">{lang === 'es' ? 'Rol administrativo' : 'Admin role'}</Label>
                      <Select value={adminRoleDraft} onValueChange={setAdminRoleDraft}>
                        <SelectTrigger id="admin-platform-role">
                          <SelectValue placeholder={lang === 'es' ? 'Selecciona un rol' : 'Select a role'} />
                        </SelectTrigger>
                        <SelectContent>
                          {platformRoleCatalog.roles.filter((role) => role.isActive).map((role) => (
                            <SelectItem key={role.id} value={role.slug}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => updateAdminRoleMutation.mutate(adminRoleDraft)}
                      disabled={!adminRoleDraft || adminRoleDraft === assignedPlatformRoles[0]?.slug || updateAdminRoleMutation.isPending}
                    >
                      {updateAdminRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {lang === 'es' ? 'Actualizar rol' : 'Update role'}
                    </Button>
                  </div>
                ) : canManagePlatformRoles ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    {lang === 'es'
                      ? 'No hay roles administrativos activos disponibles. Crea o reactiva un rol de plataforma antes de asignar acceso.'
                      : 'No active admin roles are available. Create or reactivate a platform role before assigning access.'}
                  </div>
                ) : ownsSuperAdminRole ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    {lang === 'es'
                      ? 'Tu cuenta tiene Super Admin, pero no es el rol activo. Selecciona Super Admin en el menú de tu perfil para gestionar este acceso.'
                      : 'Your account has Super Admin, but it is not the active role. Select Super Admin from your profile menu to manage this access.'}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {lang === 'es'
                      ? 'Solo Super Admin puede cambiar el rol administrativo. Aquí puedes revisar el acceso actual.'
                      : 'Only Super Admin can change the administrative role. You can review current access here.'}
                  </p>
                )}

                {assignedPlatformRoles.length === 0 ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    {lang === 'es'
                      ? 'Este usuario tiene el perfil Admin, pero todavía no tiene un rol de espacios asignado.'
                      : 'This user has an Admin profile but does not yet have a workspace role assigned.'}
                  </div>
                ) : assignedPlatformRoles.map((role) => {
                  const roleModules = role.modules.includes('*') ? concreteAdminModules : role.modules;
                  const workspaces = getAdminPermissionWorkspaces(adminSidebarLinks, roleModules, i18n.language, workspaceLayoutData?.layout);
                  return (
                    <div key={role.id} className="overflow-hidden rounded-xl border">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 p-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{role.name}</h3>
                            {role.isSystem && <Badge variant="secondary">{lang === 'es' ? 'Sistema' : 'System'}</Badge>}
                          </div>
                          {role.description && <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>}
                        </div>
                        <Badge variant="outline">
                          {roleModules.length} {lang === 'es' ? 'secciones' : 'sections'}
                        </Badge>
                      </div>
                      <div className="divide-y">
                        {workspaces.map((workspace) => {
                          const visibleLinks = workspace.links.filter((link) =>
                            (!!link.permission && roleModules.includes(link.permission))
                            || link.relatedPermissions?.some((permission) => roleModules.includes(permission)),
                          );
                          return (
                            <div key={workspace.key} className="p-4">
                              <div className="flex items-center gap-2 font-medium">
                                <ChevronRight className="h-4 w-4 text-primary" />
                                {workspace.label}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {visibleLinks.map((link) => (
                                  <Badge key={`${workspace.key}-${link.href}`} variant="outline" className="font-normal">
                                    {link.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        <div className={activeProfile === 'client' ? "space-y-6" : "hidden"}>
        <Card data-testid="card-user-quotes">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {lang === 'es' ? 'Cotizaciones del Usuario' : 'User Quotes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === 'es' ? 'No hay cotizaciones' : 'No quotes yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {quotes.slice(0, 5).map((quote) => (
                  <div 
                    key={quote.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => setLocation(`/admin/dashboard/quotes/${quote.id}`)}
                    data-testid={`quote-row-${quote.id}`}
                  >
                    <div>
                      <p className="font-medium">{quote.quoteNumber}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {quote.fromAddress} → {quote.toAddress}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{quote.workflowStatus}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(quote.createdAt), 'PP', { locale })}
                      </span>
                    </div>
                  </div>
                ))}
                {quotes.length > 5 && (
                  <Button variant="ghost" className="w-full" onClick={() => setLocation(`/admin/dashboard/quotes?userId=${userId}`)}>
                    {lang === 'es' ? `Ver todas (${quotes.length})` : `View all (${quotes.length})`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-user-addresses">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {lang === 'es' ? 'Direcciones Guardadas' : 'Saved Addresses'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {addresses.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {lang === 'es' ? 'Sin direcciones guardadas' : 'No saved addresses'}
                </p>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="p-3 border rounded-lg">
                      <p className="font-medium">{addr.label}</p>
                      <p className="text-sm text-muted-foreground">{addr.address}</p>
                      {addr.city && <p className="text-xs text-muted-foreground">{addr.city}, {addr.state}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-user-activity">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {lang === 'es' ? 'Actividad Reciente' : 'Recent Activity'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {lang === 'es' ? 'Sin actividad registrada' : 'No activity recorded'}
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activity.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-2 border-l-2 border-primary/30 pl-3">
                      <p className="text-sm font-medium">{log.action}</p>
                      {log.details && <p className="text-xs text-muted-foreground">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</p>}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), 'PP p', { locale })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-user-received-ratings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                {lang === 'es' ? 'Calificaciones Recibidas' : 'Received Ratings'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' ? 'Calificaciones que otros han dado a este usuario' : 'Ratings others have given to this user'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {receivedRatings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {lang === 'es' ? 'Sin calificaciones recibidas' : 'No received ratings'}
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {receivedRatings.slice(0, 5).map((rating) => (
                    <div key={rating.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${star <= rating.starRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                            />
                          ))}
                          <span className="ml-2 text-sm font-medium">{rating.starRating}/5</span>
                        </div>
                        {rating.aiTags && rating.aiTags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {rating.aiTags.map((tag) => (
                              <Badge key={tag.id} variant="outline" className={
                                tag.sentiment === 'positive' ? 'bg-green-50 text-green-700' :
                                tag.sentiment === 'negative' ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-700'
                              }>
                                {lang === 'es' && tag.tagEs ? tag.tagEs : tag.tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === 'es' ? 'De: ' : 'From: '}{rating.rater?.fullName || rating.rater?.email || 'N/A'}
                      </p>
                      {rating.comments?.publicComment && (
                        <div className="bg-slate-50 rounded-lg p-2 mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <MessageCircle className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario público' : 'Public comment'}
                          </div>
                          <p className="text-sm">{rating.comments.publicComment}</p>
                        </div>
                      )}
                      {rating.comments?.privateComment && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                          <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
                            <Lock className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario privado (solo admin)' : 'Private comment (admin only)'}
                          </div>
                          <p className="text-sm">{rating.comments.privateComment}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(rating.createdAt), 'PP', { locale })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-user-given-ratings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                {lang === 'es' ? 'Calificaciones Dadas' : 'Given Ratings'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' ? 'Calificaciones que este usuario ha dado' : 'Ratings this user has given'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {givenRatings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {lang === 'es' ? 'Sin calificaciones dadas' : 'No given ratings'}
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {givenRatings.slice(0, 5).map((rating) => (
                    <div key={rating.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${star <= rating.starRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                            />
                          ))}
                          <span className="ml-2 text-sm font-medium">{rating.starRating}/5</span>
                        </div>
                        {rating.quote?.quoteNumber && (
                          <Badge variant="outline">{rating.quote.quoteNumber}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === 'es' ? 'Para: ' : 'To: '}{rating.target?.fullName || rating.target?.email || 'N/A'}
                      </p>
                      {rating.comments?.publicComment && (
                        <div className="bg-slate-50 rounded-lg p-2 mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <MessageCircle className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario público' : 'Public comment'}
                          </div>
                          <p className="text-sm">{rating.comments.publicComment}</p>
                        </div>
                      )}
                      {rating.comments?.privateComment && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                          <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
                            <Lock className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario privado (solo admin)' : 'Private comment (admin only)'}
                          </div>
                          <p className="text-sm">{rating.comments.privateComment}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(rating.createdAt), 'PP', { locale })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
      <AlertDialog open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user.isActive === false ? (lang === 'es' ? '¿Reactivar este usuario?' : 'Reactivate this user?') : (lang === 'es' ? '¿Suspender este usuario?' : 'Suspend this user?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {lifecycleImpactLoading
                ? (lang === 'es' ? 'Calculando el impacto…' : 'Calculating impact…')
                : user.isActive === false
                  ? (lang === 'es' ? `El usuario recuperará el acceso de plataforma y podrá usar ${lifecycleImpact?.affectedMemberships ?? memberships.length} membresía(s) activas.` : `The user will regain platform access and can use ${lifecycleImpact?.affectedMemberships ?? memberships.length} active membership(s).`)
                  : (lang === 'es' ? `Se bloqueará el acceso de plataforma. Se conservarán ${lifecycleImpact?.affectedMemberships ?? memberships.length} membresía(s) y ${lifecycleImpact?.affectedQuotes ?? quotes.length} cotización(es) para reactivación posterior.` : `Platform access will be blocked. ${lifecycleImpact?.affectedMemberships ?? memberships.length} membership(s) and ${lifecycleImpact?.affectedQuotes ?? quotes.length} quote(s) will be preserved for later reactivation.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction disabled={lifecycleImpactLoading} onClick={() => lifecycleMutation.mutate(user.isActive === false)}>{user.isActive === false ? (lang === 'es' ? 'Confirmar reactivación' : 'Confirm reactivation') : (lang === 'es' ? 'Confirmar suspensión' : 'Confirm suspension')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
