import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Warehouse, RefreshCw, Loader2, ExternalLink, MapPin, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";

interface UstorageBranch {
  id: string;
  externalId: string;
  googlePlaceId: string | null;
  brand: string;
  name: string;
  region: string | null;
  address: string | null;
  url: string | null;
  mapsUrl: string | null;
  lat: string | null;
  lng: string | null;
  priceFromMxn: string | null;
  isActive: boolean | null;
  catalogStatus: string;
  sourceVersion: string | null;
  sourceImportedAt: string | null;
  lastScrapedAt: string | null;
}

interface UstorageSettings {
  id: string;
  branchMovesEnabled: boolean;
  generalMovesEnabled: boolean;
  intoStorageEnabled: boolean | null;
  outOfStorageEnabled: boolean | null;
  matchRadiusKm: string | null;
}

export default function AdminUstorage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isSpanish = lang === 'es';
  const locale = isSpanish ? es : enUS;
  const sidebarLinks = getAdminSidebarLinks(lang);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [radiusInput, setRadiusInput] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  const { data, isLoading } = useQuery<{ branches: UstorageBranch[]; settings: UstorageSettings }>({
    queryKey: ['/api/admin/ustorage/branches'],
  });

  const branches = data?.branches || [];
  const settings = data?.settings;

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/ustorage/branches/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to refresh branches');
      }
      return res.json();
    },
    onSuccess: (result: { total: number; created: number; updated: number; deactivated: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ustorage/branches'] });
      toast({
        title: isSpanish ? 'Catálogo sincronizado' : 'Catalog synchronized',
        description: isSpanish
          ? `${result.total} sucursales: ${result.created} nuevas, ${result.updated} actualizadas, ${result.deactivated} retiradas`
          : `${result.total} branches: ${result.created} new, ${result.updated} updated, ${result.deactivated} retired`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: isSpanish ? 'Error al actualizar' : 'Refresh failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleBranchMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/ustorage/branches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update branch');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ustorage/branches'] });
    },
    onError: () => {
      toast({
        title: isSpanish ? 'Error al actualizar sucursal' : 'Failed to update branch',
        variant: 'destructive',
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (update: Partial<{ branchMovesEnabled: boolean; generalMovesEnabled: boolean; matchRadiusKm: number }>) => {
      const res = await fetch('/api/admin/ustorage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ustorage/branches'] });
      toast({ title: isSpanish ? 'Configuración guardada' : 'Settings saved' });
    },
    onError: (error: Error) => {
      toast({
        title: isSpanish ? 'Error al guardar' : 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const activeCount = branches.filter(b => b.isActive).length;
  const officialBranches = branches.filter(b => b.catalogStatus === 'official');
  const visibleBranches = officialBranches.filter(branch => {
    const haystack = `${branch.brand} ${branch.name} ${branch.region || ''} ${branch.address || ''}`.toLocaleLowerCase();
    return (brandFilter === 'all' || branch.brand === brandFilter) && (!search || haystack.includes(search.toLocaleLowerCase()));
  });
  const regions = Array.from(new Set(visibleBranches.map(b => b.region || ''))).filter(Boolean);
  const brands = Array.from(new Set(officialBranches.map(b => b.brand))).sort();

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Warehouse className="h-6 w-6 text-action" />
              {isSpanish ? 'Cobertura de bodegas' : 'Storage coverage'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSpanish
                ? `${officialBranches.length} ubicaciones aprobadas en catálogo · ${activeCount} habilitadas para lanzamiento`
                : `${officialBranches.length} approved catalog locations · ${activeCount} enabled for launch`}
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh-branches"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isSpanish ? 'Sincronizar catálogo oficial' : 'Sync official catalog'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isSpanish ? 'Modalidades del servicio' : 'Service eligibility modes'}</CardTitle>
            <CardDescription>
              {isSpanish
                ? 'Controla qué tipos de traslado pueden iniciar el proceso'
                : 'Controls which move types can begin the process'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">{isSpanish ? 'Traslados conectados con bodega' : 'Branch-connected moves'}</p>
                <p className="text-sm text-muted-foreground">
                  {isSpanish ? 'El origen o el destino debe ser una bodega activa del catálogo' : 'Origin or destination must be an active catalog branch'}
                </p>
              </div>
              <Switch
                checked={!!settings?.branchMovesEnabled}
                onCheckedChange={(checked) => updateSettingsMutation.mutate({ branchMovesEnabled: checked })}
                data-testid="switch-branch-moves"
              />
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">{isSpanish ? 'Traslados punto A → punto B' : 'Point A → B moves'}</p>
                <p className="text-sm text-muted-foreground">
                  {isSpanish ? 'Permite traslados sin una bodega aprobada; desactivado inicialmente' : 'Allows moves without an approved branch; initially disabled'}
                </p>
              </div>
              <Switch
                checked={!!settings?.generalMovesEnabled}
                onCheckedChange={(checked) => updateSettingsMutation.mutate({ generalMovesEnabled: checked })}
                data-testid="switch-general-moves"
              />
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <Label htmlFor="match-radius">{isSpanish ? 'Radio de coincidencia (km)' : 'Match radius (km)'}</Label>
                <Input
                  id="match-radius"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.5"
                  className="w-32 mt-1"
                  value={radiusInput ?? (settings?.matchRadiusKm ? parseFloat(settings.matchRadiusKm).toString() : '')}
                  onChange={(e) => setRadiusInput(e.target.value)}
                  data-testid="input-match-radius"
                />
              </div>
              <Button
                variant="outline"
                disabled={radiusInput === null || updateSettingsMutation.isPending}
                onClick={() => {
                  const r = parseFloat(radiusInput || '');
                  if (!Number.isFinite(r) || r <= 0 || r > 100) {
                    toast({
                      title: isSpanish ? 'Radio inválido' : 'Invalid radius',
                      description: isSpanish ? 'Debe ser un número entre 0 y 100' : 'Must be a number between 0 and 100',
                      variant: 'destructive',
                    });
                    return;
                  }
                  updateSettingsMutation.mutate({ matchRadiusKm: r });
                  setRadiusInput(null);
                }}
                data-testid="button-save-radius"
              >
                {isSpanish ? 'Guardar radio' : 'Save radius'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isSpanish ? 'Buscar por nombre, región o dirección' : 'Search by name, region, or address'}
                  className="pl-9"
                  data-testid="input-branch-search"
                />
              </div>
              <select
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                aria-label={isSpanish ? 'Filtrar por marca' : 'Filter by brand'}
              >
                <option value="all">{isSpanish ? 'Todas las marcas' : 'All brands'}</option>
                {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          regions.map(region => (
            <Card key={region}>
              <CardHeader>
                <CardTitle className="text-base">{region}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                   {visibleBranches.filter(b => (b.region || '') === region).map(branch => (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between gap-3 border rounded-lg px-4 py-3 flex-wrap"
                      data-testid={`row-branch-${branch.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{branch.name}</span>
                           <Badge variant="secondary">{branch.brand}</Badge>
                          {!branch.isActive && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600">
                              {isSpanish ? 'Inactiva' : 'Inactive'}
                            </Badge>
                          )}
                          {branch.url && (
                            <a
                              href={branch.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`link-branch-${branch.id}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                           {branch.mapsUrl && (
                             <a
                               href={branch.mapsUrl}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-muted-foreground hover:text-foreground"
                               aria-label={isSpanish ? 'Abrir en Google Maps' : 'Open in Google Maps'}
                             >
                               <MapPin className="h-3.5 w-3.5" />
                             </a>
                           )}
                        </div>
                        {branch.address && (
                          <p className="text-xs text-muted-foreground" data-testid={`text-branch-address-${branch.id}`}>
                            {branch.address}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {branch.priceFromMxn && `${isSpanish ? 'Desde' : 'From'} $${parseFloat(branch.priceFromMxn).toLocaleString()} MXN`}
                           {branch.sourceImportedAt && ` · ${isSpanish ? 'Importada' : 'Imported'}: ${format(new Date(branch.sourceImportedAt), 'PP', { locale })}`}
                        </p>
                      </div>
                      <Switch
                        checked={!!branch.isActive}
                        onCheckedChange={(checked) => toggleBranchMutation.mutate({ id: branch.id, isActive: checked })}
                        data-testid={`switch-branch-${branch.id}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
