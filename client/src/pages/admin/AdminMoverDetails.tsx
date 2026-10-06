import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRoute, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { usePartnerStatuses } from "@/hooks/usePartnerStatuses";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { 
  ArrowLeft, Building2, Mail, Phone, Globe, Calendar, 
  Save, Loader2, Truck, Users, Star, FileText, CheckCircle2, XCircle, MessageCircle, Lock, Shield, History,
  FileCheck, Eye, Clock, AlertCircle, File
} from "lucide-react";

interface MoverProfile {
  id: string;
  userId: string;
  companyName: string;
  businessEmail: string | null;
  contactPhone: string | null;
  contactWhatsApp: string | null;
  website: string | null;
  description: string | null;
  taxId: string | null;
  insuranceInfo: string | null;
  serviceAreas: string[] | null;
  moveTypes: string[] | null;
  vehicleTypes: string[] | null;
  fleetSize: number | null;
  crewSize: number | null;
  yearsInBusiness: number | null;
  operatingHours: string | null;
  verified: boolean | null;
  partnerStatus: string | null;
  partnerStatusNote: string | null;
  partnerStatusUpdatedAt: string | null;
  rating: string | null;
  totalJobs: number | null;
  onboardingComplete: boolean | null;
  createdAt: string;
  user?: {
    id: string;
    email: string | null;
    fullName: string | null;
    phone: string | null;
    isActive: boolean | null;
    createdAt?: string;
  };
}

