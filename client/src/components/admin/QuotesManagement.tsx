import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, MapPin, Calendar, Package, Clock, User, Building2,
  DollarSign, Send, CheckCircle, XCircle, Eye, Users, Gavel,
  Truck, AlertCircle, Play, Pause, Check, Plus
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { QuoteWithDetails, MoverProfile } from "@shared/schema";
import { useWorkflowStatuses } from "@/hooks/useWorkflowStatuses";

export function QuotesManagement() {
  const { getStatusLabel, getStatusColor, getStatusOptions } = useWorkflowStatuses();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithDetails | null>(null);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showBiddingDialog, setShowBiddingDialog] = useState(false);
  const [showNewQuoteDialog, setShowNewQuoteDialog] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  
  const [newQuote, setNewQuote] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    fromAddress: '',
    toAddress: '',
    moveDate: '',
    homeSize: 'studio',
    storageOption: 'none',
    notes: '',
  });

  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['admin-quotes', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`/api/admin/quotes${params}`);
      if (!response.ok) throw new Error('Failed to fetch quotes');
      const data = await response.json();
      return data.quotes as QuoteWithDetails[];
    },
  });

  const { data: partnersData } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const response = await fetch('/api/admin/partners');
      if (!response.ok) throw new Error('Failed to fetch partners');
      const data = await response.json();
      return data.partners as (MoverProfile & { user: any })[];
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: any }) => {
      const response = await fetch(`/api/admin/quotes/${quoteId}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.success(t('quotes.admin.updateSuccess'));
    },
  });

  const openBiddingMutation = useMutation({
    mutationFn: async ({ quoteId, suggestedPrice }: { quoteId: string; suggestedPrice: string }) => {
      const response = await fetch(`/api/admin/quotes/${quoteId}/open-bidding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestedPrice }),
      });
      if (!response.ok) throw new Error('Failed to open bidding');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setShowBiddingDialog(false);
      setSuggestedPrice('');
      toast.success(t('quotes.admin.biddingOpened'));
    },
  });

  const invitePartnerMutation = useMutation({
    mutationFn: async ({ quoteId, moverProfileId }: { quoteId: string; moverProfileId: string }) => {
      const response = await fetch(`/api/admin/quotes/${quoteId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moverProfileId }),
      });
      if (!response.ok) throw new Error('Failed to invite partner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      toast.success(t('quotes.admin.partnerInvited'));
    },
  });

  const acceptBidMutation = useMutation({
    mutationFn: async ({ bidId, quoteId }: { bidId: string; quoteId: string }) => {
      const response = await fetch(`/api/admin/bids/${bidId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });
      if (!response.ok) throw new Error('Failed to accept bid');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setShowQuoteDetail(false);
      toast.success(t('quotes.admin.bidAccepted'));
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: typeof newQuote) => {
      const response = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setShowNewQuoteDialog(false);
      setNewQuote({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        fromAddress: '',
        toAddress: '',
        moveDate: '',
        homeSize: 'studio',
        storageOption: 'none',
        notes: '',
      });
      toast.success(t('quotes.admin.createSuccess'));
    },
    onError: () => {
      toast.error(t('quotes.admin.createError'));
    },
  });

  const getStatusBadge = (status: string | null) => {
    const { color, bgColor } = getStatusColor(status);
    const statusLabel = getStatusLabel(status);

    return (
      <Badge 
        style={{ backgroundColor: bgColor, color: color }}
        className="hover:opacity-80"
      >
        {statusLabel}
      </Badge>
    );
  };

  const handleViewQuote = (quote: QuoteWithDetails) => {
    setSelectedQuote(quote);
    setAdminNotes(quote.adminNotes || '');
    setShowQuoteDetail(true);
  };

  const handleOpenBidding = () => {
    if (!selectedQuote) return;
    setShowBiddingDialog(true);
  };

  const handleStartBidding = () => {
    if (!selectedQuote) return;
    openBiddingMutation.mutate({ 
      quoteId: selectedQuote.id, 
      suggestedPrice 
    });
  };

  const handleInvitePartner = (moverProfileId: string) => {
    if (!selectedQuote) return;
    invitePartnerMutation.mutate({ 
      quoteId: selectedQuote.id, 
      moverProfileId 
    });
  };

  const handleAcceptBid = (bidId: string) => {
    if (!selectedQuote) return;
    acceptBidMutation.mutate({ 
      bidId, 
      quoteId: selectedQuote.id 
    });
  };

  const handleSaveNotes = () => {
    if (!selectedQuote) return;
    updateWorkflowMutation.mutate({
      quoteId: selectedQuote.id,
      data: { adminNotes },
    });
  };

  const handleMoveToTriage = () => {
    if (!selectedQuote) return;
    updateWorkflowMutation.mutate({
      quoteId: selectedQuote.id,
      data: { workflowStatus: 'triage' },
    });
  };

  return (
    <section id="quotes" className="flex flex-col gap-4 py-6 border-t">
      <h2 className="text-2xl font-bold text-foreground">{t('quotes.admin.title')}</h2>
      
      <Card className="border-t-4 border-t-action">
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-action" />
              {t('quotes.admin.subtitle')}
            </CardTitle>
            <CardDescription>{t('quotes.admin.description')}</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowNewQuoteDialog(true)}
            data-testid="button-new-quote"
          >
            <Plus className="mr-2 h-4 w-4" /> {t('quotes.admin.newQuote')}
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {getStatusOptions(true).slice(0, 6).map((status) => (
                <TabsTrigger 
                  key={status.value} 
                  value={status.value}
                  className="text-xs"
                  data-testid={`tab-status-${status.value}`}
                >
                  {status.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={statusFilter}>
              {isLoading ? (
                <div className="flex items-center justify-center h-40 text-slate-400">
                  {t('common.loading')}
                </div>
              ) : quotesData && quotesData.length > 0 ? (
                <div className="overflow-x-auto"><Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('quotes.admin.table.customer')}</TableHead>
                      <TableHead>{t('quotes.admin.table.route')}</TableHead>
                      <TableHead>{t('quotes.admin.table.date')}</TableHead>
                      <TableHead>{t('quotes.admin.table.items')}</TableHead>
                      <TableHead>{t('quotes.admin.table.bids')}</TableHead>
                      <TableHead>{t('quotes.admin.table.status')}</TableHead>
                      <TableHead className="text-right">{t('quotes.admin.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotesData.map((quote) => (
                      <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{quote.user?.fullName || '-'}</p>
                            <p className="text-xs text-muted-foreground">{quote.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-[200px]">
                            <p className="truncate">{quote.fromAddress}</p>
                            <p className="text-xs text-muted-foreground truncate">→ {quote.toAddress}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {quote.moveDate ? format(new Date(quote.moveDate), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {quote.inventoryItems?.length || 0} {t('quotes.admin.items')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {quote.bids && quote.bids.length > 0 ? (
                            <Badge className="bg-green-100 text-green-700">
                              {quote.bids.filter(b => b.status === 'submitted').length} {t('quotes.admin.bidsReceived')}
                            </Badge>
                          ) : quote.invitations && quote.invitations.length > 0 ? (
                            <Badge variant="secondary">
                              {quote.invitations.length} {t('quotes.admin.invited')}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(quote.workflowStatus)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewQuote(quote)}
                            data-testid={`button-view-quote-${quote.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t('common.view')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <FileText className="h-12 w-12 mb-4" />
                  <p>{t('quotes.admin.empty')}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Sheet open={showQuoteDetail} onOpenChange={setShowQuoteDetail}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedQuote && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>{t('quotes.admin.quoteDetails')}</span>
                  {getStatusBadge(selectedQuote.workflowStatus)}
                </SheetTitle>
                <SheetDescription>
                  {t('quotes.admin.createdAt')}: {format(new Date(selectedQuote.createdAt), 'dd/MM/yyyy HH:mm')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.admin.customer')}</p>
                      <p className="text-sm">{selectedQuote.user?.fullName || '-'}</p>
                      <p className="text-xs text-muted-foreground">{selectedQuote.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.admin.route')}</p>
                      <p className="text-sm">{selectedQuote.fromAddress}</p>
                      <p className="text-sm text-muted-foreground">→ {selectedQuote.toAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.admin.moveDate')}</p>
                      <p className="text-sm">
                        {selectedQuote.moveDate 
                          ? format(new Date(selectedQuote.moveDate), 'EEEE, dd MMMM yyyy')
                          : t('quotes.admin.dateNotSet')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('quotes.admin.homeSize')}</p>
                      <p className="text-sm">{selectedQuote.homeSize}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('quotes.admin.inventory')} ({selectedQuote.inventoryItems?.length || 0})
                  </h4>
                  {selectedQuote.inventoryItems && selectedQuote.inventoryItems.length > 0 ? (
                    <ScrollArea className="h-[150px] rounded-md border p-3">
                      <div className="space-y-2">
                        {selectedQuote.inventoryItems.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.itemName}</span>
                            <Badge variant="outline">{item.quantity}x</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('quotes.admin.noInventory')}</p>
                  )}
                </div>

                {selectedQuote.quoteServices && selectedQuote.quoteServices.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">{t('quotes.admin.services')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedQuote.quoteServices.map((qs, idx) => (
                          <Badge key={idx} variant="secondary">{qs.service.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedQuote.quoteAddOns && selectedQuote.quoteAddOns.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">{t('quotes.admin.addOns')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedQuote.quoteAddOns.map((qa, idx) => (
                          <Badge key={idx} variant="outline">{qa.addOn.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t('quotes.admin.pricing')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t('quotes.admin.suggestedPrice')}</p>
                      <p className="text-lg font-bold">
                        {selectedQuote.suggestedPrice 
                          ? `$${Number(selectedQuote.suggestedPrice).toLocaleString()} MXN`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t('quotes.admin.finalPrice')}</p>
                      <p className="text-lg font-bold text-green-600">
                        {selectedQuote.finalPrice 
                          ? `$${Number(selectedQuote.finalPrice).toLocaleString()} MXN`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="adminNotes">{t('quotes.admin.notes')}</Label>
                  <Textarea
                    id="adminNotes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={t('quotes.admin.notesPlaceholder')}
                    className="mt-2"
                    rows={3}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={handleSaveNotes}
                    disabled={updateWorkflowMutation.isPending}
                  >
                    {t('common.save')}
                  </Button>
                </div>

                {selectedQuote.workflowStatus === 'bidding_open' || 
                 selectedQuote.workflowStatus === 'selection' ? (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Gavel className="h-4 w-4" />
                        {t('quotes.admin.bids')} ({selectedQuote.bids?.filter(b => b.status === 'submitted').length || 0})
                      </h4>
                      {selectedQuote.bids && selectedQuote.bids.filter(b => b.status === 'submitted').length > 0 ? (
                        <div className="space-y-3">
                          {selectedQuote.bids
                            .filter(b => b.status === 'submitted')
                            .map((bid) => (
                            <Card key={bid.id} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{bid.moverProfile.companyName}</p>
                      <p className="text-2xl font-bold text-action">
                                    ${Number(bid.amount).toLocaleString()} MXN
                                  </p>
                                  {bid.estimatedHours && (
                                    <p className="text-sm text-muted-foreground">
                                      {bid.estimatedHours}h · {bid.crewSize} {t('quotes.admin.crew')}
                                    </p>
                                  )}
                                  {bid.notes && (
                                    <p className="text-sm mt-2 text-slate-600">{bid.notes}</p>
                                  )}
                                </div>
                                {selectedQuote.workflowStatus === 'selection' && (
                                  <Button 
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleAcceptBid(bid.id)}
                                    disabled={acceptBidMutation.isPending}
                                    data-testid={`button-accept-bid-${bid.id}`}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    {t('quotes.admin.acceptBid')}
                                  </Button>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('quotes.admin.noBids')}</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        {t('quotes.admin.invitedPartners')}
                      </h4>
                      {selectedQuote.invitations && selectedQuote.invitations.length > 0 ? (
                        <div className="space-y-2">
                          {selectedQuote.invitations.map((inv) => (
                            <div key={inv.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                              <span>{inv.moverProfile.companyName}</span>
                              <Badge variant="outline">{inv.status}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('quotes.admin.noInvitations')}</p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowInviteDialog(true)}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {t('quotes.admin.invitePartner')}
                      </Button>
                    </div>
                  </>
                ) : null}

                {selectedQuote.assignedMover && (
                  <>
                    <Separator />
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-green-700">
                        <Building2 className="h-4 w-4" />
                        {t('quotes.admin.assignedPartner')}
                      </h4>
                      <p className="font-medium">{selectedQuote.assignedMover.companyName}</p>
                      <p className="text-sm text-muted-foreground">{selectedQuote.assignedMover.contactPhone}</p>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex gap-2 flex-wrap">
                  {selectedQuote.workflowStatus === 'intake' && (
                    <Button onClick={handleMoveToTriage} className="bg-primary">
                      <Eye className="h-4 w-4 mr-1" />
                      {t('quotes.admin.startReview')}
                    </Button>
                  )}
                  {selectedQuote.workflowStatus === 'triage' && (
                    <Button onClick={handleOpenBidding} className="bg-action text-action-foreground">
                      <Gavel className="h-4 w-4 mr-1" />
                      {t('quotes.admin.openBidding')}
                    </Button>
                  )}
                  {selectedQuote.workflowStatus === 'bidding_open' && (
                    <Button 
                      variant="outline"
                      onClick={() => updateWorkflowMutation.mutate({
                        quoteId: selectedQuote.id,
                        data: { workflowStatus: 'selection' }
                      })}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      {t('quotes.admin.closeBidding')}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showBiddingDialog} onOpenChange={setShowBiddingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('quotes.admin.openBiddingTitle')}</DialogTitle>
            <DialogDescription>
              {t('quotes.admin.openBiddingDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="suggestedPrice">{t('quotes.admin.suggestedPrice')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  id="suggestedPrice"
                  type="number"
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(e.target.value)}
                  placeholder="5000"
                  className="pl-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">MXN</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBiddingDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleStartBidding}
              disabled={openBiddingMutation.isPending}
              className="bg-action text-action-foreground"
            >
              <Play className="h-4 w-4 mr-1" />
              {t('quotes.admin.startBidding')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('quotes.admin.invitePartnerTitle')}</DialogTitle>
            <DialogDescription>
              {t('quotes.admin.invitePartnerDescription')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px] mt-4">
            <div className="space-y-2">
              {partnersData?.filter(p => p.verified).map((partner) => {
                const alreadyInvited = selectedQuote?.invitations?.some(
                  inv => inv.moverProfileId === partner.id
                );
                return (
                  <div 
                    key={partner.id} 
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{partner.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {partner.fleetSize} {t('quotes.admin.vehicles')} · {partner.crewSize} {t('quotes.admin.crew')}
                      </p>
                    </div>
                    {alreadyInvited ? (
                      <Badge variant="secondary">{t('quotes.admin.alreadyInvited')}</Badge>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => {
                          handleInvitePartner(partner.id);
                          setShowInviteDialog(false);
                        }}
                        disabled={invitePartnerMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {t('quotes.admin.invite')}
                      </Button>
                    )}
                  </div>
                );
              })}
              {(!partnersData || partnersData.filter(p => p.verified).length === 0) && (
                <div className="text-center py-8 text-slate-400">
                  <Building2 className="h-12 w-12 mx-auto mb-2" />
                  <p>{t('quotes.admin.noVerifiedPartners')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewQuoteDialog} onOpenChange={setShowNewQuoteDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('quotes.admin.newQuoteTitle')}</DialogTitle>
            <DialogDescription>
              {t('quotes.admin.newQuoteDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customerName">{t('quotes.admin.form.customerName')}</Label>
                <Input
                  id="customerName"
                  value={newQuote.customerName}
                  onChange={(e) => setNewQuote({...newQuote, customerName: e.target.value})}
                  placeholder="Juan Pérez"
                  data-testid="input-customer-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customerEmail">{t('quotes.admin.form.customerEmail')}</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={newQuote.customerEmail}
                  onChange={(e) => setNewQuote({...newQuote, customerEmail: e.target.value})}
                  placeholder="cliente@email.com"
                  data-testid="input-customer-email"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerPhone">{t('quotes.admin.form.customerPhone')}</Label>
              <Input
                id="customerPhone"
                value={newQuote.customerPhone}
                onChange={(e) => setNewQuote({...newQuote, customerPhone: e.target.value})}
                placeholder="+52 55 1234 5678"
                data-testid="input-customer-phone"
              />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="fromAddress">{t('quotes.admin.form.fromAddress')}</Label>
              <Input
                id="fromAddress"
                value={newQuote.fromAddress}
                onChange={(e) => setNewQuote({...newQuote, fromAddress: e.target.value})}
                placeholder="Av. Reforma 123, CDMX"
                data-testid="input-from-address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="toAddress">{t('quotes.admin.form.toAddress')}</Label>
              <Input
                id="toAddress"
                value={newQuote.toAddress}
                onChange={(e) => setNewQuote({...newQuote, toAddress: e.target.value})}
                placeholder="Polanco 456, CDMX"
                data-testid="input-to-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="moveDate">{t('quotes.admin.form.moveDate')}</Label>
                <Input
                  id="moveDate"
                  type="date"
                  value={newQuote.moveDate}
                  onChange={(e) => setNewQuote({...newQuote, moveDate: e.target.value})}
                  data-testid="input-move-date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="homeSize">{t('quotes.admin.form.homeSize')}</Label>
                <Select 
                  value={newQuote.homeSize} 
                  onValueChange={(value) => setNewQuote({...newQuote, homeSize: value})}
                >
                  <SelectTrigger data-testid="select-home-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="studio">{t('quotes.admin.form.homeSizes.studio')}</SelectItem>
                    <SelectItem value="1bed">{t('quotes.admin.form.homeSizes.1bed')}</SelectItem>
                    <SelectItem value="2bed">{t('quotes.admin.form.homeSizes.2bed')}</SelectItem>
                    <SelectItem value="3bed">{t('quotes.admin.form.homeSizes.3bed')}</SelectItem>
                    <SelectItem value="4bed">{t('quotes.admin.form.homeSizes.4bed')}</SelectItem>
                    <SelectItem value="house">{t('quotes.admin.form.homeSizes.house')}</SelectItem>
                    <SelectItem value="office">{t('quotes.admin.form.homeSizes.office')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="storageOption">{t('quotes.admin.form.storageOption')}</Label>
              <Select 
                value={newQuote.storageOption} 
                onValueChange={(value) => setNewQuote({...newQuote, storageOption: value})}
              >
                <SelectTrigger data-testid="select-storage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('quotes.admin.form.storage.none')}</SelectItem>
                  <SelectItem value="short">{t('quotes.admin.form.storage.short')}</SelectItem>
                  <SelectItem value="long">{t('quotes.admin.form.storage.long')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t('quotes.admin.form.notes')}</Label>
              <Textarea
                id="notes"
                value={newQuote.notes}
                onChange={(e) => setNewQuote({...newQuote, notes: e.target.value})}
                placeholder={t('quotes.admin.form.notesPlaceholder')}
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewQuoteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={() => createQuoteMutation.mutate(newQuote)}
              disabled={createQuoteMutation.isPending || !newQuote.fromAddress || !newQuote.toAddress}
              className="bg-primary"
              data-testid="button-submit-new-quote"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('quotes.admin.createQuote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
