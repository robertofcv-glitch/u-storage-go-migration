import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Truck, Clock, MapPin, Home, Loader2, ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Quote {
  id: string;
  quoteNumber: string | null;
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

export default function ClientOverview() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const { user: authUser } = useAuth();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['client-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/client/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
    enabled: !!authUser,
  });

  const sidebarLinks = [
    { href: "/dashboard", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "/dashboard/moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "/dashboard/quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "/dashboard/saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="client">
                <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = dashboardData?.stats || { pendingQuotes: 0, activeQuotes: 0, completedQuotes: 0, totalQuotes: 0 };
  const quotes = dashboardData?.quotes || [];
  const recentQuotes = quotes.slice(0, 3);

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
       <div className="flex flex-col gap-5 lg:gap-7">
        <div className="workspace-hero flex items-end justify-between gap-4">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              <Sparkles className="h-4 w-4" />
              {i18n.language === 'es' ? 'Tu mudanza, de un vistazo' : 'Your move, at a glance'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('dashboard.client.title')}</h1>
            <p className="mt-2 text-sm text-white/75">
              {dashboardData?.user?.fullName ? `${t('dashboard.client.welcome')}, ${dashboardData.user.fullName}` : t('dashboard.client.welcome')}
            </p>
          </div>
          <Button 
            onClick={() => setLocation('/dashboard/new-quote')} 
            className="relative z-10 min-h-12 shrink-0 bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-400"
            data-testid="button-get-quote"
          >
            {t('clients.hero.cta')}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/dashboard/moves')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.client.activeMoves')}</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeQuotes}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.client.activeMovesSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/dashboard/quotes')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.client.pendingQuotes')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingQuotes}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.client.pendingQuotesSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat">
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--usg-ink)]">{t('dashboard.client.recentActivity')}</h2>
            <Button variant="link" onClick={() => setLocation('/dashboard/quotes')} className="text-[var(--usg-orange)]">
              {t('common.viewAll')}
            </Button>
          </div>
          {recentQuotes.length > 0 ? (
            recentQuotes.map((quote) => (
              <Card key={quote.id} className="workspace-card group cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {quote.quoteNumber && (
                          <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{quote.quoteNumber}</span>
                        )}
                        <h3 className="font-semibold text-[var(--usg-ink)]">
                          {quote.fromAddress || t('common.noAddress')} → {quote.toAddress || t('common.noAddress')}
                        </h3>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
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
                <div className="flex flex-col items-center justify-center h-20 text-slate-400 gap-2">
                  <p>{t('dashboard.client.noRecentActivity')}</p>
                  <Button onClick={() => setLocation('/dashboard/new-quote')} variant="outline" size="sm">
                    {t('clients.hero.cta')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