interface PartnerStatusHistoryEntry {
  id: string;
  moverProfileId: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

interface QuoteBid {
  id: string;
  quoteId: string;
  status: string;
  bidAmount: string | null;
  createdAt: string;
  quote?: {
    quoteNumber: string;
    fromAddress: string;
    toAddress: string;
  };
}

interface Rating {
  id: string;
  starRating: number;
  direction: string;
  createdAt: string;
  comments?: {
    publicComment: string | null;
    privateComment: string | null;
  } | null;
  aiTags?: Array<{
    id: string;
    sentiment: string;
    tag: string;
    tagEs?: string | null;
  }> | null;
  rater?: {
    fullName: string | null;
    email: string | null;
  } | null;
  quote?: {
    quoteNumber: string | null;
  } | null;
}

interface PartnerDocument {
  id: string;
  moverProfileId: string;
  documentTypeId: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documentType?: {
    id: string;
    key: string;
    nameEs: string;
    nameEn: string;
    descriptionEs: string | null;
    descriptionEn: string | null;
    isRequired: boolean;
  };
}

export default function AdminMoverDetails() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/dashboard/movers/:moverId");
  const moverId = params?.moverId;
  const locale = i18n.language === 'es' ? es : enUS;
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    companyName: '',
    businessEmail: '',
    contactPhone: '',
    contactWhatsApp: '',
    website: '',
    description: '',
    taxId: '',
    insuranceInfo: '',
    fleetSize: 0,
    crewSize: 0,
    yearsInBusiness: 0,
    operatingHours: '',
    verified: false,
  });

  const { data: moverData, isLoading } = useQuery<{ mover: MoverProfile }>({
    queryKey: [`/api/admin/movers/${moverId}`],
    enabled: !!moverId,
  });

  const { data: bidsData } = useQuery<{ bids: QuoteBid[] }>({
    queryKey: [`/api/admin/movers/${moverId}/bids`],
    enabled: !!moverId,
  });

  const { data: ratingsData } = useQuery<{ ratings: Rating[] }>({
    queryKey: [`/api/admin/movers/${moverId}/ratings`],
    enabled: !!moverId,
  });

  const { data: statusHistoryData } = useQuery<{ history: PartnerStatusHistoryEntry[] }>({
    queryKey: [`/api/admin/movers/${moverId}/status-history`],
    enabled: !!moverId,
  });

  const { data: documentsData, refetch: refetchDocuments } = useQuery<PartnerDocument[]>({
    queryKey: [`/api/admin/movers/${moverId}/documents`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/movers/${moverId}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!moverId,
  });

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const reviewDocumentMutation = useMutation({
    mutationFn: async ({ docId, status, note }: { docId: string; status: string; note?: string }) => {
      const response = await fetch(`/api/admin/documents/${docId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNote: note }),
      });
      if (!response.ok) throw new Error('Failed to review document');
      return response.json();
    },
    onSuccess: () => {
      refetchDocuments();
      setReviewingDocId(null);
      setReviewNote('');
      toast({
        title: lang === 'es' ? 'Documento revisado' : 'Document reviewed',
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error al revisar' : 'Review failed',
        variant: 'destructive',
      });
    },
  });

  const { statuses, getStatusLabel, getStatusColor, getStatusOptions, getStatusDescription } = usePartnerStatuses();

  const mover = moverData?.mover;
  const bids = bidsData?.bids || [];
  const ratings = ratingsData?.ratings || [];
  const statusHistory = statusHistoryData?.history || [];
  const documents = documentsData || [];

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch(`/api/admin/movers/${moverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update mover');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/movers/${moverId}`] });
      setIsEditing(false);
      toast({
        title: lang === 'es' ? 'Socio actualizado' : 'Partner updated',
        description: lang === 'es' ? 'Los cambios se guardaron correctamente' : 'Changes saved successfully',
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

  const verifyMutation = useMutation({
    mutationFn: async (verified: boolean) => {
      const res = await fetch(`/api/admin/movers/${moverId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });
      if (!res.ok) throw new Error('Failed to update verification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/movers/${moverId}`] });
      toast({
        title: lang === 'es' ? 'Estado actualizado' : 'Status updated',
      });
    },
  });

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ status, note }: { status: string; note?: string }) => {
      const res = await fetch(`/api/admin/movers/${moverId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/movers/${moverId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/movers/${moverId}/status-history`] });
      setStatusNote('');
      toast({
        title: lang === 'es' ? 'Estado actualizado' : 'Status updated',
        description: lang === 'es' ? 'El estado del socio se actualizó correctamente' : 'Partner status updated successfully',
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

  const [statusNote, setStatusNote] = useState('');

  const startEditing = () => {
    if (mover) {
      setEditForm({
        companyName: mover.companyName || '',
        businessEmail: mover.businessEmail || '',
        contactPhone: mover.contactPhone || '',
        contactWhatsApp: mover.contactWhatsApp || '',
        website: mover.website || '',
        description: mover.description || '',
        taxId: mover.taxId || '',
        insuranceInfo: mover.insuranceInfo || '',
        fleetSize: mover.fleetSize || 0,
        crewSize: mover.crewSize || 0,
        yearsInBusiness: mover.yearsInBusiness || 0,
        operatingHours: mover.operatingHours || '',
        verified: mover.verified || false,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const avgRating = ratings.length > 0 
    ? (ratings.reduce((sum, r) => sum + r.starRating, 0) / ratings.length).toFixed(1)
    : null;

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

  if (!mover) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {lang === 'es' ? 'El socio solicitado no existe' : 'The requested partner does not exist'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation('/admin/dashboard/movers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a socios' : 'Back to partners'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/admin/dashboard/movers')} data-testid="button-back-movers">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a socios' : 'Back to partners'}
          </Button>
          {!isEditing ? (
            <Button onClick={startEditing} data-testid="button-edit-mover">
              {lang === 'es' ? 'Editar socio' : 'Edit partner'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-mover">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Save className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Guardar' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{mover.totalJobs || 0}</div>
                <p className="text-sm text-muted-foreground">
                  {lang === 'es' ? 'Trabajos Completados' : 'Jobs Completed'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-3xl font-bold">
                  {avgRating || 'N/A'}
                  {avgRating && <Star className="h-6 w-6 fill-amber-400 text-amber-400" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === 'es' ? 'Calificación Promedio' : 'Average Rating'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{mover.fleetSize || 0}</div>
                <p className="text-sm text-muted-foreground">
                  {lang === 'es' ? 'Vehículos' : 'Vehicles'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{mover.crewSize || 0}</div>
                <p className="text-sm text-muted-foreground">
                  {lang === 'es' ? 'Personal' : 'Crew Size'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-company-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {lang === 'es' ? 'Información de la Empresa' : 'Company Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Nombre de la empresa' : 'Company name'}</Label>
                    <Input
                      value={editForm.companyName}
                      onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Email comercial' : 'Business email'}</Label>
                      <Input
                        type="email"
                        value={editForm.businessEmail}
                        onChange={(e) => setEditForm({ ...editForm, businessEmail: e.target.value })}
                        data-testid="input-business-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Teléfono' : 'Phone'}</Label>
                      <Input
                        value={editForm.contactPhone}
                        onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>WhatsApp</Label>
                      <Input
                        value={editForm.contactWhatsApp}
                        onChange={(e) => setEditForm({ ...editForm, contactWhatsApp: e.target.value })}
                        data-testid="input-whatsapp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Sitio web' : 'Website'}</Label>
                      <Input
                        value={editForm.website}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        data-testid="input-website"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Descripción' : 'Description'}</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                      data-testid="input-description"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{mover.companyName}</h3>
                    <Badge variant={mover.verified ? 'default' : 'secondary'} className="flex items-center gap-1">
                      {mover.verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {mover.verified 
                        ? (lang === 'es' ? 'Verificado' : 'Verified')
                        : (lang === 'es' ? 'No Verificado' : 'Not Verified')}
                    </Badge>
                  </div>
                  {mover.description && <p className="text-sm text-muted-foreground">{mover.description}</p>}
                  <Separator />
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{mover.businessEmail || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{mover.contactPhone || 'N/A'}</span>
                    </div>
                    {mover.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a href={mover.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {mover.website}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lang === 'es' ? 'Registrado: ' : 'Registered: '}
                        {(() => {
                          const dateStr = mover.createdAt || mover.user?.createdAt;
                          return dateStr ? format(new Date(dateStr), 'PP', { locale }) : 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-business-details">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {lang === 'es' ? 'Detalles del Negocio' : 'Business Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'RFC/ID Fiscal' : 'Tax ID'}</Label>
                      <Input
                        value={editForm.taxId}
                        onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                        data-testid="input-tax-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Años en operación' : 'Years in business'}</Label>
                      <Input
                        type="number"
                        value={editForm.yearsInBusiness}
                        onChange={(e) => setEditForm({ ...editForm, yearsInBusiness: parseInt(e.target.value) || 0 })}
                        data-testid="input-years"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Tamaño de flota' : 'Fleet size'}</Label>
                      <Input
                        type="number"
                        value={editForm.fleetSize}
                        onChange={(e) => setEditForm({ ...editForm, fleetSize: parseInt(e.target.value) || 0 })}
                        data-testid="input-fleet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Personal' : 'Crew size'}</Label>
                      <Input
                        type="number"
                        value={editForm.crewSize}
                        onChange={(e) => setEditForm({ ...editForm, crewSize: parseInt(e.target.value) || 0 })}
                        data-testid="input-crew"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Horario de operación' : 'Operating hours'}</Label>
                    <Input
                      value={editForm.operatingHours}
                      onChange={(e) => setEditForm({ ...editForm, operatingHours: e.target.value })}
                      placeholder="Lun-Vie 8:00-18:00"
                      data-testid="input-hours"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Información de seguro' : 'Insurance info'}</Label>
                    <Textarea
                      value={editForm.insuranceInfo}
                      onChange={(e) => setEditForm({ ...editForm, insuranceInfo: e.target.value })}
                      rows={2}
                      data-testid="input-insurance"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{lang === 'es' ? 'RFC/ID Fiscal' : 'Tax ID'}</span>
                    <span className="font-medium">{mover.taxId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{lang === 'es' ? 'Años en operación' : 'Years in business'}</span>
                    <span className="font-medium">{mover.yearsInBusiness || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{lang === 'es' ? 'Horario' : 'Hours'}</span>
                    <span className="font-medium">{mover.operatingHours || 'N/A'}</span>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1">{lang === 'es' ? 'Seguro' : 'Insurance'}</p>
                    <p className="text-sm">{mover.insuranceInfo || (lang === 'es' ? 'Sin información' : 'No information')}</p>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>{lang === 'es' ? 'Verificar socio' : 'Verify partner'}</span>
                    <Switch
                      checked={mover.verified || false}
                      onCheckedChange={(checked) => verifyMutation.mutate(checked)}
                      disabled={verifyMutation.isPending}
                      data-testid="switch-verify"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-partner-status">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              {lang === 'es' ? 'Estado del Socio' : 'Partner Status'}
            </CardTitle>
            <CardDescription>
              {getStatusDescription(mover.partnerStatus)}
              <span className="block text-xs mt-1 text-action">
                {lang === 'es' ? 'Usa el selector para cambiar el estado' : 'Use the dropdown to change status'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const allStatuses = statuses;
              const currentStatus = mover.partnerStatus || 'pending';
              const currentIdx = allStatuses.findIndex(s => s.key === currentStatus);
              const statusColors = getStatusColor(currentStatus);
              const currentStatusData = statuses.find(s => s.key === currentStatus);
              const isFinalState = currentStatusData?.isFinal;
              
              return (
                <>
                  {/* Progress bar with stage dots */}
                  <div className="relative py-4">
                    {/* Background track */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full -translate-y-1/2" />
                    
                    {/* Filled track */}
                    <div 
                      className="absolute top-1/2 left-0 h-1 rounded-full -translate-y-1/2 transition-all duration-500"
                      style={{ 
                        width: `${currentIdx >= 0 ? (currentIdx / Math.max(allStatuses.length - 1, 1)) * 100 : 0}%`,
                        backgroundColor: isFinalState 
                          ? (currentStatus === 'active' ? '#10B981' : '#dc2626')
                          : 'hsl(var(--action))'
                      }}
                    />
                    
                    {/* Stage dots */}
                    <div className="relative flex justify-between">
                      {allStatuses.map((status, idx) => {
                        const isCurrentStep = status.key === currentStatus;
                        const isPastStep = idx < currentIdx;
                        const dotColors = getStatusColor(status.key);
                        const isFinal = status.isFinal;
                        const isActiveStatus = status.key === 'active';
                        const finalColor = isActiveStatus ? '#10B981' : isFinal ? '#dc2626' : dotColors.color;
                        
                        return (
                          <div 
                            key={status.id} 
                            className="flex flex-col items-center"
                            style={{ width: '24px' }}
                            title={lang === 'es' ? status.labelEs : status.labelEn}
                          >
                            <div 
                              className={`w-4 h-4 rounded-full border-2 transition-all ${
                                isCurrentStep ? 'w-5 h-5 ring-2 ring-offset-1' : ''
                              }`}
                              style={{ 
                                backgroundColor: isPastStep || isCurrentStep ? (isActiveStatus ? '#10B981' : isFinal ? finalColor : 'hsl(var(--action))') : 'white',
                                borderColor: isPastStep || isCurrentStep ? (isActiveStatus ? '#10B981' : isFinal ? finalColor : 'hsl(var(--action))') : '#d1d5db',
                                ['--tw-ring-color' as string]: isCurrentStep ? (isActiveStatus ? '#10B981' : isFinal ? finalColor : 'hsl(var(--action))') : 'transparent'
                              }}
                            >
                              {isPastStep && (
                                <CheckCircle2 className="w-full h-full text-white" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Status labels below dots */}
                    <div className="relative flex justify-between mt-2">
                      {allStatuses.map((status) => (
                        <div 
                          key={status.id} 
                          className="text-[10px] text-center text-muted-foreground"
                          style={{ width: `${100 / allStatuses.length}%` }}
                        >
                          {lang === 'es' ? status.labelEs : status.labelEn}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Current status display with dropdown */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: statusColors.bgColor }}>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'white', border: `2px solid ${statusColors.color}` }}
                      >
                        {currentStatus === 'active' ? (
                          <CheckCircle2 className="h-5 w-5" style={{ color: statusColors.color }} />
                        ) : currentStatus === 'inactive' || currentStatus === 'suspended' ? (
                          <XCircle className="h-5 w-5" style={{ color: statusColors.color }} />
                        ) : (
                          <span className="text-sm font-bold" style={{ color: statusColors.color }}>
                            {currentIdx >= 0 ? currentIdx + 1 : '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: statusColors.color }}>
                          {currentStatusData ? (lang === 'es' ? currentStatusData.labelEs : currentStatusData.labelEn) : currentStatus}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getStatusDescription(currentStatus)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status dropdown */}
                    <Select
                      value={currentStatus}
                      onValueChange={(value) => {
                        if (value !== currentStatus) {
                          statusUpdateMutation.mutate({ status: value, note: statusNote || undefined });
                        }
                      }}
                      disabled={statusUpdateMutation.isPending}
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-partner-status">
                        <SelectValue placeholder={lang === 'es' ? 'Cambiar estado' : 'Change status'} />
                      </SelectTrigger>
                      <SelectContent>
                        {getStatusOptions().map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              );
            })()}
            
            {/* Note input */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {lang === 'es' ? 'Nota para el cambio de estado (opcional)' : 'Note for status change (optional)'}
              </Label>
              <Input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={lang === 'es' ? 'Agregar nota al cambio de estado...' : 'Add note to status change...'}
                data-testid="input-status-note"
              />
            </div>
            
            {mover.partnerStatusNote && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  {lang === 'es' ? 'Última nota:' : 'Last note:'}
                </p>
                <p className="text-sm">{mover.partnerStatusNote}</p>
                {mover.partnerStatusUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(mover.partnerStatusUpdatedAt), 'PPpp', { locale })}
                  </p>
                )}
              </div>
            )}
            
            <Separator />
            
            {/* Status History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {lang === 'es' ? 'Historial de Estados' : 'Status History'}
                </span>
              </div>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {lang === 'es' ? 'Sin historial' : 'No history'}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {statusHistory.slice(0, 10).map((entry) => (
                    <div 
                      key={entry.id} 
                      className="flex items-start gap-3 p-2 border rounded text-sm"
                      data-testid={`status-history-${entry.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {entry.fromStatus && (
                            <>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{
                                  borderColor: getStatusColor(entry.fromStatus).color,
                                  color: getStatusColor(entry.fromStatus).color,
                                }}
                              >
                                {getStatusLabel(entry.fromStatus)}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge 
                            className="text-xs"
                            style={{
                              backgroundColor: getStatusColor(entry.toStatus).bgColor,
                              color: getStatusColor(entry.toStatus).color,
                            }}
                          >
                            {getStatusLabel(entry.toStatus)}
                          </Badge>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{entry.actorName || entry.actorType}</p>
                        <p>{format(new Date(entry.createdAt), 'PP', { locale })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-partner-documents">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-action" />
              {lang === 'es' ? 'Documentos del Socio' : 'Partner Documents'}
            </CardTitle>
            <CardDescription>
              {lang === 'es' 
                ? 'Revisa y aprueba los documentos requeridos del socio' 
                : 'Review and approve required partner documents'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === 'es' ? 'No hay documentos subidos' : 'No documents uploaded'}
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const isReviewing = reviewingDocId === doc.id;
                  const docName = doc.documentType 
                    ? (lang === 'es' ? doc.documentType.nameEs : doc.documentType.nameEn)
                    : doc.fileName;
                  
                  return (
                    <div 
                      key={doc.id} 
                      className="p-4 border rounded-lg"
                      data-testid={`doc-${doc.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <File className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="font-medium">{docName}</p>
                            <p className="text-sm text-muted-foreground">{doc.fileName}</p>
                            {doc.fileSize && (
                              <p className="text-xs text-muted-foreground">
                                {(doc.fileSize / 1024).toFixed(1)} KB{doc.createdAt && ` - ${format(new Date(doc.createdAt), 'PP', { locale })}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={
                            doc.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' :
                            doc.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                            doc.status === 'submitted' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }
                        >
                          {doc.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {doc.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                          {doc.status === 'submitted' && <Clock className="h-3 w-3 mr-1" />}
                          {doc.status === 'pending' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {doc.status === 'approved' ? (lang === 'es' ? 'Aprobado' : 'Approved') :
                           doc.status === 'rejected' ? (lang === 'es' ? 'Rechazado' : 'Rejected') :
                           doc.status === 'submitted' ? (lang === 'es' ? 'En revisión' : 'Under Review') :
                           (lang === 'es' ? 'Pendiente' : 'Pending')}
                        </Badge>
                      </div>

                      {doc.reviewNote && (
                        <div className="p-2 bg-slate-50 rounded mb-3">
                          <p className="text-sm">
                            <span className="font-medium">{lang === 'es' ? 'Nota:' : 'Note:'}</span> {doc.reviewNote}
                          </p>
                          {doc.reviewedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(doc.reviewedAt), 'PPp', { locale })}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/admin/documents/${doc.id}/file`, '_blank')}
                          data-testid={`view-doc-${doc.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {lang === 'es' ? 'Ver' : 'View'}
                        </Button>

                        {doc.status !== 'approved' && (
                          <>
                            {isReviewing ? (
                              <div className="flex-1 flex items-center gap-2">
                                <Input
                                  value={reviewingDocId === doc.id ? reviewNote : ''}
                                  onChange={(e) => setReviewNote(e.target.value)}
                                  placeholder={lang === 'es' ? 'Nota (opcional)...' : 'Note (optional)...'}
                                  className="flex-1"
                                  data-testid={`review-note-${doc.id}`}
                                />
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => reviewDocumentMutation.mutate({ docId: doc.id, status: 'approved', note: reviewNote })}
                                  disabled={reviewDocumentMutation.isPending}
                                  data-testid={`approve-doc-${doc.id}`}
                                >
                                  {reviewDocumentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => reviewDocumentMutation.mutate({ docId: doc.id, status: 'rejected', note: reviewNote })}
                                  disabled={reviewDocumentMutation.isPending}
                                  data-testid={`reject-doc-${doc.id}`}
                                >
                                  {reviewDocumentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setReviewingDocId(null); setReviewNote(''); }}
                                >
                                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setReviewingDocId(doc.id); setReviewNote(''); }}
                                data-testid={`review-doc-${doc.id}`}
                              >
                                {lang === 'es' ? 'Revisar' : 'Review'}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-mover-bids">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {lang === 'es' ? 'Ofertas Recientes' : 'Recent Bids'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bids.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === 'es' ? 'No hay ofertas' : 'No bids yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {bids.slice(0, 5).map((bid) => (
                  <div 
                    key={bid.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => setLocation(`/admin/dashboard/quotes/${bid.quoteId}`)}
                    data-testid={`bid-row-${bid.id}`}
                  >
                    <div>
                      <p className="font-medium">{bid.quote?.quoteNumber || bid.quoteId}</p>
                      {bid.quote && (
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {bid.quote.fromAddress} → {bid.quote.toAddress}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {bid.bidAmount && (
                        <span className="font-semibold">${parseFloat(bid.bidAmount).toLocaleString()}</span>
                      )}
                      <Badge variant="outline">{bid.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(bid.createdAt), 'PP', { locale })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-mover-ratings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              {lang === 'es' ? 'Calificaciones Recibidas' : 'Received Ratings'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === 'es' ? 'Sin calificaciones' : 'No ratings yet'}
              </p>
            ) : (
              <div className="space-y-3">
                {ratings.slice(0, 5).map((rating) => (
                  <div key={rating.id} className="p-3 border rounded-lg" data-testid={`rating-${rating.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star}
                            className={`h-4 w-4 ${
                              star <= rating.starRating 
                                ? 'fill-amber-400 text-amber-400' 
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                        <span className="ml-2 font-medium">{rating.starRating}/5</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rating.aiTags && rating.aiTags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {rating.aiTags.map((tag) => (
                              <Badge key={tag.id} variant="outline" className={
                                tag.sentiment === 'positive' ? 'bg-green-50 text-green-700' :
                                tag.sentiment === 'negative' ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-700'
                              }>
                                {lang === 'es' && tag.tagEs ? tag.tagEs : tag.tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(rating.createdAt), 'PP', { locale })}
                        </span>
                      </div>
                    </div>
                    {rating.rater && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {lang === 'es' ? 'De: ' : 'From: '}{rating.rater.fullName || rating.rater.email || 'N/A'}
                      </p>
                    )}
                    {rating.comments?.publicComment && (
                      <div className="bg-slate-50 rounded-lg p-2 mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <MessageCircle className="h-3 w-3" />
                          {lang === 'es' ? 'Comentario público' : 'Public comment'}
                        </div>
                        <p className="text-sm">{rating.comments.publicComment}</p>
                      </div>
                    )}
                    {rating.comments?.privateComment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                        <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
                          <Lock className="h-3 w-3" />
                          {lang === 'es' ? 'Comentario privado (solo admin)' : 'Private comment (admin only)'}
                        </div>
                        <p className="text-sm">{rating.comments.privateComment}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {mover.user && (
          <Card data-testid="card-linked-user">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {lang === 'es' ? 'Usuario Vinculado' : 'Linked User'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                onClick={() => setLocation(`/admin/dashboard/users/${mover.user?.id}`)}
              >
                <div>
                  <p className="font-medium">{mover.user.fullName || mover.user.email}</p>
                  <p className="text-sm text-muted-foreground">{mover.user.email}</p>
                </div>
                <Badge variant={mover.user.isActive ? 'default' : 'secondary'}>
                  {mover.user.isActive ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Inactivo' : 'Inactive')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
