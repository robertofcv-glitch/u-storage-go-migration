import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Activity, Clock, User, FileCheck, Gavel, LogIn, UserPlus, Shield, FileText, Truck, ChevronDown, Calculator, Link2, X, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

interface ActivityLog {
  id: string;
  userId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: any;
  createdAt: string;
  user?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
}

const actionIcons: Record<string, any> = {
  'login': LogIn,
  'user.registered': UserPlus,
  'quote.created': FileText,
  'quote.updated': FileCheck,
  'bid.submitted': Gavel,
  'bid.accepted': Gavel,
  'user.role_added': Shield,
  'user.role_removed': Shield,
  'estimate.calculated': Calculator,
};

const actionLabels: Record<string, { en: string; es: string }> = {
  'login': { en: 'User logged in', es: 'Usuario inició sesión' },
  'user.registered': { en: 'New user registered', es: 'Nuevo usuario registrado' },
  'quote.created': { en: 'Quote created', es: 'Cotización creada' },
  'quote.updated': { en: 'Quote updated', es: 'Cotización actualizada' },
  'bid.submitted': { en: 'Bid submitted', es: 'Oferta enviada' },
  'bid.accepted': { en: 'Bid accepted', es: 'Oferta aceptada' },
  'user.role_added': { en: 'Role granted', es: 'Rol otorgado' },
  'user.role_removed': { en: 'Role removed', es: 'Rol removido' },
  'estimate.calculated': { en: 'Estimate calculated', es: 'Estimación calculada' },
};

const roleColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  mover: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
};

interface Quote {
  id: string;
  quoteNumber: string;
  originCity: string | null;
  destinationCity: string | null;
  workflowStatus: string | null;
}

interface BackfillResult {
  dryRun: boolean;
  totalUnlinked: number;
  matchedBySession: number;
  matchedByProximity: number;
  noMatch: number;
  results: Array<{
    logId: string;
    quoteId: string | null;
    quoteNumber: string | null;
    matchType: string;
    applied: boolean;
  }>;
}

