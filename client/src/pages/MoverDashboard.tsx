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
import { BarChart3, Package, Truck, Users, LayoutDashboard, FileText, Car, Building2, Phone, Globe, MapPin, Clock, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MoverQuotes } from "@/components/mover/MoverQuotes";

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

export default function MoverDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['mover-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/mover/profile/${user.id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.profile;
    },
    enabled: !!user?.id,
  });

  const [editForm, setEditForm] = useState({
    companyName: "",
    description: "",
    yearsInBusiness: "",
    taxId: "",
    fleetSize: "",
    crewSize: "",
    moveTypes: [] as string[],
    vehicleTypes: [] as string[],
    serviceAreas: "",
    operatingHours: "",
    contactPhone: "",
    businessEmail: "",
    website: "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const response = await fetch(`/api/mover/profile/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName || null,
          description: data.description || null,
          yearsInBusiness: data.yearsInBusiness ? parseInt(data.yearsInBusiness) : null,
          taxId: data.taxId || null,
          fleetSize: data.fleetSize ? parseInt(data.fleetSize) : null,
          crewSize: data.crewSize ? parseInt(data.crewSize) : null,
          moveTypes: data.moveTypes,
          vehicleTypes: data.vehicleTypes,
          serviceAreas: data.serviceAreas ? data.serviceAreas.split(',').map(s => s.trim()) : [],
          operatingHours: data.operatingHours || null,
          contactPhone: data.contactPhone || null,
          businessEmail: data.businessEmail || null,
          website: data.website || null,
          onboardingComplete: true,
        }),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-profile', user?.id] });
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
        fleetSize: profileData.fleetSize?.toString() || "",
        crewSize: profileData.crewSize?.toString() || "",
        moveTypes: profileData.moveTypes || [],
        vehicleTypes: profileData.vehicleTypes || [],
        serviceAreas: profileData.serviceAreas?.join(', ') || "",
        operatingHours: profileData.operatingHours || "",
        contactPhone: profileData.contactPhone || "",
        businessEmail: profileData.businessEmail || "",
        website: profileData.website || "",
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

  const sidebarLinks = [
    { href: "#overview", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "#profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "#jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "#quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "#fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "#drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
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

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">{t('dashboard.mover.title')}</h1>
            <p className="text-muted-foreground">{t('dashboard.mover.welcome')}</p>
          </div>
        </div>

        <section id="overview" className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.mover.activeJobs')}</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profileData?.totalJobs || 0}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.mover.activeJobsSub')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.mover.pendingQuotes')}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.mover.pendingQuotesSub')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.mover.revenue')}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.mover.revenueSub')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.mover.drivers')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profileData?.crewSize || 0}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.mover.driversSub')}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="profile" className="flex flex-col gap-4 py-6 border-t">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-primary">{t('dashboard.mover.profile.title')}</h2>
            <div className="flex items-center gap-2">
              {profileData?.verified ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {t('dashboard.mover.profile.verified')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                  <AlertCircle className="h-3 w-3 mr-1" /> {t('dashboard.mover.profile.pending')}
                </Badge>
              )}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={openEditDialog} data-testid="button-edit-profile">
                    <Pencil className="h-4 w-4 mr-1" /> {t('dashboard.mover.profile.edit')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('dashboard.mover.profile.editTitle')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-4">
                      <h4 className="font-medium text-[#1A1A1A] flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> {t('dashboard.mover.profile.company')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-companyName">{t('onboarding.company.name')}</Label>
                          <Input 
                            id="edit-companyName"
                            value={editForm.companyName}
                            onChange={(e) => updateEditField('companyName', e.target.value)}
                            data-testid="input-edit-company-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-taxId">{t('onboarding.company.taxId')}</Label>
                          <Input 
                            id="edit-taxId"
                            value={editForm.taxId}
                            onChange={(e) => updateEditField('taxId', e.target.value)}
                            placeholder="ABC123456XYZ"
                            data-testid="input-edit-tax-id"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">{t('onboarding.company.description')}</Label>
                        <Textarea 
                          id="edit-description"
                          value={editForm.description}
                          onChange={(e) => updateEditField('description', e.target.value)}
                          rows={2}
                          data-testid="input-edit-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-yearsInBusiness">{t('onboarding.company.years')}</Label>
                          <Input 
                            id="edit-yearsInBusiness"
                            type="number"
                            min="0"
                            value={editForm.yearsInBusiness}
                            onChange={(e) => updateEditField('yearsInBusiness', e.target.value)}
                            data-testid="input-edit-years"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-[#1A1A1A] flex items-center gap-2">
                        <Truck className="h-4 w-4" /> {t('dashboard.mover.profile.fleet')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-fleetSize">{t('onboarding.fleet.size')}</Label>
                          <Input 
                            id="edit-fleetSize"
                            type="number"
                            min="1"
                            value={editForm.fleetSize}
                            onChange={(e) => updateEditField('fleetSize', e.target.value)}
                            data-testid="input-edit-fleet-size"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-crewSize">{t('onboarding.fleet.crew')}</Label>
                          <Input 
                            id="edit-crewSize"
                            type="number"
                            min="1"
                            value={editForm.crewSize}
                            onChange={(e) => updateEditField('crewSize', e.target.value)}
                            data-testid="input-edit-crew-size"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('onboarding.fleet.vehicleTypes')}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {VEHICLE_TYPES.map((type) => (
                            <div key={type.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`edit-vehicle-${type.id}`}
                                checked={editForm.vehicleTypes.includes(type.id)}
                                onCheckedChange={() => toggleArrayItem('vehicleTypes', type.id)}
                              />
                              <label htmlFor={`edit-vehicle-${type.id}`} className="text-sm cursor-pointer">
                                {t(type.labelKey)}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('onboarding.fleet.moveTypes')}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {MOVE_TYPES.map((type) => (
                            <div key={type.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`edit-move-${type.id}`}
                                checked={editForm.moveTypes.includes(type.id)}
                                onCheckedChange={() => toggleArrayItem('moveTypes', type.id)}
                              />
                              <label htmlFor={`edit-move-${type.id}`} className="text-sm cursor-pointer">
                                {t(type.labelKey)}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-[#1A1A1A] flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {t('dashboard.mover.profile.services')}
                      </h4>
                      <div className="space-y-2">
                        <Label htmlFor="edit-serviceAreas">{t('onboarding.areas.coverage')}</Label>
                        <Textarea 
                          id="edit-serviceAreas"
                          value={editForm.serviceAreas}
                          onChange={(e) => updateEditField('serviceAreas', e.target.value)}
                          placeholder={t('onboarding.areas.placeholder')}
                          rows={2}
                          data-testid="input-edit-service-areas"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-operatingHours">{t('onboarding.areas.hours')}</Label>
                        <Input 
                          id="edit-operatingHours"
                          value={editForm.operatingHours}
                          onChange={(e) => updateEditField('operatingHours', e.target.value)}
                          placeholder={t('onboarding.areas.hoursPlaceholder')}
                          data-testid="input-edit-hours"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-[#1A1A1A] flex items-center gap-2">
                        <Phone className="h-4 w-4" /> {t('dashboard.mover.profile.contact')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-contactPhone">{t('onboarding.contact.phone')}</Label>
                          <Input 
                            id="edit-contactPhone"
                            type="tel"
                            value={editForm.contactPhone}
                            onChange={(e) => updateEditField('contactPhone', e.target.value)}
                            placeholder="+52 55 1234 5678"
                            data-testid="input-edit-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-businessEmail">{t('onboarding.contact.email')}</Label>
                          <Input 
                            id="edit-businessEmail"
                            type="email"
                            value={editForm.businessEmail}
                            onChange={(e) => updateEditField('businessEmail', e.target.value)}
                            data-testid="input-edit-business-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-website">{t('onboarding.contact.website')}</Label>
                        <Input 
                          id="edit-website"
                          type="url"
                          value={editForm.website}
                          onChange={(e) => updateEditField('website', e.target.value)}
                          placeholder="https://www.tuempresa.com"
                          data-testid="input-edit-website"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button 
                        onClick={() => updateMutation.mutate(editForm)}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateMutation.isPending ? t('common.saving') : t('common.save')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {profileData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-[#EF7521]" />
                    {t('dashboard.mover.profile.company')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('onboarding.company.name')}</p>
                    <p className="font-medium" data-testid="text-company-name">{profileData.companyName || '-'}</p>
                  </div>
                  {profileData.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('onboarding.company.description')}</p>
                      <p className="text-sm">{profileData.description}</p>
                    </div>
                  )}
                  <div className="flex gap-6">
                    {profileData.yearsInBusiness && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('onboarding.company.years')}</p>
                        <p className="font-medium">{profileData.yearsInBusiness} {t('dashboard.mover.profile.years')}</p>
                      </div>
                    )}
                    {profileData.taxId && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('onboarding.company.taxId')}</p>
                        <p className="font-medium">{profileData.taxId}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-5 w-5 text-[#EF7521]" />
                    {t('dashboard.mover.profile.contact')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profileData.contactPhone && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('onboarding.contact.phone')}</p>
                      <p className="font-medium">{profileData.contactPhone}</p>
                    </div>
                  )}
                  {profileData.businessEmail && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('onboarding.contact.email')}</p>
                      <p className="font-medium">{profileData.businessEmail}</p>
                    </div>
                  )}
                  {profileData.website && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('onboarding.contact.website')}</p>
                      <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[#EF7521] hover:underline flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {profileData.website}
                      </a>
                    </div>
                  )}
                  {!profileData.contactPhone && !profileData.businessEmail && !profileData.website && (
                    <p className="text-slate-400 text-sm">{t('dashboard.mover.profile.noContact')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5 text-[#EF7521]" />
                    {t('dashboard.mover.profile.fleet')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-6">
                    {profileData.fleetSize && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('onboarding.fleet.size')}</p>
                        <p className="font-medium text-xl">{profileData.fleetSize}</p>
                      </div>
                    )}
                    {profileData.crewSize && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('onboarding.fleet.crew')}</p>
                        <p className="font-medium text-xl">{profileData.crewSize}</p>
                      </div>
                    )}
                  </div>
                  {profileData.vehicleTypes && profileData.vehicleTypes.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">{t('onboarding.fleet.vehicleTypes')}</p>
                      <div className="flex flex-wrap gap-1">
                        {profileData.vehicleTypes.map((type: string) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {vehicleTypeLabels[type] || type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {!profileData.fleetSize && !profileData.crewSize && (!profileData.vehicleTypes || profileData.vehicleTypes.length === 0) && (
                    <p className="text-slate-400 text-sm">{t('dashboard.mover.profile.noFleet')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5 text-[#EF7521]" />
                    {t('dashboard.mover.profile.services')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profileData.moveTypes && profileData.moveTypes.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">{t('onboarding.fleet.moveTypes')}</p>
                      <div className="flex flex-wrap gap-1">
                        {profileData.moveTypes.map((type: string) => (
                          <Badge key={type} className="bg-[#F8D9BF] text-[#1A1A1A] hover:bg-[#F8D9BF] text-xs">
                            {moveTypeLabels[type] || type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profileData.serviceAreas && profileData.serviceAreas.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('onboarding.areas.coverage')}</p>
                      <p className="text-sm">{profileData.serviceAreas.join(', ')}</p>
                    </div>
                  )}
                  {profileData.operatingHours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profileData.operatingHours}</span>
                    </div>
                  )}
                  {(!profileData.moveTypes || profileData.moveTypes.length === 0) && (!profileData.serviceAreas || profileData.serviceAreas.length === 0) && (
                    <p className="text-slate-400 text-sm">{t('dashboard.mover.profile.noServices')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Building2 className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium mb-2">{t('dashboard.mover.profile.noProfile')}</p>
                  <Button variant="outline" onClick={openEditDialog}>
                    {t('dashboard.mover.profile.complete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section id="jobs" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-primary">{t('dashboard.mover.nav.jobs')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg">
                  {t('dashboard.mover.jobsPlaceholder')}
               </div>
             </CardContent>
           </Card>
        </section>

        <section id="quotes" className="flex flex-col gap-4 py-6 border-t">
          {profileData?.id && <MoverQuotes moverProfileId={profileData.id} />}
        </section>

        <section id="fleet" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-primary">{t('dashboard.mover.nav.fleet')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg">
                  {t('dashboard.mover.fleetPlaceholder')}
               </div>
             </CardContent>
           </Card>
        </section>

        <section id="drivers" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-primary">{t('dashboard.mover.nav.drivers')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg">
                  {t('dashboard.mover.driversPlaceholder')}
               </div>
             </CardContent>
           </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
