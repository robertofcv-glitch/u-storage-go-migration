import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, FileText, Users, Truck, Activity, ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";

interface ActivityLog {
  id: string;
  userId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: any;
  createdAt: string;
  user?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
}

interface Quote {
  id: string;
  quoteNumber: string | null;
  fromAddress: string;
  toAddress: string;
  workflowStatus: string;
  createdAt: string;
}

const actionLabels: Record<string, { en: string; es: string }> = {
  'login': { en: 'Logged in', es: 'Inició sesión' },
  'user.registered': { en: 'User registered', es: 'Usuario registrado' },
  'quote.created': { en: 'Quote created', es: 'Cotización creada' },
  'quote.updated': { en: 'Quote updated', es: 'Cotización actualizada' },
  'bid.submitted': { en: 'Bid submitted', es: 'Oferta enviada' },
  'bid.accepted': { en: 'Bid accepted', es: 'Oferta aceptada' },
  'user.role_added': { en: 'Role added', es: 'Rol agregado' },
  'user.role_removed': { en: 'Role removed', es: 'Rol eliminado' },
};

const statusColors: Record<string, string> = {
  intake: 'bg-muted text-muted-foreground',
  triage: 'bg-accent text-accent-foreground',
  bidding_open: 'bg-primary/10 text-primary',
  selection: 'bg-action/15 text-foreground',
  confirmed: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]',
  scheduled: 'bg-secondary/15 text-secondary',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]',
  cancelled: 'bg-destructive/15 text-destructive',
};

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const locale = i18n.language === 'es' ? es : enUS;

  const { data: quotesData } = useQuery<{ quotes: Quote[] }>({
    queryKey: ['/api/admin/quotes'],
  });

  const { data: activityData } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ['/api/admin/activity-logs?limit=10'],
  });

  const { data: usersData } = useQuery<{ users: any[] }>({
    queryKey: ['/api/admin/roles/client/users'],
  });

  const { data: moversData } = useQuery<{ users: any[] }>({
    queryKey: ['/api/admin/roles/mover/users'],
  });

  const quotes = quotesData?.quotes || [];
  const recentQuotes = quotes.slice(0, 5);
  const activityLogs = activityData?.logs || [];
  const totalUsers = usersData?.users?.length || 0;
  const totalMovers = moversData?.users?.length || 0;

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const getActionLabel = (action: string) => {
    const labels = actionLabels[action];
    if (labels) {
      return i18n.language === 'es' ? labels.es : labels.en;
    }
    return action.replace(/\./g, ' ').replace(/_/g, ' ');
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; es: string }> = {
      intake: { en: 'New', es: 'Nueva' },
      triage: { en: 'Review', es: 'Revisión' },
      bidding_open: { en: 'Bidding', es: 'En subasta' },
      selection: { en: 'Selection', es: 'Selección' },
      confirmed: { en: 'Confirmed', es: 'Confirmada' },
      scheduled: { en: 'Scheduled', es: 'Programada' },
      in_progress: { en: 'In Progress', es: 'En progreso' },
      completed: { en: 'Completed', es: 'Completada' },
      cancelled: { en: 'Cancelled', es: 'Cancelada' },
    };
    const label = labels[status];
    return label ? (i18n.language === 'es' ? label.es : label.en) : status;
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-5 lg:gap-7">
        <div className="workspace-hero">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              <Sparkles className="h-4 w-4" />
              {i18n.language === 'es' ? 'Centro de operaciones' : 'Operations center'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('dashboard.admin.title')}</h1>
            <p className="mt-2 text-sm text-white/75">
              {t('dashboard.admin.welcome')} {i18n.language === 'es'
                ? 'Mantén la red en movimiento con una vista clara del trabajo de hoy.'
                : 'Keep the network moving with a clear view of today’s work.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/admin/dashboard/quotes')} data-testid="card-total-quotes">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.admin.totalQuotes')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-quote-count">{quotes.length}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.admin.totalQuotesSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/admin/dashboard/users')} data-testid="card-total-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.admin.activeUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-user-count">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.admin.activeUsersSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/admin/dashboard/movers')} data-testid="card-total-movers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.admin.activeMovers')}</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-mover-count">{totalMovers}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.admin.activeMoversSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/admin/dashboard/activity')} data-testid="card-activity">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{i18n.language === 'es' ? 'Actividad Reciente' : 'Recent Activity'}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-activity-count">{activityLogs.length}</div>
              <p className="text-xs text-muted-foreground">{i18n.language === 'es' ? 'Últimas acciones' : 'Latest actions'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('dashboard.admin.recentQuotes')}</CardTitle>
              <Button variant="link" onClick={() => setLocation('/admin/dashboard/quotes')} className="text-action">
                {t('common.viewAll')}
              </Button>
            </CardHeader>
            <CardContent>
              {recentQuotes.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-lg">
                  {i18n.language === 'es' ? 'No hay cotizaciones aún' : 'No quotes yet'}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentQuotes.map((quote) => (
                    <div
                      key={quote.id} 
                        className="group flex flex-wrap items-center justify-between gap-2 rounded-xl border border-transparent bg-muted/70 p-3 transition-all hover:border-orange-200 hover:bg-accent cursor-pointer"
                      onClick={() => setLocation(`/admin/dashboard/quotes/${quote.id}`)}
                      data-testid={`quote-row-${quote.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <span className="font-medium text-foreground">{quote.quoteNumber || quote.id.slice(0, 8)}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          <Badge className={statusColors[quote.workflowStatus || 'intake']}>
                            {getStatusLabel(quote.workflowStatus || 'intake')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {quote.fromAddress} → {quote.toAddress}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true, locale })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{i18n.language === 'es' ? 'Actividad Reciente' : 'Recent Activity'}</CardTitle>
              <Button variant="link" onClick={() => setLocation('/admin/dashboard/activity')} className="text-action">
                {t('common.viewAll')}
              </Button>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg">
                  {i18n.language === 'es' ? 'No hay actividad registrada' : 'No activity recorded yet'}
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg" data-testid={`activity-row-${log.id}`}>
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <Activity className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-foreground">
                            {getActionLabel(log.action)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.user?.fullName || log.user?.email || (i18n.language === 'es' ? 'Usuario desconocido' : 'Unknown user')}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