export default function AdminActivity() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? es : enUS;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [backfillResultsOpen, setBackfillResultsOpen] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResult | null>(null);

  const { data: activityData, isLoading } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ['/api/admin/activity-logs?limit=100'],
  });

  const { data: quotesData } = useQuery<{ quotes: Quote[] }>({
    queryKey: ['/api/admin/quotes'],
    enabled: linkDialogOpen,
  });

  const linkQuoteMutation = useMutation({
    mutationFn: async ({ logId, quoteId, quoteNumber }: { logId: string; quoteId: string; quoteNumber: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/activity-logs/${logId}/link-quote`, { quoteId, quoteNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/activity-logs?limit=100'] });
      setLinkDialogOpen(false);
      setSelectedLogId(null);
      toast.success(i18n.language === 'es' ? 'Cálculo vinculado a cotización' : 'Calculation linked to quote');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to link quote');
    },
  });

  const unlinkQuoteMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await apiRequest('PATCH', `/api/admin/activity-logs/${logId}/unlink-quote`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/activity-logs?limit=100'] });
      toast.success(i18n.language === 'es' ? 'Vínculo removido' : 'Link removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unlink quote');
    },
  });

  const backfillLinksMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await apiRequest('POST', '/api/admin/activity-logs/backfill-links', { dryRun });
      return res.json();
    },
    onSuccess: (data: BackfillResult) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/activity-logs?limit=100'] });
      setBackfillResults(data);
      setBackfillResultsOpen(true);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to run backfill');
    },
  });

  const activityLogs = activityData?.logs || [];
  const quotes = quotesData?.quotes || [];
  const filteredQuotes = quotes.filter(q => 
    quoteSearchQuery === '' || 
    q.quoteNumber?.toLowerCase().includes(quoteSearchQuery.toLowerCase()) ||
    q.originCity?.toLowerCase().includes(quoteSearchQuery.toLowerCase()) ||
    q.destinationCity?.toLowerCase().includes(quoteSearchQuery.toLowerCase())
  );

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = searchQuery === '' || 
      log.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(activityLogs.map(log => log.action)));

  const sidebarLinks = getAdminSidebarLinks(i18n.language);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const calculationLogs = activityLogs.filter(log => log.action === 'estimate.calculated');

  const getActionLabel = (action: string) => {
    const labels = actionLabels[action];
    if (labels) {
      return i18n.language === 'es' ? labels.es : labels.en;
    }
    return action.replace(/\./g, ' ').replace(/_/g, ' ');
  };

  const getActionIcon = (action: string) => {
    const IconComponent = actionIcons[action] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {i18n.language === 'es' ? 'Registro de Actividad' : 'Activity Log'}
          </h1>
          <p className="text-muted-foreground">
            {i18n.language === 'es' ? 'Seguimiento de todas las acciones en la plataforma' : 'Track all actions on the platform'}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-activity">
              <Activity className="h-4 w-4 mr-2" />
              {i18n.language === 'es' ? 'Toda la Actividad' : 'All Activity'}
            </TabsTrigger>
            <TabsTrigger value="calculations" data-testid="tab-calculation-logs">
              <Truck className="h-4 w-4 mr-2" />
              {i18n.language === 'es' ? 'Logs de Cálculos' : 'Calculation Logs'}
              {calculationLogs.length > 0 && (
                <Badge variant="secondary" className="ml-2">{calculationLogs.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Input
                placeholder={i18n.language === 'es' ? 'Buscar por usuario o acción...' : 'Search by user or action...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-activity"
              />
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-action">
                  <SelectValue placeholder={i18n.language === 'es' ? 'Filtrar por acción' : 'Filter by action'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{i18n.language === 'es' ? 'Todas las acciones' : 'All actions'}</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>{getActionLabel(action)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {i18n.language === 'es' ? 'Historial de Actividad' : 'Activity History'}
                  <Badge variant="secondary" className="ml-2">{filteredLogs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64 text-slate-400">
                    {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
                    {i18n.language === 'es' ? 'No hay actividad registrada' : 'No activity recorded'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        data-testid={`activity-log-${log.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{getActionLabel(log.action)}</span>
                            {log.actorRole && (
                              <Badge className={roleColors[log.actorRole] || 'bg-gray-100 text-gray-800'}>
                                {log.actorRole}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{log.user?.fullName || log.user?.email || (i18n.language === 'es' ? 'Usuario desconocido' : 'Unknown user')}</span>
                          </div>
                          {log.entityType && log.entityId && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {log.entityType}: {log.entityId.slice(0, 8)}...
                            </div>
                          )}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1 bg-white p-2 rounded border">
                              {JSON.stringify(log.details)}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.createdAt), 'PPp', { locale })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calculations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {i18n.language === 'es' ? 'Logs de Cálculos de Estimación' : 'Estimation Calculation Logs'}
                  <Badge variant="secondary" className="ml-2">{calculationLogs.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => backfillLinksMutation.mutate(true)}
                    disabled={backfillLinksMutation.isPending}
                    data-testid="btn-analyze-links"
                  >
                    {backfillLinksMutation.isPending 
                      ? (i18n.language === 'es' ? 'Analizando...' : 'Analyzing...') 
                      : (i18n.language === 'es' ? 'Analizar Vínculos' : 'Analyze Links')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => backfillLinksMutation.mutate(false)}
                    disabled={backfillLinksMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="btn-apply-links"
                  >
                    <Link2 className="h-4 w-4 mr-1" />
                    {i18n.language === 'es' ? 'Vincular Automáticamente' : 'Auto-Link'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64 text-slate-400">
                    {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
                  </div>
                ) : calculationLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg flex-col gap-2">
                    <Truck className="h-12 w-12 opacity-50" />
                    <span>{i18n.language === 'es' ? 'No hay logs de cálculos' : 'No calculation logs yet'}</span>
                    <span className="text-sm">{i18n.language === 'es' ? 'Los logs aparecerán cuando se calculen estimaciones' : 'Logs will appear when estimates are calculated'}</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {calculationLogs.map((log) => {
                      const details = log.details || {};
                      const isExpanded = expandedLogId === log.id;
                      
                      return (
                        <Collapsible 
                          key={log.id} 
                          open={isExpanded}
                          onOpenChange={() => setExpandedLogId(isExpanded ? null : log.id)}
                        >
                          <div className="border rounded-lg overflow-hidden" data-testid={`calc-log-${log.id}`}>
                            <CollapsibleTrigger className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                                  <Calculator className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                  {details.linkedQuoteNumber ? (
                                    <>
                                      <div className="text-lg font-bold text-foreground">
                                        #{details.linkedQuoteNumber}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {details.loadRequirements?.totalVolume?.toFixed(2)} m³ → {details.result?.recommendedTruck || 'N/A'}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {details.loadRequirements?.totalWeight?.toFixed(0)} kg · {details.input?.itemCount} {i18n.language === 'es' ? 'artículos' : 'items'}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-lg font-bold text-foreground">
                                        {format(new Date(log.createdAt), 'PPp', { locale })}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {details.loadRequirements?.totalVolume?.toFixed(2)} m³ → {details.result?.recommendedTruck || 'N/A'}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {details.loadRequirements?.totalWeight?.toFixed(0)} kg · {details.input?.itemCount} {i18n.language === 'es' ? 'artículos' : 'items'}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale })}
                                  </div>
                                  {details.linkedQuoteNumber && (
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(log.createdAt), 'PPp', { locale })}
                                    </div>
                                  )}
                                </div>
                                <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="p-4 border-t bg-white space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="p-3 bg-blue-50 rounded-lg">
                                    <div className="text-xs text-blue-600 font-medium mb-1">
                                      {i18n.language === 'es' ? 'CARGA' : 'LOAD'}
                                    </div>
                                    <div className="text-lg font-bold text-blue-800">
                                      {details.loadRequirements?.totalVolume?.toFixed(2)} m³
                                    </div>
                                    <div className="text-sm text-blue-600">
                                      {details.loadRequirements?.totalWeight?.toFixed(0)} kg
                                    </div>
                                    <div className="text-xs text-blue-500 mt-1">
                                      {details.input?.itemCount} {i18n.language === 'es' ? 'artículos' : 'items'}
                                    </div>
                                  </div>
                                  
                                  <div className="p-3 bg-green-50 rounded-lg">
                                    <div className="text-xs text-green-600 font-medium mb-1">
                                      {i18n.language === 'es' ? 'RESULTADO' : 'RESULT'}
                                    </div>
                                    <div className="text-lg font-bold text-green-800">
                                      {details.result?.recommendedTruck}
                                    </div>
                                    <div className="text-sm text-green-600">
                                      {details.result?.truckCount} {i18n.language === 'es' ? 'camión(es)' : 'truck(s)'}
                                    </div>
                                    <div className="text-xs text-green-500 mt-1">
                                      {i18n.language === 'es' ? 'Factor limitante' : 'Constraining'}: {details.result?.constrainingFactor}
                                    </div>
                                  </div>
                                  
                                  <div className="p-3 bg-purple-50 rounded-lg">
                                    <div className="text-xs text-purple-600 font-medium mb-1">
                                      {i18n.language === 'es' ? 'COSTO' : 'COST'}
                                    </div>
                                    <div className="text-lg font-bold text-purple-800">
                                      ${details.result?.estimatedCost?.low?.toLocaleString()} - ${details.result?.estimatedCost?.high?.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-purple-600">
                                      {details.result?.estimatedCost?.currency}
                                    </div>
                                    <div className="text-xs text-purple-500 mt-1">
                                      {i18n.language === 'es' ? 'Fuente' : 'Source'}: {details.pricingSource}
                                    </div>
                                  </div>
                                </div>

                                {(details.input?.fromAddress || details.input?.toAddress || details.distance) && (
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-xs text-slate-600 font-medium mb-2">
                                      {i18n.language === 'es' ? 'RUTA Y DISTANCIA' : 'ROUTE & DISTANCE'}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {details.input?.fromAddress && (
                                        <div>
                                          <div className="text-xs text-slate-500 mb-0.5">
                                            {i18n.language === 'es' ? 'Origen:' : 'Origin:'}
                                          </div>
                                          <div className="text-sm text-slate-800 font-medium">
                                            {details.input.fromAddress}
                                          </div>
                                        </div>
                                      )}
                                      {details.input?.toAddress && (
                                        <div>
                                          <div className="text-xs text-slate-500 mb-0.5">
                                            {i18n.language === 'es' ? 'Destino:' : 'Destination:'}
                                          </div>
                                          <div className="text-sm text-slate-800 font-medium">
                                            {details.input.toAddress}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {details.distance && (
                                      <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4">
                                        <div>
                                          <span className="text-xs text-slate-500">
                                            {i18n.language === 'es' ? 'Distancia:' : 'Distance:'}
                                          </span>
                                          <span className="ml-1 font-bold text-slate-800">
                                            {details.distance.km?.toFixed(1)} km
                                          </span>
                                        </div>
                                        <Badge variant={details.distance.source === 'google_maps' ? 'default' : 'secondary'} className="text-xs">
                                          {details.distance.source === 'google_maps' ? 'Google Maps' : 
                                           details.distance.source === 'stored' ? (i18n.language === 'es' ? 'Almacenado' : 'Stored') :
                                           details.distance.source === 'default' ? (i18n.language === 'es' ? 'Por defecto' : 'Default') :
                                           details.distance.source}
                                        </Badge>
                                        <div className="border-l border-slate-300 pl-4 flex items-center gap-2">
                                          <div>
                                            <span className="text-xs text-slate-500">
                                              {i18n.language === 'es' ? 'Tiempo traslado:' : 'Travel time:'}
                                            </span>
                                            <span className="ml-1 font-bold text-slate-800">
                                              ~{Math.ceil((details.distance.km || 0) / 30 * 60)} min
                                            </span>
                                          </div>
                                          <Badge variant={details.distance.source === 'google_maps' ? 'default' : 'secondary'} className="text-xs">
                                            {details.distance.source === 'google_maps' ? 'Google Maps' : 
                                             (i18n.language === 'es' ? 'Por defecto' : 'Default')}
                                          </Badge>
                                        </div>
                                        {details.pricingBreakdown?.synchronizedHours && (
                                          <div className="border-l border-slate-300 pl-4">
                                            <span className="text-xs text-slate-500">
                                              {i18n.language === 'es' ? 'Tiempo mudanza:' : 'Move time:'}
                                            </span>
                                            <span className="ml-1 font-bold text-slate-800">
                                              {details.pricingBreakdown.synchronizedHours} hrs
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div>
                                  <h4 className="font-medium text-sm mb-2">
                                    {i18n.language === 'es' ? 'Datos de Camiones Disponibles' : 'Available Truck Data'}
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>{i18n.language === 'es' ? 'Camión' : 'Truck'}</TableHead>
                                          <TableHead className="text-right">{i18n.language === 'es' ? 'Capacidad (kg)' : 'Capacity (kg)'}</TableHead>
                                          <TableHead className="text-right">{i18n.language === 'es' ? 'Capacidad (m³)' : 'Capacity (m³)'}</TableHead>
                                          <TableHead className="text-right">{i18n.language === 'es' ? 'Factor Usable' : 'Usable Factor'}</TableHead>
                                          <TableHead className="text-right">{i18n.language === 'es' ? 'Vol. Usable (m³)' : 'Usable Vol (m³)'}</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {details.truckData?.map((truck: any, idx: number) => {
                                          const truckCount = details.selectedFleet?.filter((t: string) => t === truck.name).length || 0;
                                          const isSelected = truckCount > 0;
                                          return (
                                            <TableRow key={idx} className={isSelected ? 'bg-green-50' : ''}>
                                              <TableCell className="font-medium">
                                                {truck.name}
                                                {isSelected && (
                                                  <>
                                                    <Badge className="ml-2 bg-green-100 text-green-800">{i18n.language === 'es' ? 'Seleccionado' : 'Selected'}</Badge>
                                                    <Badge className="ml-1 bg-green-600 text-white">× {truckCount}</Badge>
                                                  </>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right">{truck.capacityKg?.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{truck.capacityM3?.toFixed(2)}</TableCell>
                                              <TableCell className="text-right">{truck.usableVolumeFactor}</TableCell>
                                              <TableCell className="text-right font-medium">{truck.usableVolumeCalc?.toFixed(2)}</TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>

                                {details.pricingBreakdown && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <h4 className="font-medium text-sm mb-3 text-amber-800 flex items-center gap-2">
                                      <Calculator className="h-4 w-4" />
                                      {i18n.language === 'es' ? 'Desglose de Precio' : 'Price Breakdown'}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-amber-700">
                                          {i18n.language === 'es' ? 'Costo base camión(es):' : 'Base truck cost:'}
                                        </span>
                                        <span className="font-medium">${details.pricingBreakdown.baseTruckCost?.toLocaleString()}</span>
                                      </div>
                                      {details.pricingBreakdown.baseTruckCostDetails?.map((truck: any, idx: number) => (
                                        <div key={idx} className="pl-4 text-xs text-amber-600">
                                          <div className="flex justify-between">
                                            <span>• {truck.name} (${truck.baseRate?.toLocaleString()} + {truck.distanceKm}km × ${truck.perKmRate})</span>
                                            <span>${(truck.baseRate + truck.distanceKm * truck.perKmRate)?.toLocaleString()}</span>
                                          </div>
                                          {truck.extraHours > 0 && (
                                            <>
                                              <div className="flex justify-between text-amber-500 italic ml-2">
                                                <span>+ {truck.extraHours}h {i18n.language === 'es' ? 'extras camión' : 'extra truck'} × ${truck.hourlyRate}/hr</span>
                                                <span>+${truck.truckExtraHoursCost?.toLocaleString()}</span>
                                              </div>
                                              <div className="flex justify-between text-amber-500 italic ml-2">
                                                <span>+ {truck.extraHours}h × {truck.includedMovers} {i18n.language === 'es' ? 'cargadores' : 'movers'} × ${truck.moverHourlyRate}/hr</span>
                                                <span>+${truck.moverExtraHoursCost?.toLocaleString()}</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                      {details.pricingBreakdown.extraHoursCost > 0 && (
                                        <div className="bg-amber-100 p-2 rounded space-y-1">
                                          <div className="flex justify-between text-xs font-medium text-amber-700">
                                            <span>
                                              {i18n.language === 'es' 
                                                ? `Horas sincronizadas: ${details.pricingBreakdown.synchronizedHours}h` 
                                                : `Synchronized hours: ${details.pricingBreakdown.synchronizedHours}h`}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-xs text-amber-600">
                                            <span>{i18n.language === 'es' ? 'Horas extra camiones:' : 'Extra truck hours:'}</span>
                                            <span>+${details.pricingBreakdown.extraTruckHoursCost?.toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-xs text-amber-600">
                                            <span>{i18n.language === 'es' ? 'Horas extra cargadores:' : 'Extra mover labor:'}</span>
                                            <span>+${details.pricingBreakdown.extraMoverLaborCost?.toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-xs font-bold text-amber-800 border-t border-amber-300 pt-1">
                                            <span>{i18n.language === 'es' ? 'Total sincronización:' : 'Total sync cost:'}</span>
                                            <span>+${details.pricingBreakdown.extraHoursCost?.toLocaleString()}</span>
                                          </div>
                                        </div>
                                      )}
                                      <div className="border-t border-amber-300 pt-2 mt-2 flex justify-between font-medium">
                                        <span className="text-amber-800">
                                          {i18n.language === 'es' ? 'Subtotal:' : 'Subtotal:'}
                                        </span>
                                        <span>${details.pricingBreakdown.subtotalBeforeMarkup?.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-amber-600">
                                          {i18n.language === 'es' ? 'Multiplicador bajo (estándar):' : 'Low multiplier (standard):'}
                                        </span>
                                        <span>×{details.pricingBreakdown.lowMarkupMultiplier?.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-amber-600">
                                          {i18n.language === 'es' ? 'Multiplicador alto (complicado):' : 'High multiplier (complicated):'}
                                        </span>
                                        <span>×{details.pricingBreakdown.highMarkupMultiplier?.toFixed(2)}</span>
                                      </div>
                                      <div className="border-t border-amber-300 pt-2 mt-2">
                                        <div className="flex justify-between font-bold text-amber-900">
                                          <span>{i18n.language === 'es' ? 'Rango final:' : 'Final range:'}</span>
                                          <span>
                                            ${details.pricingBreakdown.finalLowEstimate?.toLocaleString()} - ${details.pricingBreakdown.finalHighEstimate?.toLocaleString()} {details.pricingBreakdown.currency}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-muted-foreground">
                                  {i18n.language === 'es' ? 'Flotas candidatas evaluadas' : 'Candidate fleets evaluated'}: {details.candidateFleetsCount}
                                  {details.bestScore && (
                                    <span className="ml-4">
                                      {i18n.language === 'es' ? 'Mejor puntuación' : 'Best score'}: 
                                      {` ${details.bestScore.count} ${i18n.language === 'es' ? 'camiones' : 'trucks'}, ${details.bestScore.totalVol?.toFixed(2)} m³, $${details.bestScore.cost?.toLocaleString()}`}
                                    </span>
                                  )}
                                </div>

                                <div className="pt-3 border-t flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Link2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                      {details.linkedQuoteNumber 
                                        ? (i18n.language === 'es' ? 'Cotización Vinculada' : 'Linked Quote')
                                        : (i18n.language === 'es' ? 'Cotización No Vinculada' : 'No Linked Quote')}
                                    </span>
                                  </div>
                                  {details.linkedQuoteNumber ? (
                                    <div className="flex items-center gap-2">
                                      <a 
                                        href={`/admin/dashboard/quotes/${details.linkedQuoteId}`}
                                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                        data-testid={`link-quote-${log.id}`}
                                      >
                                        #{details.linkedQuoteNumber}
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          unlinkQuoteMutation.mutate(log.id);
                                        }}
                                        disabled={unlinkQuoteMutation.isPending}
                                        data-testid={`unlink-quote-${log.id}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLogId(log.id);
                                        setLinkDialogOpen(true);
                                      }}
                                      data-testid={`add-link-quote-${log.id}`}
                                    >
                                      <Link2 className="h-4 w-4 mr-2" />
                                      {i18n.language === 'es' ? 'Vincular' : 'Link'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {i18n.language === 'es' ? 'Vincular a Cotización' : 'Link to Quote'}
              </DialogTitle>
              <DialogDescription>
                {i18n.language === 'es' 
                  ? 'Selecciona una cotización para vincular este cálculo' 
                  : 'Select a quote to link this calculation to'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder={i18n.language === 'es' ? 'Buscar por número o ciudad...' : 'Search by number or city...'}
                value={quoteSearchQuery}
                onChange={(e) => setQuoteSearchQuery(e.target.value)}
                data-testid="quote-search-input"
              />
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {filteredQuotes.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {i18n.language === 'es' ? 'No se encontraron cotizaciones' : 'No quotes found'}
                  </div>
                ) : (
                  filteredQuotes.slice(0, 20).map((quote) => (
                    <button
                      key={quote.id}
                      className="w-full p-3 text-left hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                      onClick={() => {
                        if (selectedLogId) {
                          linkQuoteMutation.mutate({
                            logId: selectedLogId,
                            quoteId: quote.id,
                            quoteNumber: quote.quoteNumber,
                          });
                        }
                      }}
                      disabled={linkQuoteMutation.isPending}
                      data-testid={`select-quote-${quote.id}`}
                    >
                      <div className="font-medium text-foreground">
                        #{quote.quoteNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quote.originCity} → {quote.destinationCity}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={backfillResultsOpen} onOpenChange={setBackfillResultsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {backfillResults?.dryRun 
                  ? (i18n.language === 'es' ? 'Análisis de Vínculos' : 'Link Analysis')
                  : (i18n.language === 'es' ? 'Resultados de Vinculación' : 'Linking Results')}
              </DialogTitle>
              <DialogDescription>
                {backfillResults?.dryRun 
                  ? (i18n.language === 'es' 
                      ? 'Vista previa de las coincidencias encontradas (sin cambios aplicados)' 
                      : 'Preview of matches found (no changes applied)')
                  : (i18n.language === 'es' 
                      ? 'Los cálculos han sido vinculados a sus cotizaciones' 
                      : 'Calculations have been linked to their quotes')}
              </DialogDescription>
            </DialogHeader>
            
            {backfillResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-700">{backfillResults.totalUnlinked}</div>
                    <div className="text-xs text-muted-foreground">
                      {i18n.language === 'es' ? 'Sin Vincular' : 'Unlinked'}
                    </div>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {backfillResults.matchedBySession + backfillResults.matchedByProximity}
                    </div>
                    <div className="text-xs text-green-600">
                      {i18n.language === 'es' ? 'Coincidencias' : 'Matches'}
                    </div>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {i18n.language === 'es' ? 'Por ID de sesión:' : 'By session ID:'}
                    </span>
                    <span className="font-medium">{backfillResults.matchedBySession}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {i18n.language === 'es' ? 'Por proximidad temporal:' : 'By time proximity:'}
                    </span>
                    <span className="font-medium">{backfillResults.matchedByProximity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {i18n.language === 'es' ? 'Sin coincidencia:' : 'No match:'}
                    </span>
                    <span className="font-medium">{backfillResults.noMatch}</span>
                  </div>
                </div>

                {backfillResults.results.filter(r => r.quoteNumber).length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    <div className="text-xs font-medium p-2 bg-slate-50 border-b">
                      {i18n.language === 'es' ? 'Coincidencias Encontradas' : 'Matches Found'}
                    </div>
                    {backfillResults.results.filter(r => r.quoteNumber).map((result, idx) => (
                      <div key={idx} className="p-2 border-b last:border-b-0 text-sm flex justify-between items-center">
                        <span className="font-medium text-primary">#{result.quoteNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.matchType === 'session_id' 
                            ? (i18n.language === 'es' ? 'Sesión' : 'Session')
                            : (i18n.language === 'es' ? 'Proximidad' : 'Proximity')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {backfillResults.dryRun && (backfillResults.matchedBySession + backfillResults.matchedByProximity) > 0 && (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setBackfillResultsOpen(false);
                      backfillLinksMutation.mutate(false);
                    }}
                    data-testid="btn-apply-from-dialog"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    {i18n.language === 'es' 
                      ? `Aplicar ${backfillResults.matchedBySession + backfillResults.matchedByProximity} Vínculos` 
                      : `Apply ${backfillResults.matchedBySession + backfillResults.matchedByProximity} Links`}
                  </Button>
                )}

                {!backfillResults.dryRun && (
                  <div className="p-3 bg-green-50 rounded-lg text-center text-green-700">
                    {i18n.language === 'es' 
                      ? `${backfillResults.matchedBySession + backfillResults.matchedByProximity} cálculos vinculados exitosamente` 
                      : `${backfillResults.matchedBySession + backfillResults.matchedByProximity} calculations linked successfully`}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
