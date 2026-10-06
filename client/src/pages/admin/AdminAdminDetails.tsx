import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRoute, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { 
  ArrowLeft, User, Mail, Phone, Shield, ShieldCheck, 
  Save, Loader2, Activity, Key
} from "lucide-react";

interface AdminDetails {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  preferredLanguage: string | null;
  isActive: boolean | null;
  createdAt: string;
  platformRoles?: string[];
  permissions?: {
    id: string;
    canManageUsers: boolean;
    canManageMovers: boolean;
    canManageQuotes: boolean;
    canManageSettings: boolean;
    canAccessDatabase: boolean;
    canManageAdmins: boolean;
    isSuperAdmin: boolean;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

const permissionLabels: Record<string, { es: string; en: string; description: { es: string; en: string } }> = {
  canManageUsers: {
    es: 'Gestionar Usuarios',
    en: 'Manage Users',
    description: { es: 'Crear, editar y eliminar usuarios', en: 'Create, edit and delete users' }
  },
  canManageMovers: {
    es: 'Gestionar Socios',
    en: 'Manage Partners',
    description: { es: 'Verificar y administrar socios de mudanza', en: 'Verify and manage moving partners' }
  },
  canManageQuotes: {
    es: 'Gestionar Cotizaciones',
    en: 'Manage Quotes',
    description: { es: 'Ver y administrar todas las cotizaciones', en: 'View and manage all quotes' }
  },
  canManageSettings: {
    es: 'Gestionar Configuración',
    en: 'Manage Settings',
    description: { es: 'Modificar configuración del sistema', en: 'Modify system settings' }
  },
  canAccessDatabase: {
    es: 'Acceso a Base de Datos',
    en: 'Database Access',
    description: { es: 'Acceso directo a la base de datos', en: 'Direct database access' }
  },
  canManageAdmins: {
    es: 'Gestionar Administradores',
    en: 'Manage Admins',
    description: { es: 'Crear y modificar otros administradores', en: 'Create and modify other admins' }
  },
  isSuperAdmin: {
    es: 'Super Administrador',
    en: 'Super Admin',
    description: { es: 'Acceso completo a todas las funciones', en: 'Full access to all features' }
  },
};

export default function AdminAdminDetails() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/dashboard/admins/:adminId");
  const adminId = params?.adminId;
  const locale = i18n.language === 'es' ? es : enUS;
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'es',
  });

  const { data: adminData, isLoading } = useQuery<{ admin: AdminDetails }>({
    queryKey: [`/api/admin/admins/${adminId}`],
    enabled: !!adminId,
  });

  const { data: activityData } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: [`/api/admin/users/${adminId}/activity`],
    enabled: !!adminId,
  });

  const admin = adminData?.admin;
  const activity = activityData?.logs || [];

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch(`/api/admin/users/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update admin');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/admins/${adminId}`] });
      toast({
        title: lang === 'es' ? 'Información actualizada' : 'Information updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const startEditing = () => {
    if (admin) {
      setEditForm({
        fullName: admin.fullName || '',
        email: admin.email || '',
        phone: admin.phone || '',
        preferredLanguage: admin.preferredLanguage || 'es',
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(editForm);
  };

  const sidebarLinks = getAdminSidebarLinks(lang);

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!admin) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {lang === 'es' ? 'El administrador solicitado no existe' : 'The requested admin does not exist'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation('/admin/dashboard/admins')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a administradores' : 'Back to admins'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/admin/dashboard/admins')} data-testid="button-back-admins">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a administradores' : 'Back to admins'}
          </Button>
          {!isEditing ? (
            <Button onClick={startEditing} data-testid="button-edit-admin">
              {lang === 'es' ? 'Editar administrador' : 'Edit admin'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending}
                data-testid="button-save-admin"
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Guardar' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-admin-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {lang === 'es' ? 'Información del Administrador' : 'Admin Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Nombre completo' : 'Full name'}</Label>
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      data-testid="input-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Email' : 'Email'}</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Teléfono' : 'Phone'}</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      data-testid="input-phone"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
                      <ShieldCheck className="h-8 w-8 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{admin.fullName || 'N/A'}</h3>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      {admin.permissions?.isSuperAdmin && (
                        <Badge className="mt-1 bg-purple-600">
                          {lang === 'es' ? 'Super Admin' : 'Super Admin'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{admin.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{admin.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={admin.isActive ? 'default' : 'secondary'}>
                      {admin.isActive 
                        ? (lang === 'es' ? 'Activo' : 'Active')
                        : (lang === 'es' ? 'Inactivo' : 'Inactive')}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-admin-permissions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {lang === 'es' ? 'Acceso de plataforma' : 'Platform access'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'El rol de plataforma controla el acceso. Los indicadores heredados se muestran solo como referencia.'
                  : 'Platform roles control access. Legacy indicators are shown for reference only.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {admin.platformRoles?.length ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{lang === 'es' ? 'Roles asignados' : 'Assigned roles'}</p>
                      <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Gestionar en el catálogo de roles de plataforma' : 'Manage in the platform role catalog'}</p>
                    </div>
                    <div className="flex gap-1">
                      {admin.platformRoles.map((role) => <Badge key={role} variant="secondary">{role.replace(/_/g, ' ')}</Badge>)}
                    </div>
                  </div>
                ) : null}
                {Object.entries(permissionLabels).map(([key, labels]) => {
                  const permKey = key as Exclude<keyof NonNullable<AdminDetails["permissions"]>, "id">;
                  const hasPermission = admin.permissions?.[permKey] ?? false;
                  
                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{labels[lang]}</p>
                        <p className="text-xs text-muted-foreground">{labels.description[lang]}</p>
                      </div>
                      <Badge variant={hasPermission ? 'default' : 'outline'}>
                        {hasPermission
                          ? (lang === 'es' ? 'Sí' : 'Yes')
                          : (lang === 'es' ? 'No' : 'No')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-admin-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {lang === 'es' ? 'Actividad Reciente' : 'Recent Activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === 'es' ? 'Sin actividad registrada' : 'No activity recorded'}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activity.slice(0, 20).map((log) => (
                  <div key={log.id} className="p-3 border-l-2 border-purple-300 pl-4 bg-slate-50 rounded-r-lg">
                    <p className="font-medium">{log.action}</p>
                    {log.details && <p className="text-sm text-muted-foreground">{log.details}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.createdAt), 'PP p', { locale })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
