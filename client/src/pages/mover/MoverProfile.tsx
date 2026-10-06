import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LayoutDashboard, FileText, Car, Building2, Phone, Globe, MapPin, Clock, CheckCircle2, AlertCircle, Pencil, Truck, Users, Loader2, FileCheck, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";
import { dispatchRequest } from "@/components/mover/dispatchApi";

const MOVE_TYPES = [
  { id: "local", labelKey: "onboarding.moveTypes.local" },
  { id: "commercial", labelKey: "onboarding.moveTypes.commercial" },
  { id: "residential", labelKey: "onboarding.moveTypes.residential" },
  { id: "packing", labelKey: "onboarding.moveTypes.packing" },
  { id: "storage", labelKey: "onboarding.moveTypes.storage" },
  { id: "specialItems", labelKey: "onboarding.moveTypes.specialItems" },
  { id: "international", labelKey: "onboarding.moveTypes.international" },
];

const VEHICLE_TYPES = [
  { id: "van", labelKey: "onboarding.vehicleTypes.van" },
  { id: "smallTruck", labelKey: "onboarding.vehicleTypes.smallTruck" },
  { id: "mediumTruck", labelKey: "onboarding.vehicleTypes.mediumTruck" },
  { id: "largeTruck", labelKey: "onboarding.vehicleTypes.largeTruck" },
  { id: "trailer", labelKey: "onboarding.vehicleTypes.trailer" },
  { id: "motorcycle", labelKey: "onboarding.vehicleTypes.motorcycle" },
];

