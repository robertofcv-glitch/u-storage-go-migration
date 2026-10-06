import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Upload, CheckCircle, AlertCircle, Loader2, Globe, Clock, Users, Bot, RefreshCw, Settings, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useActiveTimezones, useTimezoneDetection } from "@/hooks/useTimezoneDetection";
import { useTimezone } from "@/hooks/useTimezone";
import { getTimezoneOffset, getTimezoneName } from "@shared/timezone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface OpenAIStatus {
  connected: boolean;
  primaryModel: string;
  fallbackModel: string;
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  error?: string;
  models?: string[];
}

interface AiAgentConfig {
  id: string;
  model: string;
  temperature: string;
  maxTokens: number;
}

interface AiModel {
  id: string;
  modelId: string;
  name: string;
  provider: string;
  description?: string;
  descriptionEs?: string;
  capabilities?: string[];
  isVisionCapable?: boolean;
  isReasoningModel?: boolean;
  isActive: boolean;
  sortOrder?: number;
}

const SUPPORTED_AI_MODEL_IDS = new Set(['claude-sonnet-4-6', 'gpt-5']);

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; summary?: any } | null>(null);
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState({
    modelId: '',
    name: '',
    provider: 'Anthropic',
    description: '',
    descriptionEs: '',
    isVisionCapable: false,
    isReasoningModel: false,
  });

  const { data: activeTimezones, isLoading: timezonesLoading } = useActiveTimezones();
  const { setTimezone, isUpdating, browserTimezone } = useTimezoneDetection(
    {
      timezone: (user as any)?.timezone,
      timezoneSource: (user as any)?.timezoneSource,
      timezoneDetectedAt: (user as any)?.timezoneDetectedAt,
    },
    { enabled: !!user }
  );
  const { timezone: currentTimezone } = useTimezone({ timezone: (user as any)?.timezone });

  const { data: openaiStatus, isLoading: openaiLoading, refetch: refetchOpenai } = useQuery<OpenAIStatus>({
    queryKey: ['/api/admin/llm/status'],
  });

  const { data: aiConfig, isLoading: configLoading } = useQuery<AiAgentConfig>({
    queryKey: ['/api/admin/ai-agent-config'],
  });

  const { data: aiModels, isLoading: modelsLoading } = useQuery<AiModel[]>({
    queryKey: ['/api/admin/ai-models'],
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: typeof newModel) => {
      if (!SUPPORTED_AI_MODEL_IDS.has(data.modelId)) {
        throw new Error(
          i18n.language === 'es'
            ? 'Solo Claude Sonnet 4.6 y GPT-5 son compatibles actualmente.'
            : 'Only Claude Sonnet 4.6 and GPT-5 are currently supported.'
        );
      }
      const response = await apiRequest('POST', '/api/admin/ai-models', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-models'] });
      setShowAddModel(false);
      setNewModel({ modelId: '', name: '', provider: 'Anthropic', description: '', descriptionEs: '', isVisionCapable: false, isReasoningModel: false });
      toast({
        title: i18n.language === 'es' ? 'Modelo agregado' : 'Model added',
        description: i18n.language === 'es' ? 'El modelo ha sido agregado a la lista.' : 'The model has been added to the list.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/ai-models/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-models'] });
      toast({
        title: i18n.language === 'es' ? 'Modelo eliminado' : 'Model deleted',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleModelActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/admin/ai-models/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-models'] });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async (model: string) => {
      const response = await apiRequest('POST', '/api/admin/llm/model', { model });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-agent-config'] });
      toast({
        title: i18n.language === 'es' ? 'Modelo actualizado' : 'Model updated',
        description: i18n.language === 'es' ? 'El modelo de IA ha sido actualizado.' : 'The AI model has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const sidebarLinks = getAdminSidebarLinks(i18n.language);
  const locale = i18n.language === 'es' ? 'es' : 'en';
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const selectableAiModels = aiModels?.filter(
    (model) => model.isActive && SUPPORTED_AI_MODEL_IDS.has(model.modelId)
  );

  const handleSeedConfig = async () => {
    setSeeding(true);
    setSeedResult(null);
    
    try {
      const configResponse = await fetch('/api/admin/seed-config', { credentials: 'include' });
      if (!configResponse.ok) {
        const error = await configResponse.json();
        throw new Error(error.message || 'Could not load configuration file.');
      }
      const configData = await configResponse.json();
      
      const response = await fetch('/api/admin/seed-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSeedResult({ success: true, message: result.message, summary: result.summary });
        toast({
          title: i18n.language === 'es' ? '¡Configuración sembrada!' : 'Configuration seeded!',
          description: i18n.language === 'es' ? 'Los datos de configuración se han importado correctamente.' : 'Configuration data has been imported successfully.',
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      setSeedResult({ success: false, message: error.message });
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleTimezoneChange = (timezone: string) => {
    setTimezone(timezone, 'admin_override');
    toast({
      title: i18n.language === 'es' ? 'Zona horaria actualizada' : 'Timezone updated',
      description: i18n.language === 'es' 
        ? `Ahora usando ${getTimezoneName(timezone, 'es')}` 
        : `Now using ${getTimezoneName(timezone, 'en')}`,
    });
  };

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/movers/backfill-profiles', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to backfill profiles');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBackfillResult({ 
        success: true, 
        message: data.message,
        count: data.profilesCreated,
      });
      toast({
        title: i18n.language === 'es' ? 'Sincronización completada' : 'Sync completed',
        description: data.message,
      });
    },
    onError: (error: any) => {
      setBackfillResult({ success: false, message: error.message });
      toast({
        title: i18n.language === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.admin.nav.settings')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.settingsDesc')}</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general" data-testid="tab-general">
              <Settings className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'General' : 'General'}
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">
              <Database className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'Datos' : 'Data'}
            </TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai">
              <Bot className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'IA / LLM' : 'AI / LLM'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {lang === 'es' ? 'Zona Horaria' : 'Timezone'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es' 
                    ? 'Configura la zona horaria para mostrar fechas y horas. Las zonas disponibles se basan en las ciudades activas en la plataforma.'
                    : 'Configure the timezone for displaying dates and times. Available timezones are based on active cities on the platform.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {lang === 'es' ? 'Tu navegador detectó: ' : 'Your browser detected: '}
                    <Badge variant="outline">{browserTimezone}</Badge>
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone-select">
                    {lang === 'es' ? 'Zona horaria activa' : 'Active Timezone'}
                  </Label>
                  <Select 
                    value={currentTimezone} 
                    onValueChange={handleTimezoneChange}
                    disabled={timezonesLoading || isUpdating}
                  >
                    <SelectTrigger id="timezone-select" className="w-full md:w-[400px]" data-testid="select-timezone">
                      <SelectValue placeholder={lang === 'es' ? 'Seleccionar zona horaria' : 'Select timezone'} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTimezones?.map((tz) => (
                        <SelectItem key={tz.timezone} value={tz.timezone} data-testid={`option-timezone-${tz.timezone}`}>
                          <div className="flex items-center gap-2">
                            <span>{getTimezoneName(tz.timezone, locale)}</span>
                            <span className="text-muted-foreground text-xs">({getTimezoneOffset(tz.timezone)})</span>
                            <span className="text-muted-foreground text-xs">- {tz.cityName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'es' 
                      ? 'Esta configuración afecta cómo se muestran las fechas en el panel de administración.'
                      : 'This setting affects how dates are displayed in the admin dashboard.'}
                  </p>
                </div>

                {(user as any)?.timezoneSource && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Badge variant="secondary">
                      {(user as any)?.timezoneSource === 'detected' 
                        ? (lang === 'es' ? 'Auto-detectado' : 'Auto-detected')
                        : (user as any)?.timezoneSource === 'manual'
                        ? (lang === 'es' ? 'Manual' : 'Manual')
                        : (lang === 'es' ? 'Configurado por admin' : 'Admin override')}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {lang === 'es' ? 'Sembrar Configuración' : 'Seed Configuration'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es' 
                    ? 'Importar datos de configuración (categorías de inventario, servicios, tipos de camión, plantillas de email, etc.) a esta base de datos.'
                    : 'Import configuration data (inventory categories, services, truck types, email templates, etc.) to this database.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <strong>{lang === 'es' ? 'Nota:' : 'Note:'}</strong>{' '}
                  {lang === 'es'
                    ? 'Esta operación es segura de ejecutar múltiples veces. Los registros existentes se actualizarán en lugar de duplicarse.'
                    : 'This operation is safe to run multiple times. Existing records will be updated instead of duplicated.'}
                </div>
                
                <Button 
                  onClick={handleSeedConfig} 
                  disabled={seeding}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-seed-config"
                >
                  {seeding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {lang === 'es' ? 'Sembrando...' : 'Seeding...'}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {lang === 'es' ? 'Sembrar Configuración' : 'Seed Configuration'}
                    </>
                  )}
                </Button>
                
                {seedResult && (
                  <div className={`rounded-lg p-4 ${seedResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {seedResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${seedResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {seedResult.message}
                      </span>
                    </div>
                    {seedResult.summary && (
                      <div className="text-sm text-green-700 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <span>• {lang === 'es' ? 'Categorías de inventario' : 'Inventory Categories'}: {seedResult.summary.inventoryCategories}</span>
                        <span>• {lang === 'es' ? 'Habitaciones' : 'Rooms'}: {seedResult.summary.inventoryRooms}</span>
                        <span>• {lang === 'es' ? 'Servicios' : 'Services'}: {seedResult.summary.services}</span>
                        <span>• Add-ons: {seedResult.summary.addOns}</span>
                        <span>• {lang === 'es' ? 'Tipos de camión' : 'Truck Types'}: {seedResult.summary.truckTypes}</span>
                        <span>• {lang === 'es' ? 'Plantillas de email' : 'Email Templates'}: {seedResult.summary.emailTemplates}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {lang === 'es' ? 'Sincronizar Perfiles de Socios' : 'Sync Partner Profiles'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es' 
                    ? 'Crear perfiles de socio para usuarios con el rol "socio" que no tienen perfil. Útil después de asignar roles manualmente o migrar datos.'
                    : 'Create partner profiles for users with the "mover" role who don\'t have a profile. Useful after manually assigning roles or migrating data.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <strong>{lang === 'es' ? 'Info:' : 'Info:'}</strong>{' '}
                  {lang === 'es'
                    ? 'Esta operación es segura. Solo crea perfiles para usuarios que no tienen uno. Los perfiles existentes no se modifican.'
                    : 'This operation is safe. It only creates profiles for users who don\'t have one. Existing profiles are not modified.'}
                </div>
                
                <Button 
                  onClick={() => backfillMutation.mutate()} 
                  disabled={backfillMutation.isPending}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                  data-testid="button-backfill-profiles"
                >
                  {backfillMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {lang === 'es' ? 'Sincronizando...' : 'Syncing...'}
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      {lang === 'es' ? 'Sincronizar Perfiles' : 'Sync Profiles'}
                    </>
                  )}
                </Button>
                
                {backfillResult && (
                  <div className={`rounded-lg p-4 ${backfillResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {backfillResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${backfillResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {backfillResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {lang === 'es' ? 'Credenciales de proveedores de IA' : 'AI Provider Credentials'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es' 
                    ? 'Disponibilidad de credenciales para el modelo principal y su respaldo. Esto no es una prueba de salud en vivo de las APIs.'
                    : 'Credential availability for the primary model and its fallback. This is not a live API health check.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${openaiStatus?.primaryConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-medium">Claude Sonnet 4.6</div>
                        <div className="text-sm text-muted-foreground">
                          {openaiLoading
                            ? (lang === 'es' ? 'Verificando credenciales...' : 'Checking credentials...')
                            : openaiStatus?.primaryConfigured
                              ? (lang === 'es' ? 'Credenciales configuradas · Modelo principal' : 'Credentials configured · Primary model')
                              : (lang === 'es' ? 'Claude no está configurado · El modelo principal no está disponible' : 'Claude is not configured · Primary model unavailable')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${openaiStatus?.fallbackConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-medium">GPT-5</div>
                        <div className="text-sm text-muted-foreground">
                          {openaiLoading
                            ? (lang === 'es' ? 'Verificando credenciales...' : 'Checking credentials...')
                            : openaiStatus?.fallbackConfigured
                              ? openaiStatus?.primaryConfigured
                                ? (lang === 'es' ? 'Credenciales configuradas · Respaldo disponible' : 'Credentials configured · Fallback available')
                                : (lang === 'es' ? 'Respaldo disponible aunque Claude no está configurado' : 'Fallback available while Claude is not configured')
                              : (lang === 'es' ? 'GPT-5 de respaldo no está configurado' : 'GPT-5 fallback is not configured')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchOpenai()}
                    disabled={openaiLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${openaiLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {openaiStatus?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                    <strong>{lang === 'es' ? 'Error:' : 'Error:'}</strong> {openaiStatus.error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>
                    {lang === 'es' ? 'Modelos de IA Disponibles' : 'Available AI Models'}
                  </CardTitle>
                  <CardDescription>
                    {lang === 'es' 
                      ? 'Revisa el catálogo de modelos. Actualmente solo Claude Sonnet 4.6 y GPT-5 se pueden agregar o seleccionar.'
                      : 'Review the model catalog. Only Claude Sonnet 4.6 and GPT-5 can currently be added or selected.'}
                  </CardDescription>
                </div>
                <Dialog open={showAddModel} onOpenChange={setShowAddModel}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="btn-add-model">
                      <Plus className="h-4 w-4 mr-1" />
                      {lang === 'es' ? 'Agregar Modelo' : 'Add Model'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{lang === 'es' ? 'Agregar Nuevo Modelo' : 'Add New Model'}</DialogTitle>
                      <DialogDescription>
                        {lang === 'es' 
                          ? 'Agrega un nuevo modelo de IA a la lista de modelos disponibles.'
                          : 'Add a new AI model to the list of available models.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="modelId">{lang === 'es' ? 'ID del Modelo' : 'Model ID'}</Label>
                        <Select
                          value={newModel.modelId}
                          onValueChange={(modelId) => setNewModel({
                            ...newModel,
                            modelId,
                            name: modelId === 'claude-sonnet-4-6' ? 'Claude Sonnet 4.6' : 'GPT-5',
                            provider: modelId === 'claude-sonnet-4-6' ? 'Anthropic' : 'OpenAI',
                          })}
                        >
                          <SelectTrigger id="modelId">
                            <SelectValue placeholder={lang === 'es' ? 'Seleccionar modelo compatible' : 'Select supported model'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                            <SelectItem value="gpt-5">GPT-5</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {lang === 'es'
                            ? 'Actualmente solo se pueden agregar Claude Sonnet 4.6 y GPT-5.'
                            : 'Only Claude Sonnet 4.6 and GPT-5 can currently be added.'}
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name">{lang === 'es' ? 'Nombre' : 'Name'}</Label>
                        <Input 
                          id="name" 
                          placeholder="e.g., Claude Sonnet 4.6, GPT-5"
                          value={newModel.name}
                          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="provider">{lang === 'es' ? 'Proveedor' : 'Provider'}</Label>
                        <Select value={newModel.provider} disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OpenAI">OpenAI</SelectItem>
                            <SelectItem value="Anthropic">Anthropic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">{lang === 'es' ? 'Descripción (EN)' : 'Description (EN)'}</Label>
                        <Input 
                          id="description" 
                          placeholder="Brief description"
                          value={newModel.description}
                          onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="descriptionEs">{lang === 'es' ? 'Descripción (ES)' : 'Description (ES)'}</Label>
                        <Input 
                          id="descriptionEs" 
                          placeholder="Descripción breve"
                          value={newModel.descriptionEs}
                          onChange={(e) => setNewModel({ ...newModel, descriptionEs: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="isVisionCapable" 
                            checked={newModel.isVisionCapable}
                            onCheckedChange={(c) => setNewModel({ ...newModel, isVisionCapable: !!c })}
                          />
                          <Label htmlFor="isVisionCapable" className="text-sm">
                            {lang === 'es' ? 'Soporta visión' : 'Vision capable'}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="isReasoningModel" 
                            checked={newModel.isReasoningModel}
                            onCheckedChange={(c) => setNewModel({ ...newModel, isReasoningModel: !!c })}
                          />
                          <Label htmlFor="isReasoningModel" className="text-sm">
                            {lang === 'es' ? 'Modelo de razonamiento' : 'Reasoning model'}
                          </Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddModel(false)}>
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </Button>
                      <Button 
                        onClick={() => createModelMutation.mutate(newModel)}
                        disabled={!newModel.modelId || !newModel.name || createModelMutation.isPending}
                      >
                        {createModelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {lang === 'es' ? 'Agregar' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {modelsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === 'es' ? 'Modelo' : 'Model'}</TableHead>
                        <TableHead>{lang === 'es' ? 'Proveedor' : 'Provider'}</TableHead>
                        <TableHead>{lang === 'es' ? 'Descripción' : 'Description'}</TableHead>
                        <TableHead>{lang === 'es' ? 'Capacidades' : 'Capabilities'}</TableHead>
                        <TableHead>{lang === 'es' ? 'Activo' : 'Active'}</TableHead>
                        <TableHead className="text-right">{lang === 'es' ? 'Acciones' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiModels?.map((model) => (
                        <TableRow key={model.id} data-testid={`row-model-${model.modelId}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{model.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{model.modelId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{model.provider}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {lang === 'es' ? model.descriptionEs || model.description : model.description}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {model.isVisionCapable && <Badge variant="secondary" className="text-xs">Vision</Badge>}
                              {model.isReasoningModel && <Badge variant="secondary" className="text-xs">Reasoning</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleModelActiveMutation.mutate({ id: model.id, isActive: !model.isActive })}
                            >
                              {model.isActive ? (
                                <Eye className="h-4 w-4 text-green-600" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteModelMutation.mutate(model.id)}
                              disabled={aiConfig?.model === model.modelId}
                              title={aiConfig?.model === model.modelId ? (lang === 'es' ? 'No puedes eliminar el modelo activo' : 'Cannot delete active model') : ''}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!aiModels || aiModels.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {lang === 'es' ? 'No hay modelos configurados. Agrega uno para comenzar.' : 'No models configured. Add one to get started.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {lang === 'es' ? 'Modelo por Defecto' : 'Default Model'}
                </CardTitle>
                <CardDescription>
                  {lang === 'es' 
                    ? 'Modelo usado para funciones de IA generales (no agentes). Los agentes como Clara tienen su propio selector.'
                    : 'Model used for general AI features (not agents). Agents like Clara have their own selector.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model-select">
                    {lang === 'es' ? 'Modelo seleccionado' : 'Selected Model'}
                  </Label>
                  <Select 
                    value={aiConfig?.model || 'claude-sonnet-4-6'}
                    onValueChange={(value) => updateModelMutation.mutate(value)}
                    disabled={configLoading || updateModelMutation.isPending || !selectableAiModels?.length}
                  >
                    <SelectTrigger id="model-select" className="w-full md:w-[400px]" data-testid="select-ai-model">
                      <SelectValue placeholder={lang === 'es' ? 'Seleccionar modelo' : 'Select model'} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableAiModels?.map((model) => (
                        <SelectItem key={model.id} value={model.modelId} data-testid={`option-model-${model.modelId}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-muted-foreground text-xs">({model.provider})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'es' 
                      ? 'Se usa para análisis de inventario, traducciones y otras funciones de IA no vinculadas a un agente específico. Actualmente solo Claude Sonnet 4.6 y GPT-5 son compatibles.'
                      : 'Used for inventory analysis, translations, and other AI features not tied to a specific agent. Only Claude Sonnet 4.6 and GPT-5 are currently supported.'}
                  </p>
                </div>

                {updateModelMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === 'es' ? 'Actualizando modelo...' : 'Updating model...'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
