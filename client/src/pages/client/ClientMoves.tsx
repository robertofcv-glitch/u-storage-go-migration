import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Package, Truck, MapPin, Home, Loader2, Gavel, Calendar, Building2, Clock, DollarSign, ChevronRight, Award, AlertTriangle, CheckCircle, GripVertical, ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState, useEffect, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Quote {
  id: string;
  quoteNumber: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  moveDate: string | null;
  homeSize: string | null;
  workflowStatus: string | null;
  createdAt: string | null;
  bidsCount: number;
  biddingCloseAt: string | null;
  assignedMover: {
    id: string;
    companyName: string;
    companyLogo: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

interface Bid {
  id: string;
  amount: string;
  status: string;
  notes: string | null;
  adjustmentReason: string | null;
  createdAt: string;
  clientPreferenceRank: number | null;
  moverProfile: {
    id: string;
    companyName: string;
    companyLogo: string | null;
    city: string | null;
    state: string | null;
  };
}

interface QuoteWithBids {
  id: string;
  bids: Bid[];
}

interface DroppableZoneProps {
  id: string;
  children: ReactNode;
  className?: string;
}

function DroppableZone({ id, children, className }: DroppableZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'ring-2 ring-[var(--usg-orange)] ring-offset-2' : ''}`}
    >
      {children}
    </div>
  );
}

interface SortableBidItemProps {
  bid: Bid;
  rank?: number;
  isAcceptable: boolean;
  lang: string;
  locale: any;
  onMoveToAcceptable?: () => void;
  onMoveToNotAcceptable?: () => void;
}

function SortableBidItem({ bid, rank, isAcceptable, lang, locale, onMoveToAcceptable, onMoveToNotAcceptable }: SortableBidItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bid.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = bid.status === 'selected' || bid.status === 'accepted';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isDragging ? 'shadow-lg z-50' : ''
      } ${
        isSelected 
          ? 'border-green-500 bg-green-50' 
          : isAcceptable 
            ? 'border-[var(--usg-orange)] bg-[var(--usg-orange)]/5'
            : 'border-gray-200 bg-white'
      }`}
      data-testid={`sortable-bid-${bid.id}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>

      {rank && (
        <div className="w-8 h-8 rounded-full bg-[var(--usg-orange)] text-[var(--usg-ink)] flex items-center justify-center font-bold text-sm flex-shrink-0">
          {rank}
        </div>
      )}

      <div className="h-10 w-10 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center flex-shrink-0">
        {bid.moverProfile.companyLogo ? (
          <img 
            src={bid.moverProfile.companyLogo} 
            alt={bid.moverProfile.companyName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <Building2 className="h-5 w-5 text-[var(--usg-purple)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--usg-ink)] truncate text-sm">
          {bid.moverProfile.companyName}
        </p>
        <p className="text-lg font-bold text-[var(--usg-ink)]">
          ${Number(bid.amount).toLocaleString()} MXN
        </p>
      </div>

      {isSelected && (
        <Badge className="bg-green-600 flex-shrink-0">
          <Award className="h-3 w-3 mr-1" />
          {lang === 'es' ? 'Seleccionado' : 'Selected'}
        </Badge>
      )}

      {isAcceptable && onMoveToNotAcceptable && (
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToNotAcceptable();
          }}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      )}

      {!isAcceptable && onMoveToAcceptable && (
        <Button
          size="sm"
          variant="ghost"
          className="text-green-500 hover:text-green-700 hover:bg-green-50 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToAcceptable();
          }}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default function ClientMoves() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const locale = lang === 'es' ? es : enUS;
  const [_, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showBidsSheet, setShowBidsSheet] = useState(false);

  const { data, isLoading } = useQuery<{ quotes: Quote[] }>({
    queryKey: ['client-quotes'],
    queryFn: async () => {
      const response = await fetch('/api/client/quotes', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return response.json();
    },
    enabled: !!authUser,
  });

  const { data: quoteDetails, refetch: refetchQuoteDetails } = useQuery<{ quote: QuoteWithBids }>({
    queryKey: [`/api/client/quotes/${selectedQuoteId}`],
    queryFn: async () => {
      const response = await fetch(`/api/client/quotes/${selectedQuoteId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch quote details');
      return response.json();
    },
    enabled: !!selectedQuoteId && showBidsSheet,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for drag and drop ordering
  const [acceptableBids, setAcceptableBids] = useState<Bid[]>([]);
  const [notAcceptableBids, setNotAcceptableBids] = useState<Bid[]>([]);

  // Initialize bid lists when quote details change
  useEffect(() => {
    if (quoteDetails?.quote?.bids) {
      const bids = quoteDetails.quote.bids;
      // Bids with rank > 0 are acceptable (in order), rank <= 0 or null are not acceptable
      const acceptable = bids
        .filter(b => b.clientPreferenceRank !== null && b.clientPreferenceRank > 0)
        .sort((a, b) => (a.clientPreferenceRank || 0) - (b.clientPreferenceRank || 0));
      const notAcceptable = bids
        .filter(b => b.clientPreferenceRank === null || b.clientPreferenceRank <= 0)
        .sort((a, b) => Number(a.amount) - Number(b.amount));
      setAcceptableBids(acceptable);
      setNotAcceptableBids(notAcceptable);
    }
  }, [quoteDetails?.quote?.bids]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const savePreferencesMutation = useMutation({
    mutationFn: async (bidRankings: { bidId: string; rank: number }[]) => {
      const response = await fetch(`/api/client/quotes/${selectedQuoteId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bidRankings }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save preferences');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: lang === 'es' ? '¡Preferencias guardadas!' : 'Preferences saved!',
        description: lang === 'es' ? 'Tus preferencias han sido registradas.' : 'Your preferences have been recorded.',
      });
      refetchQuoteDetails();
    },
    onError: (error: Error) => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveCurrentOrder = (newAcceptable: Bid[], newNotAcceptable: Bid[]) => {
    // Build rankings: acceptable bids get ranks 1, 2, 3, etc.
    // Not acceptable bids are not sent (they'll be cleared to null by backend)
    const bidRankings = newAcceptable.map((bid, index) => ({
      bidId: bid.id,
      rank: index + 1,
    }));
    savePreferencesMutation.mutate(bidRankings);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if active item is in acceptable or not acceptable list
    const isActiveInAcceptable = acceptableBids.some(b => b.id === activeId);
    
    // Check if dropping on a zone container (for empty zones)
    const isOverAcceptableZone = overId === 'acceptable-zone';
    const isOverNotAcceptableZone = overId === 'not-acceptable-zone';
    
    // Check if dropping on an item in one of the lists
    const isOverItemInAcceptable = acceptableBids.some(b => b.id === overId);
    const isOverItemInNotAcceptable = notAcceptableBids.some(b => b.id === overId);

    if (isActiveInAcceptable) {
      // Active item is from acceptable list
      if (isOverNotAcceptableZone || isOverItemInNotAcceptable) {
        // Moving from acceptable to not acceptable
        const bid = acceptableBids.find(b => b.id === activeId);
        if (bid) {
          const newAcceptable = acceptableBids.filter(b => b.id !== activeId);
          const insertIndex = isOverItemInNotAcceptable 
            ? notAcceptableBids.findIndex(b => b.id === overId)
            : 0;
          const newNotAcceptable = [...notAcceptableBids];
          newNotAcceptable.splice(insertIndex >= 0 ? insertIndex : 0, 0, bid);
          setAcceptableBids(newAcceptable);
          setNotAcceptableBids(newNotAcceptable);
          saveCurrentOrder(newAcceptable, newNotAcceptable);
        }
      } else if (isOverItemInAcceptable) {
        // Reordering within acceptable
        const oldIndex = acceptableBids.findIndex(b => b.id === activeId);
        const newIndex = acceptableBids.findIndex(b => b.id === overId);
        if (newIndex >= 0) {
          const newAcceptable = arrayMove(acceptableBids, oldIndex, newIndex);
          setAcceptableBids(newAcceptable);
          saveCurrentOrder(newAcceptable, notAcceptableBids);
        }
      }
    } else {
      // Active item is from not acceptable list
      if (isOverAcceptableZone || isOverItemInAcceptable) {
        // Moving from not acceptable to acceptable
        const bid = notAcceptableBids.find(b => b.id === activeId);
        if (bid) {
          const newNotAcceptable = notAcceptableBids.filter(b => b.id !== activeId);
          const insertIndex = isOverItemInAcceptable
            ? acceptableBids.findIndex(b => b.id === overId)
            : acceptableBids.length;
          const newAcceptable = [...acceptableBids];
          newAcceptable.splice(insertIndex >= 0 ? insertIndex : newAcceptable.length, 0, bid);
          setAcceptableBids(newAcceptable);
          setNotAcceptableBids(newNotAcceptable);
          saveCurrentOrder(newAcceptable, newNotAcceptable);
        }
      } else if (isOverItemInNotAcceptable) {
        // Reordering within not acceptable
        const oldIndex = notAcceptableBids.findIndex(b => b.id === activeId);
        const newIndex = notAcceptableBids.findIndex(b => b.id === overId);
        if (newIndex >= 0) {
          setNotAcceptableBids(arrayMove(notAcceptableBids, oldIndex, newIndex));
        }
      }
    }
  };

  const moveToAcceptable = (bid: Bid) => {
    const newNotAcceptable = notAcceptableBids.filter(b => b.id !== bid.id);
    const newAcceptable = [...acceptableBids, bid];
    setNotAcceptableBids(newNotAcceptable);
    setAcceptableBids(newAcceptable);
    saveCurrentOrder(newAcceptable, newNotAcceptable);
  };

  const moveToNotAcceptable = (bid: Bid) => {
    const newAcceptable = acceptableBids.filter(b => b.id !== bid.id);
    const newNotAcceptable = [bid, ...notAcceptableBids];
    setAcceptableBids(newAcceptable);
    setNotAcceptableBids(newNotAcceptable);
    saveCurrentOrder(newAcceptable, newNotAcceptable);
  };

  const sidebarLinks = [
    { href: "/dashboard", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "/dashboard/moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "/dashboard/quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "/dashboard/saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  const homeSizeLabels: Record<string, { es: string; en: string }> = {
    small: { es: 'Pequeño', en: 'Small' },
    medium: { es: 'Mediano', en: 'Medium' },
    large: { es: 'Grande', en: 'Large' },
    office: { es: 'Oficina', en: 'Office' },
    studio: { es: 'Estudio', en: 'Studio' },
    '1br': { es: '1 Recámara', en: '1 Bedroom' },
    '2br': { es: '2 Recámaras', en: '2 Bedrooms' },
    '3br': { es: '3 Recámaras', en: '3 Bedrooms' },
    '4br': { es: '4+ Recámaras', en: '4+ Bedrooms' },
    house: { es: 'Casa', en: 'House' },
    commercial: { es: 'Comercial', en: 'Commercial' },
  };

  const getHomeSizeLabel = (size: string | null) => {
    if (!size) return '-';
    return homeSizeLabels[size]?.[lang] || size;
  };

  const getStatusBadge = (status: string | null) => {
    const statusStyles: Record<string, string> = {
      intake: "bg-blue-100 text-blue-800",
      triage: "bg-yellow-100 text-yellow-800",
      bidding_open: "bg-purple-100 text-purple-800",
      bidding_closed: "bg-indigo-100 text-indigo-800",
      selection: "bg-orange-100 text-orange-800",
      confirmed: "bg-green-100 text-green-800",
      scheduled: "bg-emerald-100 text-emerald-800",
      in_progress: "bg-cyan-100 text-cyan-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return statusStyles[status || ''] || "bg-gray-100 text-gray-600";
  };

  const getStatusLabel = (status: string | null) => {
    const labels: Record<string, { es: string; en: string }> = {
      intake: { es: 'Recibido', en: 'Received' },
      triage: { es: 'En Revisión', en: 'Under Review' },
      bidding_open: { es: 'Recibiendo Ofertas', en: 'Receiving Bids' },
      bidding_closed: { es: 'Ofertas Cerradas', en: 'Bidding Closed' },
      selection: { es: 'En Selección', en: 'Selection' },
      confirmed: { es: 'Confirmado', en: 'Confirmed' },
      scheduled: { es: 'Programado', en: 'Scheduled' },
      in_progress: { es: 'En Proceso', en: 'In Progress' },
      completed: { es: 'Completado', en: 'Completed' },
      cancelled: { es: 'Cancelado', en: 'Cancelled' },
    };
    return labels[status || '']?.[lang] || status || 'Unknown';
  };

  const handleViewBids = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setShowBidsSheet(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  const quotes = data?.quotes || [];
  const receivingOffers = quotes.filter(q => ['bidding_open', 'bidding_closed'].includes(q.workflowStatus || ''));
  const activeMoves = quotes.filter(q => ['selection', 'confirmed', 'scheduled', 'in_progress'].includes(q.workflowStatus || ''));
  const completedMoves = quotes.filter(q => q.workflowStatus === 'completed');

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);
  const bids = quoteDetails?.quote?.bids || [];

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">
            {lang === 'es' ? 'Mis Mudanzas' : 'My Moves'}
          </h1>
          <p className="text-muted-foreground">
            {lang === 'es' ? 'Gestiona tus mudanzas y revisa las ofertas recibidas' : 'Manage your moves and review received offers'}
          </p>
        </div>

        {/* Cotizaciones Recibiendo Ofertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-purple-600" />
              {lang === 'es' ? 'Cotizaciones Recibiendo Ofertas' : 'Quotes Receiving Offers'}
              {receivingOffers.length > 0 && (
                <Badge variant="secondary" className="ml-2">{receivingOffers.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receivingOffers.length > 0 ? (
              <div className="space-y-3">
                {receivingOffers.map((quote) => {
                  const daysUntilClose = quote.biddingCloseAt 
                    ? differenceInDays(new Date(quote.biddingCloseAt), new Date()) 
                    : null;
                  const isUrgent = daysUntilClose !== null && daysUntilClose <= 3;

                  return (
                    <div 
                      key={quote.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleViewBids(quote.id)}
                      data-testid={`row-receiving-offers-${quote.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {quote.quoteNumber && (
                            <span className="text-xs font-mono bg-[var(--usg-purple)] text-[var(--usg-paper)] px-2 py-0.5 rounded">{quote.quoteNumber}</span>
                          )}
                          <Badge className={getStatusBadge(quote.workflowStatus)}>
                            {getStatusLabel(quote.workflowStatus)}
                          </Badge>
                          {quote.bidsCount > 0 && (
                            <Badge className="bg-[var(--usg-orange)] text-[var(--usg-ink)]">
                              {quote.bidsCount} {lang === 'es' ? 'ofertas' : 'bids'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{quote.fromAddress || '-'}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate">{quote.toAddress || '-'}</span>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {quote.moveDate ? format(new Date(quote.moveDate), 'dd MMM yyyy', { locale }) : '-'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {getHomeSizeLabel(quote.homeSize)}
                          </span>
                          {quote.biddingCloseAt && (
                            <span className={`flex items-center gap-1 ${isUrgent ? 'text-amber-600' : ''}`}>
                              {isUrgent && <AlertTriangle className="h-3 w-3" />}
                              <Clock className="h-3 w-3" />
                              {lang === 'es' ? 'Cierra' : 'Closes'}: {formatDistanceToNow(new Date(quote.biddingCloseAt), { addSuffix: true, locale })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-[var(--usg-orange)] font-medium ml-4">
                        {lang === 'es' ? 'Ver ofertas' : 'View offers'}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed rounded-lg">
                <Gavel className="h-8 w-8 mb-2" />
                <p>{lang === 'es' ? 'No hay cotizaciones recibiendo ofertas' : 'No quotes receiving offers'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mudanzas Activas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              {lang === 'es' ? 'Mudanzas Activas' : 'Active Moves'}
              {activeMoves.length > 0 && (
                <Badge variant="secondary" className="ml-2">{activeMoves.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeMoves.length > 0 ? (
              <div className="space-y-3">
                {activeMoves.map((quote) => (
                  <div 
                    key={quote.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/dashboard/quotes/${quote.id}`)}
                    data-testid={`row-active-move-${quote.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {quote.assignedMover && (
                        <div className="h-10 w-10 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center flex-shrink-0">
                          {quote.assignedMover.companyLogo ? (
                            <img 
                              src={quote.assignedMover.companyLogo} 
                              alt={quote.assignedMover.companyName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-[var(--usg-purple)]" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {quote.quoteNumber && (
                            <span className="text-xs font-mono bg-[var(--usg-purple)] text-[var(--usg-paper)] px-2 py-0.5 rounded">{quote.quoteNumber}</span>
                          )}
                          <Badge className={getStatusBadge(quote.workflowStatus)}>
                            {getStatusLabel(quote.workflowStatus)}
                          </Badge>
                          {quote.assignedMover && (
                            <span className="text-sm font-medium text-green-700">{quote.assignedMover.companyName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{quote.fromAddress || '-'}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate">{quote.toAddress || '-'}</span>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {quote.moveDate ? format(new Date(quote.moveDate), 'dd MMM yyyy', { locale }) : '-'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {getHomeSizeLabel(quote.homeSize)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-[var(--usg-orange)] font-medium ml-4">
                      {lang === 'es' ? 'Ver detalles' : 'View details'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed rounded-lg">
                <Truck className="h-8 w-8 mb-2" />
                <p>{lang === 'es' ? 'No hay mudanzas activas' : 'No active moves'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mudanzas Completadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-gray-500" />
              {lang === 'es' ? 'Mudanzas Completadas' : 'Completed Moves'}
              {completedMoves.length > 0 && (
                <Badge variant="secondary" className="ml-2">{completedMoves.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedMoves.length > 0 ? (
              <div className="space-y-3">
                {completedMoves.map((quote) => (
                  <div 
                    key={quote.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/dashboard/quotes/${quote.id}`)}
                    data-testid={`card-completed-move-${quote.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {quote.assignedMover && (
                        <div className="h-10 w-10 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center flex-shrink-0">
                          {quote.assignedMover.companyLogo ? (
                            <img 
                              src={quote.assignedMover.companyLogo} 
                              alt={quote.assignedMover.companyName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-[var(--usg-purple)]" />
                          )}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {quote.quoteNumber && (
                            <span className="text-xs font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{quote.quoteNumber}</span>
                          )}
                          <span className="font-medium">{quote.fromAddress || '-'} → {quote.toAddress || '-'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {quote.moveDate ? format(new Date(quote.moveDate), 'dd MMM yyyy', { locale }) : '-'}
                          {quote.assignedMover && ` • ${quote.assignedMover.companyName}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusBadge(quote.workflowStatus)}>
                      {getStatusLabel(quote.workflowStatus)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-20 text-slate-400 border-2 border-dashed rounded-lg">
                <p>{lang === 'es' ? 'No hay mudanzas completadas' : 'No completed moves'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bids Sheet */}
      <Sheet open={showBidsSheet} onOpenChange={setShowBidsSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedQuote && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5" />
                  {lang === 'es' ? 'Ofertas Recibidas' : 'Offers Received'}
                </SheetTitle>
                <SheetDescription>
                  {selectedQuote.fromAddress} → {selectedQuote.toAddress}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {selectedQuote.moveDate ? format(new Date(selectedQuote.moveDate), 'dd MMM yyyy', { locale }) : '-'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    {getHomeSizeLabel(selectedQuote.homeSize)}
                  </div>
                </div>

                {/* Drag and drop preference info */}
                <div className="bg-[var(--usg-orange)]/10 p-3 rounded-lg text-sm">
                  <p className="font-medium text-[var(--usg-ink)] mb-1">
                    {lang === 'es' ? 'Ordena tus preferencias' : 'Rank your preferences'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {lang === 'es' 
                      ? 'Arrastra las ofertas para ordenarlas según tu preferencia. El orden le indica a U-Storage Go cuál es tu opción favorita (#1), segunda opción (#2), etc. Las ofertas debajo de la línea se consideran no aceptables.' 
                      : 'Drag offers to rank them by your preference. The order tells U-Storage Go which is your favorite option (#1), second choice (#2), etc. Offers below the line are considered not acceptable.'}
                  </p>
                </div>

                {(acceptableBids.length > 0 || notAcceptableBids.length > 0) ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="space-y-2">
                      {/* Acceptable section header */}
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                        <ThumbsUp className="h-4 w-4" />
                        {lang === 'es' ? 'Aceptables' : 'Acceptable'} ({acceptableBids.length})
                      </div>

                      {/* Acceptable bids list */}
                      <SortableContext
                        items={acceptableBids.map(b => b.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableZone 
                          id="acceptable-zone" 
                          className="space-y-2 min-h-[60px] p-2 bg-green-50/50 rounded-lg border-2 border-dashed border-green-200 transition-all"
                        >
                          {acceptableBids.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {lang === 'es' ? 'Arrastra ofertas aquí para marcarlas como aceptables' : 'Drag offers here to mark them as acceptable'}
                            </p>
                          ) : (
                            acceptableBids.map((bid, index) => (
                              <SortableBidItem
                                key={bid.id}
                                bid={bid}
                                rank={index + 1}
                                isAcceptable={true}
                                lang={lang}
                                locale={locale}
                                onMoveToNotAcceptable={() => moveToNotAcceptable(bid)}
                              />
                            ))
                          )}
                        </DroppableZone>
                      </SortableContext>

                      {/* Divider line */}
                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t-2 border-red-300 border-dashed"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-3 text-sm text-red-500 font-medium">
                            {lang === 'es' ? '— Límite de aceptación —' : '— Acceptance limit —'}
                          </span>
                        </div>
                      </div>

                      {/* Not acceptable section header */}
                      <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                        <ThumbsDown className="h-4 w-4" />
                        {lang === 'es' ? 'No aceptables' : 'Not acceptable'} ({notAcceptableBids.length})
                      </div>

                      {/* Not acceptable bids list */}
                      <SortableContext
                        items={notAcceptableBids.map(b => b.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableZone 
                          id="not-acceptable-zone" 
                          className="space-y-2 min-h-[60px] p-2 bg-red-50/30 rounded-lg border-2 border-dashed border-red-200 transition-all"
                        >
                          {notAcceptableBids.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {lang === 'es' ? 'Arrastra ofertas aquí si no son aceptables' : 'Drag offers here if not acceptable'}
                            </p>
                          ) : (
                            notAcceptableBids.map((bid) => (
                              <SortableBidItem
                                key={bid.id}
                                bid={bid}
                                isAcceptable={false}
                                lang={lang}
                                locale={locale}
                                onMoveToAcceptable={() => moveToAcceptable(bid)}
                              />
                            ))
                          )}
                        </DroppableZone>
                      </SortableContext>
                    </div>
                  </DndContext>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <Gavel className="h-12 w-12 mb-4" />
                    <p className="text-center">
                      {lang === 'es' 
                        ? 'Aún no hay ofertas. Los socios están revisando tu solicitud.' 
                        : 'No offers yet. Partners are reviewing your request.'}
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
                  onClick={() => {
                    setShowBidsSheet(false);
                    setLocation(`/dashboard/quotes/${selectedQuoteId}`);
                  }}
                >
                  {lang === 'es' ? 'Ver detalles completos' : 'View full details'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
