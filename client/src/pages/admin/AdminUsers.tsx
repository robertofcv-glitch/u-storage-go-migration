import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Mail, Phone, Clock, User, Search, ShieldCheck, UserRoundCog, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface UserData {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  userType: string;
  preferredLanguage: string | null;
  isActive: boolean | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  mover: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
};

export function AdminUsersContent() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const locale = i18n.language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
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

  const { data: adminPermissionsData } = useQuery<{ admins: Array<{ id: string; permissions?: { isSuperAdmin?: boolean } }> }>({
    queryKey: ['/api/admin/admins'],
  });
  const currentUserAdmin = adminPermissionsData?.admins?.find(a => a.id === (currentUser as any)?.id);
  const isSuperAdmin = currentUserAdmin?.permissions?.isSuperAdmin || false;

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/impersonate/${userId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to impersonate user');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: i18n.language === 'es' ? 'Impersonando cliente' : 'Impersonating client',
        description: data.user?.fullName || data.user?.email,
      });
      window.location.href = '/dashboard';
    },
    onError: () => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: i18n.language === 'es' ? 'No se pudo impersonar al cliente' : 'Failed to impersonate client',
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: typeof editForm }) => {
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

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      await Promise.all([
        updateUserMutation.mutateAsync({ userId: selectedUser.id, data: editForm }),
        syncRolesMutation.mutateAsync({ userId: selectedUser.id, roles: editRoles }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/client/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/mover/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/admin/users'] });
      setShowDetailsDialog(false);
      toast({
        title: i18n.language === 'es' ? 'Usuario actualizado' : 'User updated',
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

  const openDetailsDialog = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      preferredLanguage: user.preferredLanguage || 'es',
      isActive: user.isActive !== false,
    });
    setEditRoles(getUserRoles(user.id));
    setShowDetailsDialog(true);
  };

  const { data: clientsData, isLoading: loadingClients } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/client/users'],
  });

  const { data: moversData, isLoading: loadingMovers } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/mover/users'],
  });

  const { data: adminsData, isLoading: loadingAdmins } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/admin/users'],
  });

  const clients = clientsData?.users || [];
  const movers = moversData?.users || [];
  const admins = adminsData?.users || [];

  const getUserRoles = (userId: string) => {
    const roles: string[] = [];
    if (clients.some(u => u.id === userId)) roles.push('client');
    if (movers.some(u => u.id === userId)) roles.push('mover');
    if (admins.some(u => u.id === userId)) roles.push('admin');
    return roles;
  };

  const filteredClients = clients.filter(user => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      user.fullName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query)
    );
  });

  const isLoading = loadingClients || loadingMovers || loadingAdmins;

  return (
    <>
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {i18n.language === 'es' ? 'Clientes' : 'Clients'}
          </h1>
          <p className="text-muted-foreground">
            {i18n.language === 'es' ? 'Todos los clientes registrados' : 'All registered clients'}
          </p>
        </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {clients.length} {i18n.language === 'es' ? 'clientes' : 'clients'}
          </Badge>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">{clients.length}</div>
                <div className="text-sm text-blue-700">{i18n.language === 'es' ? 'Clientes Registrados' : 'Registered Clients'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={i18n.language === 'es' ? 'Buscar clientes...' : 'Search clients...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-clients"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {i18n.language === 'es' ? 'Todos los Clientes' : 'All Clients'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400">
                {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
                {searchQuery ? (i18n.language === 'es' ? 'No se encontraron clientes' : 'No clients found') : (i18n.language === 'es' ? 'No hay clientes registrados' : 'No clients registered')}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((user) => {
                  const roles = getUserRoles(user.id);
                  return (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      data-testid={`client-row-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {user.fullName || (i18n.language === 'es' ? 'Sin nombre' : 'No name')}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </span>
                            )}
                            {user.phone && (
                              <span className="flex items-center gap-1 ml-2">
                                <Phone className="h-3 w-3" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {roles.map(role => (
                            <Badge key={role} className={roleColors[role]}>
                              {role === 'client' ? (i18n.language === 'es' ? 'Cliente' : 'Client') :
                               role === 'mover' ? (i18n.language === 'es' ? 'Socio' : 'Partner') :
                               role === 'admin' ? 'Admin' : role}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {i18n.language === 'es' ? 'Activo ' : 'Active '}
                          {formatDistanceToNow(new Date(user.lastActiveAt || user.lastLoginAt || user.createdAt), { addSuffix: true, locale })}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLocation(`/admin/dashboard/users/${user.id}`)}
                          data-testid={`button-view-details-${user.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {i18n.language === 'es' ? 'Ver' : 'View'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => impersonateMutation.mutate(user.id)}
                          disabled={impersonateMutation.isPending}
                          title={i18n.language === 'es' ? 'Impersonar cliente' : 'Impersonate client'}
                          data-testid={`button-impersonate-${user.id}`}
                        >
                          <UserRoundCog className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {i18n.language === 'es' ? 'Detalles del Cliente' : 'Client Details'}
            </DialogTitle>
            <DialogDescription>
              {i18n.language === 'es' ? 'Ver y editar información del usuario' : 'View and edit user information'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{i18n.language === 'es' ? 'Nombre Completo' : 'Full Name'}</Label>
              <Input
                id="fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                data-testid="input-edit-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{i18n.language === 'es' ? 'Correo Electrónico' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{i18n.language === 'es' ? 'Teléfono' : 'Phone'}</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{i18n.language === 'es' ? 'Idioma Preferido' : 'Preferred Language'}</Label>
              <Select 
                value={editForm.preferredLanguage} 
                onValueChange={(v) => setEditForm({ ...editForm, preferredLanguage: v })}
              >
                <SelectTrigger data-testid="select-edit-language">
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
                    id="role-client"
                    checked={editRoles.includes('client')}
                    onCheckedChange={() => toggleRole('client')}
                    data-testid="checkbox-role-client"
                  />
                  <label htmlFor="role-client" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Cliente' : 'Client'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-mover"
                    checked={editRoles.includes('mover')}
                    onCheckedChange={() => toggleRole('mover')}
                    data-testid="checkbox-role-mover"
                  />
                  <label htmlFor="role-mover" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Socio' : 'Partner'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-admin"
                    checked={editRoles.includes('admin')}
                    onCheckedChange={() => isSuperAdmin && toggleRole('admin')}
                    disabled={!isSuperAdmin}
                    data-testid="checkbox-role-admin"
                  />
                  <label htmlFor="role-admin" className={`text-sm font-medium leading-none ${!isSuperAdmin ? 'opacity-50' : ''}`}>
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
                  {i18n.language === 'es' ? 'El usuario puede acceder al sistema' : 'User can access the system'}
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                data-testid="switch-edit-active"
              />
            </div>
            {selectedUser && (
              <div className="pt-2 border-t text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>{i18n.language === 'es' ? 'Última actividad:' : 'Last activity:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedUser.lastActiveAt || selectedUser.lastLoginAt || selectedUser.createdAt), { addSuffix: true, locale })}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>{i18n.language === 'es' ? 'Registrado:' : 'Registered:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedUser.createdAt), { addSuffix: true, locale })}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending || syncRolesMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-user"
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

export default function AdminUsers() {
  const { i18n } = useTranslation();
  const sidebarLinks = getAdminSidebarLinks(i18n.language);
  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <AdminUsersContent />
    </DashboardLayout>
  );
}
