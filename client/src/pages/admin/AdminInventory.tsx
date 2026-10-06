import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  Save, Plus, Trash2, Home, Sparkles, Package, Loader2, Layers, X, Tags, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PresetInventorySet {
  id: string;
  key: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
  homeSize: string;
  sortOrder: number;
  isActive: boolean;
  generatedViaAi: boolean | null;
  items?: PresetInventoryItem[];
}

interface PresetInventoryItem {
  id: string;
  presetSetId: string;
  itemName: string;
  itemNameEs: string;
  roomKey: string;
  categoryKey: string;
  defaultQuantity: number;
  sortOrder: number | null;
}

interface InventoryCategory {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  description: string | null;
  icon: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
  avgWeightKg: string | null;
  minWeightKg: string | null;
  maxWeightKg: string | null;
  avgVolumeM3: string | null;
  minVolumeM3: string | null;
  maxVolumeM3: string | null;
  estDensityKgPerM3: string | null;
}

interface InventoryRoom {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  sortOrder: number | null;
  isActive: boolean | null;
}

interface CategoryKeyword {
  id: string;
  categoryKey: string;
  keyword: string;
  language: string;
  priority: number | null;
  isActive: boolean | null;
}

interface RoomKeyword {
  id: string;
  roomKey: string;
  keyword: string;
  language: string;
  priority: number | null;
  isActive: boolean | null;
}

function InventoryCategoriesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [newCategory, setNewCategory] = useState({ key: '', labelEs: '', labelEn: '', description: '' });
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [weightForm, setWeightForm] = useState({ 
    avgWeightKg: '', minWeightKg: '', maxWeightKg: '',
    avgVolumeM3: '', minVolumeM3: '', maxVolumeM3: '', estDensityKgPerM3: ''
  });

  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<InventoryCategory>) => {
      const res = await fetch('/api/admin/inventory-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      setNewCategory({ key: '', labelEs: '', labelEn: '', description: '' });
      toast({ title: isSpanish ? "Categoría agregada" : "Category added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/inventory-categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      toast({ title: isSpanish ? "Categoría eliminada" : "Category deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryCategory> }) => {
      const res = await fetch(`/api/admin/inventory-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      setEditDialogOpen(false);
      setEditingCategory(null);
      toast({ title: isSpanish ? "Especificaciones actualizadas" : "Specifications updated" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/inventory-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
    },
  });

  const openEditDialog = (cat: InventoryCategory) => {
    setEditingCategory(cat);
    setWeightForm({
      avgWeightKg: cat.avgWeightKg || '',
      minWeightKg: cat.minWeightKg || '',
      maxWeightKg: cat.maxWeightKg || '',
      avgVolumeM3: cat.avgVolumeM3 || '',
      minVolumeM3: cat.minVolumeM3 || '',
      maxVolumeM3: cat.maxVolumeM3 || '',
      estDensityKgPerM3: cat.estDensityKgPerM3 || ''
    });
    setEditDialogOpen(true);
  };

  const saveSpecs = () => {
    if (!editingCategory) return;
    const parseVal = (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : String(num);
    };
    
    updateMutation.mutate({
      id: editingCategory.id,
      data: {
        avgWeightKg: parseVal(weightForm.avgWeightKg),
        minWeightKg: parseVal(weightForm.minWeightKg),
        maxWeightKg: parseVal(weightForm.maxWeightKg),
        avgVolumeM3: parseVal(weightForm.avgVolumeM3),
        minVolumeM3: parseVal(weightForm.minVolumeM3),
        maxVolumeM3: parseVal(weightForm.maxVolumeM3),
        estDensityKgPerM3: parseVal(weightForm.estDensityKgPerM3)
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          {isSpanish ? "Categorías de Inventario" : "Inventory Categories"}
        </CardTitle>
        <CardDescription>
          {isSpanish 
            ? "Lista de tipos de artículos con sus pesos para calcular el camión necesario" 
            : "List of item types with weights for truck calculation"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{isSpanish ? "Clave" : "Key"}</Label>
            <Input
              placeholder="sofas"
              value={newCategory.key}
              onChange={(e) => setNewCategory(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
            />
          </div>
          <div>
            <Label className="text-xs">{isSpanish ? "Nombre (ES)" : "Name (ES)"}</Label>
            <Input
              placeholder="Sofás"
              value={newCategory.labelEs}
              onChange={(e) => setNewCategory(p => ({ ...p, labelEs: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">{isSpanish ? "Descripción" : "Description"}</Label>
            <Input
              placeholder={isSpanish ? "Sofás, sillones..." : "Sofas, armchairs..."}
              value={newCategory.description}
              onChange={(e) => setNewCategory(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            onClick={() => addMutation.mutate({ 
              ...newCategory, 
              labelEn: newCategory.labelEs, 
              isActive: true,
              sortOrder: categories.length + 1
            })}
            disabled={!newCategory.key || !newCategory.labelEs}
          >
            <Plus className="h-4 w-4 mr-1" /> {isSpanish ? "Agregar" : "Add"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2 w-12">{isSpanish ? "Activo" : "Active"}</th>
                <th className="p-2">{isSpanish ? "Categoría" : "Category"}</th>
                <th className="p-2 text-center">{isSpanish ? "Peso (kg)" : "Weight (kg)"}</th>
                <th className="p-2 text-center">{isSpanish ? "Volumen (m³)" : "Volume (m³)"}</th>
                <th className="p-2 text-center">{isSpanish ? "Densidad" : "Density"}</th>
                <th className="p-2 w-24">{isSpanish ? "Acciones" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50">
                  <td className="p-2">
                    <Switch
                      checked={cat.isActive ?? true}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: cat.id, isActive: v })}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{cat.labelEs}</div>
                    <div className="text-xs text-slate-500">{cat.description}</div>
                  </td>
                  <td className="p-2 text-center">
                    <div className="font-medium">{cat.avgWeightKg ? `${parseFloat(cat.avgWeightKg).toFixed(0)}` : '-'}</div>
                    <div className="text-xs text-slate-400">
                      {cat.minWeightKg && cat.maxWeightKg 
                        ? `${parseFloat(cat.minWeightKg).toFixed(0)}-${parseFloat(cat.maxWeightKg).toFixed(0)}` 
                        : ''}
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <div className="font-medium">{cat.avgVolumeM3 ? parseFloat(cat.avgVolumeM3).toFixed(2) : '-'}</div>
                    <div className="text-xs text-slate-400">
                      {cat.minVolumeM3 && cat.maxVolumeM3 
                        ? `${parseFloat(cat.minVolumeM3).toFixed(2)}-${parseFloat(cat.maxVolumeM3).toFixed(2)}` 
                        : ''}
                    </div>
                  </td>
                  <td className="p-2 text-center text-slate-500">
                    {cat.estDensityKgPerM3 ? `${parseFloat(cat.estDensityKgPerM3).toFixed(1)}` : '-'}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(cat)}
                        title={isSpanish ? "Editar especificaciones" : "Edit specs"}
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(cat.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isSpanish ? "Editar Especificaciones" : "Edit Specifications"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory?.labelEs}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isSpanish ? "Peso (kg)" : "Weight (kg)"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Promedio" : "Average"}</Label>
                    <Input
                      type="number"
                      value={weightForm.avgWeightKg}
                      onChange={(e) => setWeightForm(p => ({ ...p, avgWeightKg: e.target.value }))}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Mínimo" : "Minimum"}</Label>
                    <Input
                      type="number"
                      value={weightForm.minWeightKg}
                      onChange={(e) => setWeightForm(p => ({ ...p, minWeightKg: e.target.value }))}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Máximo" : "Maximum"}</Label>
                    <Input
                      type="number"
                      value={weightForm.maxWeightKg}
                      onChange={(e) => setWeightForm(p => ({ ...p, maxWeightKg: e.target.value }))}
                      placeholder="80"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isSpanish ? "Volumen (m³)" : "Volume (m³)"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Promedio" : "Average"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={weightForm.avgVolumeM3}
                      onChange={(e) => setWeightForm(p => ({ ...p, avgVolumeM3: e.target.value }))}
                      placeholder="1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Mínimo" : "Minimum"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={weightForm.minVolumeM3}
                      onChange={(e) => setWeightForm(p => ({ ...p, minVolumeM3: e.target.value }))}
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{isSpanish ? "Máximo" : "Maximum"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={weightForm.maxVolumeM3}
                      onChange={(e) => setWeightForm(p => ({ ...p, maxVolumeM3: e.target.value }))}
                      placeholder="2.0"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isSpanish ? "Densidad Estimada (kg/m³)" : "Estimated Density (kg/m³)"}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weightForm.estDensityKgPerM3}
                  onChange={(e) => setWeightForm(p => ({ ...p, estDensityKgPerM3: e.target.value }))}
                  placeholder="25.0"
                  className="w-32"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {isSpanish ? "Cancelar" : "Cancel"}
              </Button>
              <Button onClick={saveSpecs} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {isSpanish ? "Guardar" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function InventoryRoomsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [newRoom, setNewRoom] = useState({ key: '', labelEs: '', labelEn: '' });

  const { data: rooms = [] } = useQuery<InventoryRoom[]>({
    queryKey: ['inventory-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-rooms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load rooms');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<InventoryRoom>) => {
      const res = await fetch('/api/admin/inventory-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add room');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-rooms'] });
      setNewRoom({ key: '', labelEs: '', labelEn: '' });
      toast({ title: isSpanish ? "Habitación agregada" : "Room added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/inventory-rooms/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete room');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-rooms'] });
      toast({ title: isSpanish ? "Habitación eliminada" : "Room deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/inventory-rooms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update room');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-rooms'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          {isSpanish ? "Habitaciones" : "Rooms"}
        </CardTitle>
        <CardDescription>
          {isSpanish 
            ? "Lista de habitaciones para organizar el inventario" 
            : "List of rooms to organize inventory"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{isSpanish ? "Clave" : "Key"}</Label>
            <Input
              placeholder="sala"
              value={newRoom.key}
              onChange={(e) => setNewRoom(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
            />
          </div>
          <div>
            <Label className="text-xs">{isSpanish ? "Nombre (ES)" : "Name (ES)"}</Label>
            <Input
              placeholder="Sala"
              value={newRoom.labelEs}
              onChange={(e) => setNewRoom(p => ({ ...p, labelEs: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">{isSpanish ? "Nombre (EN)" : "Name (EN)"}</Label>
            <Input
              placeholder="Living Room"
              value={newRoom.labelEn}
              onChange={(e) => setNewRoom(p => ({ ...p, labelEn: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            onClick={() => addMutation.mutate({ 
              ...newRoom, 
              isActive: true,
              sortOrder: rooms.length + 1
            })}
            disabled={!newRoom.key || !newRoom.labelEs}
          >
            <Plus className="h-4 w-4 mr-1" /> {isSpanish ? "Agregar" : "Add"}
          </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-auto">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Switch
                checked={room.isActive ?? true}
                onCheckedChange={(v) => toggleMutation.mutate({ id: room.id, isActive: v })}
              />
              <Badge variant="outline" className="font-mono text-xs">{room.key}</Badge>
              <span className="font-medium flex-1">{room.labelEs}</span>
              <span className="text-sm text-slate-500">{room.labelEn}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-500 hover:text-red-700"
                onClick={() => deleteMutation.mutate(room.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PresetInventoriesManager() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [viewItemsPreset, setViewItemsPreset] = useState<PresetInventorySet | null>(null);
  const [editingPreset, setEditingPreset] = useState<PresetInventorySet | null>(null);
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState({ key: '', titleEs: '', titleEn: '', descriptionEs: '', descriptionEn: '' });

  const { data: presets = [], isLoading } = useQuery<PresetInventorySet[]>({
    queryKey: ['admin-preset-inventories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/preset-inventories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load presets');
      return res.json();
    }
  });

  const { data: presetDetails, refetch: refetchPresetDetails } = useQuery<PresetInventorySet>({
    queryKey: ['admin-preset-details', viewItemsPreset?.id],
    queryFn: async () => {
      if (!viewItemsPreset?.id) return null;
      const res = await fetch(`/api/admin/preset-inventories/${viewItemsPreset.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load preset details');
      return res.json();
    },
    enabled: !!viewItemsPreset?.id
  });

  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    }
  });

  const { data: rooms = [] } = useQuery<InventoryRoom[]>({
    queryKey: ['inventory-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-rooms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load rooms');
      return res.json();
    }
  });

  const createPresetMutation = useMutation({
    mutationFn: async (data: typeof newPreset) => {
      const res = await fetch('/api/admin/preset-inventories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          homeSize: data.key,
          sortOrder: presets.length + 1,
          isActive: true,
          generatedViaAi: false
        })
      });
      if (!res.ok) throw new Error('Failed to create preset');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preset-inventories'] });
      setShowAddPreset(false);
      setNewPreset({ key: '', titleEs: '', titleEn: '', descriptionEs: '', descriptionEn: '' });
      toast({ title: isSpanish ? "Preset creado" : "Preset created" });
    },
    onError: () => {
      toast({ title: isSpanish ? "Error al crear preset" : "Failed to create preset", variant: "destructive" });
    }
  });

  const updatePresetMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PresetInventorySet> }) => {
      const res = await fetch(`/api/admin/preset-inventories/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.updates)
      });
      if (!res.ok) throw new Error('Failed to update preset');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preset-inventories'] });
      setEditingPreset(null);
      toast({ title: isSpanish ? "Preset actualizado" : "Preset updated" });
    },
    onError: () => {
      toast({ title: isSpanish ? "Error al actualizar" : "Failed to update", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/preset-inventories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete preset');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preset-inventories'] });
      toast({ title: isSpanish ? "Preset eliminado" : "Preset deleted" });
    },
    onError: () => {
      toast({ title: isSpanish ? "Error al eliminar" : "Failed to delete", variant: "destructive" });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: string; updates: Partial<PresetInventoryItem> }) => {
      const res = await fetch(`/api/admin/preset-inventory-items/${data.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.updates)
      });
      if (!res.ok) throw new Error('Failed to update item');
      return res.json();
    },
    onSuccess: () => {
      refetchPresetDetails();
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/admin/preset-inventory-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete item');
      return res.json();
    },
    onSuccess: () => {
      refetchPresetDetails();
      toast({ title: isSpanish ? "Artículo eliminado" : "Item deleted" });
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: Partial<PresetInventoryItem>) => {
      const res = await fetch('/api/admin/preset-inventory-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to add item');
      return res.json();
    },
    onSuccess: () => {
      refetchPresetDetails();
      toast({ title: isSpanish ? "Artículo agregado" : "Item added" });
    }
  });

  const [newItem, setNewItem] = useState({ itemName: '', itemNameEs: '', roomKey: '', categoryKey: '', defaultQuantity: 1 });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                {isSpanish ? "Presets por Tamaño de Hogar" : "Presets by Home Size"}
              </CardTitle>
              <CardDescription>
                {isSpanish 
                  ? "Inventarios sugeridos que aparecen como opciones rápidas en Clara" 
                  : "Suggested inventories that appear as quick-select options in Clara"}
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowAddPreset(true)}
              className="bg-action hover:bg-action/90"
              data-testid="btn-add-preset"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSpanish ? "Agregar Preset" : "Add Preset"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-action" />
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium mb-2">
                {isSpanish ? "No hay presets creados" : "No presets created"}
              </p>
              <p className="text-sm mb-4">
                {isSpanish 
                  ? "Crea plantillas de inventario para diferentes tamaños de hogar" 
                  : "Create inventory templates for different home sizes"}
              </p>
              <Button onClick={() => setShowAddPreset(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                {isSpanish ? "Crear Primer Preset" : "Create First Preset"}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isSpanish ? "Clave" : "Key"}</TableHead>
                  <TableHead>{isSpanish ? "Nombre (ES)" : "Name (ES)"}</TableHead>
                  <TableHead>{isSpanish ? "Nombre (EN)" : "Name (EN)"}</TableHead>
                  <TableHead className="text-center">{isSpanish ? "Activo" : "Active"}</TableHead>
                  <TableHead className="text-right">{isSpanish ? "Acciones" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presets.sort((a, b) => a.sortOrder - b.sortOrder).map((preset) => (
                  <TableRow key={preset.id} data-testid={`row-preset-${preset.key}`}>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-mono">
                        {preset.key}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{preset.titleEs}</TableCell>
                    <TableCell>{preset.titleEn}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={preset.isActive}
                        onCheckedChange={(checked) => updatePresetMutation.mutate({ id: preset.id, updates: { isActive: checked } })}
                        data-testid={`switch-active-${preset.key}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewItemsPreset(preset)}
                          data-testid={`btn-edit-${preset.key}`}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          {isSpanish ? "Editar Items" : "Edit Items"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(isSpanish ? "¿Eliminar este preset y todos sus artículos?" : "Delete this preset and all its items?")) {
                              deleteMutation.mutate(preset.id);
                            }
                          }}
                          data-testid={`btn-delete-${preset.key}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddPreset} onOpenChange={setShowAddPreset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isSpanish ? "Agregar Nuevo Preset" : "Add New Preset"}</DialogTitle>
            <DialogDescription>
              {isSpanish ? "Crea una plantilla de inventario para un tamaño de hogar" : "Create an inventory template for a home size"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isSpanish ? "Clave única" : "Unique key"}</Label>
                <Input
                  placeholder="5br"
                  value={newPreset.key}
                  onChange={(e) => setNewPreset(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                />
              </div>
              <div>
                <Label>{isSpanish ? "Nombre (ES)" : "Name (ES)"}</Label>
                <Input
                  placeholder="5 Recámaras"
                  value={newPreset.titleEs}
                  onChange={(e) => setNewPreset(p => ({ ...p, titleEs: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{isSpanish ? "Nombre (EN)" : "Name (EN)"}</Label>
              <Input
                placeholder="5 Bedrooms"
                value={newPreset.titleEn}
                onChange={(e) => setNewPreset(p => ({ ...p, titleEn: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isSpanish ? "Descripción (ES)" : "Description (ES)"}</Label>
              <Input
                placeholder={isSpanish ? "Inventario típico para casa de 5 recámaras" : "Typical inventory for a 5-bedroom home"}
                value={newPreset.descriptionEs}
                onChange={(e) => setNewPreset(p => ({ ...p, descriptionEs: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPreset(false)}>
              {isSpanish ? "Cancelar" : "Cancel"}
            </Button>
            <Button 
              onClick={() => createPresetMutation.mutate(newPreset)}
              disabled={!newPreset.key || !newPreset.titleEs || !newPreset.titleEn}
            >
              {isSpanish ? "Crear Preset" : "Create Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewItemsPreset} onOpenChange={(open) => !open && setViewItemsPreset(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {viewItemsPreset && (isSpanish ? viewItemsPreset.titleEs : viewItemsPreset.titleEn)}
              <Badge variant="outline" className="ml-2 font-mono">{viewItemsPreset?.key}</Badge>
            </DialogTitle>
            <DialogDescription>
              {viewItemsPreset && (isSpanish ? viewItemsPreset.descriptionEs : viewItemsPreset.descriptionEn)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <p className="text-sm font-medium text-slate-700">{isSpanish ? "Agregar nuevo artículo:" : "Add new item:"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
              <div>
                <Label className="text-xs">{isSpanish ? "Nombre ES" : "Name ES"}</Label>
                <Input
                  placeholder="Sofá"
                  value={newItem.itemNameEs}
                  onChange={(e) => setNewItem(p => ({ ...p, itemNameEs: e.target.value, itemName: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">{isSpanish ? "Nombre EN" : "Name EN"}</Label>
                <Input
                  placeholder="Sofa"
                  value={newItem.itemName}
                  onChange={(e) => setNewItem(p => ({ ...p, itemName: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">{isSpanish ? "Habitación" : "Room"}</Label>
                <select
                  value={newItem.roomKey}
                  onChange={(e) => setNewItem(p => ({ ...p, roomKey: e.target.value }))}
                  className="h-8 w-full text-sm border rounded-md px-2"
                >
                  <option value="">{isSpanish ? "Seleccionar" : "Select"}</option>
                  {rooms.filter(r => r.isActive).map(r => (
                    <option key={r.key} value={r.key}>{r.labelEs}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{isSpanish ? "Categoría" : "Category"}</Label>
                <select
                  value={newItem.categoryKey}
                  onChange={(e) => setNewItem(p => ({ ...p, categoryKey: e.target.value }))}
                  className="h-8 w-full text-sm border rounded-md px-2"
                >
                  <option value="">{isSpanish ? "Seleccionar" : "Select"}</option>
                  {categories.filter(c => c.isActive).map(c => (
                    <option key={c.key} value={c.key}>{c.labelEs}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{isSpanish ? "Cantidad" : "Qty"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={newItem.defaultQuantity}
                  onChange={(e) => setNewItem(p => ({ ...p, defaultQuantity: parseInt(e.target.value) || 1 }))}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                className="h-8"
                disabled={!newItem.itemNameEs || !newItem.roomKey || !newItem.categoryKey}
                onClick={() => {
                  if (viewItemsPreset) {
                    addItemMutation.mutate({
                      presetSetId: viewItemsPreset.id,
                      ...newItem,
                      sortOrder: (presetDetails?.items?.length || 0) + 1
                    });
                    setNewItem({ itemName: '', itemNameEs: '', roomKey: '', categoryKey: '', defaultQuantity: 1 });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {presetDetails?.items && presetDetails.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isSpanish ? "Artículo" : "Item"}</TableHead>
                    <TableHead>{isSpanish ? "Habitación" : "Room"}</TableHead>
                    <TableHead>{isSpanish ? "Categoría" : "Category"}</TableHead>
                    <TableHead className="text-center w-20">{isSpanish ? "Cantidad" : "Qty"}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presetDetails.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {isSpanish ? item.itemNameEs : item.itemName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.roomKey}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.categoryKey}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={1}
                          value={item.defaultQuantity}
                          onChange={(e) => updateItemMutation.mutate({
                            itemId: item.id,
                            updates: { defaultQuantity: parseInt(e.target.value) || 1 }
                          })}
                          className="h-7 w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>{isSpanish ? "No hay artículos en este preset" : "No items in this preset"}</p>
                <p className="text-sm">{isSpanish ? "Agrega artículos usando el formulario de arriba" : "Add items using the form above"}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-slate-500">
                {presetDetails?.items?.length || 0} {isSpanish ? "artículos" : "items"}
              </span>
              <Button variant="outline" onClick={() => setViewItemsPreset(null)}>
                {isSpanish ? "Cerrar" : "Close"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KeywordsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({});
  const [newCategoryKeyword, setNewCategoryKeyword] = useState<{ categoryKey: string; keyword: string; language: string }>({ categoryKey: '', keyword: '', language: 'es' });
  const [newRoomKeyword, setNewRoomKeyword] = useState<{ roomKey: string; keyword: string; language: string }>({ roomKey: '', keyword: '', language: 'es' });

  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    }
  });

  const { data: rooms = [] } = useQuery<InventoryRoom[]>({
    queryKey: ['inventory-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory-rooms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load rooms');
      return res.json();
    }
  });

  const { data: categoryKeywords = [] } = useQuery<CategoryKeyword[]>({
    queryKey: ['category-keywords'],
    queryFn: async () => {
      const res = await fetch('/api/admin/category-keywords', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load category keywords');
      return res.json();
    }
  });

  const { data: roomKeywords = [] } = useQuery<RoomKeyword[]>({
    queryKey: ['room-keywords'],
    queryFn: async () => {
      const res = await fetch('/api/admin/room-keywords', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load room keywords');
      return res.json();
    }
  });

  const addCategoryKeywordMutation = useMutation({
    mutationFn: async (data: { categoryKey: string; keyword: string; language: string }) => {
      const res = await fetch('/api/admin/category-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, priority: 10, isActive: true }),
      });
      if (!res.ok) throw new Error('Failed to add keyword');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-keywords'] });
      setNewCategoryKeyword({ categoryKey: '', keyword: '', language: 'es' });
      toast({ title: isSpanish ? "Palabra clave agregada" : "Keyword added" });
    },
  });

  const deleteCategoryKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/category-keywords/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete keyword');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-keywords'] });
      toast({ title: isSpanish ? "Palabra clave eliminada" : "Keyword deleted" });
    },
  });

  const addRoomKeywordMutation = useMutation({
    mutationFn: async (data: { roomKey: string; keyword: string; language: string }) => {
      const res = await fetch('/api/admin/room-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, priority: 10, isActive: true }),
      });
      if (!res.ok) throw new Error('Failed to add keyword');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-keywords'] });
      setNewRoomKeyword({ roomKey: '', keyword: '', language: 'es' });
      toast({ title: isSpanish ? "Palabra clave agregada" : "Keyword added" });
    },
  });

  const deleteRoomKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/room-keywords/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete keyword');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-keywords'] });
      toast({ title: isSpanish ? "Palabra clave eliminada" : "Keyword deleted" });
    },
  });

  const getKeywordsForCategory = (categoryKey: string) => 
    categoryKeywords.filter(k => k.categoryKey === categoryKey);
  
  const getKeywordsForRoom = (roomKey: string) =>
    roomKeywords.filter(k => k.roomKey === roomKey);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            {isSpanish ? "Palabras Clave de Categorías" : "Category Keywords"}
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Palabras que se usan para inferir la categoría de un artículo al procesar archivos CSV o documentos" 
              : "Words used to infer item category when processing CSV files or documents"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>{isSpanish ? "Categoría" : "Category"}</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newCategoryKeyword.categoryKey}
                onChange={(e) => setNewCategoryKeyword(prev => ({ ...prev, categoryKey: e.target.value }))}
              >
                <option value="">{isSpanish ? "Seleccionar..." : "Select..."}</option>
                {categories.map(cat => (
                  <option key={cat.key} value={cat.key}>{isSpanish ? cat.labelEs : cat.labelEn}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Label>{isSpanish ? "Palabra clave" : "Keyword"}</Label>
              <Input 
                placeholder={isSpanish ? "ej: refrigerador" : "e.g., refrigerator"}
                value={newCategoryKeyword.keyword}
                onChange={(e) => setNewCategoryKeyword(prev => ({ ...prev, keyword: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <Label>{isSpanish ? "Idioma" : "Language"}</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newCategoryKeyword.language}
                onChange={(e) => setNewCategoryKeyword(prev => ({ ...prev, language: e.target.value }))}
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Button 
              onClick={() => addCategoryKeywordMutation.mutate(newCategoryKeyword)}
              disabled={!newCategoryKeyword.categoryKey || !newCategoryKeyword.keyword || addCategoryKeywordMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              {isSpanish ? "Agregar" : "Add"}
            </Button>
          </div>

          <div className="space-y-2">
            {categories.map(cat => {
              const keywords = getKeywordsForCategory(cat.key);
              const isOpen = openCategories[cat.key] ?? false;
              return (
                <Collapsible key={cat.key} open={isOpen} onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [cat.key]: open }))}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="font-medium">{isSpanish ? cat.labelEs : cat.labelEn}</span>
                        <Badge variant="secondary">{keywords.length}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {keywords.map(kw => (
                        <Badge key={kw.id} variant="outline" className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">{kw.language.toUpperCase()}</span>
                          {kw.keyword}
                          <button 
                            onClick={() => deleteCategoryKeywordMutation.mutate(kw.id)}
                            className="ml-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {keywords.length === 0 && (
                        <span className="text-sm text-slate-400">{isSpanish ? "Sin palabras clave" : "No keywords"}</span>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {isSpanish ? "Palabras Clave de Habitaciones" : "Room Keywords"}
          </CardTitle>
          <CardDescription>
            {isSpanish 
              ? "Palabras que se usan para inferir la habitación de un artículo al procesar archivos CSV o documentos" 
              : "Words used to infer item room when processing CSV files or documents"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>{isSpanish ? "Habitación" : "Room"}</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newRoomKeyword.roomKey}
                onChange={(e) => setNewRoomKeyword(prev => ({ ...prev, roomKey: e.target.value }))}
              >
                <option value="">{isSpanish ? "Seleccionar..." : "Select..."}</option>
                {rooms.map(room => (
                  <option key={room.key} value={room.key}>{isSpanish ? room.labelEs : room.labelEn}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Label>{isSpanish ? "Palabra clave" : "Keyword"}</Label>
              <Input 
                placeholder={isSpanish ? "ej: living" : "e.g., living"}
                value={newRoomKeyword.keyword}
                onChange={(e) => setNewRoomKeyword(prev => ({ ...prev, keyword: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <Label>{isSpanish ? "Idioma" : "Language"}</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newRoomKeyword.language}
                onChange={(e) => setNewRoomKeyword(prev => ({ ...prev, language: e.target.value }))}
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Button 
              onClick={() => addRoomKeywordMutation.mutate(newRoomKeyword)}
              disabled={!newRoomKeyword.roomKey || !newRoomKeyword.keyword || addRoomKeywordMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              {isSpanish ? "Agregar" : "Add"}
            </Button>
          </div>

          <div className="space-y-2">
            {rooms.map(room => {
              const keywords = getKeywordsForRoom(room.key);
              const isOpen = openRooms[room.key] ?? false;
              return (
                <Collapsible key={room.key} open={isOpen} onOpenChange={(open) => setOpenRooms(prev => ({ ...prev, [room.key]: open }))}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="font-medium">{isSpanish ? room.labelEs : room.labelEn}</span>
                        <Badge variant="secondary">{keywords.length}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {keywords.map(kw => (
                        <Badge key={kw.id} variant="outline" className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">{kw.language.toUpperCase()}</span>
                          {kw.keyword}
                          <button 
                            onClick={() => deleteRoomKeywordMutation.mutate(kw.id)}
                            className="ml-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {keywords.length === 0 && (
                        <span className="text-sm text-slate-400">{isSpanish ? "Sin palabras clave" : "No keywords"}</span>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminInventory() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {isSpanish ? "Gestión de Inventario" : "Inventory Management"}
          </h1>
          <p className="text-slate-500">
            {isSpanish 
              ? "Configura categorías, habitaciones y presets de inventario" 
              : "Configure categories, rooms, and inventory presets"}
          </p>
        </div>

        <Tabs defaultValue="presets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="presets" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Presets" : "Presets"}</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Categorías" : "Categories"}</span>
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Habitaciones" : "Rooms"}</span>
            </TabsTrigger>
            <TabsTrigger value="keywords" className="gap-2">
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Keywords" : "Keywords"}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-6">
            <PresetInventoriesManager />
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <InventoryCategoriesManager />
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6">
            <InventoryRoomsManager />
          </TabsContent>

          <TabsContent value="keywords" className="space-y-6">
            <KeywordsManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
