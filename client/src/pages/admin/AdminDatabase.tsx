import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Database, Table, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ArrowUpDown, ExternalLink, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { tableMetadataConfig, type RelationshipMetadata, ROLE_OPTIONS } from "@shared/tableMetadata";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

interface TableInfo {
  name: string;
  displayName: { en: string; es: string };
  description: { en: string; es: string };
  category: string;
  permissions: { read: boolean; create: boolean; update: boolean; delete: boolean };
  rowCount: number;
}

interface ColumnMetadata {
  name: string;
  type: string;
  label: { en: string; es: string };
  editable: boolean;
  required: boolean;
  hidden?: boolean;
  relation?: RelationshipMetadata;
  options?: { value: string; label: { en: string; es: string } }[];
  virtual?: boolean;
}

interface LookupOption {
  value: string;
  label: string;
}

interface TableMetadata {
  name: string;
  displayName: { en: string; es: string };
  columns: ColumnMetadata[];
  permissions: { read: boolean; create: boolean; update: boolean; delete: boolean };
  primaryKey: string;
}

const categoryLabels: Record<string, { en: string; es: string }> = {
  users: { en: 'Users', es: 'Usuarios' },
  quotes: { en: 'Quotes', es: 'Cotizaciones' },
  services: { en: 'Services', es: 'Servicios' },
  config: { en: 'Configuration', es: 'Configuración' },
  logs: { en: 'Logs', es: 'Registros' },
};

const categoryColors: Record<string, string> = {
  users: 'bg-blue-100 text-blue-800',
  quotes: 'bg-green-100 text-green-800',
  services: 'bg-purple-100 text-purple-800',
  config: 'bg-amber-100 text-amber-800',
  logs: 'bg-slate-100 text-slate-800',
};

