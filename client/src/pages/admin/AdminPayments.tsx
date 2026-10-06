import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, CheckCircle2, XCircle, ExternalLink, RefreshCw, Key, Trash2, Plus, Check, Settings, Receipt, Building2, Mail, Globe, Pencil, Zap, TestTube, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";

interface StripeProfile {
  id: string;
  name: string;
  activeMode: 'live' | 'sandbox';
  accountId?: string;
  accountName?: string;
  isActive: boolean;
  hasSandboxKeys: boolean;
  hasLiveKeys: boolean;
  createdAt: string;
}

interface ProfileStatus {
  connected: boolean;
  mode: string;
  activeMode: string;
  hasSandboxKeys?: boolean;
  hasLiveKeys?: boolean;
  accountId?: string;
  accountName?: string;
  country?: string;
  email?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  lastChecked: string;
  error?: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  customerEmail?: string;
  created: string;
  receiptUrl?: string;
}

export default function AdminPayments() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const sidebarLinks = getAdminSidebarLinks(lang);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StripeProfile | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    sandboxSecretKey: '', 
    sandboxPublishableKey: '',
    liveSecretKey: '',
    livePublishableKey: ''
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<StripeProfile[]>({
    queryKey: ['/api/admin/stripe/profiles'],
  });

  const activeProfile = profiles?.find(p => p.isActive);
  const viewingProfile = profiles?.find(p => p.id === viewingProfileId) || activeProfile;

  const { data: profileStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<ProfileStatus>({
    queryKey: ['/api/admin/stripe/profiles', viewingProfile?.id, 'status'],
    enabled: !!viewingProfile?.id,
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{ transactions: Transaction[]; hasMore: boolean }>({
    queryKey: ['/api/admin/stripe/profiles', viewingProfile?.id, 'transactions'],
    enabled: !!viewingProfile?.id,
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/admin/stripe/profiles', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles'] });
      setFormData({ name: '', sandboxSecretKey: '', sandboxPublishableKey: '', liveSecretKey: '', livePublishableKey: '' });
      setShowAddDialog(false);
      toast({ title: lang === 'es' ? 'Cuenta creada' : 'Account created', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest('PATCH', `/api/admin/stripe/profiles/${id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles'] });
      setShowEditDialog(false);
      setEditingProfile(null);
      toast({ title: lang === 'es' ? 'Cuenta actualizada' : 'Account updated', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleModeMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'sandbox' | 'live' }) => {
      const response = await apiRequest('POST', `/api/admin/stripe/profiles/${id}/toggle-mode`, { mode });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles', viewingProfile?.id, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles', viewingProfile?.id, 'transactions'] });
      toast({ title: lang === 'es' ? 'Modo cambiado' : 'Mode changed', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const activateProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/admin/stripe/profiles/${id}/activate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles'] });
      toast({ title: lang === 'es' ? 'Cuenta activada' : 'Account activated', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/stripe/profiles/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/profiles'] });
      toast({ title: lang === 'es' ? 'Cuenta eliminada' : 'Account deleted', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = (profile: StripeProfile) => {
    setEditingProfile(profile);
    setFormData({ name: profile.name, sandboxSecretKey: '', sandboxPublishableKey: '', liveSecretKey: '', livePublishableKey: '' });
    setShowEditDialog(true);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-6">
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    {lang === 'es' ? 'Cuenta Activa en Plataforma' : 'Active Platform Account'}
                  </div>
                  {profilesLoading ? (
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                  ) : activeProfile ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-semibold">{activeProfile.name}</span>
                      <Badge className={activeProfile.activeMode === 'live' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
                        {activeProfile.activeMode === 'live' ? (
                          <><Zap className="h-3 w-3 mr-1" /> {lang === 'es' ? 'Producción' : 'Live'}</>
                        ) : (
                          <><TestTube className="h-3 w-3 mr-1" /> Sandbox</>
                        )}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-xl font-semibold text-muted-foreground">
                      {lang === 'es' ? 'Ninguna cuenta activa' : 'No active account'}
                    </span>
                  )}
                </div>
              </div>
              {activeProfile && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    {lang === 'es' ? 'Conectada' : 'Connected'}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="accounts" className="gap-2" data-testid="tab-accounts">
              <Key className="h-4 w-4" />
              {lang === 'es' ? 'Cuentas' : 'Accounts'}
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-2" data-testid="tab-status">
              <Activity className="h-4 w-4" />
              {lang === 'es' ? 'Estado' : 'Status'}
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2" data-testid="tab-transactions">
              <Receipt className="h-4 w-4" />
              {lang === 'es' ? 'Transacciones' : 'Transactions'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{lang === 'es' ? 'Cuentas de Stripe' : 'Stripe Accounts'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Administra tus cuentas y alterna entre sandbox y producción' : 'Manage your accounts and toggle between sandbox and production'}
                  </CardDescription>
                </div>
                <Button onClick={() => { setFormData({ name: '', sandboxSecretKey: '', sandboxPublishableKey: '', liveSecretKey: '', livePublishableKey: '' }); setShowAddDialog(true); }} data-testid="button-add-account">
                  <Plus className="h-4 w-4 mr-2" />
                  {lang === 'es' ? 'Agregar Cuenta' : 'Add Account'}
                </Button>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : !profiles?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">{lang === 'es' ? 'No hay cuentas configuradas' : 'No accounts configured'}</p>
                    <p className="text-sm mt-1">{lang === 'es' ? 'Agrega una cuenta de Stripe para empezar' : 'Add a Stripe account to get started'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profiles.map((profile) => (
                      <div key={profile.id} className={`p-4 rounded-lg border-2 ${profile.isActive ? 'border-primary bg-primary/5' : 'border-border'}`} data-testid={`account-${profile.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{profile.name}</span>
                                {profile.isActive && (
                                  <Badge className="bg-primary/10 text-primary border-primary/30">
                                    <Check className="h-3 w-3 mr-1" />
                                    {lang === 'es' ? 'Activa' : 'Active'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <span>{profile.accountName || profile.accountId || '—'}</span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <Badge variant={profile.hasSandboxKeys ? "outline" : "secondary"} className={profile.hasSandboxKeys ? "border-amber-300 text-amber-700" : "opacity-50"}>
                                  <TestTube className="h-3 w-3 mr-1" /> Sandbox {profile.hasSandboxKeys ? '✓' : '—'}
                                </Badge>
                                <Badge variant={profile.hasLiveKeys ? "outline" : "secondary"} className={profile.hasLiveKeys ? "border-green-300 text-green-700" : "opacity-50"}>
                                  <Zap className="h-3 w-3 mr-1" /> {lang === 'es' ? 'Producción' : 'Live'} {profile.hasLiveKeys ? '✓' : '—'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                              <span className={`text-sm font-medium ${profile.activeMode === 'sandbox' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                Sandbox
                              </span>
                              <Switch
                                checked={profile.activeMode === 'live'}
                                onCheckedChange={(checked) => {
                                  const newMode = checked ? 'live' : 'sandbox';
                                  const hasKeys = checked ? profile.hasLiveKeys : profile.hasSandboxKeys;
                                  if (!hasKeys) {
                                    toast({
                                      title: lang === 'es' ? 'Claves no configuradas' : 'Keys not configured',
                                      description: checked ? (lang === 'es' ? 'Agrega claves de producción primero' : 'Add production keys first') : (lang === 'es' ? 'Agrega claves de sandbox primero' : 'Add sandbox keys first'),
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  toggleModeMutation.mutate({ id: profile.id, mode: newMode });
                                }}
                                disabled={toggleModeMutation.isPending}
                              />
                              <span className={`text-sm font-medium ${profile.activeMode === 'live' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {lang === 'es' ? 'Producción' : 'Live'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {!profile.isActive && (
                                <Button variant="outline" size="sm" onClick={() => activateProfileMutation.mutate(profile.id)} disabled={activateProfileMutation.isPending}>
                                  {activateProfileMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(profile)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteProfileMutation.mutate(profile.id)} disabled={profile.isActive || deleteProfileMutation.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                    <CreditCard className="h-4 w-4" />
                    {lang === 'es' ? 'Tarjeta de Prueba para Sandbox' : 'Test Card for Sandbox'}
                  </div>
                  <div className="mt-2 font-mono text-sm bg-white p-3 rounded border border-blue-200">
                    <div className="font-semibold">4242 4242 4242 4242</div>
                    <div className="text-muted-foreground text-xs mt-1">{lang === 'es' ? 'Fecha: cualquier futura • CVC: cualquier 3 dígitos' : 'Expiry: any future • CVC: any 3 digits'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{lang === 'es' ? 'Estado de Cuenta' : 'Account Status'}</CardTitle>
                    <CardDescription>{lang === 'es' ? 'Verifica la conexión y detalles de la cuenta' : 'Verify connection and account details'}</CardDescription>
                  </div>
                  {profiles && profiles.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{lang === 'es' ? 'Ver cuenta:' : 'View account:'}</span>
                      <Select value={viewingProfileId || activeProfile?.id || ''} onValueChange={(v) => setViewingProfileId(v)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder={lang === 'es' ? 'Seleccionar cuenta' : 'Select account'} />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.isActive && '★'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!viewingProfile ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{lang === 'es' ? 'No hay cuenta para mostrar' : 'No account to display'}</p>
                  </div>
                ) : statusLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : !profileStatus?.connected ? (
                  <Alert className="border-red-300 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      {profileStatus?.error || (lang === 'es' ? 'Error de conexión' : 'Connection error')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <span className="font-semibold text-green-700 text-lg">{lang === 'es' ? 'Conectada' : 'Connected'}</span>
                      <Badge className={profileStatus.mode === 'live' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                        {profileStatus.mode === 'live' ? (lang === 'es' ? 'Producción' : 'Live') : 'Sandbox'}
                      </Badge>
                      {!viewingProfile.isActive && (
                        <Badge variant="outline" className="ml-2">{lang === 'es' ? 'Vista previa' : 'Preview'}</Badge>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {profileStatus.accountName && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">{lang === 'es' ? 'Negocio' : 'Business'}</div>
                            <div className="font-medium text-lg">{profileStatus.accountName}</div>
                          </div>
                        </div>
                      )}
                      
                      {profileStatus.email && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                          <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Email</div>
                            <div className="font-medium">{profileStatus.email}</div>
                          </div>
                        </div>
                      )}

                      {profileStatus.country && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                          <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">{lang === 'es' ? 'País' : 'Country'}</div>
                            <div className="font-medium">{profileStatus.country}</div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                        <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">{lang === 'es' ? 'Cobros' : 'Charges'}</div>
                          <div className="font-medium flex items-center gap-2">
                            {profileStatus.chargesEnabled ? (
                              <><CheckCircle2 className="h-4 w-4 text-green-600" /> {lang === 'es' ? 'Habilitados' : 'Enabled'}</>
                            ) : (
                              <><XCircle className="h-4 w-4 text-red-600" /> {lang === 'es' ? 'Deshabilitados' : 'Disabled'}</>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        {lang === 'es' ? 'Última verificación' : 'Last checked'}: {formatDistanceToNow(new Date(profileStatus.lastChecked), { addSuffix: true, locale: lang === 'es' ? es : enUS })}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => refetchStatus()} disabled={statusLoading}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
                          {lang === 'es' ? 'Verificar' : 'Verify'}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {lang === 'es' ? 'Dashboard' : 'Dashboard'}
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{lang === 'es' ? 'Transacciones Recientes' : 'Recent Transactions'}</CardTitle>
                    <CardDescription>{lang === 'es' ? 'Historial de pagos procesados' : 'Processed payments history'}</CardDescription>
                  </div>
                  {profiles && profiles.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{lang === 'es' ? 'Ver cuenta:' : 'View account:'}</span>
                      <Select value={viewingProfileId || activeProfile?.id || ''} onValueChange={(v) => setViewingProfileId(v)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder={lang === 'es' ? 'Seleccionar cuenta' : 'Select account'} />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.isActive && '★'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!viewingProfile ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{lang === 'es' ? 'No hay cuenta para mostrar' : 'No account to display'}</p>
                  </div>
                ) : transactionsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : !transactionsData?.transactions?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">{lang === 'es' ? 'No hay transacciones aún' : 'No transactions yet'}</p>
                    <p className="text-sm mt-1">
                      {viewingProfile.activeMode === 'sandbox' 
                        ? (lang === 'es' ? 'Usa la tarjeta de prueba para hacer transacciones de prueba' : 'Use the test card to make test transactions')
                        : (lang === 'es' ? 'Las transacciones aparecerán cuando los clientes paguen' : 'Transactions will appear when customers pay')}
                    </p>
                    {!viewingProfile.isActive && (
                      <Badge variant="outline" className="mt-4">{lang === 'es' ? 'Vista previa de cuenta inactiva' : 'Viewing inactive account'}</Badge>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!viewingProfile.isActive && (
                      <div className="mb-4 p-2 rounded bg-muted text-center text-sm text-muted-foreground">
                        {lang === 'es' ? 'Viendo transacciones de cuenta inactiva' : 'Viewing transactions from inactive account'}
                      </div>
                    )}
                    {transactionsData.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">{formatCurrency(tx.amount, tx.currency)}</span>
                            <Badge className={getStatusColor(tx.status)} variant="outline">{tx.status}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{tx.description || tx.customerEmail || tx.id}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(tx.created), { addSuffix: true, locale: lang === 'es' ? es : enUS })}
                          </div>
                        </div>
                        {tx.receiptUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === 'es' ? 'Agregar Cuenta de Stripe' : 'Add Stripe Account'}</DialogTitle>
            <DialogDescription>{lang === 'es' ? 'Configura claves de sandbox, producción o ambas' : 'Configure sandbox, production, or both keys'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{lang === 'es' ? 'Nombre de la Cuenta' : 'Account Name'}</Label>
              <Input id="profile-name" placeholder={lang === 'es' ? 'Ej: Cuenta Principal' : 'E.g., Main Account'} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-account-name" />
            </div>
            
            <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 font-medium mb-3">
                <TestTube className="h-4 w-4" />
                {lang === 'es' ? 'Claves de Sandbox (Pruebas)' : 'Sandbox Keys (Testing)'}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sandbox-secret-key" className="text-sm">{lang === 'es' ? 'Clave Secreta' : 'Secret Key'}</Label>
                  <Input id="sandbox-secret-key" type="password" placeholder="sk_test_..." value={formData.sandboxSecretKey} onChange={(e) => setFormData({ ...formData, sandboxSecretKey: e.target.value })} data-testid="input-sandbox-secret" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sandbox-publishable-key" className="text-sm">{lang === 'es' ? 'Clave Publicable' : 'Publishable Key'}</Label>
                  <Input id="sandbox-publishable-key" placeholder="pk_test_..." value={formData.sandboxPublishableKey} onChange={(e) => setFormData({ ...formData, sandboxPublishableKey: e.target.value })} data-testid="input-sandbox-publishable" />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
                <Zap className="h-4 w-4" />
                {lang === 'es' ? 'Claves de Producción (Real)' : 'Production Keys (Live)'}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="live-secret-key" className="text-sm">{lang === 'es' ? 'Clave Secreta' : 'Secret Key'}</Label>
                  <Input id="live-secret-key" type="password" placeholder="sk_live_..." value={formData.liveSecretKey} onChange={(e) => setFormData({ ...formData, liveSecretKey: e.target.value })} data-testid="input-live-secret" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="live-publishable-key" className="text-sm">{lang === 'es' ? 'Clave Publicable' : 'Publishable Key'}</Label>
                  <Input id="live-publishable-key" placeholder="pk_live_..." value={formData.livePublishableKey} onChange={(e) => setFormData({ ...formData, livePublishableKey: e.target.value })} data-testid="input-live-publishable" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{lang === 'es' ? 'Cancelar' : 'Cancel'}</Button>
            <Button onClick={() => createProfileMutation.mutate(formData)} disabled={createProfileMutation.isPending || !formData.name || ((!formData.sandboxSecretKey || !formData.sandboxPublishableKey) && (!formData.liveSecretKey || !formData.livePublishableKey))} data-testid="button-save-account">
              {createProfileMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {lang === 'es' ? 'Guardar' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === 'es' ? 'Editar Cuenta' : 'Edit Account'}</DialogTitle>
            <DialogDescription>{lang === 'es' ? 'Deja las claves vacías para mantener las actuales' : 'Leave keys empty to keep current ones'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{lang === 'es' ? 'Nombre de la Cuenta' : 'Account Name'}</Label>
              <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            
            <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 font-medium mb-3">
                <TestTube className="h-4 w-4" />
                {lang === 'es' ? 'Claves de Sandbox (opcional)' : 'Sandbox Keys (optional)'}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">{lang === 'es' ? 'Nueva Clave Secreta' : 'New Secret Key'}</Label>
                  <Input type="password" placeholder="sk_test_..." value={formData.sandboxSecretKey} onChange={(e) => setFormData({ ...formData, sandboxSecretKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{lang === 'es' ? 'Nueva Clave Publicable' : 'New Publishable Key'}</Label>
                  <Input placeholder="pk_test_..." value={formData.sandboxPublishableKey} onChange={(e) => setFormData({ ...formData, sandboxPublishableKey: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
                <Zap className="h-4 w-4" />
                {lang === 'es' ? 'Claves de Producción (opcional)' : 'Production Keys (optional)'}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">{lang === 'es' ? 'Nueva Clave Secreta' : 'New Secret Key'}</Label>
                  <Input type="password" placeholder="sk_live_..." value={formData.liveSecretKey} onChange={(e) => setFormData({ ...formData, liveSecretKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{lang === 'es' ? 'Nueva Clave Publicable' : 'New Publishable Key'}</Label>
                  <Input placeholder="pk_live_..." value={formData.livePublishableKey} onChange={(e) => setFormData({ ...formData, livePublishableKey: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{lang === 'es' ? 'Cancelar' : 'Cancel'}</Button>
            <Button onClick={() => {
              if (editingProfile) {
                const data: any = { name: formData.name };
                if (formData.sandboxSecretKey) data.sandboxSecretKey = formData.sandboxSecretKey;
                if (formData.sandboxPublishableKey) data.sandboxPublishableKey = formData.sandboxPublishableKey;
                if (formData.liveSecretKey) data.liveSecretKey = formData.liveSecretKey;
                if (formData.livePublishableKey) data.livePublishableKey = formData.livePublishableKey;
                updateProfileMutation.mutate({ id: editingProfile.id, data });
              }
            }} disabled={updateProfileMutation.isPending || !formData.name}>
              {updateProfileMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {lang === 'es' ? 'Actualizar' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
