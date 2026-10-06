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
import { Truck, Mail, Phone, MapPin, Building, Star, Search, Clock, UserRoundCog, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface MoverProfile {
  id: string;
  userId: string;
  companyName: string;
  description: string | null;
  yearsInBusiness: number | null;
  fleetSize: number | null;
  serviceAreas: string[] | null;
  insuranceInfo: string | null;
  rating: string | null;
  totalJobs: number | null;
  verified: boolean | null;
  createdAt: string;
}

interface PartnerUser {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  userType: string;
  preferredLanguage?: string | null;
  isActive: boolean | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

interface Partner {
  user: PartnerUser;
  profile: MoverProfile | null;
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

export function AdminMoversContent() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const locale = i18n.language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
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
        title: i18n.language === 'es' ? 'Impersonando socio' : 'Impersonating partner',
        description: data.user?.fullName || data.user?.email,
      });
      window.location.href = '/mover/dashboard';
    },
    onError: () => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: i18n.language === 'es' ? 'No se pudo impersonar al usuario' : 'Failed to impersonate user',
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

  const handleSavePartner = async () => {
    if (!selectedPartner) return;
    try {
      await Promise.all([
        updateUserMutation.mutateAsync({ userId: selectedPartner.user.id, data: editForm }),
        syncRolesMutation.mutateAsync({ userId: selectedPartner.user.id, roles: editRoles }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/client/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/mover/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles/admin/users'] });
      setShowDetailsDialog(false);
      toast({
        title: i18n.language === 'es' ? 'Socio actualizado' : 'Partner updated',
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

  const openDetailsDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setEditForm({
      fullName: partner.user.fullName || '',
      email: partner.user.email || '',
      phone: partner.user.phone || '',
      preferredLanguage: partner.user.preferredLanguage || 'es',
      isActive: partner.user.isActive !== false,
    });
    setEditRoles(getUserRoles(partner.user.id));
    setShowDetailsDialog(true);
  };

  const { data: partnersData, isLoading: loadingPartners } = useQuery<{ partners: Partner[] }>({
    queryKey: ['/api/admin/partners'],
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/client/users'],
  });

  const { data: adminsData, isLoading: loadingAdmins } = useQuery<{ users: UserData[] }>({
    queryKey: ['/api/admin/roles/admin/users'],
  });

  const partners = partnersData?.partners || [];
  const clients = clientsData?.users || [];
  const admins = adminsData?.users || [];

  const getUserRoles = (userId: string) => {
    const roles: string[] = ['mover'];
    if (clients.some(u => u.id === userId)) roles.unshift('client');
    if (admins.some(u => u.id === userId)) roles.push('admin');
    return roles;
  };

  const isLoading = loadingPartners || loadingClients || loadingAdmins;

  const filteredPartners = partners.filter(partner => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      partner.user.fullName?.toLowerCase().includes(query) ||
      partner.user.email?.toLowerCase().includes(query) ||
      partner.profile?.companyName?.toLowerCase().includes(query)
    );
  });

  return (
    <>
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.admin.nav.movers')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.allMovers')}</p>
        </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {partners.length} {i18n.language === 'es' ? 'socios' : 'partners'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-900">{partners.length}</div>
                  <div className="text-sm text-green-700">{i18n.language === 'es' ? 'Socios Registrados' : 'Registered Partners'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                  <Star className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-900">
                    {partners.filter(p => p.profile?.verified).length}
                  </div>
                  <div className="text-sm text-blue-700">{i18n.language === 'es' ? 'Verificados' : 'Verified'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-900">
                    {partners.filter(p => !p.profile?.verified).length}
                  </div>
                  <div className="text-sm text-amber-700">{i18n.language === 'es' ? 'Pendientes' : 'Pending'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={i18n.language === 'es' ? 'Buscar socios...' : 'Search partners...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-partners"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {t('dashboard.admin.allMovers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400">
                {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
                {searchQuery ? (i18n.language === 'es' ? 'No se encontraron socios' : 'No partners found') : (i18n.language === 'es' ? 'No hay socios registrados' : 'No partners registered')}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPartners.map((partner) => (
                  <div 
                    key={partner.user.id} 
                    className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    data-testid={`partner-row-${partner.user.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Truck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">
                              {partner.profile?.companyName || partner.user.fullName || (i18n.language === 'es' ? 'Sin nombre' : 'No name')}
                            </span>
                            {partner.profile?.verified && (
                              <Badge className="bg-green-100 text-green-800">
                                {i18n.language === 'es' ? 'Verificado' : 'Verified'}
                              </Badge>
                            )}
                            {!partner.profile?.verified && (
                              <Badge className="bg-amber-100 text-amber-800">
                                {i18n.language === 'es' ? 'Pendiente' : 'Pending'}
                              </Badge>
                            )}
                            <span className="flex gap-1">
                              {getUserRoles(partner.user.id).map(role => (
                                <Badge key={role} className={roleColors[role]}>
                                  {role === 'client' ? (i18n.language === 'es' ? 'Cliente' : 'Client') :
                                   role === 'mover' ? (i18n.language === 'es' ? 'Socio' : 'Partner') :
                                   role === 'admin' ? 'Admin' : role}
                                </Badge>
                              ))}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {partner.user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {partner.user.email}
                              </span>
                            )}
                            {partner.user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {partner.user.phone}
                              </span>
                            )}
                          </div>

                          {partner.profile && (
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                              {partner.profile.yearsInBusiness && (
                                <span className="flex items-center gap-1">
                                  <Building className="h-3 w-3" />
                                  {partner.profile.yearsInBusiness} {i18n.language === 'es' ? 'años' : 'years'}
                                </span>
                              )}
                              {partner.profile.fleetSize && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {partner.profile.fleetSize} {i18n.language === 'es' ? 'vehículos' : 'vehicles'}
                                </span>
                              )}
                              {partner.profile.serviceAreas && partner.profile.serviceAreas.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {partner.profile.serviceAreas.slice(0, 2).join(', ')}
                                  {partner.profile.serviceAreas.length > 2 && ` +${partner.profile.serviceAreas.length - 2}`}
                                </span>
                              )}
                              {partner.profile.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {parseFloat(partner.profile.rating).toFixed(1)}
                                </span>
                              )}
                            </div>
                          )}

                          {partner.profile?.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {partner.profile.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-muted-foreground">
                          {i18n.language === 'es' ? 'Activo' : 'Active'}{' '}
                          {formatDistanceToNow(new Date(partner.user.lastActiveAt || partner.user.lastLoginAt || partner.user.createdAt), { addSuffix: true, locale })}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              // Always go to mover details page - use profile ID if available, otherwise user ID
                              // The backend supports lookup by either ID
                              const id = partner.profile?.id || partner.user.id;
                              setLocation(`/admin/dashboard/movers/${id}`);
                            }}
                            data-testid={`button-view-partner-${partner.user.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {i18n.language === 'es' ? 'Ver' : 'View'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => impersonateMutation.mutate(partner.user.id)}
                            disabled={impersonateMutation.isPending}
                            title={i18n.language === 'es' ? 'Impersonar socio' : 'Impersonate partner'}
                            data-testid={`button-impersonate-partner-${partner.user.id}`}
                          >
                            <UserRoundCog className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {i18n.language === 'es' ? 'Detalles del Socio' : 'Partner Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedPartner?.profile?.companyName || (i18n.language === 'es' ? 'Ver y editar información del socio' : 'View and edit partner information')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{i18n.language === 'es' ? 'Nombre Completo' : 'Full Name'}</Label>
              <Input
                id="fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                data-testid="input-edit-partner-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{i18n.language === 'es' ? 'Correo Electrónico' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                data-testid="input-edit-partner-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{i18n.language === 'es' ? 'Teléfono' : 'Phone'}</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                data-testid="input-edit-partner-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{i18n.language === 'es' ? 'Idioma Preferido' : 'Preferred Language'}</Label>
              <Select 
                value={editForm.preferredLanguage} 
                onValueChange={(v) => setEditForm({ ...editForm, preferredLanguage: v })}
              >
                <SelectTrigger data-testid="select-edit-partner-language">
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
                    id="partner-role-client"
                    checked={editRoles.includes('client')}
                    onCheckedChange={() => toggleRole('client')}
                    data-testid="checkbox-partner-role-client"
                  />
                  <label htmlFor="partner-role-client" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Cliente' : 'Client'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="partner-role-mover"
                    checked={editRoles.includes('mover')}
                    onCheckedChange={() => toggleRole('mover')}
                    data-testid="checkbox-partner-role-mover"
                  />
                  <label htmlFor="partner-role-mover" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {i18n.language === 'es' ? 'Socio' : 'Partner'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="partner-role-admin"
                    checked={editRoles.includes('admin')}
                    onCheckedChange={() => isSuperAdmin && toggleRole('admin')}
                    disabled={!isSuperAdmin}
                    data-testid="checkbox-partner-role-admin"
                  />
                  <label htmlFor="partner-role-admin" className={`text-sm font-medium leading-none ${!isSuperAdmin ? 'opacity-50' : ''}`}>
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
                  {i18n.language === 'es' ? 'El socio puede acceder al sistema' : 'Partner can access the system'}
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                data-testid="switch-edit-partner-active"
              />
            </div>
            {selectedPartner && (
              <div className="pt-2 border-t text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>{i18n.language === 'es' ? 'Última actividad:' : 'Last activity:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedPartner.user.lastActiveAt || selectedPartner.user.lastLoginAt || selectedPartner.user.createdAt), { addSuffix: true, locale })}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>{i18n.language === 'es' ? 'Registrado:' : 'Registered:'}</span>
                  <span>{formatDistanceToNow(new Date(selectedPartner.user.createdAt), { addSuffix: true, locale })}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSavePartner}
              disabled={updateUserMutation.isPending || syncRolesMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-partner"
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

export default function AdminMovers() {
  const { i18n } = useTranslation();
  const sidebarLinks = getAdminSidebarLinks(i18n.language);
  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <AdminMoversContent />
    </DashboardLayout>
  );
}