export default function MoverProfile() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { active, can } = usePartnerCompany();

  const { data: profileData, isLoading } = useQuery({
     queryKey: ['partner-company'],
    queryFn: async () => {
       const data = await dispatchRequest<{ company: any }>("/api/partner/company");
       return data.company;
    },
     enabled: true,
  });

  const [editForm, setEditForm] = useState({
    companyName: "",
    description: "",
    yearsInBusiness: "",
    taxId: "",
    moveTypes: [] as string[],
    vehicleTypes: [] as string[],
    serviceAreas: "",
    operatingHours: "",
    contactPhone: "",
    businessEmail: "",
    website: "",
    operatingTimezone: "America/Mexico_City",
    serviceCapabilities: [] as string[],
    travelBufferMinutes: "60",
    turnaroundBufferMinutes: "30",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
       const response = await fetch(`/api/partner/company`, {
         method: 'PATCH', credentials: "include",
         headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          companyName: data.companyName || null,
          description: data.description || null,
          yearsInBusiness: data.yearsInBusiness ? parseInt(data.yearsInBusiness) : null,
          taxId: data.taxId || null,
          moveTypes: data.moveTypes,
          vehicleTypes: data.vehicleTypes,
          serviceAreas: data.serviceAreas ? data.serviceAreas.split(',').map(s => s.trim()) : [],
          operatingHours: data.operatingHours || null,
          contactPhone: data.contactPhone || null,
          businessEmail: data.businessEmail || null,
          website: data.website || null,
           operatingTimezone: data.operatingTimezone,
           serviceCapabilities: data.serviceCapabilities,
           travelBufferMinutes: parseInt(data.travelBufferMinutes) || 0,
           turnaroundBufferMinutes: parseInt(data.turnaroundBufferMinutes) || 0,
           onboardingComplete: true,
         }),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['partner-company'] });
      setEditDialogOpen(false);
      toast({
        title: t('common.success'),
        description: t('dashboard.mover.profile.updateSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('dashboard.mover.profile.updateError'),
        variant: "destructive",
      });
    },
  });

  const openEditDialog = () => {
    if (profileData) {
      setEditForm({
        companyName: profileData.companyName || "",
        description: profileData.description || "",
        yearsInBusiness: profileData.yearsInBusiness?.toString() || "",
        taxId: profileData.taxId || "",
        moveTypes: profileData.moveTypes || [],
        vehicleTypes: profileData.vehicleTypes || [],
        serviceAreas: profileData.serviceAreas?.join(', ') || "",
        operatingHours: profileData.operatingHours || "",
        contactPhone: profileData.contactPhone || "",
        businessEmail: profileData.businessEmail || "",
        website: profileData.website || "",
         operatingTimezone: profileData.operatingTimezone || "America/Mexico_City",
         serviceCapabilities: profileData.serviceCapabilities || [],
         travelBufferMinutes: String(profileData.travelBufferMinutes ?? 60),
         turnaroundBufferMinutes: String(profileData.turnaroundBufferMinutes ?? 30),
      });
    }
    setEditDialogOpen(true);
  };

  const updateEditField = (field: string, value: string | string[]) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: string, item: string) => {
    const current = editForm[field as keyof typeof editForm] as string[];
    if (current.includes(item)) {
      updateEditField(field, current.filter(i => i !== item));
    } else {
      updateEditField(field, [...current, item]);
    }
  };

  const isSpanish = i18n.language === 'es';

  const sidebarLinks = [
    { href: "/mover/dashboard", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "/mover/dashboard/profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "/mover/dashboard/company", label: isSpanish ? "Empresa y equipo" : "Company & team", icon: Users },
    { href: "/mover/dashboard/documents", label: isSpanish ? 'Documentos' : 'Documents', icon: FileCheck },
    { href: "/mover/dashboard/jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "/mover/dashboard/quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "/mover/dashboard/fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "/mover/dashboard/drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
    { href: "/mover/dashboard/calendar", label: isSpanish ? "Calendario operativo" : "Operations calendar", icon: CalendarDays },
  ];

  const moveTypeLabels: Record<string, string> = {
    local: t('onboarding.moveTypes.local'),
    longDistance: t('onboarding.moveTypes.longDistance'),
    commercial: t('onboarding.moveTypes.commercial'),
    residential: t('onboarding.moveTypes.residential'),
    packing: t('onboarding.moveTypes.packing'),
    storage: t('onboarding.moveTypes.storage'),
    specialItems: t('onboarding.moveTypes.specialItems'),
    international: t('onboarding.moveTypes.international'),
  };

  const vehicleTypeLabels: Record<string, string> = {
    van: t('onboarding.vehicleTypes.van'),
    smallTruck: t('onboarding.vehicleTypes.smallTruck'),
    mediumTruck: t('onboarding.vehicleTypes.mediumTruck'),
    largeTruck: t('onboarding.vehicleTypes.largeTruck'),
    trailer: t('onboarding.vehicleTypes.trailer'),
    motorcycle: t('onboarding.vehicleTypes.motorcycle'),
  };

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="mover">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">{t('dashboard.mover.profile.title')}</h1>
            <p className="text-muted-foreground">{profileData?.companyName || t('dashboard.mover.profile.noProfile')}</p>
          </div>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
             <DialogTrigger asChild>
              <Button onClick={openEditDialog} disabled={!can("company:manage")} className="bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600">
                <Pencil className="h-4 w-4 mr-2" />
                {t('dashboard.mover.profile.edit')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('dashboard.mover.profile.editTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('onboarding.companyName')}</Label>
                    <Input value={editForm.companyName} onChange={(e) => updateEditField('companyName', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('onboarding.taxId')}</Label>
                    <Input value={editForm.taxId} onChange={(e) => updateEditField('taxId', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('onboarding.description')}</Label>
                  <Textarea value={editForm.description} onChange={(e) => updateEditField('description', e.target.value)} rows={3} />
                </div>
                 <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>{t('onboarding.yearsInBusiness')}</Label><Input type="number" value={editForm.yearsInBusiness} onChange={(e) => updateEditField('yearsInBusiness', e.target.value)} /></div><div className="space-y-2"><Label>{isSpanish ? "Zona horaria" : "Time zone"}</Label><Input value={editForm.operatingTimezone} onChange={(e) => updateEditField('operatingTimezone', e.target.value)} /></div><div className="space-y-2"><Label>{isSpanish ? "Horas de operación" : "Operating hours"}</Label><Input value={editForm.operatingHours} onChange={(e) => updateEditField('operatingHours', e.target.value)} /></div></div>
                <div className="space-y-2">
                  <Label>{t('onboarding.moveTypes.title')}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MOVE_TYPES.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox checked={editForm.moveTypes.includes(type.id)} onCheckedChange={() => toggleArrayItem('moveTypes', type.id)} />
                        <Label className="font-normal">{t(type.labelKey)}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('onboarding.vehicleTypes.title')}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {VEHICLE_TYPES.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox checked={editForm.vehicleTypes.includes(type.id)} onCheckedChange={() => toggleArrayItem('vehicleTypes', type.id)} />
                        <Label className="font-normal">{t(type.labelKey)}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('onboarding.contactPhone')}</Label>
                    <Input value={editForm.contactPhone} onChange={(e) => updateEditField('contactPhone', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('common.businessEmail')}</Label>
                    <Input type="email" value={editForm.businessEmail} onChange={(e) => updateEditField('businessEmail', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('onboarding.serviceAreas')}</Label>
                  <Input value={editForm.serviceAreas} onChange={(e) => updateEditField('serviceAreas', e.target.value)} placeholder="CDMX, Guadalajara, Monterrey" />
                </div>
                 <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-2"><Label>{isSpanish ? "Sitio web" : "Website"}</Label><Input type="url" value={editForm.website} onChange={(e) => updateEditField('website', e.target.value)} placeholder="https://..." /></div><div className="space-y-2"><Label>{isSpanish ? "Buffer de viaje (min)" : "Travel buffer (min)"}</Label><Input type="number" value={editForm.travelBufferMinutes} onChange={(e) => updateEditField('travelBufferMinutes', e.target.value)} /></div></div>
                <Button onClick={() => updateMutation.mutate(editForm)} className="w-full bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {profileData ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('dashboard.mover.profile.company')}
                  <Badge variant={profileData.verificationStatus === 'verified' ? 'default' : 'secondary'} className={profileData.verificationStatus === 'verified' ? 'bg-green-500' : ''}>
                    {profileData.verificationStatus === 'verified' ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" />{t('dashboard.mover.profile.verified')}</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1" />{t('dashboard.mover.profile.pending')}</>
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--usg-ink)]">{profileData.companyName || '-'}</h3>
                  <p className="text-sm text-slate-500 mt-1">{profileData.description || '-'}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div><span className="text-slate-500">RFC:</span> <span className="font-medium">{profileData.taxId || '-'}</span></div>
                  <div><span className="text-slate-500">{t('dashboard.mover.profile.years')}:</span> <span className="font-medium">{profileData.yearsInBusiness || 0}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.mover.profile.contact')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{profileData.contactPhone || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <span>{profileData.businessEmail || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{profileData.serviceAreas?.join(', ') || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{profileData.operatingHours || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.mover.profile.fleet')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                   <div className="text-center p-4 bg-slate-50 rounded-lg sm:col-span-2"><div className="text-2xl font-bold text-[var(--usg-ink)]">{profileData.operatingTimezone || "America/Mexico_City"}</div><div className="text-sm text-slate-500">{isSpanish ? "Zona horaria operativa" : "Operating timezone"}</div></div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-2">{t('onboarding.vehicleTypes.title')}</div>
                  <div className="flex flex-wrap gap-1">
                    {profileData.vehicleTypes?.map((type: string) => (
                      <Badge key={type} variant="outline">{vehicleTypeLabels[type] || type}</Badge>
                    )) || <span className="text-slate-400">-</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.mover.profile.services')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profileData.moveTypes?.map((type: string) => (
                    <Badge key={type} className="bg-[var(--usg-lavender)] text-[var(--usg-purple)]">{moveTypeLabels[type] || type}</Badge>
                  )) || <span className="text-slate-400">-</span>}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center h-40 text-slate-400">
                {t('dashboard.mover.profile.noProfile')}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
