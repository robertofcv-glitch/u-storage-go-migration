import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, MapPin, Calendar, Package, Clock, User, Building2,
  DollarSign, Send, CheckCircle, XCircle, Eye, Gavel,
  Truck, AlertTriangle, Inbox, Home, Timer, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { StorageMoveContext } from "@/components/quote/StorageMoveContext";

interface MoverQuotesProps {
  moverProfileId: string;
}

export function MoverQuotes({ moverProfileId }: MoverQuotesProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('invitations');
  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);
  const [showInvitationDetail, setShowInvitationDetail] = useState(false);
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidHours, setBidHours] = useState('');
  const [bidCrew, setBidCrew] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const { data: invitationsData, isLoading: loadingInvitations } = useQuery({
    queryKey: ['mover-invitations', moverProfileId],
    queryFn: async () => {
      const response = await fetch(`/api/mover/${moverProfileId}/invitations`);
      if (!response.ok) throw new Error('Failed to fetch invitations');
      const data = await response.json();
      return data.invitations;
    },
    enabled: !!moverProfileId,
  });

  const { data: bidsData, isLoading: loadingBids } = useQuery({
    queryKey: ['mover-bids', moverProfileId],
    queryFn: async () => {
      const response = await fetch(`/api/mover/${moverProfileId}/bids`);
      if (!response.ok) throw new Error('Failed to fetch bids');
      const data = await response.json();
      return data.bids;
    },
    enabled: !!moverProfileId,
  });

  const markViewedMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/mover/invitations/${invitationId}/view`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark as viewed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-invitations', moverProfileId] });
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/mover/invitations/${invitationId}/decline`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to decline invitation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-invitations', moverProfileId] });
      setShowInvitationDetail(false);
      toast.success(t('quotes.mover.invitationDeclined'));
    },
  });

  const submitBidMutation = useMutation({
    mutationFn: async (data: {
      invitationId: string;
      quoteId: string;
      amount: string;
      estimatedHours: number | null;
      crewSize: number | null;
      notes: string | null;
      adjustmentReason: string | null;
    }) => {
      const response = await fetch(`/api/mover/quotes/${data.quoteId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: data.invitationId,
          moverProfileId,
          amount: data.amount,
          estimatedHours: data.estimatedHours,
          crewSize: data.crewSize,
          notes: data.notes,
          adjustmentReason: data.adjustmentReason,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit bid');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-invitations', moverProfileId] });
      queryClient.invalidateQueries({ queryKey: ['mover-bids', moverProfileId] });
      setShowBidDialog(false);
      setShowInvitationDetail(false);
      resetBidForm();
      toast.success(t('quotes.mover.bidSubmitted'));
      setActiveTab('bids');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const withdrawBidMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const response = await fetch(`/api/mover/bids/${bidId}/withdraw`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to withdraw bid');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-bids', moverProfileId] });
      toast.success(t('quotes.mover.bidWithdrawn'));
    },
  });

  const resetBidForm = () => {
    setBidAmount('');
    setBidHours('');
    setBidCrew('');
    setBidNotes('');
    setAdjustmentReason('');
  };

  const handleViewInvitation = (invitation: any) => {
    setSelectedInvitation(invitation);
    setShowInvitationDetail(true);
    
    if (invitation.status === 'invited') {
      markViewedMutation.mutate(invitation.id);
    }
  };

  const handleOpenBidDialog = () => {
    if (selectedInvitation?.quotedAmount) {
      setBidAmount(selectedInvitation.quotedAmount.toString());
    } else if (selectedInvitation?.quote?.suggestedPrice) {
      setBidAmount(selectedInvitation.quote.suggestedPrice.toString());
    }
    setAdjustmentReason('');
    setShowBidDialog(true);
  };

  const isPriceChanged = () => {
    if (!selectedInvitation?.quotedAmount || !bidAmount) return false;
    return Number(bidAmount) !== Number(selectedInvitation.quotedAmount);
  };

  const handleSubmitBid = () => {
    if (!selectedInvitation || !bidAmount) return;
    
    const priceChanged = isPriceChanged();
    if (priceChanged && !adjustmentReason.trim()) {
      toast.error(t('quotes.mover.adjustmentReasonRequired'));
      return;
    }
    
    submitBidMutation.mutate({
      invitationId: selectedInvitation.id,
      quoteId: selectedInvitation.quoteId,
      amount: bidAmount,
      estimatedHours: bidHours ? parseInt(bidHours) : null,
      crewSize: bidCrew ? parseInt(bidCrew) : null,
      notes: bidNotes || null,
      adjustmentReason: priceChanged ? adjustmentReason : null,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      'invited': { color: 'bg-blue-100 text-blue-700', icon: Inbox, label: t('quotes.mover.status.new') },
      'viewed': { color: 'bg-yellow-100 text-yellow-700', icon: Eye, label: t('quotes.mover.status.viewed') },
      'bid_submitted': { color: 'bg-green-100 text-green-700', icon: Send, label: t('quotes.mover.status.bidSubmitted') },
      'declined': { color: 'bg-red-100 text-red-700', icon: XCircle, label: t('quotes.mover.status.declined') },
      'expired': { color: 'bg-slate-100 text-slate-700', icon: Clock, label: t('quotes.mover.status.expired') },
    };

    const config = statusConfig[status] || statusConfig['invited'];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} hover:${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getBidStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      'submitted': { color: 'bg-blue-100 text-blue-700', icon: Send, label: t('quotes.mover.bidStatus.submitted') },
      'accepted': { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: t('quotes.mover.bidStatus.accepted') },
      'rejected': { color: 'bg-red-100 text-red-700', icon: XCircle, label: t('quotes.mover.bidStatus.rejected') },
      'withdrawn': { color: 'bg-slate-100 text-slate-700', icon: XCircle, label: t('quotes.mover.bidStatus.withdrawn') },
    };

    const config = statusConfig[status] || statusConfig['submitted'];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} hover:${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const pendingInvitations = invitationsData?.filter((inv: any) => 
    ['invited', 'viewed'].includes(inv.status)
  ) || [];
  
  const activeBids = bidsData?.filter((bid: any) => 
    bid.status === 'submitted'
  ) || [];

  // Sort invitations by closing date (dueAt), closest first
  const sortedInvitations = [...(invitationsData || [])].sort((a, b) => {
    const dateA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const dateB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return dateA - dateB;
  });

  const getHomeSizeLabel = (size: string) => {
    const sizes: Record<string, { en: string; es: string }> = {
      'small': { en: 'Small', es: 'Pequeño' },
      'medium': { en: 'Medium', es: 'Mediano' },
      'large': { en: 'Large', es: 'Grande' },
      'extra-large': { en: 'Extra Large', es: 'Extra Grande' },
    };
    const lang = i18n.language;
    return sizes[size]?.[lang as 'en' | 'es'] || size;
  };

  const getDaysRemaining = (dueAt: string | null) => {
    if (!dueAt) return null;
    const now = new Date();
    const due = new Date(dueAt);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <>
      <div className="rounded-xl border border-[#502864]/15 bg-[#502864]/[0.04] p-4">
        <p className="text-sm font-semibold text-[#502864]">
          {i18n.language === 'es' ? 'El despacho directo es el flujo principal' : 'Direct dispatch is the primary workflow'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {i18n.language === 'es'
            ? 'Revisa las asignaciones en Trabajos. Esta bandeja conserva invitaciones y ofertas históricas.'
            : 'Review assignments in Jobs. This inbox keeps legacy invitations and bids for reference.'}
        </p>
      </div>
      <h2 className="text-2xl font-bold text-primary">{i18n.language === 'es' ? 'Historial de cotizaciones' : 'Quote history'}</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#EF7521]" />
            {i18n.language === 'es' ? 'Invitaciones y ofertas anteriores' : 'Legacy invitations and bids'}
          </CardTitle>
          <CardDescription>
            {i18n.language === 'es' ? 'Las nuevas asignaciones no requieren puja.' : 'New assignments do not require bidding.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="invitations" className="gap-2">
                <Inbox className="h-4 w-4" />
                {t('quotes.mover.tabs.invitations')}
                {pendingInvitations.length > 0 && (
                  <Badge className="ml-1 bg-[#EF7521]">{pendingInvitations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bids" className="gap-2">
                <Gavel className="h-4 w-4" />
                {t('quotes.mover.tabs.myBids')}
                {activeBids.length > 0 && (
                  <Badge variant="outline" className="ml-1">{activeBids.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invitations">
              {loadingInvitations ? (
                <div className="flex items-center justify-center h-40 text-slate-400">
                  {t('common.loading')}
                </div>
              ) : sortedInvitations && sortedInvitations.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortedInvitations.map((invitation: any) => {
                    const daysRemaining = getDaysRemaining(invitation.dueAt);
                    const isUrgent = daysRemaining !== null && daysRemaining <= 3;
                    const quotedAmount = invitation.quotedAmount || invitation.quote?.estimatedCost;
                    
                    return (
                      <Card 
                        key={invitation.id} 
                        className={`cursor-pointer transition-all hover:shadow-lg hover:border-[#EF7521] ${
                          invitation.status === 'invited' ? 'ring-2 ring-[#EF7521] ring-opacity-50' : ''
                        } ${isUrgent ? 'border-orange-300' : ''}`}
                        onClick={() => handleViewInvitation(invitation)}
                        data-testid={`card-invitation-${invitation.id}`}
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Header: Status + Deadline */}
                          <div className="flex justify-between items-start">
                            {getStatusBadge(invitation.status)}
                            {daysRemaining !== null && (
                              <Badge 
                                variant="outline" 
                                className={`${isUrgent ? 'border-orange-500 text-orange-600 bg-orange-50' : 'text-muted-foreground'}`}
                              >
                                <Timer className="h-3 w-3 mr-1" />
                                {daysRemaining <= 0 
                                  ? (i18n.language === 'es' ? 'Vencido' : 'Expired')
                                  : daysRemaining === 1 
                                    ? (i18n.language === 'es' ? '1 día' : '1 day')
                                    : `${daysRemaining} ${i18n.language === 'es' ? 'días' : 'days'}`
                                }
                              </Badge>
                            )}
                          </div>

                          {/* Price - Prominent Display */}
                          {quotedAmount && (
                            <div className="text-center py-2 bg-gradient-to-r from-[#EF7521]/10 to-[#EF7521]/5 rounded-lg">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                {i18n.language === 'es' ? 'Precio Sugerido' : 'Suggested Price'}
                              </p>
                              <p className="text-2xl font-bold text-[#EF7521]">
                                ${Number(quotedAmount).toLocaleString()} <span className="text-sm font-normal">MXN</span>
                              </p>
                            </div>
                          )}

                          {/* Route */}
                          <StorageMoveContext quote={invitation.quote || {}} lang={i18n.language === "es" ? "es" : "en"} compact />
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm font-medium line-clamp-1">
                                {invitation.quote?.fromAddress?.split(',')[0] || t('quotes.mover.unknownLocation')}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 text-slate-300 ml-0 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground line-clamp-1">
                                {invitation.quote?.toAddress?.split(',')[0] || t('quotes.mover.unknownLocation')}
                              </span>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                            <div className="text-center">
                              <Home className="h-4 w-4 mx-auto text-slate-400" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {invitation.quote?.homeSize 
                                  ? getHomeSizeLabel(invitation.quote.homeSize)
                                  : '-'
                                }
                              </p>
                            </div>
                            <div className="text-center">
                              <Calendar className="h-4 w-4 mx-auto text-slate-400" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {invitation.quote?.moveDate 
                                  ? format(new Date(invitation.quote.moveDate), 'dd/MM')
                                  : '-'}
                              </p>
                            </div>
                            <div className="text-center">
                              <Package className="h-4 w-4 mx-auto text-slate-400" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {invitation.quote?.inventoryItems?.length || 0} {t('quotes.mover.items')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Inbox className="h-12 w-12 mb-4" />
                  <p>{t('quotes.mover.noInvitations')}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bids">
              {loadingBids ? (
                <div className="flex items-center justify-center h-40 text-slate-400">
                  {t('common.loading')}
                </div>
              ) : bidsData && bidsData.length > 0 ? (
                <div className="space-y-3">
                  {bidsData.map((bid: any) => (
                    <Card key={bid.id} data-testid={`card-bid-${bid.id}`}>
                      <CardContent className="py-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span className="font-medium">{bid.quote?.fromAddress || '-'}</span>
                            </div>
                            <div className="text-sm text-muted-foreground pl-6">
                              → {bid.quote?.toAddress || '-'}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {bid.estimatedHours && (
                                <span>{bid.estimatedHours}h</span>
                              )}
                              {bid.crewSize && (
                                <span>{bid.crewSize} {t('quotes.mover.crew')}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            {getBidStatusBadge(bid.status)}
                            <div className="text-xl font-bold">
                              ${Number(bid.amount).toLocaleString()} MXN
                            </div>
                            {bid.status === 'submitted' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => withdrawBidMutation.mutate(bid.id)}
                                disabled={withdrawBidMutation.isPending}
                              >
                                {t('quotes.mover.withdrawBid')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Gavel className="h-12 w-12 mb-4" />
                  <p>{t('quotes.mover.noBids')}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Sheet open={showInvitationDetail} onOpenChange={setShowInvitationDetail}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedInvitation && (
            <>
              <SheetHeader>
                <SheetTitle>{t('quotes.mover.quoteDetails')}</SheetTitle>
                <SheetDescription>
                  {t('quotes.mover.invitedAt')}: {format(new Date(selectedInvitation.createdAt), 'dd/MM/yyyy HH:mm')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid gap-4">
                  <StorageMoveContext quote={selectedInvitation.quote || {}} lang={i18n.language === "es" ? "es" : "en"} compact />
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.mover.route')}</p>
                      <p className="text-sm">{selectedInvitation.quote?.fromAddress}</p>
                      <p className="text-sm text-muted-foreground">→ {selectedInvitation.quote?.toAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.mover.moveDate')}</p>
                      <p className="text-sm">
                        {selectedInvitation.quote?.moveDate 
                          ? format(new Date(selectedInvitation.quote.moveDate), 'EEEE, dd MMMM yyyy')
                          : t('quotes.mover.dateNotSet')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.mover.homeSize')}</p>
                      <p className="text-sm">
                        {selectedInvitation.quote?.homeSize 
                          ? getHomeSizeLabel(selectedInvitation.quote.homeSize)
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Services requested */}
                  {(selectedInvitation.quote?.needsPacking || selectedInvitation.quote?.needsUnpacking || 
                    selectedInvitation.quote?.needsInsurance || selectedInvitation.quote?.needsBox) && (
                    <div className="flex items-start gap-3">
                      <Truck className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="font-medium">{i18n.language === 'es' ? 'Servicios Solicitados' : 'Services Requested'}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedInvitation.quote?.needsPacking && (
                            <Badge variant="secondary" className="text-xs">
                              {i18n.language === 'es' ? 'Empaque' : 'Packing'}
                            </Badge>
                          )}
                          {selectedInvitation.quote?.needsUnpacking && (
                            <Badge variant="secondary" className="text-xs">
                              {i18n.language === 'es' ? 'Desempaque' : 'Unpacking'}
                            </Badge>
                          )}
                          {selectedInvitation.quote?.needsInsurance && (
                            <Badge variant="secondary" className="text-xs">
                              {i18n.language === 'es' ? 'Seguro' : 'Insurance'}
                            </Badge>
                          )}
                          {selectedInvitation.quote?.needsBox && (
                            <Badge variant="secondary" className="text-xs">
                              {i18n.language === 'es' ? 'Cajas' : 'Boxes'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('quotes.mover.inventory')} ({selectedInvitation.quote?.inventoryItems?.length || 0})
                  </h4>
                  {selectedInvitation.quote?.inventoryItems && selectedInvitation.quote.inventoryItems.length > 0 ? (
                    <ScrollArea className="h-[120px] rounded-md border p-3">
                      <div className="space-y-2">
                        {selectedInvitation.quote.inventoryItems.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.itemName}</span>
                            <Badge variant="outline">{item.quantity}x</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('quotes.mover.noInventory')}</p>
                  )}
                </div>

                <Separator />

                <div className="bg-[#F8D9BF]/30 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t('quotes.mover.suggestedPrice')}
                  </h4>
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {(selectedInvitation.quotedAmount || selectedInvitation.quote?.estimatedCost)
                      ? `$${Number(selectedInvitation.quotedAmount || selectedInvitation.quote?.estimatedCost).toLocaleString()} MXN`
                      : t('quotes.mover.noPriceSuggested')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('quotes.mover.suggestedPriceNote')}
                  </p>
                </div>

                {selectedInvitation.message && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">{t('quotes.mover.adminMessage')}</h4>
                    <p className="text-sm">{selectedInvitation.message}</p>
                  </div>
                )}

                {selectedInvitation.dueAt && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      {t('quotes.mover.respondBy')}: {format(new Date(selectedInvitation.dueAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                )}

                <Separator />

                {['invited', 'viewed'].includes(selectedInvitation.status) && (
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-[#EF7521] hover:bg-[#EF7521]/90"
                      onClick={handleOpenBidDialog}
                    >
                      <Gavel className="h-4 w-4 mr-2" />
                      {t('quotes.mover.submitBid')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => declineInvitationMutation.mutate(selectedInvitation.id)}
                      disabled={declineInvitationMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t('quotes.mover.decline')}
                    </Button>
                  </div>
                )}

                {selectedInvitation.status === 'bid_submitted' && (
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-700">{t('quotes.mover.bidAlreadySubmitted')}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showBidDialog} onOpenChange={setShowBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('quotes.mover.submitBidTitle')}</DialogTitle>
            <DialogDescription>
              {t('quotes.mover.submitBidDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bidAmount">{t('quotes.mover.bidAmount')} *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  id="bidAmount"
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="5000"
                  className="pl-7"
                  data-testid="input-bid-amount"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">MXN</span>
              </div>
              {selectedInvitation?.quotedAmount && (
                <p className="text-xs text-muted-foreground">
                  {t('quotes.mover.suggestedPrice')}: ${Number(selectedInvitation.quotedAmount).toLocaleString()} MXN
                </p>
              )}
            </div>

            {isPriceChanged() && (
              <div className="grid gap-2">
                <Label htmlFor="adjustmentReason" className="text-orange-600">
                  {t('quotes.mover.adjustmentReason')} *
                </Label>
                <Textarea
                  id="adjustmentReason"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder={t('quotes.mover.adjustmentReasonPlaceholder')}
                  rows={2}
                  className="border-orange-300 focus:border-orange-500"
                  data-testid="input-adjustment-reason"
                />
                <p className="text-xs text-orange-600">
                  {t('quotes.mover.adjustmentReasonHelp')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bidHours">{t('quotes.mover.estimatedHours')}</Label>
                <Input
                  id="bidHours"
                  type="number"
                  value={bidHours}
                  onChange={(e) => setBidHours(e.target.value)}
                  placeholder="4"
                  data-testid="input-bid-hours"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bidCrew">{t('quotes.mover.crewSize')}</Label>
                <Input
                  id="bidCrew"
                  type="number"
                  value={bidCrew}
                  onChange={(e) => setBidCrew(e.target.value)}
                  placeholder="3"
                  data-testid="input-bid-crew"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bidNotes">{t('quotes.mover.bidNotes')}</Label>
              <Textarea
                id="bidNotes"
                value={bidNotes}
                onChange={(e) => setBidNotes(e.target.value)}
                placeholder={t('quotes.mover.bidNotesPlaceholder')}
                rows={3}
                data-testid="input-bid-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBidDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmitBid}
              disabled={!bidAmount || submitBidMutation.isPending}
              className="bg-[#EF7521]"
              data-testid="button-submit-bid"
            >
              <Send className="h-4 w-4 mr-2" />
              {t('quotes.mover.confirmBid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
