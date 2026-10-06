import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { getAdminSidebarLinks } from '@/lib/adminSidebar';

interface WorkflowStatus {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  description?: string;
  descriptionEs?: string;
  color: string;
  bgColor: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isFinal: boolean;
  isDefault: boolean;
}

export function WorkflowStatusesContent() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<WorkflowStatus | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    labelEs: '',
    labelEn: '',
    description: '',
    descriptionEs: '',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '',
    isActive: true,
    isFinal: false,
    isDefault: false,
  });

  const { data: statuses = [], isLoading } = useQuery<WorkflowStatus[]>({
    queryKey: ['/api/admin/quote-workflow-statuses'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/admin/quote-workflow-statuses', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quote-workflow-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-workflow-statuses'] });
      toast({ title: lang === 'es' ? 'Estado creado' : 'Status created' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PATCH', `/api/admin/quote-workflow-statuses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quote-workflow-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-workflow-statuses'] });
      toast({ title: lang === 'es' ? 'Estado actualizado' : 'Status updated' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/quote-workflow-statuses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quote-workflow-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-workflow-statuses'] });
      toast({ title: lang === 'es' ? 'Estado eliminado' : 'Status deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest('POST', '/api/admin/quote-workflow-statuses/reorder', { orderedIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quote-workflow-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-workflow-statuses'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openCreateDialog = () => {
    setEditingStatus(null);
    setFormData({
      key: '',
      labelEs: '',
      labelEn: '',
      description: '',
      descriptionEs: '',
      color: '#6B7280',
      bgColor: '#F3F4F6',
      icon: '',
      isActive: true,
      isFinal: false,
      isDefault: false,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (status: WorkflowStatus) => {
    setEditingStatus(status);
    setFormData({
      key: status.key,
      labelEs: status.labelEs,
      labelEn: status.labelEn,
      description: status.description || '',
      descriptionEs: status.descriptionEs || '',
      color: status.color,
      bgColor: status.bgColor,
      icon: status.icon || '',
      isActive: status.isActive,
      isFinal: status.isFinal,
      isDefault: status.isDefault,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingStatus(null);
  };

  const handleSubmit = () => {
    if (!formData.key || !formData.labelEs || !formData.labelEn) {
      toast({
        title: 'Error',
        description: lang === 'es' ? 'Completa todos los campos requeridos' : 'Fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (editingStatus) {
      updateMutation.mutate({ id: editingStatus.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = draggedIndex;
    
    if (dragIndex === null || dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newOrder = [...statuses];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    reorderMutation.mutate(newOrder.map(s => s.id));
    handleDragEnd();
  };

  const handleDelete = (status: WorkflowStatus) => {
    if (confirm(lang === 'es' 
      ? `¿Eliminar el estado "${status.labelEs}"?` 
      : `Delete status "${status.labelEn}"?`)) {
      deleteMutation.mutate(status.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-workflow-statuses-title">
            {lang === 'es' ? 'Estados del Flujo de Cotizaciones' : 'Quote Workflow Statuses'}
          </h2>
          <p className="text-muted-foreground">
            {lang === 'es' 
              ? 'Administra los estados del embudo de cotizaciones' 
              : 'Manage the quote funnel statuses'}
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-status">
          <Plus className="h-4 w-4 mr-2" />
          {lang === 'es' ? 'Agregar Estado' : 'Add Status'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            {lang === 'es' ? 'Orden del Embudo' : 'Funnel Order'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statuses.map((status, index) => (
              <div
                key={status.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-all ${
                  draggedIndex === index 
                    ? 'opacity-50 scale-95' 
                    : dragOverIndex === index 
                      ? 'border-primary border-2 bg-primary/5' 
                      : 'hover:bg-accent/50'
                }`}
                data-testid={`status-row-${status.key}`}
              >
                <div 
                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
                  data-testid={`drag-handle-${status.key}`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2 min-w-[120px]">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: status.color }}
                  />
                  <span
                    className="px-2 py-1 rounded text-sm font-medium"
                    style={{ backgroundColor: status.bgColor, color: status.color }}
                  >
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1">
                  <div className="font-medium">
                    {lang === 'es' ? status.labelEs : status.labelEn}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <code className="bg-muted px-1 rounded">{status.key}</code>
                    {' • '}
                    {lang === 'es' ? status.descriptionEs : status.description}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {status.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {lang === 'es' ? 'Por defecto' : 'Default'}
                    </span>
                  )}
                  {status.isFinal && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {lang === 'es' ? 'Final' : 'Final'}
                    </span>
                  )}
                  {status.isActive ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(status)}
                    data-testid={`button-edit-${status.key}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(status)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-${status.key}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStatus 
                ? (lang === 'es' ? 'Editar Estado' : 'Edit Status')
                : (lang === 'es' ? 'Nuevo Estado' : 'New Status')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'es' ? 'Clave (key)' : 'Key'} *</Label>
                <Input
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g. pending_payment"
                  data-testid="input-status-key"
                />
              </div>
              <div>
                <Label>{lang === 'es' ? 'Icono' : 'Icon'}</Label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="e.g. check-circle"
                  data-testid="input-status-icon"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'es' ? 'Nombre (Español)' : 'Name (Spanish)'} *</Label>
                <Input
                  value={formData.labelEs}
                  onChange={(e) => setFormData({ ...formData, labelEs: e.target.value })}
                  placeholder="Pago Pendiente"
                  data-testid="input-status-label-es"
                />
              </div>
              <div>
                <Label>{lang === 'es' ? 'Nombre (Inglés)' : 'Name (English)'} *</Label>
                <Input
                  value={formData.labelEn}
                  onChange={(e) => setFormData({ ...formData, labelEn: e.target.value })}
                  placeholder="Pending Payment"
                  data-testid="input-status-label-en"
                />
              </div>
            </div>

            <div>
              <Label>{lang === 'es' ? 'Descripción (Español)' : 'Description (Spanish)'}</Label>
              <Input
                value={formData.descriptionEs}
                onChange={(e) => setFormData({ ...formData, descriptionEs: e.target.value })}
                placeholder="Descripción del estado..."
                data-testid="input-status-desc-es"
              />
            </div>

            <div>
              <Label>{lang === 'es' ? 'Descripción (Inglés)' : 'Description (English)'}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Status description..."
                data-testid="input-status-desc-en"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'es' ? 'Color del texto' : 'Text Color'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 p-1"
                    data-testid="input-status-color"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#6B7280"
                  />
                </div>
              </div>
              <div>
                <Label>{lang === 'es' ? 'Color de fondo' : 'Background Color'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="w-12 h-10 p-1"
                    data-testid="input-status-bg-color"
                  />
                  <Input
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    placeholder="#F3F4F6"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-status-active"
                />
                <Label>{lang === 'es' ? 'Activo' : 'Active'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isFinal}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFinal: checked })}
                  data-testid="switch-status-final"
                />
                <Label>{lang === 'es' ? 'Estado Final' : 'Final Status'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                  data-testid="switch-status-default"
                />
                <Label>{lang === 'es' ? 'Por Defecto' : 'Default'}</Label>
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/50">
              <Label className="text-sm text-muted-foreground">
                {lang === 'es' ? 'Vista previa:' : 'Preview:'}
              </Label>
              <div className="mt-2">
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: formData.bgColor, color: formData.color }}
                >
                  {lang === 'es' ? formData.labelEs || 'Nombre...' : formData.labelEn || 'Name...'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-status">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-status"
            >
              {(createMutation.isPending || updateMutation.isPending) 
                ? (lang === 'es' ? 'Guardando...' : 'Saving...')
                : (lang === 'es' ? 'Guardar' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminWorkflowStatuses() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const sidebarLinks = getAdminSidebarLinks(lang);
  
  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <WorkflowStatusesContent />
    </DashboardLayout>
  );
}
