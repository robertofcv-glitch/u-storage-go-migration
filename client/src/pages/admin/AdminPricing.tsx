import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  Save, DollarSign, Truck, Globe, MapPin, Plus, Trash2, Building, Edit, X, Users, Settings, Bot, ShieldAlert, Info
} from "lucide-react";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface PricingTemplate {
  id: string;
  name: string;
  nameEs: string;
  description: string | null;
  descriptionEs: string | null;
  currency: string;
  baseCostPerKm: string;
  baseCostPerItem: string;
  laborCostPerHour: string;
  largeFurnitureMultiplier: string | null;
  fragileItemMultiplier: string | null;
  floorSurchargePercent: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
}

interface Country {
  id: string;
  code: string;
  name: string;
  nameEs: string | null;
  currency: string;
  currencySymbol: string;
  pricingTemplateId: string | null;
  baseCostPerKm: string | null;
  baseCostPerItem: string | null;
  laborCostPerHour: string | null;
  isActive: boolean | null;
}

interface City {
  id: string;
  countryId: string;
  name: string;
  nameEs: string | null;
  baseCostPerKm: string | null;
  baseCostPerItem: string | null;
  laborCostPerHour: string | null;
  extraMoverRate: string | null;
  moverHourlyRate: string | null;
  complicatedMoveMultiplier: string | null;
  defaultDistanceKm: string | null;
  isActive: boolean | null;
}

interface TruckType {
  id: string;
  name: string;
  nameEs: string;
  capacityTons: string;
  capacityKg: number;
  capacityM3: string | null;
  capacityM3Low: string | null;
  capacityM3High: string | null;
  usableVolumeFactor: string | null;
  includedMovers: number;
  baseServiceHours: string;
  baseRate: string;
  hourlyRate: string;
  perKmRate: string;
  extraMoverRate: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
}


function PricingTemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PricingTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '', nameEs: '', description: '', descriptionEs: '', currency: 'MXN',
    baseCostPerKm: '5.00', baseCostPerItem: '50.00', laborCostPerHour: '200.00',
    largeFurnitureMultiplier: '1.50', fragileItemMultiplier: '1.25', floorSurchargePercent: '10.00',
    isDefault: false, isActive: true
  });

  const { data: templates = [], isLoading } = useQuery<PricingTemplate[]>({
    queryKey: ['pricing-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pricing-templates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-templates'] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Plantilla creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear plantilla", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PricingTemplate> }) => {
      const res = await fetch(`/api/admin/pricing-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-templates'] });
      setEditTemplate(null);
      toast({ title: "Plantilla actualizada" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/pricing-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-templates'] });
      toast({ title: "Plantilla eliminada" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '', nameEs: '', description: '', descriptionEs: '', currency: 'MXN',
      baseCostPerKm: '5.00', baseCostPerItem: '50.00', laborCostPerHour: '200.00',
      largeFurnitureMultiplier: '1.50', fragileItemMultiplier: '1.25', floorSurchargePercent: '10.00',
      isDefault: false, isActive: true
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Plantillas de Precios
          </CardTitle>
          <CardDescription>Define plantillas base para diferentes regiones o tipos de servicio</CardDescription>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Nueva Plantilla</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nueva Plantilla de Precios</DialogTitle>
              <DialogDescription>Define los parámetros base para una región o tipo de servicio</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nombre (EN)</Label><Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="LATAM Default" /></div>
                <div><Label>Nombre (ES)</Label><Input value={formData.nameEs} onChange={e => setFormData(p => ({...p, nameEs: e.target.value}))} placeholder="LATAM Predeterminado" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Moneda</Label><Input value={formData.currency} onChange={e => setFormData(p => ({...p, currency: e.target.value.toUpperCase()}))} placeholder="MXN" /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={formData.isDefault} onCheckedChange={v => setFormData(p => ({...p, isDefault: v}))} /><Label>Predeterminada</Label></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Costo/km</Label><Input type="number" step="0.01" value={formData.baseCostPerKm} onChange={e => setFormData(p => ({...p, baseCostPerKm: e.target.value}))} /></div>
                <div><Label>Costo/artículo</Label><Input type="number" step="0.01" value={formData.baseCostPerItem} onChange={e => setFormData(p => ({...p, baseCostPerItem: e.target.value}))} /></div>
                <div><Label>Costo/hora</Label><Input type="number" step="0.01" value={formData.laborCostPerHour} onChange={e => setFormData(p => ({...p, laborCostPerHour: e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Mult. grande</Label><Input type="number" step="0.01" value={formData.largeFurnitureMultiplier} onChange={e => setFormData(p => ({...p, largeFurnitureMultiplier: e.target.value}))} /></div>
                <div><Label>Mult. frágil</Label><Input type="number" step="0.01" value={formData.fragileItemMultiplier} onChange={e => setFormData(p => ({...p, fragileItemMultiplier: e.target.value}))} /></div>
                <div><Label>Recargo piso %</Label><Input type="number" step="0.01" value={formData.floorSurchargePercent} onChange={e => setFormData(p => ({...p, floorSurchargePercent: e.target.value}))} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={() => addMutation.mutate(formData)} disabled={!formData.name || !formData.nameEs}>Crear Plantilla</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {t.name}
                      {t.isDefault && <Badge variant="secondary">Predeterminada</Badge>}
                      {!t.isActive && <Badge variant="outline">Inactiva</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{t.currency} · ${t.baseCostPerItem}/artículo · ${t.baseCostPerKm}/km · ${t.laborCostPerHour}/hr</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.isActive ?? false} onCheckedChange={v => updateMutation.mutate({ id: t.id, data: { isActive: v } })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-muted-foreground text-center py-8">No hay plantillas configuradas</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountriesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '', name: '', nameEs: '', currency: 'MXN', currencySymbol: '$',
    pricingTemplateId: '', baseCostPerKm: '', baseCostPerItem: '', laborCostPerHour: '', isActive: true
  });

  const { data: countries = [], isLoading } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/countries', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load countries');
      return res.json();
    }
  });

  const { data: templates = [] } = useQuery<PricingTemplate[]>({
    queryKey: ['pricing-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pricing-templates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          pricingTemplateId: data.pricingTemplateId || null,
          baseCostPerKm: data.baseCostPerKm || null,
          baseCostPerItem: data.baseCostPerItem || null,
          laborCostPerHour: data.laborCostPerHour || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add country');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      setIsAddOpen(false);
      setFormData({ code: '', name: '', nameEs: '', currency: 'MXN', currencySymbol: '$', pricingTemplateId: '', baseCostPerKm: '', baseCostPerItem: '', laborCostPerHour: '', isActive: true });
      toast({ title: "País agregado" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Country> }) => {
      const res = await fetch(`/api/admin/countries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update country');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast({ title: "País actualizado" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/countries/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast({ title: "País eliminado" });
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Países</CardTitle>
          <CardDescription>Configura precios por país con overrides opcionales</CardDescription>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> Agregar País</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Agregar País</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Código ISO</Label><Input value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value.toUpperCase()}))} placeholder="MX" maxLength={2} /></div>
                <div><Label>Moneda</Label><Input value={formData.currency} onChange={e => setFormData(p => ({...p, currency: e.target.value.toUpperCase()}))} placeholder="MXN" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nombre (EN)</Label><Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Mexico" /></div>
                <div><Label>Nombre (ES)</Label><Input value={formData.nameEs} onChange={e => setFormData(p => ({...p, nameEs: e.target.value}))} placeholder="México" /></div>
              </div>
              <div><Label>Símbolo moneda</Label><Input value={formData.currencySymbol} onChange={e => setFormData(p => ({...p, currencySymbol: e.target.value}))} placeholder="$" /></div>
              <div>
                <Label>Plantilla base</Label>
                <Select value={formData.pricingTemplateId} onValueChange={v => setFormData(p => ({...p, pricingTemplateId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar plantilla..." /></SelectTrigger>
                  <SelectContent>{templates.filter(t => t.isActive).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Overrides opcionales (dejar vacío para usar plantilla):</p>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>$/km</Label><Input type="number" step="0.01" value={formData.baseCostPerKm} onChange={e => setFormData(p => ({...p, baseCostPerKm: e.target.value}))} placeholder="5.00" /></div>
                <div><Label>$/art</Label><Input type="number" step="0.01" value={formData.baseCostPerItem} onChange={e => setFormData(p => ({...p, baseCostPerItem: e.target.value}))} placeholder="50.00" /></div>
                <div><Label>$/hr</Label><Input type="number" step="0.01" value={formData.laborCostPerHour} onChange={e => setFormData(p => ({...p, laborCostPerHour: e.target.value}))} placeholder="200.00" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={() => addMutation.mutate(formData)} disabled={!formData.code || !formData.name}>Agregar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="space-y-3">
            {countries.map(c => (
              <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <span className="text-lg">{c.code}</span> {c.name} {c.nameEs && <span className="text-muted-foreground">({c.nameEs})</span>}
                    {!c.isActive && <Badge variant="outline">Inactivo</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.currency} ({c.currencySymbol}) 
                    {c.baseCostPerKm && ` · $${c.baseCostPerKm}/km`}
                    {c.baseCostPerItem && ` · $${c.baseCostPerItem}/art`}
                    {c.laborCostPerHour && ` · $${c.laborCostPerHour}/hr`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={c.isActive ?? false} onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { isActive: v } })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {countries.length === 0 && <p className="text-muted-foreground text-center py-8">No hay países configurados</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CityTruckPricing {
  id: string;
  cityId: string;
  truckTypeId: string;
  baseRate: string;
  hourlyRate: string;
  perKmRate: string;
  baseServiceHours: string;
  includedMovers: number;
}

function CitiesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [editingCityName, setEditingCityName] = useState<string>('');
  const [truckPricing, setTruckPricing] = useState<Record<string, { 
    baseRate: string; hourlyRate: string; perKmRate: string; 
    baseServiceHours: string; includedMovers: string; 
  }>>({});
  const [generalPricing, setGeneralPricing] = useState({ extraMoverRate: '', moverHourlyRate: '', complicatedMoveMultiplier: '', defaultDistanceKm: '' });
  const [formData, setFormData] = useState({
    countryId: '', name: '', nameEs: '', baseCostPerKm: '', baseCostPerItem: '', laborCostPerHour: '', isActive: true
  });

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/countries', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load countries');
      return res.json();
    }
  });

  const { data: truckTypes = [] } = useQuery<TruckType[]>({
    queryKey: ['truck-types'],
    queryFn: async () => {
      const res = await fetch('/api/admin/truck-types', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load truck types');
      return res.json();
    }
  });

  const loadCityTruckPricing = async (cityId: string, city: City) => {
    try {
      // Load general pricing from city
      setGeneralPricing({
        extraMoverRate: city.extraMoverRate || '200.00',
        moverHourlyRate: city.moverHourlyRate || '150.00',
        complicatedMoveMultiplier: city.complicatedMoveMultiplier || '1.30',
        defaultDistanceKm: city.defaultDistanceKm || '20.00',
      });
      // Load truck-specific pricing
      const res = await fetch(`/api/admin/cities/${cityId}/truck-pricing`, { credentials: 'include' });
      if (res.ok) {
        const pricing: CityTruckPricing[] = await res.json();
        const pricingMap: Record<string, { baseRate: string; hourlyRate: string; perKmRate: string; baseServiceHours: string; includedMovers: string }> = {};
        pricing.forEach(p => {
          pricingMap[p.truckTypeId] = {
            baseRate: p.baseRate,
            hourlyRate: p.hourlyRate,
            perKmRate: p.perKmRate,
            baseServiceHours: p.baseServiceHours || '3.0',
            includedMovers: String(p.includedMovers || 2),
          };
        });
        setTruckPricing(pricingMap);
      }
    } catch (err) {
      console.error('Failed to load truck pricing', err);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveAllPricing = async () => {
    if (!editingCityId) return;
    setIsSaving(true);
    try {
      // Save general pricing
      await fetch(`/api/admin/cities/${editingCityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(generalPricing),
      });

      // Save all truck pricing in parallel
      const truckSavePromises = Object.entries(truckPricing).map(([truckTypeId, data]) => {
        if (!data.baseRate || !data.hourlyRate || !data.perKmRate) return Promise.resolve();
        return fetch(`/api/admin/cities/${editingCityId}/truck-pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            truckTypeId, 
            baseRate: data.baseRate,
            hourlyRate: data.hourlyRate,
            perKmRate: data.perKmRate,
            baseServiceHours: data.baseServiceHours,
            includedMovers: parseInt(data.includedMovers) || 2,
          }),
        });
      });
      
      await Promise.all(truckSavePromises);
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      toast({ title: "Todos los precios guardados" });
    } catch (err) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const { data: cities = [], isLoading } = useQuery<City[]>({
    queryKey: ['cities', selectedCountry],
    queryFn: async () => {
      const url = selectedCountry ? `/api/admin/cities?countryId=${selectedCountry}` : '/api/admin/cities';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load cities');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          baseCostPerKm: data.baseCostPerKm || null,
          baseCostPerItem: data.baseCostPerItem || null,
          laborCostPerHour: data.laborCostPerHour || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add city');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      setIsAddOpen(false);
      setFormData({ countryId: '', name: '', nameEs: '', baseCostPerKm: '', baseCostPerItem: '', laborCostPerHour: '', isActive: true });
      toast({ title: "Ciudad agregada" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<City> }) => {
      const res = await fetch(`/api/admin/cities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update city');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      toast({ title: "Ciudad actualizada" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/cities/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      toast({ title: "Ciudad eliminada" });
    }
  });

  const getCountryInfo = (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    return country ? { name: `${country.code} - ${country.name}`, currency: country.currency, symbol: country.currencySymbol } : { name: 'Unknown', currency: 'MXN', symbol: '$' };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Ciudades</CardTitle>
          <CardDescription>Configura precios específicos por ciudad (override del país)</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCountry || "all"} onValueChange={v => setSelectedCountry(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar por país" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> Agregar Ciudad</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Agregar Ciudad</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Duplicar precios de</Label>
                  <Select 
                    value="none" 
                    onValueChange={v => {
                      if (v !== "none") {
                        const sourceCity = cities.find(c => c.id === v);
                        if (sourceCity) {
                          setFormData(p => ({
                            ...p,
                            countryId: sourceCity.countryId,
                            baseCostPerKm: sourceCity.baseCostPerKm || '',
                            baseCostPerItem: sourceCity.baseCostPerItem || '',
                            laborCostPerHour: sourceCity.laborCostPerHour || '',
                          }));
                        }
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar ciudad existente (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- No duplicar --</SelectItem>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Copia los precios de una ciudad existente</p>
                </div>
                <div>
                  <Label>País</Label>
                  <Select value={formData.countryId} onValueChange={v => setFormData(p => ({...p, countryId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar país..." /></SelectTrigger>
                    <SelectContent>{countries.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nombre (EN)</Label><Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Mexico City" /></div>
                  <div><Label>Nombre (ES)</Label><Input value={formData.nameEs} onChange={e => setFormData(p => ({...p, nameEs: e.target.value}))} placeholder="Ciudad de México" /></div>
                </div>
                <p className="text-xs text-muted-foreground">Precios (dejar vacío para usar precios del país):</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>$/km</Label><Input type="number" step="0.01" value={formData.baseCostPerKm} onChange={e => setFormData(p => ({...p, baseCostPerKm: e.target.value}))} /></div>
                  <div><Label>$/art</Label><Input type="number" step="0.01" value={formData.baseCostPerItem} onChange={e => setFormData(p => ({...p, baseCostPerItem: e.target.value}))} /></div>
                  <div><Label>$/hr</Label><Input type="number" step="0.01" value={formData.laborCostPerHour} onChange={e => setFormData(p => ({...p, laborCostPerHour: e.target.value}))} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <Button onClick={() => addMutation.mutate(formData)} disabled={!formData.countryId || !formData.name}>Agregar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="space-y-3">
            {cities.map(c => {
              const countryInfo = getCountryInfo(c.countryId);
              return (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {c.name} {c.nameEs && c.nameEs !== c.name && <span className="text-muted-foreground">({c.nameEs})</span>}
                      <Badge variant="secondary">{countryInfo.currency}</Badge>
                      {!c.isActive && <Badge variant="outline">Inactiva</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {countryInfo.name}
                      {c.extraMoverRate && ` · +${countryInfo.symbol}${c.extraMoverRate}/cargador`}
                      {c.moverHourlyRate && ` · ${countryInfo.symbol}${c.moverHourlyRate}/hr-carg`}
                      {c.complicatedMoveMultiplier && ` · x${c.complicatedMoveMultiplier} complejo`}
                      {!c.extraMoverRate && !c.moverHourlyRate && !c.complicatedMoveMultiplier && ' · (configurar precios)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingCityId(c.id);
                      setEditingCityName(c.name);
                      setTruckPricing({});
                      loadCityTruckPricing(c.id, c);
                    }}>
                      <DollarSign className="h-4 w-4 mr-1" />
                      Precios
                    </Button>
                    <Switch checked={c.isActive ?? false} onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { isActive: v } })} />
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
            {cities.length === 0 && <p className="text-muted-foreground text-center py-8">No hay ciudades configuradas{selectedCountry && ' para este país'}</p>}
          </div>
        )}

        <Dialog open={!!editingCityId} onOpenChange={(open) => !open && setEditingCityId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Precios - {editingCityName}
              </DialogTitle>
              <DialogDescription>Configure los precios generales y por tipo de camión</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-medium">Precios Generales</span>
                  <Badge variant="secondary">Aplica a todos los camiones</Badge>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground h-8 flex items-end">Cargador Extra ($)</Label>
                    <Input type="number" step="0.01" value={generalPricing.extraMoverRate} onChange={e => setGeneralPricing(p => ({...p, extraMoverRate: e.target.value}))} placeholder="200.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground h-8 flex items-end">$/Hr/Cargador</Label>
                    <Input type="number" step="0.01" value={generalPricing.moverHourlyRate} onChange={e => setGeneralPricing(p => ({...p, moverHourlyRate: e.target.value}))} placeholder="150.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground h-8 flex items-end" title="Factor para mudanzas complicadas">Factor Mov. Complicado</Label>
                    <Input type="number" step="0.01" value={generalPricing.complicatedMoveMultiplier} onChange={e => setGeneralPricing(p => ({...p, complicatedMoveMultiplier: e.target.value}))} placeholder="1.30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground h-8 flex items-end">Distancia Default (km)</Label>
                    <Input type="number" step="0.01" value={generalPricing.defaultDistanceKm} onChange={e => setGeneralPricing(p => ({...p, defaultDistanceKm: e.target.value}))} placeholder="20.00" />
                  </div>
                </div>
              </div>

              {truckTypes.filter(t => t.isActive).map((truck) => {
                const pricing = truckPricing[truck.id] || { 
                  baseRate: '', hourlyRate: '', perKmRate: '',
                  baseServiceHours: '3.0', includedMovers: '2'
                };
                const updateField = (field: string, value: string) => {
                  setTruckPricing(p => ({
                    ...p,
                    [truck.id]: { 
                      baseRate: p[truck.id]?.baseRate || '', 
                      hourlyRate: p[truck.id]?.hourlyRate || '', 
                      perKmRate: p[truck.id]?.perKmRate || '', 
                      baseServiceHours: p[truck.id]?.baseServiceHours || '3.0',
                      includedMovers: p[truck.id]?.includedMovers || '2',
                      [field]: value 
                    }
                  }));
                };
                return (
                  <div key={truck.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="h-5 w-5 text-primary" />
                      <span className="font-medium">{truck.name}</span>
                      <Badge variant="outline">{truck.capacityTons}t · {truck.capacityKg}kg · {truck.capacityM3 || '?'}m³</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Precio Base ($)</Label>
                        <Input type="number" step="0.01" value={pricing.baseRate} onChange={e => updateField('baseRate', e.target.value)} placeholder="1500.00" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Hora Extra ($)</Label>
                        <Input type="number" step="0.01" value={pricing.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} placeholder="200.00" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Por Km ($)</Label>
                        <Input type="number" step="0.01" value={pricing.perKmRate} onChange={e => updateField('perKmRate', e.target.value)} placeholder="8.00" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Horas Base Incluidas</Label>
                        <Input type="number" step="0.5" value={pricing.baseServiceHours} onChange={e => updateField('baseServiceHours', e.target.value)} placeholder="3.0" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Cargadores Incluidos</Label>
                        <Input type="number" step="1" min="1" value={pricing.includedMovers} onChange={e => updateField('includedMovers', e.target.value)} placeholder="2" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {truckTypes.filter(t => t.isActive).length === 0 && (
                <p className="text-muted-foreground text-center py-8">No hay tipos de camión activos. Configure camiones primero en la pestaña "Camiones".</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditingCityId(null)}>Cerrar</Button>
              <Button onClick={saveAllPricing} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Guardando...' : 'Guardar Todo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TruckTypesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [editTruck, setEditTruck] = useState<TruckType | null>(null);

  const { data: trucks = [], isLoading } = useQuery<TruckType[]>({
    queryKey: ['truck-types'],
    queryFn: async () => {
      const res = await fetch('/api/admin/truck-types', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load truck types');
      return res.json();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TruckType> }) => {
      const res = await fetch(`/api/admin/truck-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update truck type');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-types'] });
      setEditTruck(null);
      toast({ title: isSpanish ? "Camión actualizado" : "Truck updated" });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          {isSpanish ? "Tipos de Camión" : "Truck Types"}
        </CardTitle>
        <CardDescription>
          {isSpanish 
            ? "Define los tipos de camión disponibles. Los precios se configuran en cada ciudad."
            : "Define available truck types. Pricing is configured per city."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>{isSpanish ? "Cargando..." : "Loading..."}</p>
        ) : (
          <div className="space-y-4">
            {trucks.map(truck => (
              <div key={truck.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">{isSpanish ? truck.nameEs : truck.name}</span>
                    <Badge variant="outline">{truck.capacityKg} kg</Badge>
                    {truck.capacityM3 && truck.usableVolumeFactor && (
                      <Badge variant="secondary">{(parseFloat(truck.capacityM3) * parseFloat(truck.usableVolumeFactor)).toFixed(1)} m³</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {truck.capacityM3 && (
                      <span>{isSpanish ? "Volumen máx" : "Max volume"}: {parseFloat(truck.capacityM3).toFixed(1)} m³</span>
                    )}
                    <span className="ml-2 text-xs italic">({isSpanish ? "Precios/cargadores/horas se configuran por ciudad" : "Pricing/movers/hours configured per city"})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditTruck(truck)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Switch 
                    checked={truck.isActive ?? false} 
                    onCheckedChange={v => updateMutation.mutate({ id: truck.id, data: { isActive: v } })} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!editTruck} onOpenChange={(open) => !open && setEditTruck(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isSpanish ? "Editar Camión" : "Edit Truck"}</DialogTitle>
              <DialogDescription>
                {isSpanish ? "Configura las especificaciones del camión" : "Configure truck specifications"}
              </DialogDescription>
            </DialogHeader>
            {editTruck && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{isSpanish ? "Nombre (EN)" : "Name (EN)"}</Label>
                    <Input value={editTruck.name} onChange={e => setEditTruck({ ...editTruck, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{isSpanish ? "Nombre (ES)" : "Name (ES)"}</Label>
                    <Input value={editTruck.nameEs} onChange={e => setEditTruck({ ...editTruck, nameEs: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{isSpanish ? "Capacidad (kg)" : "Capacity (kg)"}</Label>
                    <Input type="number" value={editTruck.capacityKg} onChange={e => setEditTruck({ ...editTruck, capacityKg: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>{isSpanish ? "Capacidad (tons)" : "Capacity (tons)"}</Label>
                    <Input type="number" step="0.25" value={editTruck.capacityTons} onChange={e => setEditTruck({ ...editTruck, capacityTons: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-amber-50 p-2 rounded">
                  {isSpanish 
                    ? "💡 Los cargadores, horas base y precios se configuran por ciudad en la pestaña 'Ciudades'." 
                    : "💡 Movers, base hours and pricing are configured per city in the 'Cities' tab."}
                </p>
                
                <div className="border-t pt-4 mt-2">
                  <Label className="text-sm font-semibold mb-3 block">{isSpanish ? "Capacidad de Volumen (m³)" : "Volume Capacity (m³)"}</Label>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">{isSpanish ? "Volumen (m³)" : "Volume (m³)"}</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={editTruck.capacityM3 || ''} 
                        onChange={e => setEditTruck({ ...editTruck, capacityM3: e.target.value || null })} 
                        placeholder="20.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{isSpanish ? "Mínimo" : "Min"}</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={editTruck.capacityM3Low || ''} 
                        onChange={e => setEditTruck({ ...editTruck, capacityM3Low: e.target.value || null })} 
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{isSpanish ? "Máximo" : "Max"}</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={editTruck.capacityM3High || ''} 
                        onChange={e => setEditTruck({ ...editTruck, capacityM3High: e.target.value || null })} 
                        placeholder="23"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{isSpanish ? "Factor útil" : "Usable Factor"}</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={editTruck.usableVolumeFactor || ''} 
                        onChange={e => setEditTruck({ ...editTruck, usableVolumeFactor: e.target.value || null })} 
                        placeholder="0.85"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isSpanish 
                      ? "El factor útil ajusta el volumen real disponible considerando eficiencia de apilamiento"
                      : "Usable factor adjusts real available volume considering stacking efficiency"}
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditTruck(null)}>
                    {isSpanish ? "Cancelar" : "Cancel"}
                  </Button>
                  <Button onClick={() => updateMutation.mutate({ 
                    id: editTruck.id, 
                    data: {
                      name: editTruck.name,
                      nameEs: editTruck.nameEs,
                      capacityKg: editTruck.capacityKg,
                      capacityTons: editTruck.capacityTons,
                      capacityM3: editTruck.capacityM3,
                      capacityM3Low: editTruck.capacityM3Low,
                      capacityM3High: editTruck.capacityM3High,
                    }
                  })}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSpanish ? "Guardar" : "Save"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PricingLogicTab() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {isSpanish ? "Fórmula de Cálculo de Precios" : "Pricing Calculation Formula"}
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Visualización de cómo Clara calcula los costos de mudanza"
              : "Visualization of how Clara calculates moving costs"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-6 space-y-4">
            <div className="text-sm font-mono space-y-3">
              <div className="font-semibold text-lg mb-4">
                {isSpanish ? "1. Cálculo de Peso y Volumen:" : "1. Weight and Volume Calculation:"}
              </div>
              <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">a</Badge>
                  <span>{isSpanish ? "totalWeight = Σ(cantidad × pesoPromedio) de cada artículo" : "totalWeight = Σ(quantity × avgWeight) for each item"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">b</Badge>
                  <span>{isSpanish ? "totalVolume = Σ(cantidad × volumenPromedio) de cada artículo" : "totalVolume = Σ(quantity × avgVolume) for each item"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">c</Badge>
                  <span className="font-semibold text-primary">
                    usableVolume = capacityM3 × usableVolumeFactor (0.85)
                  </span>
                </div>
              </div>

              <div className="font-semibold text-lg mt-6 mb-4">
                {isSpanish ? "2. Selección Óptima de Camiones:" : "2. Optimal Truck Selection:"}
              </div>
              <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  {isSpanish 
                    ? "Prioridad: (1) Menos camiones, (2) Menor capacidad total, (3) Menor costo" 
                    : "Priority: (1) Fewest trucks, (2) Smallest total capacity, (3) Lowest cost"}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/50">a</Badge>
                  <span>{isSpanish ? "Generar flotas candidatas usando algoritmo greedy" : "Generate candidate fleets using greedy algorithm"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/50">b</Badge>
                  <span>{isSpanish ? "Validar que peso Y volumen quepan en la flota" : "Validate both weight AND volume fit in fleet"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/50">c</Badge>
                  <span className="font-semibold text-primary">
                    {isSpanish 
                      ? "Seleccionar flota con menos camiones, luego menor capacidad, luego menor costo" 
                      : "Select fleet with fewest trucks, then smallest capacity, then lowest cost"}
                  </span>
                </div>
              </div>

              <div className="font-semibold text-lg mt-6 mb-4">
                {isSpanish ? "3. Estimación de Tiempo:" : "3. Time Estimation:"}
              </div>
              <div className="pl-4 border-l-2 border-blue-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/50">a</Badge>
                  <span className="font-semibold text-blue-600">
                    maxBaseHours = max(baseServiceHours) {isSpanish ? "de todos los camiones seleccionados" : "from all selected trucks"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/50">b</Badge>
                  <span>{isSpanish ? "extraHours por camión = maxBaseHours - baseServiceHours del camión" : "extraHours per truck = maxBaseHours - truck's baseServiceHours"}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-8">
                  {isSpanish 
                    ? "(Sincroniza camiones con diferentes horas base para terminar juntos)" 
                    : "(Synchronizes trucks with different base hours to finish together)"}
                </div>
              </div>
              
              <div className="font-semibold text-lg mt-6 mb-4">
                {isSpanish ? "4. Cálculo de Costos (por camión):" : "4. Cost Calculation (per truck):"}
              </div>
              <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">a</Badge>
                  <span className="font-semibold text-primary">
                    truckBaseCost = baseRate + (distanceKm × perKmRate)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground ml-8">
                  {isSpanish ? "(baseRate incluye baseServiceHours + includedMovers)" : "(baseRate includes baseServiceHours + includedMovers)"}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">b</Badge>
                  <span className="font-semibold text-primary">
                    truckExtraHoursCost = extraHours × hourlyRate
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">c</Badge>
                  <span className="font-semibold text-primary">
                    moverExtraHoursCost = extraHours × moverHourlyRate × includedMovers
                  </span>
                </div>
                <div className="text-xs text-muted-foreground ml-8">
                  {isSpanish ? "(Costo de mano de obra por horas extra de sincronización)" : "(Labor cost for synchronization extra hours)"}
                </div>
              </div>

              <div className="font-semibold text-lg mt-6 mb-4">
                {isSpanish ? "5. Totales:" : "5. Totals:"}
              </div>
              <div className="pl-4 border-l-2 border-green-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500/50">a</Badge>
                  <span className="font-semibold text-green-600">
                    baseTruckCost = Σ(truckBaseCost) {isSpanish ? "de todos los camiones" : "for all trucks"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500/50">b</Badge>
                  <span className="font-semibold text-green-600">
                    extraHoursCost = Σ(truckExtraHoursCost + moverExtraHoursCost)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500/50">c</Badge>
                  <span className="font-semibold text-green-600">
                    totalLow = baseTruckCost + extraHoursCost
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-orange-500/50">d</Badge>
                  <span className="font-semibold text-action">
                    totalHigh = totalLow × complicatedMoveMultiplier
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>{isSpanish ? "Nota:" : "Note:"}</strong> {isSpanish 
                  ? "Cada tipo de camión tiene su propia tarifa base (baseRate) que incluye las horas base de servicio (baseServiceHours) y los cargadores incluidos (includedMovers)."
                  : "Each truck type has its own base rate (baseRate) which includes base service hours (baseServiceHours) and included movers (includedMovers)."}
              </p>
              <p className="text-sm text-muted-foreground">
                {isSpanish 
                  ? "La distancia se calcula automáticamente con Google Maps. Si no está disponible, se usa el valor de respaldo configurado en la pestaña Respaldo."
                  : "Distance is calculated automatically with Google Maps. If unavailable, the fallback value from the Fallback tab is used."}
              </p>
              <p className="text-sm text-muted-foreground">
                {isSpanish 
                  ? "Las horas extra solo aplican cuando se usan múltiples camiones con diferentes horas base (sincronización)."
                  : "Extra hours only apply when using multiple trucks with different base hours (synchronization)."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {isSpanish ? "Valores por Ciudad" : "City-Based Values"}
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Todos los valores de cálculo se configuran individualmente por ciudad"
              : "All calculation values are configured individually per city"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{isSpanish ? "Precios de Camión (por tipo)" : "Truck Pricing (per type)"}</p>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">baseRate</code>, <code className="text-xs">hourlyRate</code>, <code className="text-xs">perKmRate</code>, <code className="text-xs">baseServiceHours</code>, <code className="text-xs">includedMovers</code>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{isSpanish ? "Mano de Obra (a nivel ciudad)" : "Labor (city level)"}</p>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">moverHourlyRate</code> {isSpanish ? "- tarifa por hora para horas extra de sincronización" : "- hourly rate for synchronization extra hours"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{isSpanish ? "Multiplicadores" : "Multipliers"}</p>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">complicatedMoveMultiplier</code> {isSpanish ? "- para calcular el rango alto" : "- for high range calculation"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{isSpanish ? "Distancia" : "Distance"}</p>
                  <p className="text-sm text-muted-foreground">
                    {isSpanish 
                      ? "Calculada vía Google Maps o valor por defecto de la pestaña Respaldo" 
                      : "Calculated via Google Maps or fallback value from Fallback tab"}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {isSpanish 
                ? "Los precios de camión se configuran en la pestaña Camiones. Los valores de respaldo en la pestaña Respaldo."
                : "Truck pricing is configured in the Trucks tab. Fallback values in the Fallback tab."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {isSpanish ? "Instrucciones de Cálculo para IA" : "AI Calculation Instructions"}
            <Badge variant="secondary" className="ml-2">
              {isSpanish ? "Solo lectura" : "Read-only"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Instrucciones del sistema que Clara usa para calcular estimados de costo. Editar requiere el constructor de la plataforma."
              : "System instructions Clara uses to calculate cost estimates. Editing requires the platform builder."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">{isSpanish ? "A. Estimación por Peso" : "A. Weight-Based Estimation"}</h4>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
{`1. totalWeight = Σ(quantity × avgWeightKg) for all items
2. If totalWeight <= largest truck capacity:
   - Select SMALLEST truck that can carry totalWeight
   - weightBasedTruckCount = 1
3. If totalWeight > largest truck capacity:
   - weightBasedTruckCount = ceil(totalWeight / largestTruckCapacity)
   - Use the largest truck type`}
              </pre>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">{isSpanish ? "B. Estimación por Volumen" : "B. Volume-Based Estimation"}</h4>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
{`1. totalVolume = Σ(quantity × avgVolumeM3) for all items
2. usableVolume = capacityM3 × truck.usableVolumeFactor
   (each truck has its own factor, configurable in Trucks tab)
3. If totalVolume <= largest truck usable volume:
   - Select SMALLEST truck with enough usable volume
   - volumeBasedTruckCount = 1
4. If totalVolume > largest truck usable volume:
   - volumeBasedTruckCount = ceil(totalVolume / largestUsableVolume)
   - Use the largest truck type`}
              </pre>
            </div>

            <div className="border rounded-lg p-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                  {isSpanish ? "C. Selección Final (Conservadora)" : "C. Final Selection (Conservative)"}
                </h4>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
{`truckCount = MAX(weightBasedTruckCount, volumeBasedTruckCount)
- Use whichever estimate requires MORE trucks
- constrainingFactor = 'weight' or 'volume'`}
              </pre>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">{isSpanish ? "D. Fórmula de Costos" : "D. Cost Formula"}</h4>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
{`Variables:
- truckCount = number of trucks needed
- totalMovers = truckCount × truck.includedMovers
- baseServiceHours = truck.baseServiceHours

Cost components:
1. truckBaseCost = truckCount × truck.baseRate
   (baseRate includes: baseServiceHours + includedMovers)
2. extraHoursPerTruck = max(0, estimatedHours - baseServiceHours)
3. extraHoursCost = extraHoursPerTruck × truck.hourlyRate × truckCount
4. distanceCost = distanceKm × truck.perKmRate × truckCount

Final estimate:
- Low = truckBaseCost + extraHoursCost + distanceCost
- High = Low × complicatedMoveMultiplier`}
              </pre>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">{isSpanish ? "E. Formato de Respuesta Requerido" : "E. Required Response Format"}</h4>
              </div>
              <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
{`{
  "message": "Conversational response",
  "newItems": [{ name, room, category, quantity, estimatedWeightKg, estimatedVolumeM3 }],
  "removeItems": [] or "all",
  "truckRecommendation": {
    totalWeightKg, totalVolumeM3, recommendedTruck,
    truckCount, includedMovers, estimatedHours,
    constrainingFactor, weightBasedTruckCount, volumeBasedTruckCount
  },
  "estimatedCost": { low, high, currency },
  "isComplete": false
}`}
              </pre>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  {isSpanish ? "¿Necesitas modificar estas instrucciones?" : "Need to modify these instructions?"}
                </p>
                <p className="mt-1">
                  {isSpanish 
                    ? "Estas instrucciones están integradas en el sistema para garantizar cálculos precisos. Para modificarlas, contacta al equipo de desarrollo de la plataforma."
                    : "These instructions are built into the system to ensure accurate calculations. To modify them, contact the platform development team."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Pricing Defaults Tab - Safety net values used when city/truck config is missing
function PricingDefaultsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";

  const { data: defaults, isLoading } = useQuery({
    queryKey: ['pricing-defaults'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pricing-defaults', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load defaults');
      return res.json();
    }
  });

  const [formData, setFormData] = useState({
    truckBaseRate: '1800.00',
    truckHourlyRate: '300.00',
    truckPerKmRate: '10.00',
    truckBaseServiceHours: '3.0',
    truckIncludedMovers: 2,
    truckUsableVolumeFactor: '0.85',
    moverHourlyRate: '150.00',
    complicatedMoveMultiplier: '1.30',
    defaultDistanceKm: '20.00',
    floorSurchargePercent: '10.00',
    defaultCurrency: 'MXN',
    categoryAvgWeightKg: '20.00',
    categoryAvgVolumeM3: '0.500',
  });

  // Update form when data loads
  useEffect(() => {
    if (defaults) {
      setFormData({
        truckBaseRate: defaults.truckBaseRate || '1800.00',
        truckHourlyRate: defaults.truckHourlyRate || '300.00',
        truckPerKmRate: defaults.truckPerKmRate || '10.00',
        truckBaseServiceHours: defaults.truckBaseServiceHours || '3.0',
        truckIncludedMovers: defaults.truckIncludedMovers ?? 2,
        truckUsableVolumeFactor: defaults.truckUsableVolumeFactor || '0.85',
        moverHourlyRate: defaults.moverHourlyRate || '150.00',
        complicatedMoveMultiplier: defaults.complicatedMoveMultiplier || '1.30',
        defaultDistanceKm: defaults.defaultDistanceKm || '20.00',
        floorSurchargePercent: defaults.floorSurchargePercent || '10.00',
        defaultCurrency: defaults.defaultCurrency || 'MXN',
        categoryAvgWeightKg: defaults.categoryAvgWeightKg || '20.00',
        categoryAvgVolumeM3: defaults.categoryAvgVolumeM3 || '0.500',
      });
    }
  }, [defaults]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/pricing-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update defaults');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-defaults'] });
      toast({ title: isSpanish ? "Valores guardados exitosamente" : "Defaults saved successfully" });
    },
    onError: () => {
      toast({ title: isSpanish ? "Error al guardar" : "Failed to save", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">{isSpanish ? "Cargando..." : "Loading..."}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {isSpanish ? "Valores de Respaldo" : "Fallback Values"}
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Estos valores se usan como red de seguridad cuando no hay configuración específica para una ciudad o camión. La configuración por ciudad/camión siempre tiene prioridad."
              : "These values are used as a safety net when no specific city or truck configuration exists. City/truck-specific configuration always takes priority."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Truck Defaults */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {isSpanish ? "Precios de Camión (Respaldo)" : "Truck Pricing (Fallback)"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{isSpanish ? "Tarifa Base ($)" : "Base Rate ($)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.truckBaseRate}
                  onChange={(e) => setFormData({ ...formData, truckBaseRate: e.target.value })}
                  data-testid="input-truck-base-rate"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Tarifa por Hora ($)" : "Hourly Rate ($)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.truckHourlyRate}
                  onChange={(e) => setFormData({ ...formData, truckHourlyRate: e.target.value })}
                  data-testid="input-truck-hourly-rate"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Tarifa por Km ($)" : "Per Km Rate ($)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.truckPerKmRate}
                  onChange={(e) => setFormData({ ...formData, truckPerKmRate: e.target.value })}
                  data-testid="input-truck-per-km-rate"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Horas Base de Servicio" : "Base Service Hours"}</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.truckBaseServiceHours}
                  onChange={(e) => setFormData({ ...formData, truckBaseServiceHours: e.target.value })}
                  data-testid="input-base-service-hours"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Mudadores Incluidos" : "Included Movers"}</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.truckIncludedMovers}
                  onChange={(e) => setFormData({ ...formData, truckIncludedMovers: parseInt(e.target.value) || 0 })}
                  data-testid="input-included-movers"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Factor Volumen Usable" : "Usable Volume Factor"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.truckUsableVolumeFactor}
                  onChange={(e) => setFormData({ ...formData, truckUsableVolumeFactor: e.target.value })}
                  data-testid="input-usable-volume-factor"
                />
              </div>
            </div>
          </div>

          {/* City Defaults */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {isSpanish ? "Configuración de Ciudad (Respaldo)" : "City Configuration (Fallback)"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{isSpanish ? "Tarifa Mudador por Hora ($)" : "Mover Hourly Rate ($)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.moverHourlyRate}
                  onChange={(e) => setFormData({ ...formData, moverHourlyRate: e.target.value })}
                  data-testid="input-mover-hourly-rate"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Multiplicador Mudanza Complicada" : "Complicated Move Multiplier"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.complicatedMoveMultiplier}
                  onChange={(e) => setFormData({ ...formData, complicatedMoveMultiplier: e.target.value })}
                  data-testid="input-complicated-multiplier"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Distancia Predeterminada (km)" : "Default Distance (km)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.defaultDistanceKm}
                  onChange={(e) => setFormData({ ...formData, defaultDistanceKm: e.target.value })}
                  data-testid="input-default-distance"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Recargo por Piso (%)" : "Floor Surcharge (%)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.floorSurchargePercent}
                  onChange={(e) => setFormData({ ...formData, floorSurchargePercent: e.target.value })}
                  data-testid="input-floor-surcharge"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Moneda Predeterminada" : "Default Currency"}</Label>
                <Select 
                  value={formData.defaultCurrency} 
                  onValueChange={(val) => setFormData({ ...formData, defaultCurrency: val })}
                >
                  <SelectTrigger data-testid="select-default-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Inventory Defaults */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {isSpanish ? "Inventario (Respaldo)" : "Inventory (Fallback)"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{isSpanish ? "Peso Promedio por Categoría (kg)" : "Avg Category Weight (kg)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.categoryAvgWeightKg}
                  onChange={(e) => setFormData({ ...formData, categoryAvgWeightKg: e.target.value })}
                  data-testid="input-category-weight"
                />
              </div>
              <div>
                <Label>{isSpanish ? "Volumen Promedio por Categoría (m³)" : "Avg Category Volume (m³)"}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.categoryAvgVolumeM3}
                  onChange={(e) => setFormData({ ...formData, categoryAvgVolumeM3: e.target.value })}
                  data-testid="input-category-volume"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending}
              data-testid="button-save-defaults"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending 
                ? (isSpanish ? "Guardando..." : "Saving...") 
                : (isSpanish ? "Guardar Cambios" : "Save Changes")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPricing() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            {isSpanish ? "Configuración de Precios" : "Pricing Configuration"}
          </h2>
          <p className="text-muted-foreground">
            {isSpanish 
              ? "Configura precios por ciudad y tipos de camión. Cada ciudad hereda la moneda de su país."
              : "Configure pricing by city and truck types. Each city inherits currency from its country."}
          </p>
        </div>

        <Tabs defaultValue="cities" className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="cities" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {isSpanish ? "Ciudades" : "Cities"}
            </TabsTrigger>
            <TabsTrigger value="trucks" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {isSpanish ? "Camiones" : "Trucks"}
            </TabsTrigger>
            <TabsTrigger value="logic" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {isSpanish ? "Lógica" : "Logic"}
            </TabsTrigger>
            <TabsTrigger value="defaults" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              {isSpanish ? "Respaldo" : "Fallback"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cities"><CitiesTab /></TabsContent>
          <TabsContent value="trucks"><TruckTypesTab /></TabsContent>
          <TabsContent value="logic"><PricingLogicTab /></TabsContent>
          <TabsContent value="defaults"><PricingDefaultsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
