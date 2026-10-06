import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, FileText, Search, MapPin, Calendar, Home, Clock, DollarSign, Eye, Package, Scale, GitBranch, Download, UserRoundPlus, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useWorkflowStatuses } from "@/hooks/useWorkflowStatuses";
import { WorkflowStatusesContent } from "./AdminWorkflowStatuses";
import { getStorageMoveContext, type StorageMoveQuoteLike } from "@shared/storageMoveContext";

interface Quote extends StorageMoveQuoteLike {
  id: string;
  quoteNumber: string | null;
  userId: string | null;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  homeSize: string;
  storageOption: string | null;
  status: string | null;
  workflowStatus: string | null;
  estimatedCost: string | null;
  suggestedPrice: string | null;
  finalPrice: string | null;
  createdAt: string;
  creator?: { id?: string; fullName?: string | null; email?: string | null } | null;
  followUpOwner?: { id?: string; fullName?: string | null; email?: string | null } | null;
  user?: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  inventoryItems?: Array<{
    id: string;
    itemName: string;
    room: string;
    category: string | null;
    quantity: number;
  }>;
}

interface InventoryCategory {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  avgWeightKg?: string | number | null;
  minWeightKg?: string | number | null;
  maxWeightKg?: string | number | null;
}

interface TruckType {
  id: string;
  name: string;
  capacityTons: string | number;
  isActive: boolean;
}


const homeSizeLabels: Record<string, { es: string; en: string }> = {
  studio: { es: 'Estudio', en: 'Studio' },
  '1br': { es: '1 Habitación', en: '1 Bedroom' },
  '2br': { es: '2 Habitaciones', en: '2 Bedrooms' },
  '3br': { es: '3 Habitaciones', en: '3 Bedrooms' },
  '4br': { es: '4+ Habitaciones', en: '4+ Bedrooms' },
  house: { es: 'Casa', en: 'House' },
  office: { es: 'Oficina', en: 'Office' },
};

