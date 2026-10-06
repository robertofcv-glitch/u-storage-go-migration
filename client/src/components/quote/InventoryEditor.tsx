import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Trash2, RefreshCw, Lock, Loader2, Minus, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface InventoryItem {
  id: string;
  quoteId: string;
  itemName: string;
  category: string | null;
  room: string | null;
  quantity: number;
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

interface InventoryEditorProps {
  quoteId: string;
  items: InventoryItem[];
  isLocked: boolean;
  onItemsChange?: () => void;
  onRecalculate?: () => void;
  defaultCollapsed?: boolean;
  /** Draft mode is used by review workspaces: all edits stay in the parent until explicitly saved. */
  onDraftItemsChange?: (items: InventoryItem[]) => void;
  draftMode?: boolean;
}

export function InventoryEditor({ quoteId, items, isLocked, onItemsChange, onRecalculate, defaultCollapsed = false, onDraftItemsChange, draftMode = false }: InventoryEditorProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ itemName: string; quantity: number; category: string; room: string }>({ itemName: '', quantity: 1, category: '', room: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: '', quantity: 1, category: 'other' });
  const [recalculating, setRecalculating] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<InventoryCategory[]>({
    queryKey: ['/api/inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    }
  });

  const categoryLabels: Record<string, { es: string; en: string }> = {
    sofas_large: { es: 'Sofás Grandes', en: 'Large Sofas' },
    sofas_medium: { es: 'Sofás Medianos', en: 'Medium Sofas' },
    sofas_small: { es: 'Sofás Pequeños', en: 'Small Sofas' },
    beds: { es: 'Camas', en: 'Beds' },
    tables: { es: 'Mesas', en: 'Tables' },
    chairs: { es: 'Sillas', en: 'Chairs' },
    storage: { es: 'Almacenamiento', en: 'Storage' },
    appliances: { es: 'Electrodomésticos', en: 'Appliances' },
    electronics: { es: 'Electrónicos', en: 'Electronics' },
    fragile: { es: 'Frágiles', en: 'Fragile' },
    boxes: { es: 'Cajas', en: 'Boxes' },
    outdoor: { es: 'Exterior', en: 'Outdoor' },
    office: { es: 'Oficina', en: 'Office' },
    gym: { es: 'Gimnasio', en: 'Gym' },
    other: { es: 'Otros', en: 'Other' },
  };

  const getCategoryLabel = (cat: string) => {
    const dbCategory = categories.find(c => c.key === cat);
    if (dbCategory) {
      return lang === 'es' ? dbCategory.labelEs : dbCategory.labelEn;
    }
    return categoryLabels[cat]?.[lang] || cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
  };

  const inventoryByCategory = items.reduce((acc, item) => {
    const category = draftMode ? (item.room || (lang === 'es' ? 'Sin habitación' : 'Unassigned room')) : (item.category || 'other');
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  // Calculate total estimated weight
  const calculateWeight = () => {
    if (categoriesLoading || categories.length === 0) {
      return { totalWeight: 0, minWeight: 0, maxWeight: 0 };
    }
    
    let totalWeight = 0;
    let minWeight = 0;
    let maxWeight = 0;
    
    const parseWeight = (val: string | number | null | undefined): number | null => {
      if (val == null) return null;
      const num = typeof val === 'number' ? val : parseFloat(val);
      return isNaN(num) ? null : num;
    };
    
    for (const item of items) {
      const cat = categories.find(c => c.key === (item.category || 'other'));
      const avgW = parseWeight(cat?.avgWeightKg) ?? 20;
      const minW = parseWeight(cat?.minWeightKg) ?? avgW * 0.5;
      const maxW = parseWeight(cat?.maxWeightKg) ?? avgW * 1.5;
      
      totalWeight += avgW * (item.quantity || 1);
      minWeight += minW * (item.quantity || 1);
      maxWeight += maxW * (item.quantity || 1);
    }
    
    return { totalWeight: Math.round(totalWeight), minWeight: Math.round(minWeight), maxWeight: Math.round(maxWeight) };
  };
  
  const weightEstimate = calculateWeight();

  const addItemMutation = useMutation({
    mutationFn: async (item: { quoteId: string; itemName: string; quantity: number; category: string }) => {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: lang === 'es' ? 'Artículo agregado' : 'Item added' });
      setShowAddForm(false);
      setNewItem({ itemName: '', quantity: 1, category: 'other' });
      onItemsChange?.();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItem> }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: lang === 'es' ? 'Artículo actualizado' : 'Item updated' });
      setEditingItemId(null);
      onItemsChange?.();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: lang === 'es' ? 'Artículo eliminado' : 'Item deleted' });
      onItemsChange?.();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/recalculate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      toast({ title: lang === 'es' ? 'Cotización recalculada' : 'Quote recalculated' });
      onRecalculate?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

  const startEditing = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditForm({ itemName: item.itemName, quantity: item.quantity, category: item.category || 'other', room: item.room || '' });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm({ itemName: '', quantity: 1, category: '', room: '' });
  };

  const saveEdit = () => {
    if (editingItemId) {
      if (draftMode) {
        onDraftItemsChange?.(items.map(item => item.id === editingItemId ? { ...item, ...editForm, quantity: Math.max(1, editForm.quantity) } : item));
        setEditingItemId(null);
      } else updateItemMutation.mutate({ id: editingItemId, data: editForm });
    }
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      if (draftMode) onDraftItemsChange?.(items.map(current => current.id === itemId ? { ...current, quantity: newQuantity } : current));
      else updateItemMutation.mutate({ id: itemId, data: { quantity: newQuantity } });
    }
  };

  // Generate summary of categories for collapsed view
  const categorySummary = Object.entries(inventoryByCategory).map(([cat, catItems]) => ({
    category: getCategoryLabel(cat),
    count: catItems.reduce((sum, item) => sum + item.quantity, 0)
  })).slice(0, 5); // Show top 5 categories

  return (
    <Card>
      <CardHeader 
        className={isCollapsed ? 'cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg' : ''}
        onClick={() => isCollapsed && setIsCollapsed(false)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Package className="h-5 w-5" />
            {lang === 'es' ? 'Inventario' : 'Inventory'}
            <Badge variant="secondary" className="ml-2">
              {items.reduce((sum, item) => sum + item.quantity, 0)} {lang === 'es' ? 'artículos' : 'items'}
            </Badge>
            {items.length > 0 && !categoriesLoading && categories.length > 0 && weightEstimate.totalWeight > 0 && (
              <Badge variant="outline" className="ml-1 border-blue-300 text-blue-700 bg-blue-50" title={lang === 'es' ? `Rango: ${weightEstimate.minWeight.toLocaleString()} - ${weightEstimate.maxWeight.toLocaleString()} kg` : `Range: ${weightEstimate.minWeight.toLocaleString()} - ${weightEstimate.maxWeight.toLocaleString()} kg`}>
                ~{weightEstimate.totalWeight.toLocaleString()} kg
              </Badge>
            )}
            {isLocked && (
              <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                <Lock className="h-3 w-3 mr-1" />
                {lang === 'es' ? 'Bloqueado' : 'Locked'}
              </Badge>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {!isCollapsed && !isLocked && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  disabled={showAddForm}
                  data-testid="button-add-inventory-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {lang === 'es' ? 'Agregar' : 'Add'}
                </Button>
                {!draftMode && <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  data-testid="button-recalculate-quote"
                >
                  {recalculating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {lang === 'es' ? 'Recalcular' : 'Recalculate'}
                </Button>}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
              className="h-8 w-8 p-0"
              data-testid="toggle-inventory-collapse"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
        
        {/* Collapsed summary view */}
        {isCollapsed && items.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              {categorySummary.map((cat, idx) => (
                <span key={idx} className="bg-slate-100 px-2 py-1 rounded text-xs">
                  {cat.category}: {cat.count}
                </span>
              ))}
              {Object.keys(inventoryByCategory).length > 5 && (
                <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                  +{Object.keys(inventoryByCategory).length - 5} {lang === 'es' ? 'más' : 'more'}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs">
              {lang === 'es' ? 'Clic para expandir y editar' : 'Click to expand and edit'}
            </p>
          </div>
        )}
      </CardHeader>
      
      {!isCollapsed && (
      <CardContent>
        {showAddForm && !isLocked && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg border">
            <h4 className="font-medium mb-3">{lang === 'es' ? 'Agregar artículo' : 'Add item'}</h4>
            <div className="grid gap-3 md:grid-cols-4">
              <Input 
                placeholder={lang === 'es' ? 'Nombre del artículo' : 'Item name'}
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                data-testid="input-new-item-name"
              />
              <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                <SelectTrigger data-testid="select-new-item-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(categoryLabels).map(cat => (
                    <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                type="number"
                min={1}
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                data-testid="input-new-item-quantity"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm"
                   onClick={() => {
                     if (draftMode) {
                       onDraftItemsChange?.([...items, { id: `draft-${Date.now()}`, quoteId, ...newItem, room: '' }]);
                       setShowAddForm(false);
                       setNewItem({ itemName: '', quantity: 1, category: 'other' });
                     } else addItemMutation.mutate({ quoteId, ...newItem });
                   }}
                  disabled={!newItem.itemName || addItemMutation.isPending}
                  data-testid="button-save-new-item"
                >
                  {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)} data-testid="button-cancel-new-item">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {lang === 'es' ? 'No hay artículos en el inventario' : 'No inventory items'}
          </p>
        ) : (
          <Accordion type="multiple" className="w-full" defaultValue={Object.keys(inventoryByCategory)}>
            {Object.entries(inventoryByCategory).map(([category, categoryItems]) => (
              <AccordionItem key={category} value={category} data-testid={`accordion-category-${category}`}>
                <AccordionTrigger className="hover:no-underline" data-testid={`trigger-category-${category}`}>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {draftMode ? category : getCategoryLabel(category)}
                    <Badge variant="outline">{categoryItems.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-6">
                    {categoryItems.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-2 bg-slate-50 rounded" 
                        data-testid={`inventory-item-${item.id}`}
                      >
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input 
                              value={editForm.itemName}
                               onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                              className="max-w-[200px]"
                              data-testid={`input-edit-item-name-${item.id}`}
                            />
                            <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.keys(categoryLabels).map(cat => <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input placeholder={lang === 'es' ? 'Habitación' : 'Room'} value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="max-w-[140px]" />
                            <Input 
                              type="number"
                              min={1}
                              value={editForm.quantity}
                              onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                              className="w-20"
                              data-testid={`input-edit-item-quantity-${item.id}`}
                            />
                            <Button size="sm" onClick={saveEdit} disabled={updateItemMutation.isPending} data-testid={`button-save-edit-${item.id}`}>
                              {updateItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEditing} data-testid={`button-cancel-edit-${item.id}`}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{item.itemName}</span>
                            <div className="flex items-center gap-2">
                              {!isLocked && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleQuantityChange(item.id, -1)}
                                    disabled={item.quantity <= 1 || updateItemMutation.isPending}
                                    data-testid={`button-decrease-quantity-${item.id}`}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              <Badge variant="secondary">x{item.quantity}</Badge>
                              {!isLocked && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleQuantityChange(item.id, 1)}
                                    disabled={updateItemMutation.isPending}
                                    data-testid={`button-increase-quantity-${item.id}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => startEditing(item)}
                                    data-testid={`button-edit-item-${item.id}`}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-red-500 hover:text-red-700"
                                     onClick={() => draftMode
                                       ? onDraftItemsChange?.(items.filter(current => current.id !== item.id))
                                       : deleteItemMutation.mutate(item.id)}
                                    disabled={deleteItemMutation.isPending}
                                    data-testid={`button-delete-item-${item.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
      )}
    </Card>
  );
}
