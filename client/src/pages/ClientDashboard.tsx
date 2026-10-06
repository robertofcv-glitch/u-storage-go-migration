import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Truck, Clock, MapPin, Home, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ClaraChat } from "@/components/dashboard/ClaraChat";
import { QuoteWizard, QuoteFormData } from "@/components/quote/QuoteWizard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Clear quote session data from sessionStorage to prevent quote reuse
const cleanupQuoteSession = () => {
  const sessionId = sessionStorage.getItem('ruku_quote_session_id');
  if (sessionId) {
    sessionStorage.removeItem(`ruku_partial_quote_${sessionId}`);
    sessionStorage.removeItem('ruku_quote_session_id');
  }
};

interface Quote {
  id: string;
  fromAddress: string | null;
  toAddress: string | null;
  moveDate: string | null;
  homeSize: string | null;
  workflowStatus: string | null;
  createdAt: string | null;
}

interface DashboardData {
  user: { id: string; fullName: string; email: string; phone: string | null } | null;
  quotes: Quote[];
  stats: {
    pendingQuotes: number;
    activeQuotes: number;
    completedQuotes: number;
    totalQuotes: number;
  };
}

const getStatusBadge = (status: string | null) => {
  const statusStyles: Record<string, string> = {
    intake: "bg-blue-100 text-blue-800",
    triage: "bg-yellow-100 text-yellow-800",
    bidding_open: "bg-purple-100 text-purple-800",
    selection: "bg-orange-100 text-orange-800",
    confirmed: "bg-green-100 text-green-800",
    scheduled: "bg-emerald-100 text-emerald-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return statusStyles[status || ''] || "bg-gray-100 text-gray-600";
};

const getStatusLabel = (status: string | null, t: any) => {
  const labels: Record<string, string> = {
    intake: t('quotes.status.intake'),
    triage: t('quotes.status.triage'),
    bidding_open: t('quotes.status.bidding_open'),
    selection: t('quotes.status.selection'),
    confirmed: t('quotes.status.confirmed'),
    scheduled: t('quotes.status.scheduled'),
    completed: t('quotes.status.completed'),
    cancelled: t('quotes.status.cancelled'),
  };
  return labels[status || ''] || status || 'Unknown';
};

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showQuoteWizard, setShowQuoteWizard] = useState(false);

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['client-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/client/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
    enabled: !!authUser,
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      // Use the partial quote ID from the wizard to finalize the existing quote
      // This prevents creating duplicate quotes
      if (!data.partialQuoteId) {
        throw new Error('No quote ID found. Please try again.');
      }
      
      const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
      const response = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPartial: false, quoteSessionId: quoteSessionId || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit quote');
      }
      return response.json();
    },
    onSuccess: () => {
      cleanupQuoteSession();
      toast({
        title: t('common.success'),
        description: t('quote.submitSuccess'),
      });
      setShowQuoteWizard(false);
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuoteSubmit = (data: QuoteFormData) => {
    submitQuoteMutation.mutate(data);
  };

  const sidebarLinks = [
    { href: "#overview", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "#moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "#quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "#saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#1A1A1A]" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = dashboardData?.stats || { pendingQuotes: 0, activeQuotes: 0, completedQuotes: 0, totalQuotes: 0 };
  const quotes = dashboardData?.quotes || [];
  const recentQuotes = quotes.slice(0, 3);

  // Show embedded quote wizard - uses full available width
  if (showQuoteWizard) {
    return (
      <DashboardLayout links={sidebarLinks} userType="client">
        <div className="w-full">
          <QuoteWizard
            skipAccountStep={true}
            onSubmit={handleQuoteSubmit}
            onCancel={() => {
              cleanupQuoteSession();
              setShowQuoteWizard(false);
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">{t('dashboard.client.title')}</h1>
            <p className="text-muted-foreground">
              {dashboardData?.user?.fullName ? `${t('dashboard.client.welcome')}, ${dashboardData.user.fullName}` : t('dashboard.client.welcome')}
            </p>
          </div>
          <Button 
            onClick={() => setShowQuoteWizard(true)} 
            className="bg-[#1A1A1A] hover:bg-[#1A1A1A]/90"
            data-testid="button-get-quote"
          >
            {t('clients.hero.cta')}
          </Button>
        </div>

        <section id="overview" className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.client.activeMoves')}</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeQuotes}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.client.activeMovesSub')}</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.client.pendingQuotes')}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingQuotes}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.client.pendingQuotesSub')}</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.client.completedMoves')}</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completedQuotes}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.client.completedMovesSub')}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4">
            <h2 className="text-xl font-bold text-[#1A1A1A]">{t('dashboard.client.recentActivity')}</h2>
            {recentQuotes.length > 0 ? (
              recentQuotes.map((quote) => (
                <Card key={quote.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <Clock className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-[#1A1A1A]">
                          {quote.fromAddress || t('common.noAddress')} → {quote.toAddress || t('common.noAddress')}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {quote.createdAt ? format(new Date(quote.createdAt), 'MMM dd, yyyy') : t('common.noDate')}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(quote.workflowStatus)}`}>
                          {getStatusLabel(quote.workflowStatus, t)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center h-20 text-slate-400">
                    {t('dashboard.client.noRecentActivity')}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section id="moves" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('dashboard.client.myMoves')}</h2>
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.client.activeMoves')}</CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.filter(q => ['confirmed', 'scheduled'].includes(q.workflowStatus || '')).length > 0 ? (
                <div className="space-y-4">
                  {quotes.filter(q => ['confirmed', 'scheduled'].includes(q.workflowStatus || '')).map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-semibold">{quote.fromAddress || t('common.noAddress')} → {quote.toAddress || t('common.noAddress')}</h4>
                        <p className="text-sm text-slate-500">{quote.moveDate ? format(new Date(quote.moveDate), 'MMM dd, yyyy') : t('common.noDate')}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(quote.workflowStatus)}`}>
                        {getStatusLabel(quote.workflowStatus, t)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg">
                  {t('dashboard.client.noActiveMoves')}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="quotes" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('dashboard.client.quotes')}</h2>
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.client.allQuotes')} ({quotes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.length > 0 ? (
                <div className="space-y-4">
                  {quotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <h4 className="font-semibold">{quote.fromAddress || t('common.noAddress')} → {quote.toAddress || t('common.noAddress')}</h4>
                        <div className="flex gap-4 text-sm text-slate-500">
                          <span>{quote.homeSize || '-'}</span>
                          <span>{quote.moveDate ? format(new Date(quote.moveDate), 'MMM dd, yyyy') : t('common.noDate')}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(quote.workflowStatus)}`}>
                        {getStatusLabel(quote.workflowStatus, t)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg gap-4">
                  <p>{t('dashboard.client.noQuotes')}</p>
                  <Button onClick={() => setShowQuoteWizard(true)} variant="outline" data-testid="button-get-quote-empty">
                    {t('clients.hero.cta')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="saved" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('dashboard.client.savedAddresses')}</h2>
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.client.savedAddresses')}</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="grid gap-4">
                 <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                   <div className="flex items-center gap-3">
                     <div className="bg-slate-100 p-2 rounded-full">
                       <Home className="h-5 w-5 text-[#1A1A1A]" />
                     </div>
                     <div>
                       <h4 className="font-semibold">Home</h4>
                       <p className="text-sm text-slate-500">123 Main St, Mexico City</p>
                     </div>
                   </div>
                   <Button variant="ghost" size="sm">Edit</Button>
                 </div>
                 <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                   <div className="flex items-center gap-3">
                     <div className="bg-slate-100 p-2 rounded-full">
                       <MapPin className="h-5 w-5 text-[#1A1A1A]" />
                     </div>
                     <div>
                       <h4 className="font-semibold">Office</h4>
                       <p className="text-sm text-slate-500">456 Business Blvd, Mexico City</p>
                     </div>
                   </div>
                   <Button variant="ghost" size="sm">Edit</Button>
                 </div>
               </div>
            </CardContent>
          </Card>
        </section>
        
        <section id="profile" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('dashboard.client.profile')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400">
                  Profile settings coming soon
               </div>
             </CardContent>
           </Card>
        </section>

        <section id="settings" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('dashboard.client.settings')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400">
                  Application settings coming soon
               </div>
             </CardContent>
           </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
