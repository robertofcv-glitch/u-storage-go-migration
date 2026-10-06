import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Truck, Activity, MapPin, Calendar, 
  Home, Clock, DollarSign, Mail, ArrowLeft, Download, 
  Send, Package, User, Building2, Phone, History, Gavel, CheckCircle2, XCircle,
  AlertCircle, Eye, FileDown, Loader2, FileText, Star, MessageSquare, ThumbsUp, ThumbsDown, Pencil,
  Warehouse
} from "lucide-react";
import { InventoryEditor } from "@/components/quote/InventoryEditor";
import { useTranslation } from "react-i18next";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useLocation, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useWorkflowStatuses } from "@/hooks/useWorkflowStatuses";
import { AdminDispatchConsole } from "@/components/dispatch/AdminDispatchConsole";
import { StorageMoveContext } from "@/components/quote/StorageMoveContext";
import { getStorageMoveContext } from "@shared/storageMoveContext";
import { AdminCommercialLifecycle } from "@/components/quote/AdminCommercialLifecycle";
import { normalizeQuoteStage, QUOTE_STAGE_LABELS, QUOTE_STAGE } from "@shared/workflowStages";

interface CrmOutboxEntry {
  id: string;
  provider: string;
  partner: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError: string | null;
  externalId: string | null;
  sentAt: string | null;
  dryRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteDetails {
  id: string;
  quoteNumber: string | null;
  userId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isPartial: boolean | null;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  moveAvailabilityStart: string | null;
  moveAvailabilityEnd: string | null;
  preferredMoveDates: string[];
  blockedMoveDates: string[];
  homeSize: string;
  storageOption: string | null;
  needsInsurance: boolean | null;
  needsPacking: boolean | null;
  needsUnpacking: boolean | null;
  needsBox: boolean | null;
  clientNotes: string | null;
  status: string | null;
  workflowStatus: string | null;
  estimatedCost: string | null;
  estimatedCostHigh: string | null;
  estimatedCurrency: string | null;
  suggestedPrice: string | null;
  finalPrice: string | null;
  workflowMode?: string | null;
  priceProposalAmount?: string | null;
  priceProposalCurrency?: string | null;
  priceProposalNote?: string | null;
  priceClientResponse?: string | null;
  priceClientChangeRequest?: string | null;
  paymentDeadline?: string | null;
  collectionStatus?: string | null;
  adminNotes: string | null;
  assignedMoverProfileId: string | null;
  biddingOpensAt: string | null;
  biddingClosesAt: string | null;
  clientConfirmedAt: string | null;
  partner: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  landingPage: string | null;
  referrerUrl: string | null;
  storageBranchId: string | null;
  serviceMode?: string | null;
  storageBranchBrand?: string | null;
  storageBranchGooglePlaceId?: string | null;
  storageBranchName?: string | null;
  storageBranchAddress?: string | null;
  storageBranchSnapshot?: unknown;
  eligibilityCheckedAt?: string | null;
  eligibilityVersion?: number | null;
  storageMoveType: string | null;
  storageBranchDistanceKm: string | null;
  storageSizeLabel: string | null;
  storageSizeM2: string | null;
  storageAccepted: boolean | null;
  storageAcceptedAt: string | null;
  storageContractStatus?: string | null;
  storageRentalIntent?: string | null;
  storageSelectedUnitSnapshot?: {
    code?: string;
    usableSizeM2?: number | string;
    dimensions?: string;
    floor?: string | number;
    priceMxn?: number | string;
    promotion?: string;
    characteristics?: string[];
  } | null;
  storageAvailabilityStatus?: string | null;
  storageAvailabilityCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  followUpOwnerId?: string | null;
  creator?: { id?: string; fullName?: string | null; email?: string | null } | null;
  followUpOwner?: { id?: string; fullName?: string | null; email?: string | null } | null;
  createdBy?: { id?: string; fullName?: string | null; email?: string | null } | null;
  followUpOwnerUser?: { id?: string; fullName?: string | null; email?: string | null } | null;
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  inventoryItems: Array<{
    id: string;
    itemName: string;
    room: string | null;
    category: string | null;
    quantity: number;
    notes: string | null;
  }>;
  quoteServices: Array<{ id?: string; service: { id: string; nameEn: string; nameEs: string }; creator?: { fullName?: string | null; email?: string | null } | null; followUpOwner?: { id?: string; fullName?: string | null; email?: string | null } | null }>;
  quoteAddOns: Array<{ addOn: { id: string; nameEn: string; nameEs: string } }>;
  invitations: Array<{
    id: string;
    status: string;
    createdAt: string;
    viewedAt: string | null;
    respondedAt: string | null;
    moverProfile: {
      id: string;
      companyName: string;
      contactEmail: string | null;
    };
  }>;
  bids: Array<{
    id: string;
    amount: string;
    originalAmount: string | null;
    isOriginalPrice: boolean | null;
    adjustmentReason: string | null;
    currency: string;
    status: string;
    adminReviewStatus: string | null;
    adminReviewNote: string | null;
    adminReviewedAt: string | null;
    proposedMoveDate: string | null;
    validUntil: string | null;
    estimatedHours: number | null;
    crewSize: number | null;
    vehiclesNeeded: number | null;
    notes: string | null;
    submittedAt: string | null;
    clientPreferenceRank: number | null;
    clientPreferenceUpdatedAt: string | null;
    moverProfile: {
      id: string;
      companyName: string;
      contactEmail: string | null;
    };
  }>;
  assignedMover: {
    id: string;
    companyName: string;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
}

interface QuoteDocument {
  id: string;
  quoteId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  createdAt: string;
}

interface StatusHistoryEntry {
  id: string;
  quoteId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

interface ClientUser {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface QuoteRating {
  id: string;
  quoteId: string;
  raterUserId: string;
  targetUserId: string;
  moverProfileId: string | null;
  direction: string;
  starRating: number;
  excellenceCategories: string[];
  improvementCategories: string[];
  createdAt: string;
  comments?: {
    publicComment: string | null;
    privateComment: string | null;
  } | null;
  aiTags?: Array<{
    tag: string;
    tagEs: string | null;
    sentiment: string;
  }>;
  rater?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

interface ActivityLogEntry {
  id: string;
  quoteId: string;
  actionType: string;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  description: string;
  descriptionEs: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}


const homeSizeLabels: Record<string, { es: string; en: string }> = {
  studio: { es: 'Estudio', en: 'Studio' },
  '1br': { es: '1 Habitación', en: '1 Bedroom' },
  '2br': { es: '2 Habitaciones', en: '2 Bedrooms' },
  '3br': { es: '3 Habitaciones', en: '3 Bedrooms' },
  '4br': { es: '4+ Habitaciones', en: '4+ Bedrooms' },
  house: { es: 'Casa', en: 'House' },
  office: { es: 'Oficina', en: 'Office' },
};

const bidStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  withdrawn: 'bg-red-100 text-red-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdminQuoteDetails() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/dashboard/quotes/:quoteId");
  const quoteId = params?.quoteId;
  const locale = i18n.language === 'es' ? es : enUS;
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [inviteDeadline, setInviteDeadline] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [removeInvitationId, setRemoveInvitationId] = useState<string | null>(null);
  const [removeNote, setRemoveNote] = useState('');
  const [editDeadlineDialogOpen, setEditDeadlineDialogOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [deadlineNote, setDeadlineNote] = useState('');
  const [closeBiddingDialogOpen, setCloseBiddingDialogOpen] = useState(false);
  const [closeBiddingNote, setCloseBiddingNote] = useState('');
  const [selectedFollowUpOwner, setSelectedFollowUpOwner] = useState('');
  const [selectedServiceOwner, setSelectedServiceOwner] = useState<Record<string, string>>({});
  const { statuses, getStatusLabel, getStatusColor, getStatusDescription } = useWorkflowStatuses();

  const { data: quoteData, isLoading, refetch } = useQuery<{ quote?: QuoteDetails } | QuoteDetails>({
    queryKey: [`/api/admin/quotes/${quoteId}`],
    enabled: !!quoteId,
  });

  const { data: documentsData, refetch: refetchDocuments } = useQuery<{ documents: QuoteDocument[] }>({
    queryKey: [`/api/admin/quotes/${quoteId}/documents`],
    enabled: !!quoteId,
  });

  const { data: historyData } = useQuery<{ history: StatusHistoryEntry[] }>({
    queryKey: [`/api/admin/quotes/${quoteId}/history`],
    enabled: !!quoteId,
  });

  const { data: activityLogData } = useQuery<{ activityLog: ActivityLogEntry[] }>({
    queryKey: [`/api/admin/quotes/${quoteId}/activity-log`],
    enabled: !!quoteId,
  });

  const { data: clientsData } = useQuery<{ users: ClientUser[] }>({
    queryKey: ['/api/admin/users'],
  });
  const { data: teamData } = useQuery<{ teamMembers: ClientUser[] }>({
    queryKey: ['/api/admin/assisted-quotes/team-members'],
  });

  const { data: ratingsData } = useQuery<QuoteRating[]>({
    queryKey: [`/api/quotes/${quoteId}/ratings`],
    enabled: !!quoteId,
  });

  const { data: activePartnersData } = useQuery<{ partners: Array<{ id: string; companyName: string; user: { fullName: string } }> }>({
    queryKey: ['/api/admin/active-partners'],
    enabled: inviteDialogOpen,
  });

  const { data: crmOutboxData } = useQuery<{ entries: CrmOutboxEntry[] }>({
    queryKey: [`/api/admin/quotes/${quoteId}/crm-outbox`],
    enabled: !!quoteId,
  });

  const retryCrmMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/admin/crm/outbox/${entryId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to retry CRM delivery');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/crm-outbox`] });
      toast({
        title: lang === 'es' ? 'Reintento programado' : 'Retry scheduled',
        description: lang === 'es' ? 'El envío al CRM se reintentará en breve' : 'CRM delivery will be retried shortly',
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo reintentar el envío' : 'Could not retry delivery',
        variant: 'destructive',
      });
    },
  });

  // Get active partners for invitations (only partners with 'active' status can be invited)
  const moverProfiles = (activePartnersData?.partners || [])
    .map((p) => ({ id: p.id, companyName: p.companyName || p.user?.fullName || 'Unknown' }));

  const quote = (quoteData && 'quote' in quoteData ? quoteData.quote : quoteData) as QuoteDetails | undefined;
  const documents = documentsData?.documents || [];

  // Countdown timer for bidding deadline
  useEffect(() => {
    const isBiddingActive = quote?.workflowStatus === 'bidding_open' || quote?.workflowStatus === 'bidding';
    if (!quote?.biddingClosesAt || !isBiddingActive) {
      setCountdownText(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(quote.biddingClosesAt!).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setCountdownText(lang === 'es' ? 'Licitación cerrada' : 'Bidding closed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdownText(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdownText(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdownText(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quote?.biddingClosesAt, quote?.workflowStatus, lang]);
  const history = historyData?.history || [];
  const activityLog = activityLogData?.activityLog || [];
  const clients = clientsData?.users || [];
  const teamMembers = teamData?.teamMembers || [];
  const ratings = ratingsData || [];

  const reassignMutation = useMutation({
    mutationFn: async (newUserId: string) => {
      const res = await fetch(`/api/admin/quotes/${quoteId}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUserId }),
      });
      if (!res.ok) throw new Error('Failed to reassign quote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      toast({
        title: lang === 'es' ? 'Cotización reasignada' : 'Quote reassigned',
        description: lang === 'es' ? 'La cotización ha sido asignada al nuevo cliente' : 'The quote has been assigned to the new client',
      });
      setSelectedClient('');
      setReassignDialogOpen(false);
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo reasignar la cotización' : 'Could not reassign the quote',
        variant: 'destructive',
      });
    },
  });

  const followUpOwnerMutation = useMutation({
    mutationFn: async (ownerId: string) => {
      const res = await fetch(`/api/admin/assisted-quotes/drafts/${quoteId}/follow-up-owner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ followUpOwnerId: ownerId }),
      });
      if (!res.ok) throw new Error('Failed to assign follow-up owner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      setSelectedFollowUpOwner('');
      toast({ title: lang === 'es' ? 'Seguimiento asignado' : 'Follow-up assigned' });
    },
    onError: () => toast({ title: lang === 'es' ? 'No se pudo asignar el seguimiento' : 'Could not assign follow-up', variant: 'destructive' }),
  });

  const recordFollowUpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/assisted-quotes/drafts/${quoteId}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel: 'unspecified' }),
      });
      if (!res.ok) throw new Error('Failed to record follow-up');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      toast({ title: lang === 'es' ? 'Primera atención registrada' : 'First follow-up recorded' });
    },
    onError: () => toast({ title: lang === 'es' ? 'No se pudo registrar la atención' : 'Could not record follow-up', variant: 'destructive' }),
  });

  const serviceOwnerMutation = useMutation({
    mutationFn: async ({ serviceId, ownerId }: { serviceId: string; ownerId: string }) => {
       const res = await fetch(`/api/admin/quote-services/${serviceId}/follow-up-owner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ followUpOwnerId: ownerId }),
      });
      if (!res.ok) throw new Error('Failed to assign service follow-up');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({ title: lang === 'es' ? 'Seguimiento del servicio asignado' : 'Service follow-up assigned' });
    },
    onError: () => toast({ title: lang === 'es' ? 'No se pudo asignar el servicio' : 'Could not assign service follow-up', variant: 'destructive' }),
  });

  const bidReviewMutation = useMutation({
    mutationFn: async ({ bidId, status, note }: { bidId: string; status: 'approved' | 'rejected'; note?: string }) => {
      const res = await fetch(`/api/admin/bids/${bidId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) throw new Error('Failed to review bid');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({
        title: variables.status === 'approved' 
          ? (lang === 'es' ? 'Oferta aprobada' : 'Bid approved')
          : (lang === 'es' ? 'Oferta rechazada' : 'Bid rejected'),
        description: variables.status === 'approved'
          ? (lang === 'es' ? 'La oferta ahora está visible para el cliente' : 'The bid is now visible to the client')
          : (lang === 'es' ? 'La oferta ha sido rechazada' : 'The bid has been rejected'),
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo procesar la oferta' : 'Could not process the bid',
        variant: 'destructive',
      });
    },
  });

  const finalizePartnerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/quotes/${quoteId}/finalize-partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to finalize partner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({
        title: lang === 'es' ? 'Socio finalizado' : 'Partner finalized',
        description: lang === 'es' ? 'El socio de mudanza ha sido confirmado' : 'The moving partner has been confirmed',
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo finalizar el socio' : 'Could not finalize the partner',
        variant: 'destructive',
      });
    },
  });

  const bulkInviteMutation = useMutation({
    mutationFn: async ({ moverProfileIds, dueAt, message }: { moverProfileIds: string[]; dueAt?: string; message?: string }) => {
      const res = await fetch(`/api/admin/quotes/${quoteId}/bulk-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          moverProfileIds,
          dueAt,
          message,
          quotedAmount: quote?.suggestedPrice || quote?.estimatedCost 
        }),
      });
      if (!res.ok) throw new Error('Failed to send invitations');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({
        title: lang === 'es' ? 'Invitaciones enviadas' : 'Invitations sent',
        description: lang === 'es' 
          ? `Se enviaron ${data.count} invitaciones a socios`
          : `${data.count} partner invitations sent`,
      });
      setInviteDialogOpen(false);
      setSelectedPartners([]);
      setInviteDeadline('');
      setInviteMessage('');
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudieron enviar las invitaciones' : 'Could not send invitations',
        variant: 'destructive',
      });
    },
  });

  const handleSendInvitations = () => {
    if (selectedPartners.length === 0) return;
    bulkInviteMutation.mutate({
      moverProfileIds: selectedPartners,
      dueAt: inviteDeadline || undefined,
      message: inviteMessage || undefined,
    });
  };

  // Remove partner from bidding
  const removeInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, note }: { invitationId: string; note?: string }) => {
      const res = await fetch(`/api/admin/invitations/${invitationId}/withdraw`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error('Failed to remove partner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({
        title: lang === 'es' ? 'Socio removido' : 'Partner removed',
        description: lang === 'es' ? 'El socio ha sido removido de la licitación' : 'The partner has been removed from bidding',
      });
      setRemoveInvitationId(null);
      setRemoveNote('');
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo remover el socio' : 'Could not remove the partner',
        variant: 'destructive',
      });
    },
  });

  // Update bidding deadline
  const updateDeadlineMutation = useMutation({
    mutationFn: async ({ deadline, note }: { deadline: string; note?: string }) => {
      const res = await fetch(`/api/admin/quotes/${quoteId}/bidding-deadline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline, note }),
      });
      if (!res.ok) throw new Error('Failed to update deadline');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      toast({
        title: lang === 'es' ? 'Fecha actualizada' : 'Deadline updated',
        description: lang === 'es' ? 'La fecha límite de licitación ha sido actualizada' : 'The bidding deadline has been updated',
      });
      setEditDeadlineDialogOpen(false);
      setNewDeadline('');
      setDeadlineNote('');
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo actualizar la fecha' : 'Could not update the deadline',
        variant: 'destructive',
      });
    },
  });

  // Close bidding manually
  const closeBiddingMutation = useMutation({
    mutationFn: async ({ note }: { note?: string }) => {
      const res = await fetch(`/api/admin/quotes/${quoteId}/close-bidding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error('Failed to close bidding');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/history`] });
      toast({
        title: lang === 'es' ? 'Licitación cerrada' : 'Bidding closed',
        description: lang === 'es' ? 'La licitación ha sido cerrada exitosamente' : 'Bidding has been closed successfully',
      });
      setCloseBiddingDialogOpen(false);
      setCloseBiddingNote('');
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudo cerrar la licitación' : 'Could not close bidding',
        variant: 'destructive',
      });
    },
  });

  const togglePartnerSelection = (profileId: string) => {
    setSelectedPartners(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSendPdf = async () => {
    if (!quote) return;
    setSendingPdf(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: quote.contactEmail || quote.user?.email,
          language: lang 
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send PDF');
      }
      toast({
        title: lang === 'es' ? 'PDF enviado' : 'PDF sent',
        description: lang === 'es' ? 'El PDF ha sido enviado por correo' : 'The PDF has been sent by email',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/history`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${quoteId}/activity-log`] }),
      ]);
      // Explicitly refetch documents to show the newly generated PDF
      await refetchDocuments();
    } catch (error: any) {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message || (lang === 'es' ? 'No se pudo enviar el PDF' : 'Could not send the PDF'),
        variant: 'destructive',
      });
    } finally {
      setSendingPdf(false);
    }
  };

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-action" />
        </div>
      </DashboardLayout>
    );
  }

  if (!quote) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-lg text-muted-foreground">
            {lang === 'es' ? 'Cotización no encontrada' : 'Quote not found'}
          </p>
          <Button variant="outline" onClick={() => setLocation('/admin/dashboard/quotes')} data-testid="button-back-not-found">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Volver a cotizaciones' : 'Back to quotes'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const currentStatus = normalizeQuoteStage(quote.workflowStatus);
  const isWon = currentStatus === QUOTE_STAGE.CLOSED_WON;
  const statusLabel = lang === "es" ? QUOTE_STAGE_LABELS[currentStatus].es : QUOTE_STAGE_LABELS[currentStatus].en;
  const { color: statusTextColor, bgColor: statusBgColor } = getStatusColor(currentStatus);
  const homeLabel = homeSizeLabels[quote.homeSize]?.[lang] || quote.homeSize;
  
  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/admin/dashboard/quotes')} data-testid="button-back-to-quotes">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {quote.quoteNumber || quote.id.slice(0, 8)}
                </h1>
                <Badge style={{ backgroundColor: statusBgColor, color: statusTextColor }}>{statusLabel}</Badge>
                 <Badge className="border-0 bg-[#351d3d] text-[#fff8f2]" data-testid="badge-service-type">
                   {lang === 'es' ? getStorageMoveContext(quote).labels.serviceEs : getStorageMoveContext(quote).labels.serviceEn}
                 </Badge>
                 {getStorageMoveContext(quote).labels.directionEs && (
                   <Badge variant="outline" className="border-[#b85631] text-[#8d3f3a]">
                     {lang === 'es' ? getStorageMoveContext(quote).labels.directionEs : getStorageMoveContext(quote).labels.directionEn}
                   </Badge>
                 )}
                {quote.isPartial && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    {lang === 'es' ? 'Incompleto' : 'Incomplete'}
                  </Badge>
                )}
                {countdownText && (
                  <Badge className="bg-orange-500 text-white animate-pulse" data-testid="bidding-countdown">
                    <Clock className="h-3 w-3 mr-1" />
                    {countdownText}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === 'es' ? 'Creado' : 'Created'} {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true, locale })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isWon && <Button variant="outline" size="sm" onClick={() => recordFollowUpMutation.mutate()} disabled={recordFollowUpMutation.isPending || !quote.followUpOwnerId} data-testid="button-record-follow-up">
              <Clock className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'Registrar primera atención' : 'Record first follow-up'}
            </Button>}
            {isWon && (
              <Button onClick={() => setLocation('/admin/dashboard/services')} data-testid="button-manage-service">
                <Truck className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Gestionar en Servicios' : 'Manage in Services'}
              </Button>
            )}
            {documents.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/api/quotes/${quoteId}/pdf/${documents[0].id}/download`, '_blank')}
                data-testid="button-download-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Descargar PDF' : 'Download PDF'}
              </Button>
            )}
          </div>
        </div>

        <Card data-testid="card-sales-ownership">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <p className="font-semibold">{lang === 'es' ? 'Responsables de Ventas' : 'Sales ownership'}</p>
              <p className="text-muted-foreground">
                {lang === 'es' ? 'Creador' : 'Creator'}: {quote.creator?.fullName || quote.creator?.email || quote.createdBy?.fullName || quote.createdBy?.email || '—'} · {lang === 'es' ? 'Seguimiento' : 'Follow-up'}: {quote.followUpOwner?.fullName || quote.followUpOwner?.email || quote.followUpOwnerUser?.fullName || quote.followUpOwnerUser?.email || '—'}
              </p>
            </div>
            {!isWon ? <div className="flex items-center gap-2">
              <Select value={selectedFollowUpOwner} onValueChange={setSelectedFollowUpOwner}>
                <SelectTrigger className="w-[220px]" data-testid="select-follow-up-owner">
                  <SelectValue placeholder={lang === 'es' ? 'Asignar seguimiento' : 'Assign follow-up'} />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((client) => <SelectItem key={client.id} value={client.id}>{client.fullName || client.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => selectedFollowUpOwner && followUpOwnerMutation.mutate(selectedFollowUpOwner)} disabled={!selectedFollowUpOwner || followUpOwnerMutation.isPending}>
                {lang === 'es' ? 'Asignar' : 'Assign'}
              </Button>
            </div> : (
              <Badge variant="secondary">
                {lang === 'es' ? 'Proceso comercial cerrado' : 'Sales process closed'}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#4e2069]/15 bg-[#fffdfa] shadow-sm" data-testid="card-key-details">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d6075]">{lang === 'es' ? 'Cliente' : 'Customer'}</p>
              <p className="mt-1 truncate font-semibold text-[#24152e]">{quote.contactName || quote.user?.fullName || quote.contactEmail || quote.user?.email || '—'}</p>
              <p className="truncate text-xs text-muted-foreground">{quote.contactEmail || quote.user?.email || '—'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d6075]">{lang === 'es' ? 'Ruta' : 'Route'}</p>
              <p className="mt-1 truncate font-semibold text-[#24152e]">{quote.fromAddress || '—'}</p>
              <p className="truncate text-xs text-muted-foreground">→ {quote.toAddress || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d6075]">{lang === 'es' ? 'Fecha del servicio' : 'Service date'}</p>
              <p className="mt-1 font-semibold text-[#24152e]">{quote.moveDate ? format(new Date(quote.moveDate), 'PP', { locale }) : (lang === 'es' ? 'Por definir' : 'To be defined')}</p>
              <p className="text-xs text-muted-foreground">{homeLabel} · {quote.storageOption || (lang === 'es' ? 'Sin almacenaje' : 'No storage')}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d6075]">{lang === 'es' ? 'Valor actual' : 'Current value'}</p>
              <p className="mt-1 font-semibold text-[#4e2069]">{quote.finalPrice || quote.priceProposalAmount || quote.suggestedPrice || quote.estimatedCost ? `${Number(quote.finalPrice || quote.priceProposalAmount || quote.suggestedPrice || quote.estimatedCost).toLocaleString()} ${quote.priceProposalCurrency || quote.estimatedCurrency || 'MXN'}` : '—'}</p>
              <p className="text-xs text-muted-foreground">
                {quote.inventoryItems.length} {lang === 'es'
                  ? quote.inventoryItems.length === 1
                    ? 'artículo en el inventario'
                    : 'artículos en el inventario'
                  : quote.inventoryItems.length === 1
                    ? 'item recorded'
                    : 'items recorded'}
              </p>
            </div>
          </CardContent>
        </Card>

        <AdminCommercialLifecycle
          quoteId={quote.id}
          quote={quote}
          lang={lang}
          onSendPdf={handleSendPdf}
          sendingPdf={sendingPdf}
          statusHistory={history}
        />

        {quote.workflowMode === 'dispatch' && !isWon && (
          <AdminDispatchConsole
            quoteId={quote.id}
            quote={quote}
            lang={lang}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {lang === 'es' ? 'Información del Cliente' : 'Client Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Cliente Asignado' : 'Assigned Client'}</p>
                  {quote.user ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{quote.user.fullName || quote.user.email}</p>
                        <p className="text-sm text-muted-foreground">{quote.user.email}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-amber-600">{lang === 'es' ? 'Sin cliente asignado' : 'No client assigned'}</p>
                  )}
                  <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="px-0 h-auto text-action" data-testid="button-reassign-quote">
                        {lang === 'es' ? 'Reasignar a otro cliente' : 'Reassign to another client'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{lang === 'es' ? 'Reasignar Cotización' : 'Reassign Quote'}</DialogTitle>
                        <DialogDescription>
                          {lang === 'es' 
                            ? 'Selecciona el cliente al que deseas asignar esta cotización' 
                            : 'Select the client you want to assign this quote to'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                          <SelectTrigger data-testid="select-new-client">
                            <SelectValue placeholder={lang === 'es' ? 'Seleccionar cliente' : 'Select client'} />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id} data-testid={`select-item-client-${client.id}`}>
                                {client.fullName || client.email} ({client.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setReassignDialogOpen(false)} data-testid="button-cancel-reassign">
                            {lang === 'es' ? 'Cancelar' : 'Cancel'}
                          </Button>
                          <Button 
                            onClick={() => reassignMutation.mutate(selectedClient)} 
                            disabled={!selectedClient || reassignMutation.isPending}
                            data-testid="button-confirm-reassign"
                          >
                            {reassignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {lang === 'es' ? 'Reasignar' : 'Reassign'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Contacto' : 'Contact'}</p>
                  <div className="mt-1 space-y-1">
                    <p className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {quote.contactName || quote.user?.fullName || '-'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {quote.contactEmail || quote.user?.email || '-'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {quote.contactPhone || quote.user?.phone || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {lang === 'es' ? 'Precios' : 'Pricing'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{lang === 'es' ? 'Estimación IA' : 'AI Estimate'}</span>
                <span className="font-medium">
                  {quote.estimatedCost 
                    ? `$${parseFloat(quote.estimatedCost).toLocaleString()} - $${parseFloat(quote.estimatedCostHigh || quote.estimatedCost).toLocaleString()} ${quote.estimatedCurrency || 'MXN'}`
                    : '-'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{lang === 'es' ? 'Precio Sugerido' : 'Suggested Price'}</span>
                <span className="font-medium text-action">
                  {quote.suggestedPrice ? `$${parseFloat(quote.suggestedPrice).toLocaleString()} MXN` : '-'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{lang === 'es' ? 'Precio Final' : 'Final Price'}</span>
                <span className="font-semibold text-lg text-green-600">
                  {quote.finalPrice ? `$${parseFloat(quote.finalPrice).toLocaleString()} MXN` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lead Attribution Section */}
        {(quote.partner || quote.utmSource || quote.utmCampaign || quote.landingPage) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {lang === 'es' ? 'Origen del Lead' : 'Lead Attribution'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Información sobre cómo llegó este cliente'
                  : 'Information about how this customer found us'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {quote.partner && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Partner' : 'Partner'}</p>
                    <Badge variant="secondary" className="mt-1">{quote.partner}</Badge>
                  </div>
                )}
                {quote.utmSource && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Fuente' : 'Source'}</p>
                    <p className="font-medium mt-1">{quote.utmSource}</p>
                  </div>
                )}
                {quote.utmMedium && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Medio' : 'Medium'}</p>
                    <p className="font-medium mt-1">{quote.utmMedium}</p>
                  </div>
                )}
                {quote.utmCampaign && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Campaña' : 'Campaign'}</p>
                    <p className="font-medium mt-1">{quote.utmCampaign}</p>
                  </div>
                )}
                {quote.utmTerm && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Término' : 'Term'}</p>
                    <p className="font-medium mt-1">{quote.utmTerm}</p>
                  </div>
                )}
                {quote.utmContent && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Contenido' : 'Content'}</p>
                    <p className="font-medium mt-1">{quote.utmContent}</p>
                  </div>
                )}
                {quote.landingPage && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Página de Entrada' : 'Landing Page'}</p>
                    <p className="font-medium mt-1 text-sm truncate" title={quote.landingPage}>{quote.landingPage}</p>
                  </div>
                )}
                {quote.referrerUrl && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Referente' : 'Referrer'}</p>
                    <p className="font-medium mt-1 text-sm truncate" title={quote.referrerUrl}>{quote.referrerUrl}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {lang === 'es' ? 'Ubicaciones' : 'Locations'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{lang === 'es' ? 'Origen' : 'Origin'}</p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  {quote.fromAddress}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{lang === 'es' ? 'Destino' : 'Destination'}</p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {quote.toAddress}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {lang === 'es' ? 'Detalles de la Mudanza' : 'Move Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {lang === 'es' ? 'Disponibilidad del cliente' : 'Customer availability'}
                  </p>
                  <p className="mt-1 font-medium">
                    {quote.moveAvailabilityStart && quote.moveAvailabilityEnd
                      ? `${quote.moveAvailabilityStart} — ${quote.moveAvailabilityEnd}`
                      : quote.moveDate ? format(new Date(quote.moveDate), 'PPP', { locale }) : '-'}
                  </p>
                  {quote.preferredMoveDates?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {quote.preferredMoveDates.map((date, index) => (
                        <Badge key={date} variant={index === 0 ? "default" : "secondary"}>
                          {index + 1}. {date}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {quote.blockedMoveDates?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {lang === 'es' ? 'Fechas no disponibles' : 'Unavailable dates'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {quote.blockedMoveDates.map((date) => (
                          <Badge key={date} variant="destructive">
                            {date}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{lang === 'es' ? 'Tamaño' : 'Size'}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    {homeLabel}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{lang === 'es' ? 'Servicios Adicionales' : 'Additional Services'}</p>
                  <div className="flex flex-wrap gap-2">
                    {quote.needsInsurance && <Badge variant="secondary">{lang === 'es' ? 'Seguro' : 'Insurance'}</Badge>}
                    {quote.needsPacking && <Badge variant="secondary">{lang === 'es' ? 'Empaque' : 'Packing'}</Badge>}
                    {quote.needsUnpacking && <Badge variant="secondary">{lang === 'es' ? 'Desempaque' : 'Unpacking'}</Badge>}
                    {quote.needsBox && <Badge variant="secondary">{lang === 'es' ? 'Cajas' : 'Boxes'}</Badge>}
                    {quote.storageOption && <Badge variant="secondary">{lang === 'es' ? 'Almacenaje' : 'Storage'}</Badge>}
                    {!quote.needsInsurance && !quote.needsPacking && !quote.needsUnpacking && !quote.needsBox && !quote.storageOption && (
                      <span className="text-muted-foreground text-sm">{lang === 'es' ? 'Ninguno' : 'None'}</span>
                    )}
                  </div>
                  {quote.quoteServices?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {quote.quoteServices.map((item) => {
                        const serviceKey = item.id || item.service.id;
                        return (
                          <div key={serviceKey} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2 text-xs md:flex-row md:items-center md:justify-between">
                            <div>
                              <span className="font-medium">{lang === 'es' ? item.service.nameEs : item.service.nameEn}</span>
                              <span className="ml-2 text-muted-foreground">{lang === 'es' ? 'Creador' : 'Creator'}: {item.creator?.fullName || item.creator?.email || '—'} · {lang === 'es' ? 'Seguimiento' : 'Follow-up'}: {item.followUpOwner?.fullName || item.followUpOwner?.email || '—'}</span>
                            </div>
                            {!isWon && <div className="flex items-center gap-2">
                              <Select value={selectedServiceOwner[serviceKey] || ''} onValueChange={(value) => setSelectedServiceOwner((current) => ({ ...current, [serviceKey]: value }))}>
                                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder={lang === 'es' ? 'Asignar seguimiento' : 'Assign follow-up'} /></SelectTrigger>
                                <SelectContent>{teamMembers.map((client) => <SelectItem key={client.id} value={client.id}>{client.fullName || client.email}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" className="h-8" disabled={!selectedServiceOwner[serviceKey] || !item.id || serviceOwnerMutation.isPending} onClick={() => item.id && serviceOwnerMutation.mutate({ serviceId: item.id, ownerId: selectedServiceOwner[serviceKey] })}>{lang === 'es' ? 'Asignar' : 'Assign'}</Button>
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {quote.clientNotes && (
                  <div className="col-span-2 mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">{lang === 'es' ? 'Notas del Cliente' : 'Client Notes'}</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{quote.clientNotes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <InventoryEditor
          quoteId={quote.id}
          items={quote.inventoryItems.map(item => ({
            id: item.id,
            quoteId: quote.id,
            itemName: item.itemName,
            category: item.category,
            room: item.room,
            quantity: item.quantity,
          }))}
          isLocked={isWon || ['bidding_open', 'bidding_closed', 'selection', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled'].includes(quote.workflowStatus || '')}
          onItemsChange={() => refetch()}
          onRecalculate={() => refetch()}
          defaultCollapsed={true}
        />

        {quote.workflowMode !== 'dispatch' && !isWon && <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                {lang === 'es' ? 'Ofertas de Partners' : 'Partner Bids'}
                <Badge variant="secondary" className="ml-2">{quote.bids.length}</Badge>
              </CardTitle>
              {(quote.biddingOpensAt || (quote.workflowStatus === 'bidding_open' || quote.workflowStatus === 'bidding')) && (
                <CardDescription className="space-y-1">
                  {/* Start date line */}
                  {quote.biddingOpensAt && (
                    <div className="text-sm">
                      <span className="font-medium">{lang === 'es' ? 'Apertura:' : 'Opens:'}</span>{' '}
                      {format(new Date(quote.biddingOpensAt), 'PPp', { locale })}
                    </div>
                  )}
                  
                  {/* Closing date line with edit button */}
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{lang === 'es' ? 'Cierre:' : 'Closes:'}</span>{' '}
                    {quote.biddingClosesAt ? (
                      <span>{format(new Date(quote.biddingClosesAt), 'PPp', { locale })}</span>
                    ) : (
                      <span className="text-muted-foreground">{lang === 'es' ? 'Sin fecha límite' : 'No deadline set'}</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (quote.biddingClosesAt) {
                          const date = new Date(quote.biddingClosesAt);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          setNewDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
                        } else {
                          setNewDeadline('');
                        }
                        setEditDeadlineDialogOpen(true);
                      }}
                      data-testid="edit-deadline-btn"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {lang === 'es' ? 'Editar' : 'Edit'}
                    </Button>
                  </div>
                  {countdownText && (quote.workflowStatus === 'bidding_open' || quote.workflowStatus === 'bidding') && (
                    <div className="flex items-center gap-2 pt-1">
                      <Badge className="bg-orange-500 text-white animate-pulse">
                        <Clock className="h-3 w-3 mr-1" />
                        {lang === 'es' ? 'Tiempo restante: ' : 'Time remaining: '}{countdownText}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setCloseBiddingDialogOpen(true)}
                        data-testid="close-bidding-btn"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {lang === 'es' ? 'Cerrar Licitación' : 'Close Bidding'}
                      </Button>
                    </div>
                  )}
                  {(quote.workflowStatus === 'bidding_open' || quote.workflowStatus === 'bidding') && !countdownText && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setCloseBiddingDialogOpen(true)}
                        data-testid="close-bidding-btn-no-countdown"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {lang === 'es' ? 'Cerrar Licitación' : 'Close Bidding'}
                      </Button>
                    </div>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {quote.bids.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {lang === 'es' ? 'No hay ofertas todavía' : 'No bids yet'}
                </p>
              ) : (
                <div className="space-y-3">
                  {quote.bids.map((bid) => {
                    const adminReviewColors: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-800',
                      approved: 'bg-green-100 text-green-800',
                      rejected: 'bg-red-100 text-red-800',
                    };
                    const priceChanged = bid.originalAmount && parseFloat(bid.amount) !== parseFloat(bid.originalAmount);
                    
                    return (
                      <div key={bid.id} className="p-4 bg-slate-50 rounded-lg border" data-testid={`bid-${bid.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{bid.moverProfile.companyName}</p>
                              <p className="text-sm text-muted-foreground">{bid.moverProfile.contactEmail}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg text-foreground">${parseFloat(bid.amount).toLocaleString()} {bid.currency}</p>
                            {priceChanged && bid.originalAmount && (
                              <p className="text-sm text-muted-foreground line-through">
                                {lang === 'es' ? 'Original: ' : 'Original: '}${parseFloat(bid.originalAmount).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {priceChanged && bid.adjustmentReason && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                            <span className="font-medium text-amber-800">{lang === 'es' ? 'Razón del ajuste: ' : 'Adjustment reason: '}</span>
                            <span className="text-amber-700">{bid.adjustmentReason}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className={bidStatusColors[bid.status] || 'bg-gray-100'}>
                            {bid.status === 'submitted' ? (lang === 'es' ? 'Enviada' : 'Submitted') :
                             bid.status === 'accepted' ? (lang === 'es' ? 'Aceptada' : 'Accepted') :
                             bid.status === 'rejected' ? (lang === 'es' ? 'Rechazada' : 'Rejected') :
                             bid.status === 'withdrawn' ? (lang === 'es' ? 'Retirada' : 'Withdrawn') :
                             bid.status}
                          </Badge>
                          {bid.adminReviewStatus && (
                            <Badge className={adminReviewColors[bid.adminReviewStatus] || 'bg-gray-100'}>
                              {bid.adminReviewStatus === 'pending' ? (lang === 'es' ? 'Revisión pendiente' : 'Pending review') :
                               bid.adminReviewStatus === 'approved' ? (lang === 'es' ? 'Aprobada' : 'Approved') :
                               bid.adminReviewStatus === 'rejected' ? (lang === 'es' ? 'Rechazada' : 'Rejected') :
                               bid.adminReviewStatus}
                            </Badge>
                          )}
                          {bid.isOriginalPrice === false && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              {lang === 'es' ? 'Precio modificado' : 'Modified price'}
                            </Badge>
                          )}
                          {bid.clientPreferenceRank !== null && (
                            <Badge className="bg-action text-action-foreground">
                              <Star className="h-3 w-3 mr-1" />
                              #{bid.clientPreferenceRank} {lang === 'es' ? 'Preferido por cliente' : 'Client preferred'}
                            </Badge>
                          )}
                        </div>

                        {(bid.estimatedHours || bid.crewSize || bid.vehiclesNeeded || bid.proposedMoveDate) && (
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                            {bid.estimatedHours && <span>{bid.estimatedHours} {lang === 'es' ? 'hrs' : 'hrs'}</span>}
                            {bid.crewSize && <span>{bid.crewSize} {lang === 'es' ? 'personas' : 'crew'}</span>}
                            {bid.vehiclesNeeded && <span>{bid.vehiclesNeeded} {lang === 'es' ? 'vehículos' : 'vehicles'}</span>}
                            {bid.proposedMoveDate && (
                              <span className="text-blue-600">
                                {lang === 'es' ? 'Fecha propuesta: ' : 'Proposed date: '}
                                {format(new Date(bid.proposedMoveDate), 'PP', { locale })}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {bid.notes && <p className="text-sm mb-3 text-muted-foreground">{bid.notes}</p>}

                        {bid.adminReviewStatus === 'pending' && bid.status === 'submitted' && (
                          <div className="flex gap-2 pt-3 border-t">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => bidReviewMutation.mutate({ bidId: bid.id, status: 'approved' })}
                              disabled={bidReviewMutation.isPending}
                              data-testid={`approve-bid-${bid.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              {lang === 'es' ? 'Aprobar' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => bidReviewMutation.mutate({ bidId: bid.id, status: 'rejected' })}
                              disabled={bidReviewMutation.isPending}
                              data-testid={`reject-bid-${bid.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {lang === 'es' ? 'Rechazar' : 'Reject'}
                            </Button>
                          </div>
                        )}

                        {bid.adminReviewedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {lang === 'es' ? 'Revisada: ' : 'Reviewed: '}
                            {formatDistanceToNow(new Date(bid.adminReviewedAt), { addSuffix: true, locale })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invitations Section */}
              {quote.invitations.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="font-medium mb-3">{lang === 'es' ? 'Invitaciones Enviadas' : 'Sent Invitations'}</p>
                  <div className="space-y-2">
                    {quote.invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 bg-slate-50 rounded" data-testid={`invitation-${inv.id}`}>
                        <span className={inv.status === 'withdrawn' ? 'line-through text-muted-foreground' : ''}>
                          {inv.moverProfile.companyName}
                        </span>
                        <div className="flex items-center gap-2">
                          {inv.viewedAt && <Eye className="h-4 w-4 text-blue-500" />}
                          <Badge variant="outline" className={`text-xs ${inv.status === 'withdrawn' ? 'bg-red-100 text-red-700' : ''}`}>
                            {inv.status === 'invited' ? (lang === 'es' ? 'Invitado' : 'Invited') :
                             inv.status === 'viewed' ? (lang === 'es' ? 'Vista' : 'Viewed') :
                             inv.status === 'bid_submitted' ? (lang === 'es' ? 'Ofertó' : 'Bid Submitted') :
                             inv.status === 'declined' ? (lang === 'es' ? 'Declinó' : 'Declined') :
                             inv.status === 'withdrawn' ? (lang === 'es' ? 'Removido' : 'Withdrawn') :
                             inv.status}
                          </Badge>
                          {inv.status !== 'withdrawn' && inv.status !== 'bid_submitted' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setRemoveInvitationId(inv.id)}
                              data-testid={`remove-invitation-${inv.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remove Partner Dialog */}
              <Dialog open={!!removeInvitationId} onOpenChange={(open) => !open && setRemoveInvitationId(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{lang === 'es' ? 'Remover Socio' : 'Remove Partner'}</DialogTitle>
                    <DialogDescription>
                      {lang === 'es' 
                        ? 'Esta acción removerá al socio de la licitación. Puedes agregar una nota explicando el motivo.'
                        : 'This will remove the partner from the bidding process. You can add a note explaining why.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="remove-note">{lang === 'es' ? 'Nota (opcional)' : 'Note (optional)'}</Label>
                      <Textarea
                        id="remove-note"
                        value={removeNote}
                        onChange={(e) => setRemoveNote(e.target.value)}
                        placeholder={lang === 'es' ? 'Razón para remover al socio...' : 'Reason for removing the partner...'}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setRemoveInvitationId(null); setRemoveNote(''); }}>
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => removeInvitationId && removeInvitationMutation.mutate({ invitationId: removeInvitationId, note: removeNote })}
                        disabled={removeInvitationMutation.isPending}
                      >
                        {removeInvitationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {lang === 'es' ? 'Remover' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Deadline Dialog */}
              <Dialog open={editDeadlineDialogOpen} onOpenChange={setEditDeadlineDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{lang === 'es' ? 'Editar Fecha Límite' : 'Edit Bidding Deadline'}</DialogTitle>
                    <DialogDescription>
                      {lang === 'es' 
                        ? 'Actualiza la fecha límite para que los socios envíen sus ofertas.'
                        : 'Update the deadline for partners to submit their bids.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-deadline">{lang === 'es' ? 'Nueva fecha límite' : 'New deadline'}</Label>
                      <Input
                        id="new-deadline"
                        type="datetime-local"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="mt-1"
                        data-testid="new-deadline-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deadline-note">{lang === 'es' ? 'Nota (opcional)' : 'Note (optional)'}</Label>
                      <Textarea
                        id="deadline-note"
                        value={deadlineNote}
                        onChange={(e) => setDeadlineNote(e.target.value)}
                        placeholder={lang === 'es' ? 'Razón del cambio...' : 'Reason for the change...'}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setEditDeadlineDialogOpen(false); setNewDeadline(''); setDeadlineNote(''); }}>
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </Button>
                      <Button 
                        onClick={() => updateDeadlineMutation.mutate({ deadline: newDeadline, note: deadlineNote })}
                        disabled={updateDeadlineMutation.isPending || !newDeadline}
                        data-testid="save-deadline-btn"
                      >
                        {updateDeadlineMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {lang === 'es' ? 'Guardar' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Close Bidding Dialog */}
              <Dialog open={closeBiddingDialogOpen} onOpenChange={setCloseBiddingDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{lang === 'es' ? 'Cerrar Licitación' : 'Close Bidding'}</DialogTitle>
                    <DialogDescription>
                      {lang === 'es' 
                        ? 'Esta acción cerrará la licitación y cambiará el estado a "Selección". Los socios ya no podrán enviar ofertas.'
                        : 'This will close bidding and change the status to "Selection". Partners will no longer be able to submit bids.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="close-bidding-note">{lang === 'es' ? 'Nota (opcional)' : 'Note (optional)'}</Label>
                      <Textarea
                        id="close-bidding-note"
                        value={closeBiddingNote}
                        onChange={(e) => setCloseBiddingNote(e.target.value)}
                        placeholder={lang === 'es' ? 'Razón para cerrar la licitación...' : 'Reason for closing bidding...'}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setCloseBiddingDialogOpen(false); setCloseBiddingNote(''); }}>
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => closeBiddingMutation.mutate({ note: closeBiddingNote })}
                        disabled={closeBiddingMutation.isPending}
                        data-testid="confirm-close-bidding-btn"
                      >
                        {closeBiddingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {lang === 'es' ? 'Cerrar Licitación' : 'Close Bidding'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Invite Partners Button */}
              <div className="mt-6 pt-4 border-t">
                <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
                  setInviteDialogOpen(open);
                  if (open && quote.biddingClosesAt) {
                    const date = new Date(quote.biddingClosesAt);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    setInviteDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-action hover:bg-action/90" data-testid="invite-partners-btn">
                      <Send className="h-4 w-4 mr-2" />
                      {lang === 'es' ? 'Invitar Partners' : 'Invite Partners'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {lang === 'es' ? 'Invitar Partners a Ofertar' : 'Invite Partners to Bid'}
                      </DialogTitle>
                      <DialogDescription>
                        {lang === 'es' 
                          ? 'Selecciona los socios que deseas invitar a ofertar por esta cotización.'
                          : 'Select the partners you want to invite to bid on this quote.'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <Label>{lang === 'es' ? 'Precio Sugerido' : 'Suggested Price'}</Label>
                        <p className="text-lg font-semibold text-foreground">
                          ${parseFloat(quote.suggestedPrice || quote.estimatedCost || '0').toLocaleString()} {quote.estimatedCurrency || 'MXN'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lang === 'es' 
                            ? 'Este precio se mostrará a los partners como referencia'
                            : 'This price will be shown to partners as a reference'}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="invite-deadline">
                          {lang === 'es' ? 'Fecha límite para ofertar' : 'Bid deadline'}
                        </Label>
                        {quote.biddingClosesAt ? (
                          <div className="mt-1 p-2 bg-slate-100 rounded border text-sm">
                            {format(new Date(quote.biddingClosesAt), 'PPp', { locale })}
                            <p className="text-xs text-muted-foreground mt-1">
                              {lang === 'es' ? 'Fecha establecida previamente' : 'Previously set deadline'}
                            </p>
                          </div>
                        ) : (
                          <Input
                            id="invite-deadline"
                            type="datetime-local"
                            value={inviteDeadline}
                            onChange={(e) => setInviteDeadline(e.target.value)}
                            className="mt-1"
                            data-testid="invite-deadline-input"
                          />
                        )}
                      </div>

                      <div>
                        <Label htmlFor="invite-message">
                          {lang === 'es' ? 'Mensaje (opcional)' : 'Message (optional)'}
                        </Label>
                        <Textarea
                          id="invite-message"
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          placeholder={lang === 'es' ? 'Mensaje adicional para los partners...' : 'Additional message for partners...'}
                          className="mt-1"
                          rows={2}
                          data-testid="invite-message-input"
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block">
                          {lang === 'es' ? 'Seleccionar Partners' : 'Select Partners'}
                        </Label>
                        {moverProfiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            {lang === 'es' ? 'No hay partners verificados disponibles' : 'No verified partners available'}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <Select
                              onValueChange={(value) => {
                                if (value && !selectedPartners.includes(value)) {
                                  setSelectedPartners([...selectedPartners, value]);
                                }
                              }}
                            >
                              <SelectTrigger data-testid="partner-select-dropdown">
                                <SelectValue placeholder={lang === 'es' ? 'Selecciona un socio...' : 'Select a partner...'} />
                              </SelectTrigger>
                              <SelectContent>
                                {moverProfiles
                                  .filter((profile: { id: string }) => !quote.invitations.some(inv => inv.moverProfile.id === profile.id))
                                  .filter((profile: { id: string }) => !selectedPartners.includes(profile.id))
                                  .map((profile: { id: string; companyName: string }) => (
                                    <SelectItem key={profile.id} value={profile.id} data-testid={`partner-option-${profile.id}`}>
                                      {profile.companyName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>

                            {selectedPartners.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                  {lang === 'es' ? 'Partners seleccionados:' : 'Selected partners:'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {selectedPartners.map((partnerId) => {
                                    const partner = moverProfiles.find((p: { id: string }) => p.id === partnerId);
                                    return (
                                      <Badge 
                                        key={partnerId} 
                                        variant="secondary"
                                        className="flex items-center gap-1 pr-1"
                                      >
                                        {partner?.companyName || partnerId}
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPartners(selectedPartners.filter(id => id !== partnerId))}
                                          className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
                                        >
                                          <XCircle className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setInviteDialogOpen(false)}
                        >
                          {lang === 'es' ? 'Cancelar' : 'Cancel'}
                        </Button>
                        <Button
                          className="flex-1 bg-action hover:bg-action/90"
                          onClick={handleSendInvitations}
                          disabled={selectedPartners.length === 0 || bulkInviteMutation.isPending}
                          data-testid="send-invitations-btn"
                        >
                          {bulkInviteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          {lang === 'es' 
                            ? `Enviar ${selectedPartners.length} Invitación(es)`
                            : `Send ${selectedPartners.length} Invitation(s)`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {lang === 'es' ? 'Partner Asignado' : 'Assigned Partner'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote.assignedMover ? (
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{quote.assignedMover.companyName}</p>
                    <p className="text-sm text-muted-foreground">{quote.assignedMover.contactEmail}</p>
                    {quote.assignedMover.contactPhone && (
                      <p className="text-sm text-muted-foreground">{quote.assignedMover.contactPhone}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mb-2" />
                  <p>{lang === 'es' ? 'Aún no hay partner asignado' : 'No partner assigned yet'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {lang === 'es' ? 'Registro de Actividad' : 'Activity Log'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' ? 'Historial completo de cambios en esta cotización' : 'Complete history of changes to this quote'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLog.length === 0 && history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {lang === 'es' ? 'Sin actividad registrada' : 'No activity recorded yet'}
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {/* Show activity log entries */}
                  {activityLog.map((entry) => {
                    const actionIcons: Record<string, React.ReactNode> = {
                      status_change: <Activity className="h-4 w-4 text-blue-600" />,
                      data_update: <FileText className="h-4 w-4 text-amber-600" />,
                      pricing_change: <DollarSign className="h-4 w-4 text-green-600" />,
                      document_generated: <FileDown className="h-4 w-4 text-purple-600" />,
                      document_sent: <Mail className="h-4 w-4 text-indigo-600" />,
                      partner_assigned: <Building2 className="h-4 w-4 text-teal-600" />,
                      bid_received: <Gavel className="h-4 w-4 text-orange-600" />,
                      bid_accepted: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
                      bid_rejected: <XCircle className="h-4 w-4 text-red-600" />,
                      note_added: <MessageSquare className="h-4 w-4 text-gray-600" />,
                      client_reassigned: <User className="h-4 w-4 text-cyan-600" />,
                      assisted_created: <User className="h-4 w-4 text-violet-600" />,
                      assisted_resumed: <Clock className="h-4 w-4 text-violet-600" />,
                      assisted_converted: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
                      follow_up_assigned: <User className="h-4 w-4 text-orange-600" />,
                      first_follow_up_recorded: <Clock className="h-4 w-4 text-orange-600" />,
                      'quote.review_workspace_updated': <Pencil className="h-4 w-4 text-amber-600" />,
                      'quote.review_attachment_uploaded': <FileText className="h-4 w-4 text-violet-600" />,
                      'quote.review_attachment_deleted': <XCircle className="h-4 w-4 text-red-600" />,
                    };
                    
                    const actionLabels: Record<string, { es: string; en: string }> = {
                      status_change: { es: 'Cambio de Estado', en: 'Status Change' },
                      data_update: { es: 'Actualización de Datos', en: 'Data Update' },
                      pricing_change: { es: 'Cambio de Precio', en: 'Pricing Change' },
                      document_generated: { es: 'Documento Generado', en: 'Document Generated' },
                      document_sent: { es: 'Documento Enviado', en: 'Document Sent' },
                      partner_assigned: { es: 'Socio Asignado', en: 'Partner Assigned' },
                      bid_received: { es: 'Oferta Recibida', en: 'Bid Received' },
                      bid_accepted: { es: 'Oferta Aceptada', en: 'Bid Accepted' },
                      bid_rejected: { es: 'Oferta Rechazada', en: 'Bid Rejected' },
                      note_added: { es: 'Nota Agregada', en: 'Note Added' },
                      client_reassigned: { es: 'Cliente Reasignado', en: 'Client Reassigned' },
                      assisted_created: { es: 'Venta asistida creada', en: 'Assisted sale created' },
                      assisted_resumed: { es: 'Borrador asistido retomado', en: 'Assisted draft resumed' },
                      assisted_converted: { es: 'Venta asistida convertida', en: 'Assisted sale converted' },
                      follow_up_assigned: { es: 'Seguimiento asignado', en: 'Follow-up assigned' },
                      first_follow_up_recorded: { es: 'Primera atención registrada', en: 'First follow-up recorded' },
                      'quote.review_workspace_updated': { es: 'Datos de cotización actualizados', en: 'Quote details updated' },
                      'quote.review_attachment_uploaded': { es: 'Archivo de intake agregado', en: 'Intake file added' },
                      'quote.review_attachment_deleted': { es: 'Archivo de intake eliminado', en: 'Intake file removed' },
                    };

                    const metadata = entry.metadata || {};
                    
                    return (
                      <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg" data-testid={`activity-${entry.id}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          {actionIcons[entry.actionType] || <Activity className="h-4 w-4 text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {actionLabels[entry.actionType]?.[lang] || entry.actionType}
                            </span>
                            {entry.actionType === 'status_change' && metadata.fromStatus && metadata.toStatus && (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {getStatusLabel(metadata.fromStatus)}
                                </Badge>
                                <span className="text-muted-foreground">→</span>
                                <Badge 
                                  style={{ 
                                    backgroundColor: getStatusColor(metadata.toStatus).bgColor, 
                                    color: getStatusColor(metadata.toStatus).color 
                                  }}
                                  className="text-xs"
                                >
                                  {getStatusLabel(metadata.toStatus)}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {lang === 'es' ? entry.descriptionEs || entry.description : entry.description}
                          </p>
                          {metadata.note && (
                            <p className="text-sm text-muted-foreground mt-1 italic border-l-2 border-action pl-2">
                              "{metadata.note}"
                            </p>
                          )}
                          {entry.actionType === 'quote.review_workspace_updated' && Array.isArray(metadata.changes) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {metadata.changes.map((change: string) => (
                                <Badge key={change} variant="outline" className="text-[10px]">
                                  {change.replace(/^intake\./, '').replace(/^inventory\./, lang === 'es' ? 'inventario: ' : 'inventory: ')}
                                </Badge>
                              ))}
                              {metadata.pricingImpact && (
                                <Badge className="bg-amber-100 text-amber-800">
                                  {lang === 'es' ? 'Estimado invalidado' : 'Estimate invalidated'}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{entry.actorName || (lang === 'es' ? 'Sistema' : 'System')}</span>
                            <span>•</span>
                            <span>{format(new Date(entry.createdAt), 'PP p', { locale })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Legacy status history fallback if no activity log */}
                  {activityLog.length === 0 && history.map((entry) => {
                    const toColors = getStatusColor(entry.toStatus);
                    return (
                      <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <Activity className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {lang === 'es' ? 'Cambio de Estado' : 'Status Change'}
                            </span>
                            {entry.fromStatus && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {getStatusLabel(entry.fromStatus)}
                                </Badge>
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <Badge style={{ backgroundColor: toColors.bgColor, color: toColors.color }} className="text-xs">
                              {getStatusLabel(entry.toStatus)}
                            </Badge>
                          </div>
                          {entry.note && <p className="text-sm text-muted-foreground mt-1 italic">"{entry.note}"</p>}
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.createdAt), 'PP p', { locale })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                {lang === 'es' ? 'Documentos PDF' : 'PDF Documents'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    {lang === 'es' ? 'No hay documentos generados' : 'No documents generated'}
                  </p>
                  <Button variant="outline" onClick={handleSendPdf} disabled={sendingPdf} data-testid="button-generate-send-pdf">
                    {sendingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                    {lang === 'es' ? 'Generar y enviar PDF' : 'Generate and send PDF'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`document-${doc.id}`}>
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            v{doc.version} - {(doc.fileSize / 1024).toFixed(1)} KB - {format(new Date(doc.createdAt), 'PP', { locale })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(`/api/quotes/${quoteId}/pdf/${doc.id}/preview`, '_blank')}
                          data-testid={`button-preview-doc-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(`/api/quotes/${quoteId}/pdf/${doc.id}/download`, '_blank')}
                          data-testid={`button-download-doc-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {quote.adminNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {lang === 'es' ? 'Notas de Administrador' : 'Admin Notes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{quote.adminNotes}</p>
            </CardContent>
          </Card>
        )}

        {quote && (
          <Card data-testid="storage-recommendation-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-action" />
                {lang === 'es' ? 'Bodega U-Storage' : 'U-Storage Unit'}
              </CardTitle>
              <CardDescription>{lang === 'es' ? 'Contexto persistido al reservar; no depende del catálogo actual.' : 'Context persisted at booking; independent from the current catalog.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <StorageMoveContext quote={quote} lang={lang} />
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={quote.storageAccepted
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : quote.storageAccepted === false
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'}
                  data-testid="status-storage-decision"
                >
                  {quote.storageAccepted
                    ? (lang === 'es' ? 'Aceptada' : 'Accepted')
                    : quote.storageAccepted === false
                      ? (lang === 'es' ? 'No aceptada' : 'Declined')
                      : (lang === 'es' ? 'Sin respuesta' : 'No answer')}
                </Badge>
                {getStorageMoveContext(quote).direction && <Badge variant="secondary">{getStorageMoveContext(quote).labels[lang === 'es' ? 'directionEs' : 'directionEn']}</Badge>}
                {quote.storageContractStatus && <Badge variant="secondary">{quote.storageContractStatus === 'existing' ? (lang === 'es' ? 'Contrato existente' : 'Existing contract') : (lang === 'es' ? 'Necesita unidad' : 'Needs a unit')}</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{lang === 'es' ? 'Sucursal' : 'Branch'}</p>
                  <p className="font-medium" data-testid="text-storage-branch">
                    {getStorageMoveContext(quote).branch ? `${getStorageMoveContext(quote).branch?.brand} · ${getStorageMoveContext(quote).branch?.name}` : (lang === 'es' ? 'Traslado general' : 'General move')}
                  </p>
                  {getStorageMoveContext(quote).branch?.address && (
                    <p className="text-xs text-muted-foreground" data-testid="text-storage-branch-address">
                      {getStorageMoveContext(quote).branch?.address}
                    </p>
                  )}
                  {getStorageMoveContext(quote).branch?.googlePlaceId && <p className="break-all text-xs text-muted-foreground">Place ID: {getStorageMoveContext(quote).branch?.googlePlaceId}</p>}
                  {quote.storageBranchDistanceKm && (
                    <p className="text-xs text-muted-foreground">
                      {lang === 'es' ? 'Distancia' : 'Distance'}: {quote.storageBranchDistanceKm} km
                    </p>
                  )}
                </div>
                {quote.storageSelectedUnitSnapshot && (
                  <div className="md:col-span-3 rounded-md border border-[#ead9d0] bg-[#fffaf6] p-3" data-testid="text-storage-unit-snapshot">
                    <p className="text-muted-foreground">{lang === 'es' ? 'Unidad seleccionada al reservar' : 'Unit snapshot at booking'}</p>
                    <p className="font-medium">{quote.storageSelectedUnitSnapshot.usableSizeM2} m² · {quote.storageSelectedUnitSnapshot.dimensions || '—'} · {lang === 'es' ? 'Piso' : 'Floor'} {quote.storageSelectedUnitSnapshot.floor || '—'}{quote.storageSelectedUnitSnapshot.priceMxn != null ? ` · $${Number(quote.storageSelectedUnitSnapshot.priceMxn).toLocaleString()} MXN/mes` : ''}</p>
                    {quote.storageSelectedUnitSnapshot.code && <p className="text-xs text-muted-foreground">Code: {quote.storageSelectedUnitSnapshot.code}</p>}
                    {quote.storageSelectedUnitSnapshot.promotion && <p className="text-xs text-green-700">{quote.storageSelectedUnitSnapshot.promotion}</p>}
                    {quote.storageAvailabilityCheckedAt && <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Disponibilidad consultada' : 'Availability checked'}: {format(new Date(quote.storageAvailabilityCheckedAt), 'PPp', { locale })}</p>}
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">{lang === 'es' ? 'Tamaño sugerido' : 'Suggested size'}</p>
                  <p className="font-medium" data-testid="text-storage-size">{quote.storageSizeLabel || 'N/D'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{lang === 'es' ? 'Aceptada el' : 'Accepted at'}</p>
                  <p className="font-medium">
                    {quote.storageAcceptedAt ? format(new Date(quote.storageAcceptedAt), 'PPp', { locale }) : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {(crmOutboxData?.entries?.length ?? 0) > 0 && (
          <Card data-testid="crm-sync-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-500" />
                {lang === 'es' ? 'Sincronización CRM (Salesforce)' : 'CRM Sync (Salesforce)'}
              </CardTitle>
              <CardDescription>
                {lang === 'es'
                  ? 'Estado del envío de este lead al CRM del socio'
                  : 'Delivery status of this lead to the partner CRM'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {crmOutboxData!.entries.map((entry) => {
                  const statusConfig: Record<string, { label: string; labelEs: string; className: string }> = {
                    sent: { label: 'Sent', labelEs: 'Enviado', className: 'bg-green-100 text-green-800 border-green-200' },
                    pending: { label: 'Pending', labelEs: 'Pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
                    dry_run: { label: 'Dry run (awaiting credentials)', labelEs: 'Simulación (esperando credenciales)', className: 'bg-blue-100 text-blue-800 border-blue-200' },
                    failed: { label: 'Failed', labelEs: 'Fallido', className: 'bg-red-100 text-red-800 border-red-200' },
                  };
                  const cfg = statusConfig[entry.status] || statusConfig.pending;
                  return (
                    <div key={entry.id} className="border rounded-lg p-4" data-testid={`crm-entry-${entry.id}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cfg.className} data-testid={`status-crm-${entry.id}`}>
                              {lang === 'es' ? cfg.labelEs : cfg.label}
                            </Badge>
                            <Badge variant="secondary">{entry.partner}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {entry.eventType === 'lead.created'
                                ? (lang === 'es' ? 'Lead creado' : 'Lead created')
                                : (lang === 'es' ? 'Lead actualizado' : 'Lead updated')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {lang === 'es' ? 'Intentos' : 'Attempts'}: {entry.attempts}
                            {entry.sentAt && ` · ${lang === 'es' ? 'Enviado' : 'Sent'}: ${format(new Date(entry.sentAt), 'PPp', { locale })}`}
                            {!entry.sentAt && entry.dryRunAt && ` · ${lang === 'es' ? 'Registrado' : 'Recorded'}: ${format(new Date(entry.dryRunAt), 'PPp', { locale })}`}
                          </p>
                          {entry.externalId && (
                            <p className="text-xs font-mono text-muted-foreground" data-testid={`text-crm-external-id-${entry.id}`}>
                              Salesforce ID: {entry.externalId}
                            </p>
                          )}
                          {entry.lastError && (
                            <p className="text-xs text-red-600" data-testid={`text-crm-error-${entry.id}`}>
                              {entry.lastError}
                            </p>
                          )}
                          {entry.status === 'dry_run' && (
                            <p className="text-xs text-blue-700">
                              {lang === 'es'
                                ? 'El lead está guardado y se enviará automáticamente cuando se configuren las credenciales de Salesforce.'
                                : 'The lead is saved and will be sent automatically once Salesforce credentials are configured.'}
                            </p>
                          )}
                        </div>
                        {(entry.status === 'failed' || entry.status === 'pending') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryCrmMutation.mutate(entry.id)}
                            disabled={retryCrmMutation.isPending}
                            data-testid={`button-retry-crm-${entry.id}`}
                          >
                            {retryCrmMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            {lang === 'es' ? 'Reintentar' : 'Retry'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="quote-ratings-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              {lang === 'es' ? 'Calificaciones' : 'Ratings'}
            </CardTitle>
            <CardDescription>
              {lang === 'es' 
                ? 'Calificaciones entre cliente y socio para esta mudanza'
                : 'Ratings between client and partner for this move'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <div className="text-center py-8">
                <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'es' 
                    ? 'No hay calificaciones para esta cotización'
                    : 'No ratings for this quote yet'}
                </p>
                {quote.workflowStatus !== 'completed' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {lang === 'es' 
                      ? 'Las calificaciones estarán disponibles cuando se complete la mudanza'
                      : 'Ratings will be available once the move is completed'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => {
                  const isClientToPartner = rating.direction === 'client_to_partner';
                  return (
                    <div 
                      key={rating.id} 
                      className="border rounded-lg p-4"
                      data-testid={`rating-${rating.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={isClientToPartner ? 'default' : 'secondary'}>
                            {isClientToPartner 
                              ? (lang === 'es' ? 'Cliente → Socio' : 'Client → Partner')
                              : (lang === 'es' ? 'Socio → Cliente' : 'Partner → Client')}
                          </Badge>
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
                            <span className="ml-1 text-sm font-medium">{rating.starRating}/5</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(rating.createdAt), 'PP', { locale })}
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mb-3">
                        {lang === 'es' ? 'Por:' : 'By:'}{' '}
                        <span className="font-medium text-foreground">
                          {rating.rater?.fullName || rating.rater?.email || 'Unknown'}
                        </span>
                      </div>

                      {(rating.excellenceCategories?.length > 0 || rating.improvementCategories?.length > 0) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rating.excellenceCategories?.map((cat) => (
                            <Badge key={cat} variant="outline" className="border-green-300 bg-green-50 text-green-700">
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {cat}
                            </Badge>
                          ))}
                          {rating.improvementCategories?.map((cat) => (
                            <Badge key={cat} variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {rating.comments?.publicComment && (
                        <div className="bg-slate-50 rounded-lg p-3 mb-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <MessageSquare className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario público' : 'Public comment'}
                          </div>
                          <p className="text-sm">{rating.comments.publicComment}</p>
                        </div>
                      )}

                      {rating.comments?.privateComment && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-xs text-amber-700 mb-1">
                            <Eye className="h-3 w-3" />
                            {lang === 'es' ? 'Comentario privado (solo admin)' : 'Private comment (admin only)'}
                          </div>
                          <p className="text-sm text-amber-900">{rating.comments.privateComment}</p>
                        </div>
                      )}

                      {rating.aiTags && rating.aiTags.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-2">
                            {lang === 'es' ? 'Tags de IA' : 'AI Tags'}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {rating.aiTags.map((tag, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline"
                                className={
                                  tag.sentiment === 'positive' 
                                    ? 'border-green-300 text-green-700' 
                                    : tag.sentiment === 'negative'
                                    ? 'border-red-300 text-red-700'
                                    : 'border-gray-300 text-gray-700'
                                }
                              >
                                {lang === 'es' && tag.tagEs ? tag.tagEs : tag.tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