export default function AdminQuotes() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const locale = i18n.language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { getStatusLabel, getStatusColor, getStatusOptions } = useWorkflowStatuses();

  const { data: quotesData, isLoading } = useQuery<{ quotes?: Quote[] } | Quote[]>({
    queryKey: ['/api/admin/quotes'],
  });
  const { data: assistedData, isLoading: assistedLoading } = useQuery<{ drafts: Array<{ id: string; customerName?: string; customerEmail?: string; customerPhone?: string; status?: string; createdAt?: string; updatedAt?: string; createdBy?: { fullName?: string; email?: string }; followUpOwner?: { fullName?: string; email?: string } }>; summary?: { assisted?: number; drafts?: number; averageMinutesToFirstFollowUp?: number | null } }>({
    queryKey: ['/api/admin/assisted-quotes/drafts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/assisted-quotes/drafts', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load assisted sales');
      const body = await response.json();
      const payload = body.data || body;
      return Array.isArray(payload) ? { drafts: payload } : { drafts: payload.drafts || payload.quotes || [], summary: payload.summary };
    },
  });
  const { data: salesMetrics } = useQuery<{ submittedCount?: number; firstFollowUpCount?: number; submittedToFirstFollowUp?: { averageMs?: number | null } }>({
    queryKey: ['/api/admin/assisted-quotes/metrics'],
  });

  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError } = useQuery<InventoryCategory[]>({
    queryKey: ['/api/inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    }
  });

  const { data: truckTypes = [], isLoading: trucksLoading, isError: trucksError } = useQuery<TruckType[]>({
    queryKey: ['/api/truck-types'],
    queryFn: async () => {
      const res = await fetch('/api/truck-types', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load trucks');
      return res.json();
    }
  });

  const quotes = (Array.isArray(quotesData) ? quotesData : quotesData?.quotes) || [];

  const parseWeight = (val: string | number | null | undefined): number | null => {
    if (val == null) return null;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const calculateQuoteWeight = (inventoryItems: Quote['inventoryItems']): { weight: number; hasDefaultFallback: boolean } | null => {
    if (!inventoryItems || inventoryItems.length === 0 || categories.length === 0) {
      return null;
    }
    let totalWeight = 0;
    let hasDefaultFallback = false;
    for (const item of inventoryItems) {
      const cat = categories.find(c => c.key === (item.category || 'other'));
      const configuredWeight = parseWeight(cat?.avgWeightKg);
      if (configuredWeight === null) {
        hasDefaultFallback = true;
      }
      const avgW = configuredWeight ?? 20;
      totalWeight += avgW * (item.quantity || 1);
    }
    return { weight: Math.round(totalWeight), hasDefaultFallback };
  };

  const getRecommendedTruck = (weightData: { weight: number; hasDefaultFallback: boolean } | null) => {
    if (weightData === null || truckTypes.length === 0) return null;
    const weightTons = weightData.weight / 1000;
    const sortedTrucks = [...truckTypes]
      .filter(t => t.isActive)
      .sort((a, b) => parseFloat(String(a.capacityTons)) - parseFloat(String(b.capacityTons)));
    
    for (const truck of sortedTrucks) {
      const capacity = parseFloat(String(truck.capacityTons));
      if (capacity >= weightTons) {
        return truck;
      }
    }
    return sortedTrucks[sortedTrucks.length - 1];
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = searchQuery === '' || 
      quote.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.fromAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.toAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.workflowStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    quotes.forEach(quote => {
      const status = quote.workflowStatus || 'pending';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.admin.nav.quotes')}</h1>
            <p className="text-muted-foreground">{t('dashboard.admin.allQuotes')}</p>
          </div>
           <Button onClick={() => setLocation("/admin/dashboard/quotes/assisted")} className="bg-[#ff6c00] text-[#24152e] hover:bg-[#e85f00]">
             <UserRoundPlus className="mr-2 h-4 w-4" />{i18n.language === "es" ? "Nueva venta asistida" : "New assisted sale"}
           </Button>
        </div>

        <Tabs defaultValue="quotes" className="w-full">
          <TabsList>
            <TabsTrigger value="quotes" data-testid="tab-quotes">
              <FileText className="h-4 w-4 mr-2" />
              {i18n.language === 'es' ? 'Cotizaciones' : 'Quotes'}
              <Badge variant="secondary" className="ml-2">{quotes.length}</Badge>
            </TabsTrigger>
             <TabsTrigger value="workflow" data-testid="tab-workflow">
              <GitBranch className="h-4 w-4 mr-2" />
               {i18n.language === 'es' ? 'Etapas de cotización' : 'Quote stages'}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="quotes" className="mt-4 space-y-4">
            <Card className="border-[#ff6c00]/30 bg-[#fff8f2]">
               <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><UserRoundPlus className="h-5 w-5 text-[#ff6c00]" />{i18n.language === "es" ? "Ventas asistidas" : "Assisted sales"}<Badge variant="outline">{assistedData?.drafts?.length || 0}</Badge></CardTitle>
              </CardHeader>
               <CardContent>
                {salesMetrics && (
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="sales-metrics">
                    <Badge variant="outline">{salesMetrics.submittedCount ?? 0} {i18n.language === "es" ? "enviadas" : "submitted"}</Badge>
                    <Badge variant="outline">{salesMetrics.firstFollowUpCount ?? 0} {i18n.language === "es" ? "primeras atenciones" : "first follow-ups"}</Badge>
                    {salesMetrics.submittedToFirstFollowUp?.averageMs != null && <Badge variant="outline">{i18n.language === "es" ? "promedio" : "avg"} {Math.round(salesMetrics.submittedToFirstFollowUp.averageMs / 60000)}m</Badge>}
                  </div>
                )}
                {assistedData?.summary && (
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="sales-summary">
                    <Badge variant="outline">{assistedData.summary.assisted ?? 0} {i18n.language === "es" ? "asistidas" : "assisted"}</Badge>
                    <Badge variant="outline">{assistedData.summary.drafts ?? assistedData.drafts?.length ?? 0} {i18n.language === "es" ? "borradores" : "drafts"}</Badge>
                    {assistedData.summary.averageMinutesToFirstFollowUp != null && <Badge variant="outline">{i18n.language === "es" ? "Primera atención" : "First follow-up"} {Math.round(assistedData.summary.averageMinutesToFirstFollowUp)}m</Badge>}
                  </div>
                )}
                {assistedLoading ? <div className="workspace-skeleton h-16" /> : !assistedData?.drafts?.length ? <p className="text-sm text-muted-foreground">{i18n.language === "es" ? "Los borradores de tu equipo aparecerán aquí." : "Your team's drafts will appear here."}</p> : <div className="grid gap-2 md:grid-cols-2">{assistedData.drafts.slice(0, 6).map((draft) => <button key={draft.id} type="button" onClick={() => setLocation(`/admin/dashboard/quotes/assisted/${draft.id}`)} className="flex items-center justify-between rounded-lg border bg-white p-3 text-left hover:border-[#ff6c00]"><span><span className="block font-semibold">{draft.customerName || draft.customerEmail || draft.customerPhone || (i18n.language === "es" ? "Prospecto" : "Lead")}</span><span className="text-xs text-muted-foreground">{i18n.language === "es" ? "Creador" : "Creator"}: {draft.createdBy?.fullName || draft.createdBy?.email || (i18n.language === "es" ? "Equipo de ventas" : "Sales team")} · {i18n.language === "es" ? "Seguimiento" : "Follow-up"}: {draft.followUpOwner?.fullName || draft.followUpOwner?.email || "—"} · {draft.status || (i18n.language === "es" ? "Borrador" : "Draft")}</span></span><Badge className="bg-[#4e2069]">{i18n.language === "es" ? "Asistida" : "Assisted"}</Badge></button>)}</div>}
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-blue-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('intake')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-900">{statusCounts['intake'] || 0}</div>
                  <div className="text-sm text-blue-700">{i18n.language === 'es' ? 'Nuevas' : 'New'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('triage')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-900">{statusCounts['triage'] || 0}</div>
                  <div className="text-sm text-amber-700">{i18n.language === 'es' ? 'En Revisión' : 'Under Review'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('bidding_open')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-900">{statusCounts['bidding_open'] || 0}</div>
                  <div className="text-sm text-green-700">{i18n.language === 'es' ? 'Abierto a Ofertas' : 'Open for Bids'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('completed')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-900">{statusCounts['completed'] || 0}</div>
                  <div className="text-sm text-emerald-700">{i18n.language === 'es' ? 'Completadas' : 'Completed'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={i18n.language === 'es' ? 'Buscar cotizaciones...' : 'Search quotes...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-quotes"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
              <SelectValue placeholder={i18n.language === 'es' ? 'Filtrar por estado' : 'Filter by status'} />
            </SelectTrigger>
            <SelectContent>
              {getStatusOptions(true).map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
              {i18n.language === 'es' ? 'Limpiar filtro' : 'Clear filter'}
            </Button>
          )}
          <Button variant="outline" asChild className="ml-auto">
            <a
              href={`/api/admin/quotes/export.csv${statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : ""}`}
              data-testid="button-export-quote-operations"
            >
              <Download className="mr-2 h-4 w-4" />
              {i18n.language === "es" ? "Exportar operaciones" : "Export operations"}
            </a>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('dashboard.admin.allQuotes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400">
                {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
                {searchQuery || statusFilter !== 'all' 
                  ? (i18n.language === 'es' ? 'No se encontraron cotizaciones' : 'No quotes found') 
                  : (i18n.language === 'es' ? 'No hay cotizaciones registradas' : 'No quotes registered')}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuotes.map((quote) => {
                  const status = quote.workflowStatus || 'intake';
                  const statusLabel = getStatusLabel(status);
                  const { color: statusTextColor, bgColor: statusBgColor } = getStatusColor(status);
                  const homeLabel = homeSizeLabels[quote.homeSize]?.[i18n.language === 'es' ? 'es' : 'en'] || quote.homeSize;
                  const estimatedWeight = calculateQuoteWeight(quote.inventoryItems);
                  const recommendedTruck = getRecommendedTruck(estimatedWeight);
                   const moveContext = getStorageMoveContext(quote);
                   const serviceLabel = i18n.language === "es"
                     ? moveContext.labels.serviceEs
                     : moveContext.labels.serviceEn;
                  
                  return (
                    <div 
                      key={quote.id} 
                      className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      data-testid={`quote-row-${quote.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {quote.quoteNumber || quote.id.slice(0, 8)}
                              </span>
                              <Badge style={{ backgroundColor: statusBgColor, color: statusTextColor }}>
                                {statusLabel}
                              </Badge>
                              <Badge variant="outline" className={moveContext.isBranchConnected ? "border-orange-300 text-orange-800" : "border-slate-300 text-slate-700"}>
                                {serviceLabel}
                              </Badge>
                            </div>
                            
                            {quote.user && (
                              <div className="text-sm font-medium text-muted-foreground">
                                {quote.user.fullName || quote.user.email || (i18n.language === 'es' ? 'Cliente' : 'Customer')}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {i18n.language === 'es' ? 'Creador' : 'Creator'}: {quote.creator?.fullName || quote.creator?.email || '—'} · {i18n.language === 'es' ? 'Seguimiento' : 'Follow-up'}: {quote.followUpOwner?.fullName || quote.followUpOwner?.email || '—'}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {quote.fromAddress.length > 30 ? quote.fromAddress.slice(0, 30) + '...' : quote.fromAddress}
                              </span>
                              <span className="text-action">→</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {quote.toAddress.length > 30 ? quote.toAddress.slice(0, 30) + '...' : quote.toAddress}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {homeLabel}
                              </span>
                              {quote.moveDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(quote.moveDate), 'PP', { locale })}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {quote.inventoryItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0} {i18n.language === 'es' ? 'artículos' : 'items'}
                              </span>
                              {quote.inventoryItems && quote.inventoryItems.length > 0 && (
                                categoriesLoading ? (
                                  <span className="flex items-center gap-1 text-slate-400 text-xs">
                                    <Scale className="h-3 w-3" />
                                    {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
                                  </span>
                                ) : categoriesError ? (
                                  <span className="flex items-center gap-1 text-red-500 text-xs">
                                    <Scale className="h-3 w-3" />
                                    {i18n.language === 'es' ? 'Error' : 'Error'}
                                  </span>
                                ) : estimatedWeight !== null ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`flex items-center gap-1 font-medium ${estimatedWeight.hasDefaultFallback ? 'text-amber-600' : 'text-blue-600'}`}>
                                          <Scale className="h-3 w-3" />
                                          ~{estimatedWeight.weight.toLocaleString()} kg
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {estimatedWeight.hasDefaultFallback 
                                          ? (i18n.language === 'es' ? 'Peso estimado (algunos pesos por defecto)' : 'Estimated weight (some defaults used)')
                                          : (i18n.language === 'es' ? 'Peso estimado del inventario' : 'Estimated inventory weight')}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null
                              )}
                              {quote.inventoryItems && quote.inventoryItems.length > 0 && !categoriesLoading && !categoriesError && (
                                trucksLoading ? (
                                  <span className="flex items-center gap-1 text-slate-400 text-xs">
                                    <Truck className="h-3 w-3" />
                                    {i18n.language === 'es' ? 'Cargando...' : 'Loading...'}
                                  </span>
                                ) : trucksError ? (
                                  <span className="flex items-center gap-1 text-red-500 text-xs">
                                    <Truck className="h-3 w-3" />
                                    {i18n.language === 'es' ? 'Error' : 'Error'}
                                  </span>
                                ) : recommendedTruck && estimatedWeight && !estimatedWeight.hasDefaultFallback ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                          <Truck className="h-3 w-3" />
                                          {recommendedTruck.name}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {i18n.language === 'es' ? 'Camión recomendado' : 'Recommended truck'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          {(quote.finalPrice || quote.suggestedPrice || quote.estimatedCost) && (
                            <div className="text-right">
                              <div className="text-2xl font-bold text-foreground">
                                ${parseFloat(quote.finalPrice || quote.suggestedPrice || quote.estimatedCost || '0').toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {quote.finalPrice 
                                  ? (i18n.language === 'es' ? 'Precio final' : 'Final price')
                                  : quote.suggestedPrice 
                                    ? (i18n.language === 'es' ? 'Precio sugerido' : 'Suggested price')
                                    : (i18n.language === 'es' ? 'Estimado' : 'Estimated')}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true, locale })}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setLocation(`/admin/dashboard/quotes/${quote.id}`)}
                            data-testid={`button-view-quote-${quote.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {i18n.language === 'es' ? 'Ver Detalles' : 'View Details'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
          
           <TabsContent value="workflow" className="mt-4">
             <WorkflowStatusesContent />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
