import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, UserPlus, Trash2, Crown, Clock, Check, X, AlertCircle, Copy, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  userType: string;
  isActive: boolean | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  permissions?: AdminPermissions;
  platformRoles?: string[];
  effectivePermissions?: string[];
}

interface AdminPermissions {
  canManageUsers: boolean;
  canManageMovers: boolean;
  canManageQuotes: boolean;
  canManageSettings: boolean;
  canAccessDatabase: boolean;
  canManageAdmins: boolean;
  isSuperAdmin: boolean;
}

interface NonAdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  userType: string;
}

interface UserData {
  id: string;
  email: string | null;
  fullName: string | null;
}

const roleColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  mover: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
};

interface AccessRequest {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  company: string | null;
  justification: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

const defaultPermissions: AdminPermissions = {
  canManageUsers: true,
  canManageMovers: true,
  canManageQuotes: true,
  canManageSettings: false,
  canAccessDatabase: false,
  canManageAdmins: false,
  isSuperAdmin: false,
};

export function AdminAdminsContent() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const locale = i18n.language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [passwordSetupLink, setPasswordSetupLink] = useState<string | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [selectedAdminForDetails, setSelectedAdminForDetails] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'es',
    isActive: true,
  });
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: adminsData, isLoading } = useQuery<{ admins: AdminUser[] }>({
    queryKey: ['/api/admin/admins'],
  });

  const { data: nonAdminsData } = useQuery<{ users: NonAdminUser[] }>({
    queryKey: ['/api/admin/non-admin-users'],
  });

  const { data: accessRequestsData, isLoading: loadingRequests } = useQuery<{ requests: AccessRequest[] }>({
    queryKey: ['/api/admin/access-requests'],
  });

  const { data: clientsData } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/client/users'],
  });

  const { data: moversData } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/mover/users'],
  });

  const clients = clientsData?.users || [];
  const movers = moversData?.users || [];

  const getUserRoles = (userId: string) => {
    const roles: string[] = [];
    if (clients.some(u => u.id === userId)) roles.push('client');
    if (movers.some(u => u.id === userId)) roles.push('mover');
    roles.push('admin'); // All admins have admin role
    return roles;
  };

  const pendingRequests = accessRequestsData?.requests?.filter(r => r.status === 'pending') || [];
  const currentUserAdmin = adminsData?.admins?.find(a => a.id === (currentUser as any)?.id);
  const isSuperAdmin = currentUserAdmin?.permissions?.isSuperAdmin || false;

  const addAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', '/api/admin/admins', { userId, permissions: defaultPermissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/non-admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impersonate/users'] });
      setShowAddDialog(false);
      setSelectedUserId('');
      toast({
        title: i18n.language === 'es' ? 'Administrador agregado' : 'Admin added',
        description: i18n.language === 'es' ? 'El usuario ahora tiene rol de administrador' : 'User now has admin role',
      });
    },
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/admin/admins/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/non-admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impersonate/users'] });
      toast({
        title: i18n.language === 'es' ? 'Administrador removido' : 'Admin removed',
        description: i18n.language === 'es' ? 'El rol de administrador ha sido removido' : 'Admin role has been removed',
      });
    },
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions?: AdminPermissions }) => {
      const response = await apiRequest('POST', `/api/admin/access-requests/${id}/approve`, { permissions });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admins'] });
      if (data.passwordSetupLink) {
        setPasswordSetupLink(data.passwordSetupLink);
      }
      toast({
        title: i18n.language === 'es' ? 'Solicitud aprobada' : 'Request approved',
        description: i18n.language === 'es' ? 'El usuario ha sido agregado como administrador' : 'User has been added as admin',
      });
    },
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const denyRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest('POST', `/api/admin/access-requests/${id}/deny`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-requests'] });
      setShowDenyDialog(false);
      setSelectedRequest(null);
      setDenyReason('');
      toast({
        title: i18n.language === 'es' ? 'Solicitud rechazada' : 'Request denied',
        description: i18n.language === 'es' ? 'La solicitud ha sido rechazada' : 'The request has been denied',
      });
    },
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: typeof editUserForm }) => {
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
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to sync roles');
      }
      return res.json();
    },
    onError: (error: any) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSaveAdmin = async () => {
    if (!selectedAdminForDetails) return;
    try {
      await Promise.all([
        updateUserMutation.mutateAsync({ userId: selectedAdminForDetails.id, data: editUserForm }),
        syncRolesMutation.mutateAsync({ userId: selectedAdminForDetails.id, roles: editRoles }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/client/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/mover/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/admin/users'] });
      setShowUserDetailsDialog(false);
      toast({
        title: i18n.language === 'es' ? 'Admin actualizado' : 'Admin updated',
        description: i18n.language === 'es' ? 'Los cambios se guardaron correctamente' : 'Changes saved successfully',
      });
    } catch (error) {
      // Errors handled by individual mutations
    }
  };

  const toggleRole = (role: string) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const getUserRolesForAdmin = (userId: string) => {
    const roles: string[] = ['admin'];
    if (clients?.some(u => u.id === userId)) roles.unshift('client');
    if (movers?.some(u => u.id === userId)) roles.splice(1, 0, 'mover');
    return roles;
  };

  const openUserDetailsDialog = (admin: AdminUser) => {
    setSelectedAdminForDetails(admin);
    setEditUserForm({
      fullName: admin.fullName || '',
      email: admin.email || '',
      phone: admin.phone || '',
      preferredLanguage: 'es',
      isActive: admin.isActive !== false,
    });
    setEditRoles(getUserRolesForAdmin(admin.id));
    setShowUserDetailsDialog(true);
  };

  const admins = adminsData?.admins || [];
  const nonAdmins = nonAdminsData?.users || [];

  const filteredAdmins = admins.filter(admin => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      admin.fullName?.toLowerCase().includes(query) ||
      admin.email?.toLowerCase().includes(query)
    );
  });

  const superAdmins = filteredAdmins.filter(a => a.permissions?.isSuperAdmin);
  const regularAdmins = filteredAdmins.filter(a => !a.permissions?.isSuperAdmin);

  const openDenyDialog = (request: AccessRequest) => {
    setSelectedRequest(request);
    setDenyReason('');
    setShowDenyDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: i18n.language === 'es' ? 'Copiado' : 'Copied',
      description: i18n.language === 'es' ? 'Enlace copiado al portapapeles' : 'Link copied to clipboard',
    });
  };

  return (
    <>
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {i18n.language === 'es' ? 'Administradores' : 'Administrators'}
          </h1>
          <p className="text-muted-foreground">
            {i18n.language === 'es' ? 'Gestiona los usuarios administradores y sus permisos' : 'Manage admin users and their permissions'}
          </p>
        </div>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-add-admin"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {i18n.language === 'es' ? 'Agregar Admin' : 'Add Admin'}
          </Button>
        </div>

        {isSuperAdmin && pendingRequests.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Clock className="h-5 w-5" />
                {i18n.language === 'es' ? 'Solicitudes Pendientes' : 'Pending Requests'}
                <Badge variant="secondary" className="bg-orange-200 text-orange-800 ml-2">
                  {pendingRequests.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-orange-700">
                {i18n.language === 'es' 
                  ? 'Estas personas han solicitado acceso de administrador' 
                  : 'These people have requested admin access'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-start justify-between p-4 rounded-lg bg-white border border-orange-100"
                    data-testid={`request-row-${request.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{request.fullName}</div>
                      <div className="text-sm text-slate-500">{request.email}</div>
                      {request.phone && (
                        <div className="text-sm text-slate-400">{request.phone}</div>
                      )}
                      {request.company && (
                        <div className="text-sm text-slate-400 mt-1">
                          <span className="font-medium">{i18n.language === 'es' ? 'Empresa:' : 'Company:'}</span> {request.company}
                        </div>
                      )}
                      {request.justification && (
                        <div className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          <span className="font-medium">{i18n.language === 'es' ? 'Justificación:' : 'Justification:'}</span>
                          <br />
                          {request.justification}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-2">
                        {i18n.language === 'es' ? 'Solicitado ' : 'Requested '}
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveRequestMutation.mutate({ id: request.id })}
                        disabled={approveRequestMutation.isPending}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {i18n.language === 'es' ? 'Aprobar' : 'Approve'}
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => openDenyDialog(request)}
                        disabled={denyRequestMutation.isPending}
                        data-testid={`button-deny-${request.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {i18n.language === 'es' ? 'Rechazar' : 'Deny'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isSuperAdmin && pendingRequests.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-orange-700">
                <AlertCircle className="h-5 w-5" />
                <span>
                  {i18n.language === 'es' 
                    ? `Hay ${pendingRequests.length} solicitud(es) pendiente(s). Solo un Super Admin puede aprobarlas.` 
                    : `There are ${pendingRequests.length} pending request(s). Only a Super Admin can approve them.`}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-900">{superAdmins.length}</div>
                  <div className="text-sm text-yellow-700">{i18n.language === 'es' ? 'Super Admins' : 'Super Admins'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-900">{regularAdmins.length}</div>
                  <div className="text-sm text-purple-700">{i18n.language === 'es' ? 'Administradores' : 'Administrators'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-900">{pendingRequests.length}</div>
                  <div className="text-sm text-orange-700">{i18n.language === 'es' ? 'Pendientes' : 'Pending'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={i18n.language === 'es' ? 'Buscar administradores...' : 'Search admins...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-admins"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {i18n.language === 'es' ? 'Lista de Administradores' : 'Admin List'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400">
                {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
                {searchQuery ? (i18n.language === 'es' ? 'No se encontraron administradores' : 'No admins found') : (i18n.language === 'es' ? 'No hay administradores' : 'No administrators')}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAdmins.map((admin) => (
                  <div 
                    key={admin.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${admin.permissions?.isSuperAdmin ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50'}`}
                    data-testid={`admin-row-${admin.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${admin.permissions?.isSuperAdmin ? 'bg-yellow-200' : 'bg-purple-200'}`}>
                        {admin.permissions?.isSuperAdmin ? (
                          <Crown className="h-5 w-5 text-yellow-700" />
                        ) : (
                          <Shield className="h-5 w-5 text-purple-700" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                          {admin.fullName || admin.email}
                          {admin.permissions?.isSuperAdmin && (
                            <Badge className="bg-yellow-500 text-white text-xs">
                              {i18n.language === 'es' ? 'Super Admin' : 'Super Admin'}
                            </Badge>
                          )}
                          {admin.platformRoles?.[0] && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {admin.platformRoles[0].replace(/_/g, " ")}
                            </Badge>
                          )}
                          <span className="flex gap-1">
                            {getUserRoles(admin.id).map(role => (
                              <Badge key={role} className={roleColors[role]}>
                                {role === 'client' ? (i18n.language === 'es' ? 'Cliente' : 'Client') :
                                 role === 'mover' ? (i18n.language === 'es' ? 'Socio' : 'Partner') :
                                 role === 'admin' ? 'Admin' : role}
                              </Badge>
                            ))}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500">{admin.email}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {i18n.language === 'es' ? 'Activo ' : 'Active '}
                          {formatDistanceToNow(new Date(admin.lastActiveAt || admin.lastLoginAt || admin.createdAt), { addSuffix: true, locale })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLocation(`/admin/dashboard/admins/${admin.id}`)}
                          data-testid={`button-admin-details-${admin.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {i18n.language === 'es' ? 'Ver' : 'View'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/admin/dashboard/admins/${admin.id}`)}
                        data-testid={`button-admin-role-${admin.id}`}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        {i18n.language === 'es' ? 'Rol de plataforma' : 'Platform role'}
                      </Button>
                      {!admin.permissions?.isSuperAdmin && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => removeAdminMutation.mutate(admin.id)}
                          disabled={removeAdminMutation.isPending}
                          data-testid={`button-remove-admin-${admin.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {i18n.language === 'es' ? 'Agregar Administrador' : 'Add Administrator'}
            </DialogTitle>
            <DialogDescription>
              {i18n.language === 'es' 
                ? 'Selecciona un usuario existente para darle rol de administrador' 
                : 'Select an existing user to grant admin role'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{i18n.language === 'es' ? 'Seleccionar Usuario' : 'Select User'}</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="mt-2" data-testid="select-user-for-admin">
                <SelectValue placeholder={i18n.language === 'es' ? 'Elige un usuario...' : 'Choose a user...'} />
              </SelectTrigger>
              <SelectContent>
                {nonAdmins.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName || user.email} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nonAdmins.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {i18n.language === 'es' 
                  ? 'No hay usuarios disponibles para agregar como admin' 
                  : 'No users available to add as admin'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              onClick={() => addAdminMutation.mutate(selectedUserId)}
              disabled={!selectedUserId || addAdminMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-confirm-add-admin"
            >
              {i18n.language === 'es' ? 'Agregar' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              {i18n.language === 'es' ? 'Rechazar Solicitud' : 'Deny Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.fullName} ({selectedRequest?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{i18n.language === 'es' ? 'Razón del rechazo (opcional)' : 'Reason for denial (optional)'}</Label>
            <Textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder={i18n.language === 'es' ? 'Explica por qué se rechaza esta solicitud...' : 'Explain why this request is being denied...'}
              className="mt-2"
              rows={3}
              data-testid="input-deny-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyDialog(false)}>
              {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedRequest && denyRequestMutation.mutate({ id: selectedRequest.id, reason: denyReason })}
              disabled={denyRequestMutation.isPending}
              data-testid="button-confirm-deny"
            >
              {i18n.language === 'es' ? 'Rechazar Solicitud' : 'Deny Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordSetupLink} onOpenChange={() => setPasswordSetupLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              {i18n.language === 'es' ? 'Admin Aprobado' : 'Admin Approved'}
            </DialogTitle>
            <DialogDescription>
              {i18n.language === 'es' 
                ? 'El nuevo administrador necesita configurar su contraseña. Comparte este enlace con ellos:' 
                : 'The new admin needs to set up their password. Share this link with them:'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-2">
              <code className="flex-1 text-xs break-all">{passwordSetupLink}</code>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => passwordSetupLink && copyToClipboard(passwordSetupLink)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {i18n.language === 'es' 
                ? 'Este enlace expira en 7 días.' 
                : 'This link expires in 7 days.'}
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setPasswordSetupLink(null)}
              className="bg-primary hover:bg-primary/90"
            >
              {i18n.language === 'es' ? 'Entendido' : 'Got it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserDetailsDialog} onOpenChange={setShowUserDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {i18n.language === 'es' ? 'Detalles del Admin' : 'Admin Details'}
            </DialogTitle>
            <DialogDescription>
              {i18n.language === 'es' ? 'Ver y editar información del administrador' : 'View and edit admin information'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminFullName">{i18n.language === 'es' ? 'Nombre Completo' : 'Full Name'}</Label>
              <Input
                id="adminFullName"
                value={editUserForm.fullName}
                onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                data-testid="input-edit-admin-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">{i18n.language === 'es' ? 'Correo Electrónico' : 'Email'}</Label>
              <Input
                id="adminEmail"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                data-testid="input-edit-admin-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPhone">{i18n.language === 'es' ? 'Teléfono' : 'Phone'}</Label>
              <Input
                id="adminPhone"
                value={editUserForm.phone}
                onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                data-testid="input-edit-admin-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminLanguage">{i18n.language === 'es' ? 'Idioma Preferido' : 'Preferred Language'}</Label>
              <Select 
                value={editUserForm.preferredLanguage} 
                onValueChange={(v) => setEditUserForm({ ...editUserForm, preferredLanguage: v })}
              >
                <SelectTrigger data-testid="select-edit-admin-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{i18n.language === 'es' ? 'Roles del Usuario' : 'User Roles'}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {i18n.language === 'es' ? 'Selecciona los roles que tendrá este usuario' : 'Select the roles this user will have'}
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-role-client"
                    checked={editRoles.includes('client')}
                    onCheckedChange={() => toggleRole('client')}
                    data-testid="checkbox-admin-role-client"
                  />
                  <label htmlFor="admin-role-client" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Cliente' : 'Client'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-role-mover"
                    checked={editRoles.includes('mover')}
                    onCheckedChange={() => toggleRole('mover')}
                    data-testid="checkbox-admin-role-mover"
                  />
                  <label htmlFor="admin-role-mover" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Socio' : 'Partner'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-role-admin"
                    checked={editRoles.includes('admin')}
                    onCheckedChange={() => isSuperAdmin && toggleRole('admin')}
                    disabled={!isSuperAdmin}
                    data-testid="checkbox-admin-role-admin"
                  />
                  <label htmlFor="admin-role-admin" className={`text-sm font-medium leading-none ${!isSuperAdmin ? 'opacity-50' : ''}`}>
                    Admin
                  </label>
                  {!isSuperAdmin && (
                    <span className="text-xs text-muted-foreground">
                      ({i18n.language === 'es' ? 'Solo super admin' : 'Super admin only'})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{i18n.language === 'es' ? 'Cuenta Activa' : 'Active Account'}</Label>
                <p className="text-xs text-muted-foreground">
                  {i18n.language === 'es' ? 'El admin puede acceder al sistema' : 'Admin can access the system'}
                </p>
              </div>
              <Switch
                checked={editUserForm.isActive}
                onCheckedChange={(checked) => setEditUserForm({ ...editUserForm, isActive: checked })}
                data-testid="switch-edit-admin-active"
              />
            </div>
            {selectedAdminForDetails && (
              <div className="pt-2 border-t text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>{i18n.language === 'es' ? 'Última actividad:' : 'Last activity:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedAdminForDetails.lastActiveAt || selectedAdminForDetails.lastLoginAt || selectedAdminForDetails.createdAt), { addSuffix: true, locale })}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>{i18n.language === 'es' ? 'Registrado:' : 'Registered:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedAdminForDetails.createdAt), { addSuffix: true, locale })}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDetailsDialog(false)}>
              {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSaveAdmin}
              disabled={updateUserMutation.isPending || syncRolesMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-admin"
            >
              {(updateUserMutation.isPending || syncRolesMutation.isPending)
                ? (i18n.language === 'es' ? 'Guardando...' : 'Saving...') 
                : (i18n.language === 'es' ? 'Guardar' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminAdmins() {
  const { i18n } = useTranslation();
  const sidebarLinks = getAdminSidebarLinks(i18n.language);
  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <AdminAdminsContent />
    </DashboardLayout>
  );
}