export default function AdminDatabase() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'en';

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ table: string; row: any } | null>(null);
  const [lookupCache, setLookupCache] = useState<Record<string, LookupOption[]>>({});

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const { data: tablesData, isLoading: loadingTables } = useQuery({
    queryKey: ['/api/admin/db/tables'],
    queryFn: () => fetchJson('/api/admin/db/tables'),
  });

  const { data: metadataData } = useQuery({
    queryKey: ['/api/admin/db/tables', selectedTable, 'metadata'],
    queryFn: () => fetchJson(`/api/admin/db/tables/${selectedTable}/metadata`),
    enabled: !!selectedTable,
  });

  const { data: rowsData, isLoading: loadingRows, refetch: refetchRows } = useQuery({
    queryKey: ['/api/admin/db/tables', selectedTable, 'rows', page, pageSize],
    queryFn: () => fetchJson(`/api/admin/db/tables/${selectedTable}/rows?page=${page}&pageSize=${pageSize}`),
    enabled: !!selectedTable,
  });

  const localTables: TableInfo[] = useMemo(() => {
    return Object.entries(tableMetadataConfig).map(([name, meta]) => ({
      name,
      displayName: meta.displayName,
      description: meta.description,
      category: meta.category,
      permissions: meta.permissions,
      rowCount: 0,
    }));
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/admin/db/tables/${selectedTable}/rows`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/db/tables'] });
      refetchRows();
      setIsCreateModalOpen(false);
      setFormData({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/db/tables/${selectedTable}/rows/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchRows();
      setIsEditModalOpen(false);
      setEditingRow(null);
      setFormData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/db/tables/${selectedTable}/rows/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/db/tables'] });
      refetchRows();
      setIsDeleteDialogOpen(false);
      setDeleteRowId(null);
    },
  });

  const apiTables: TableInfo[] = tablesData?.tables || [];
  const tables: TableInfo[] = apiTables.length > 0 ? apiTables : localTables;
  const metadata: TableMetadata | null = metadataData?.metadata || null;
  const rows: any[] = rowsData?.rows || [];
  const totalRows = rowsData?.total || 0;
  const totalPages = Math.ceil(totalRows / pageSize);

  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return tables;
    const search = searchTerm.toLowerCase();
    return tables.filter(t => 
      t.name.toLowerCase().includes(search) ||
      t.displayName[lang].toLowerCase().includes(search) ||
      t.description[lang].toLowerCase().includes(search)
    );
  }, [tables, searchTerm, lang]);

  const groupedTables = filteredTables.reduce((acc, table) => {
    const cat = table.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(table);
    return acc;
  }, {} as Record<string, TableInfo[]>);

  const handleEdit = (row: any) => {
    setEditingRow(row);
    setFormData({ ...row });
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setFormData({});
    setIsCreateModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteRowId(id);
    setIsDeleteDialogOpen(true);
  };

  const fetchLookupOptions = async (tableName: string, displayColumn: string): Promise<LookupOption[]> => {
    const cacheKey = `${tableName}:${displayColumn}`;
    if (lookupCache[cacheKey]) return lookupCache[cacheKey];
    
    try {
      const data = await fetchJson(`/api/admin/db/tables/${tableName}/lookup?displayColumn=${displayColumn}`);
      const options = data.options || [];
      setLookupCache(prev => ({ ...prev, [cacheKey]: options }));
      return options;
    } catch {
      return [];
    }
  };

  const handlePreviewRelated = async (relation: RelationshipMetadata, value: string) => {
    if (!value) return;
    try {
      const row = await fetchJson(`/api/admin/db/tables/${relation.targetTable}/rows/${value}`);
      if (row) {
        setPreviewData({ table: relation.targetTable, row });
        setIsPreviewModalOpen(true);
      }
    } catch {
      console.error('Failed to fetch related record');
    }
  };

  const handleNavigateToTable = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    setIsPreviewModalOpen(false);
    setPreviewData(null);
  };

  const FkSelectField = ({ col, value, onChange, disabled }: { col: ColumnMetadata; value: string; onChange: (val: string) => void; disabled: boolean }) => {
    const [options, setOptions] = useState<LookupOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    
    const fetchOptions = async (search: string = '') => {
      if (!col.relation) return;
      setLoading(true);
      try {
        const data = await fetchJson(`/api/admin/db/tables/${col.relation.targetTable}/lookup?displayColumn=${col.relation.displayColumn}&search=${encodeURIComponent(search)}`);
        setOptions(data.options || []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
      if (col.relation) {
        fetchOptions('');
      }
    }, [col.relation?.targetTable, col.relation?.displayColumn]);
    
    useEffect(() => {
      const debounce = setTimeout(() => {
        if (searchInput && col.relation) {
          fetchOptions(searchInput);
        }
      }, 300);
      return () => clearTimeout(debounce);
    }, [searchInput]);
    
    const selectedLabel = options.find(o => o.value === value)?.label || value || '';
    
    return (
      <div className="space-y-2">
        <Label htmlFor={col.name}>
          {col.label[lang]}
          {col.required && <span className="text-red-500 ml-1">*</span>}
          <Link2 className="inline h-3 w-3 ml-1 text-muted-foreground" />
        </Label>
        <div className="relative">
          <Input
            value={isOpen ? searchInput : selectedLabel}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={loading ? (lang === 'es' ? 'Cargando...' : 'Loading...') : (lang === 'es' ? 'Buscar...' : 'Search...')}
            disabled={disabled}
            data-testid={`input-fk-${col.name}`}
          />
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
              <button
                type="button"
                onClick={() => { onChange(''); setSearchInput(''); setIsOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 text-muted-foreground"
              >
                {lang === 'es' ? '(Ninguno)' : '(None)'}
              </button>
              {options.length === 0 && !loading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {lang === 'es' ? 'Sin resultados' : 'No results'}
                </div>
              )}
              {options.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setSearchInput(''); setIsOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 ${opt.value === value ? 'bg-slate-50 font-medium' : ''}`}
                >
                  {opt.label || opt.value}
                </button>
              ))}
            </div>
          )}
        </div>
        {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
      </div>
    );
  };

  const renderFormField = (col: ColumnMetadata, isCreate: boolean = false) => {
    if (!col.editable && !isCreate) return null;
    if (col.hidden) return null;
    if (!isCreate && col.name === metadata?.primaryKey) return null;

    const value = formData[col.name] ?? '';

    if (col.relation && col.editable) {
      return (
        <FkSelectField
          key={col.name}
          col={col}
          value={value}
          onChange={(val) => setFormData({ ...formData, [col.name]: val === '_none_' ? null : val })}
          disabled={!col.editable}
        />
      );
    }

    switch (col.type) {
      case 'multiselect':
        const selectedValues: string[] = Array.isArray(value) ? value : [];
        return (
          <div key={col.name} className="space-y-2">
            <Label>{col.label[lang]}</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-slate-50">
              {col.options?.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value);
                      setFormData({ ...formData, [col.name]: newValues });
                    }}
                    disabled={!col.editable}
                    className="rounded"
                    data-testid={`checkbox-${col.name}-${opt.value}`}
                  />
                  <span className="text-sm">{opt.label[lang]}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'boolean':
        return (
          <div key={col.name} className="flex items-center justify-between py-2">
            <Label htmlFor={col.name}>{col.label[lang]}</Label>
            <Switch
              id={col.name}
              checked={!!value}
              onCheckedChange={(checked) => setFormData({ ...formData, [col.name]: checked })}
              disabled={!col.editable}
              data-testid={`switch-${col.name}`}
            />
          </div>
        );
      case 'json':
      case 'array':
        return (
          <div key={col.name} className="space-y-2">
            <Label htmlFor={col.name}>{col.label[lang]}</Label>
            <Textarea
              id={col.name}
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, [col.name]: JSON.parse(e.target.value) });
                } catch {
                  setFormData({ ...formData, [col.name]: e.target.value });
                }
              }}
              disabled={!col.editable}
              className="font-mono text-sm"
              data-testid={`textarea-${col.name}`}
            />
          </div>
        );
      case 'date':
        return (
          <div key={col.name} className="space-y-2">
            <Label htmlFor={col.name}>{col.label[lang]}</Label>
            <Input
              id={col.name}
              type="datetime-local"
              value={value ? new Date(value).toISOString().slice(0, 16) : ''}
              onChange={(e) => setFormData({ ...formData, [col.name]: new Date(e.target.value).toISOString() })}
              disabled={!col.editable}
              data-testid={`input-${col.name}`}
            />
          </div>
        );
      case 'number':
        return (
          <div key={col.name} className="space-y-2">
            <Label htmlFor={col.name}>{col.label[lang]}</Label>
            <Input
              id={col.name}
              type="number"
              value={value}
              onChange={(e) => setFormData({ ...formData, [col.name]: parseFloat(e.target.value) || 0 })}
              disabled={!col.editable}
              data-testid={`input-${col.name}`}
            />
          </div>
        );
      default:
        return (
          <div key={col.name} className="space-y-2">
            <Label htmlFor={col.name}>
              {col.label[lang]}
              {col.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={col.name}
              value={value}
              onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
              disabled={!col.editable}
              data-testid={`input-${col.name}`}
            />
          </div>
        );
    }
  };

  const formatCellValue = (value: any, type: string, colName?: string): string => {
    if (value === null || value === undefined) return '-';
    if (type === 'boolean') return value ? '✓' : '✗';
    if (type === 'multiselect' && Array.isArray(value)) {
      if (colName === 'roles') {
        return value.map(v => ROLE_OPTIONS.find(o => o.value === v)?.label[lang] || v).join(', ') || '-';
      }
      return value.join(', ') || '-';
    }
    if (type === 'date') {
      try {
        return new Date(value).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
      } catch {
        return String(value);
      }
    }
    if (type === 'json' || type === 'array') {
      return typeof value === 'object' ? JSON.stringify(value).slice(0, 50) + '...' : String(value);
    }
    const str = String(value);
    return str.length > 50 ? str.slice(0, 50) + '...' : str;
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {lang === 'es' ? 'Gestión de Base de Datos' : 'Database Management'}
          </h1>
          <p className="text-muted-foreground">
            {lang === 'es' 
              ? 'Ver, editar y gestionar los datos de la plataforma' 
              : 'View, edit, and manage platform data'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{lang === 'es' ? 'Tablas' : 'Tables'}</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={lang === 'es' ? 'Buscar...' : 'Search...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-table-search"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 p-4">
                  {filteredTables.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {lang === 'es' ? 'No se encontraron tablas' : 'No tables found'}
                    </div>
                  ) : (
                    Object.entries(groupedTables).map(([category, categoryTables]) => (
                      <div key={category}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          {categoryLabels[category]?.[lang] || category}
                        </div>
                        <div className="space-y-1">
                          {categoryTables.map((table) => (
                            <button
                              key={table.name}
                              onClick={() => {
                                setSelectedTable(table.name);
                                setPage(1);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                                selectedTable === table.name
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-slate-100'
                              }`}
                              data-testid={`btn-table-${table.name}`}
                            >
                              <div className="flex items-center gap-2">
                                <Table className="h-4 w-4" />
                                <span className="text-sm font-medium">{table.displayName[lang]}</span>
                              </div>
                              {table.rowCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {table.rowCount}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            {selectedTable && metadata ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      {metadata.displayName[lang]}
                    </CardTitle>
                    <CardDescription>
                      {totalRows} {lang === 'es' ? 'registros' : 'records'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchRows()}
                      data-testid="btn-refresh-rows"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    {metadata.permissions.create && (
                      <Button
                        size="sm"
                        onClick={handleCreate}
                        className="bg-primary hover:bg-primary/90"
                        data-testid="btn-create-row"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {lang === 'es' ? 'Nuevo' : 'New'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRows ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      {lang === 'es' ? 'Cargando datos...' : 'Loading data...'}
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                      {lang === 'es' ? 'No hay datos' : 'No data'}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              {metadata.columns
                                .filter(c => !c.hidden)
                                .slice(0, 6)
                                .map((col) => (
                                  <th key={col.name} className="px-3 py-2 text-left font-medium text-slate-600">
                                    {col.label[lang]}
                                  </th>
                                ))}
                              <th className="px-3 py-2 text-right font-medium text-slate-600">
                                {lang === 'es' ? 'Acciones' : 'Actions'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rows.map((row, idx) => (
                              <tr key={row[metadata.primaryKey] || idx} className="hover:bg-slate-50">
                                {metadata.columns
                                  .filter(c => !c.hidden)
                                  .slice(0, 6)
                                  .map((col) => (
                                    <td key={col.name} className="px-3 py-2 text-slate-700">
                                      {col.relation && row[col.name] ? (
                                        <button
                                          onClick={() => handlePreviewRelated(col.relation!, row[col.name])}
                                          className="inline-flex items-center gap-1 text-action hover:text-primary hover:underline"
                                          data-testid={`link-${col.name}-${row[metadata.primaryKey]}`}
                                        >
                                          <Link2 className="h-3 w-3" />
                                          <span className="truncate max-w-[120px]">{formatCellValue(row[col.name], col.type, col.name)}</span>
                                        </button>
                                      ) : (
                                        formatCellValue(row[col.name], col.type, col.name)
                                      )}
                                    </td>
                                  ))}
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(row)}
                                      data-testid={`btn-edit-${row[metadata.primaryKey]}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {metadata.permissions.update && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(row)}
                                        data-testid={`btn-update-${row[metadata.primaryKey]}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {metadata.permissions.delete && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleDelete(row[metadata.primaryKey])}
                                        data-testid={`btn-delete-${row[metadata.primaryKey]}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            {lang === 'es' 
                              ? `Página ${page} de ${totalPages}` 
                              : `Page ${page} of ${totalPages}`}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage(p => Math.max(1, p - 1))}
                              disabled={page === 1}
                              data-testid="btn-prev-page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                              disabled={page === totalPages}
                              data-testid="btn-next-page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="h-[400px] flex flex-col items-center justify-center text-center">
                <Database className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-600">
                  {lang === 'es' ? 'Selecciona una tabla' : 'Select a table'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'es' 
                    ? 'Elige una tabla de la lista para ver y editar sus datos' 
                    : 'Choose a table from the list to view and edit its data'}
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lang === 'es' ? 'Editar Registro' : 'Edit Record'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'es' 
                ? 'Modifica los campos y guarda los cambios' 
                : 'Modify the fields and save changes'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {metadata?.columns.map(col => renderFormField(col, false))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} data-testid="btn-cancel-edit">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                if (editingRow && metadata) {
                  updateMutation.mutate({ id: editingRow[metadata.primaryKey], data: formData });
                }
              }}
              disabled={updateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="btn-save-edit"
            >
              {updateMutation.isPending 
                ? (lang === 'es' ? 'Guardando...' : 'Saving...') 
                : (lang === 'es' ? 'Guardar' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lang === 'es' ? 'Crear Nuevo Registro' : 'Create New Record'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'es' 
                ? 'Completa los campos requeridos para crear un nuevo registro' 
                : 'Fill in the required fields to create a new record'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {metadata?.columns
              .filter(col => col.editable && !col.hidden && col.name !== metadata.primaryKey)
              .map(col => renderFormField(col, true))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} data-testid="btn-cancel-create">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="btn-save-create"
            >
              {createMutation.isPending 
                ? (lang === 'es' ? 'Creando...' : 'Creating...') 
                : (lang === 'es' ? 'Crear' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === 'es' ? '¿Eliminar este registro?' : 'Delete this record?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === 'es' 
                ? 'Esta acción no se puede deshacer. El registro será eliminado permanentemente.' 
                : 'This action cannot be undone. The record will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRowId && deleteMutation.mutate(deleteRowId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending 
                ? (lang === 'es' ? 'Eliminando...' : 'Deleting...') 
                : (lang === 'es' ? 'Eliminar' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              {previewData && tableMetadataConfig[previewData.table]?.displayName[lang] || (lang === 'es' ? 'Registro Relacionado' : 'Related Record')}
            </DialogTitle>
            <DialogDescription>
              {lang === 'es' ? 'Vista previa del registro vinculado' : 'Preview of linked record'}
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-3 py-4">
              <ScrollArea className="h-[300px]">
                {Object.entries(previewData.row).map(([key, value]) => {
                  const tableMeta = tableMetadataConfig[previewData.table];
                  const colMeta = tableMeta?.columns.find(c => c.name === key);
                  if (colMeta?.hidden) return null;
                  return (
                    <div key={key} className="flex py-2 border-b last:border-0">
                      <span className="w-1/3 text-sm font-medium text-muted-foreground">
                        {colMeta?.label[lang] || key}
                      </span>
                      <span className="w-2/3 text-sm text-slate-700 break-all">
                        {formatCellValue(value, colMeta?.type || 'text', key)}
                      </span>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)} data-testid="btn-close-preview">
              {lang === 'es' ? 'Cerrar' : 'Close'}
            </Button>
            {previewData && (
              <Button
                onClick={() => handleNavigateToTable(previewData.table)}
                className="bg-action hover:bg-action/90"
                data-testid="btn-go-to-table"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {lang === 'es' ? 'Ir a Tabla' : 'Go to Table'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
