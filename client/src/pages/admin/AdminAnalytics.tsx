import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, Truck, Users, Star, DollarSign, MousePointer, Bot, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import type { MarketingAnalyticsSummary } from "@shared/schema";

interface AnalyticsData {
  quotesOverTime: Array<{ date: string; count: number }>;
  usersOverTime: Array<{ date: string; count: number }>;
  quotesByStatus: Array<{ status: string; count: number }>;
  partnerLeads: Array<{ partner: string; count: number }>;
  utmSources: Array<{ source: string; count: number }>;
  utmCampaigns: Array<{ campaign: string; count: number }>;
  landingPages: Array<{ page: string; count: number }>;
  movesCompleted: number;
  totalRevenue: number;
  averageQuoteValue: number;
  conversionRate: number;
  totalQuotes: number;
  totalUsers: number;
  totalPartners: number;
  ratingsOverTime: Array<{ date: string; avgRating: number; count: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
  topRatedPartners: Array<{ companyName: string; avgRating: number; totalRatings: number }>;
  sentimentBreakdown: Array<{ sentiment: string; count: number }>;
  totalRatings: number;
  averagePlatformRating: number;
}

// Keep chart colors in the shared semantic palette so light/dark themes remain readable.
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--action))',
  'hsl(var(--foreground))',
];

export default function AdminAnalytics() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/admin/analytics'],
  });

  const { data: marketingData, isLoading: loadingMarketing, refetch: refetchMarketing } = useQuery<MarketingAnalyticsSummary>({
    queryKey: ['/api/admin/analytics/marketing'],
  });

  const sidebarLinks = getAdminSidebarLinks(lang);

  const formatStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; es: string }> = {
      intake: { en: 'New', es: 'Nueva' },
      triage: { en: 'Review', es: 'Revisión' },
      bidding_open: { en: 'Bidding', es: 'Subasta' },
      selection: { en: 'Selection', es: 'Selección' },
      confirmed: { en: 'Confirmed', es: 'Confirmada' },
      scheduled: { en: 'Scheduled', es: 'Programada' },
      in_progress: { en: 'In Progress', es: 'En Proceso' },
      completed: { en: 'Completed', es: 'Completada' },
      cancelled: { en: 'Cancelled', es: 'Cancelada' },
    };
    return labels[status]?.[lang === 'es' ? 'es' : 'en'] || status;
  };

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const data = analyticsData || {
    quotesOverTime: [],
    usersOverTime: [],
    quotesByStatus: [],
    partnerLeads: [],
    utmSources: [],
    utmCampaigns: [],
    landingPages: [],
    movesCompleted: 0,
    totalRevenue: 0,
    averageQuoteValue: 0,
    conversionRate: 0,
    totalQuotes: 0,
    totalUsers: 0,
    totalPartners: 0,
    ratingsOverTime: [],
    ratingDistribution: [],
    topRatedPartners: [],
    sentimentBreakdown: [],
    totalRatings: 0,
    averagePlatformRating: 0,
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {lang === 'es' ? 'Analíticas' : 'Analytics'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === 'es' 
              ? 'Métricas y estadísticas de la plataforma'
              : 'Platform metrics and statistics'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === 'es' ? 'Total Cotizaciones' : 'Total Quotes'}
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalQuotes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === 'es' ? 'Total Usuarios' : 'Total Users'}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === 'es' ? 'Mudanzas Completadas' : 'Completed Moves'}
              </CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.movesCompleted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === 'es' ? 'Tasa de Conversión' : 'Conversion Rate'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(data.conversionRate || 0).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="quotes" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="quotes" data-testid="tab-quotes">
              {lang === 'es' ? 'Cotizaciones' : 'Quotes'}
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              {lang === 'es' ? 'Usuarios' : 'Users'}
            </TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners">
              {lang === 'es' ? 'Partners' : 'Partners'}
            </TabsTrigger>
            <TabsTrigger value="moves" data-testid="tab-moves">
              {lang === 'es' ? 'Mudanzas' : 'Moves'}
            </TabsTrigger>
            <TabsTrigger value="platform" data-testid="tab-platform">
              {lang === 'es' ? 'Uso de Plataforma' : 'Platform Usage'}
            </TabsTrigger>
            <TabsTrigger value="ratings" data-testid="tab-ratings">
              {lang === 'es' ? 'Calificaciones' : 'Ratings'}
            </TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">
              {lang === 'es' ? 'Marketing' : 'Marketing'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Cotizaciones por Día' : 'Quotes Over Time'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Últimos 30 días' : 'Last 30 days'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.quotesOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} name={lang === 'es' ? 'Cotizaciones' : 'Quotes'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Estado de Cotizaciones' : 'Quote Status Distribution'}</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.quotesByStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" fontSize={12} tickFormatter={formatStatusLabel} />
                      <YAxis fontSize={12} />
                      <Tooltip labelFormatter={formatStatusLabel} />
                      <Bar dataKey="count" fill="hsl(var(--chart-1))" name={lang === 'es' ? 'Cantidad' : 'Count'} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Usuarios Registrados' : 'User Registrations'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Últimos 30 días' : 'Last 30 days'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.usersOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name={lang === 'es' ? 'Usuarios' : 'Users'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Resumen de Usuarios' : 'User Summary'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <span className="font-medium">{lang === 'es' ? 'Total de Usuarios' : 'Total Users'}</span>
                      <span className="text-2xl font-bold">{data.totalUsers}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <span className="font-medium">{lang === 'es' ? 'Total de Partners' : 'Total Partners'}</span>
                      <span className="text-2xl font-bold">{data.totalPartners}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Leads por Partner' : 'Leads by Partner'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Cotizaciones originadas desde partners' : 'Quotes originated from partners'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.partnerLeads.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={data.partnerLeads}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ partner, count }) => `${partner}: ${count}`}
                          outerRadius={100}
                          fill="hsl(var(--chart-2))"
                          dataKey="count"
                          nameKey="partner"
                        >
                          {data.partnerLeads.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de partners aún' : 'No partner data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Rendimiento de Partners' : 'Partner Performance'}</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.partnerLeads.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.partnerLeads} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="partner" type="category" fontSize={12} width={100} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--chart-2))" name={lang === 'es' ? 'Leads' : 'Leads'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de partners aún' : 'No partner data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="moves" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lang === 'es' ? 'Mudanzas Completadas' : 'Completed Moves'}
                  </CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.movesCompleted}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lang === 'es' ? 'Ingresos Totales' : 'Total Revenue'}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${data.totalRevenue.toLocaleString()} MXN</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lang === 'es' ? 'Valor Promedio' : 'Average Value'}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${data.averageQuoteValue.toLocaleString()} MXN</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{lang === 'es' ? 'Distribución por Estado' : 'Status Distribution'}</CardTitle>
                <CardDescription>
                  {lang === 'es' ? 'Todas las cotizaciones por estado actual' : 'All quotes by current status'}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.quotesByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count }) => `${formatStatusLabel(status)}: ${count}`}
                      outerRadius={100}
                      fill="hsl(var(--chart-2))"
                      dataKey="count"
                      nameKey="status"
                    >
                      {data.quotesByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip labelFormatter={formatStatusLabel} />
                    <Legend formatter={formatStatusLabel} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platform" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Fuentes de Tráfico' : 'Traffic Sources'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'De dónde vienen los usuarios (UTM Source)' : 'Where users come from (UTM Source)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.utmSources.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.utmSources}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--chart-1))" name={lang === 'es' ? 'Visitas' : 'Visits'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de fuentes aún' : 'No source data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Campañas' : 'Campaigns'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Rendimiento por campaña (UTM Campaign)' : 'Performance by campaign (UTM Campaign)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.utmCampaigns.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.utmCampaigns} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="campaign" type="category" fontSize={12} width={120} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--chart-2))" name={lang === 'es' ? 'Leads' : 'Leads'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de campañas aún' : 'No campaign data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Páginas de Entrada' : 'Landing Pages'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Primeras páginas visitadas por los usuarios' : 'First pages visited by users'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.landingPages.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.landingPages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="page" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--chart-3))" name={lang === 'es' ? 'Visitas' : 'Visits'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de páginas aún' : 'No landing page data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ratings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lang === 'es' ? 'Total Calificaciones' : 'Total Ratings'}
                  </CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalRatings}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lang === 'es' ? 'Calificación Promedio' : 'Average Rating'}
                  </CardTitle>
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {(data.averagePlatformRating || 0).toFixed(1)}
                    <span className="text-sm text-muted-foreground">/ 5</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Calificaciones en el Tiempo' : 'Ratings Over Time'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Promedio de calificaciones por día' : 'Average ratings per day'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.ratingsOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.ratingsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis domain={[0, 5]} fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="avgRating" stroke="hsl(var(--chart-1))" strokeWidth={2} name={lang === 'es' ? 'Promedio' : 'Average'} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin calificaciones aún' : 'No ratings yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Distribución de Estrellas' : 'Star Distribution'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Cantidad de calificaciones por número de estrellas' : 'Number of ratings per star count'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.ratingDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.ratingDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stars" fontSize={12} tickFormatter={(v) => `${v}★`} />
                        <YAxis fontSize={12} />
                        <Tooltip labelFormatter={(v) => `${v} ${lang === 'es' ? 'estrellas' : 'stars'}`} />
                        <Bar dataKey="count" fill="hsl(var(--chart-1))" name={lang === 'es' ? 'Cantidad' : 'Count'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin calificaciones aún' : 'No ratings yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Partners Mejor Calificados' : 'Top Rated Partners'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Partners con mejor promedio de calificación' : 'Partners with highest average rating'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.topRatedPartners.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.topRatedPartners} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 5]} fontSize={12} />
                        <YAxis dataKey="companyName" type="category" fontSize={12} width={120} />
                        <Tooltip formatter={(value: number) => value.toFixed(1)} />
                        <Bar dataKey="avgRating" fill="hsl(var(--chart-3))" name={lang === 'es' ? 'Promedio' : 'Average'} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin calificaciones de partners aún' : 'No partner ratings yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'es' ? 'Análisis de Sentimiento' : 'Sentiment Analysis'}</CardTitle>
                  <CardDescription>
                    {lang === 'es' ? 'Distribución de comentarios por sentimiento' : 'Comment distribution by sentiment'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {data.sentimentBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={data.sentimentBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ sentiment, count }) => `${sentiment}: ${count}`}
                          outerRadius={100}
                          fill="hsl(var(--chart-2))"
                          dataKey="count"
                          nameKey="sentiment"
                        >
                          {data.sentimentBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.sentiment === 'positive' ? 'hsl(var(--success))' : entry.sentiment === 'negative' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {lang === 'es' ? 'Sin datos de sentimiento aún' : 'No sentiment data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="marketing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {lang === 'es' ? 'Analíticas de Marketing (Últimos 30 días)' : 'Marketing Analytics (Last 30 days)'}
              </h2>
              <button 
                onClick={() => refetchMarketing()}
                disabled={loadingMarketing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                data-testid="button-refresh-marketing"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingMarketing ? 'animate-spin' : ''}`} />
                {lang === 'es' ? 'Actualizar' : 'Refresh'}
              </button>
            </div>

            {loadingMarketing ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {lang === 'es' ? 'Páginas Vistas' : 'Page Views'}
                      </CardTitle>
                      <MousePointer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-views">
                        {marketingData?.totalPageViews || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {lang === 'es' ? 'Visitantes Únicos' : 'Unique Visitors'}
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-unique-visitors">
                        {marketingData?.uniqueVisitors || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {lang === 'es' ? 'Fuentes de Tráfico' : 'Traffic Sources'}
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-sources">
                        {marketingData?.sourceBreakdown?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {lang === 'es' ? 'Referencias de IA' : 'AI Referrals'}
                      </CardTitle>
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-ai-referrals">
                        {marketingData?.aiReferrals?.reduce((sum, a) => sum + a.views, 0) || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'es' ? 'Tendencia de Visitas' : 'Visit Trend'}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={marketingData?.trendData || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Area type="monotone" dataKey="views" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'es' ? 'Fuentes de Tráfico' : 'Traffic Sources'}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {(marketingData?.sourceBreakdown || []).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={marketingData?.sourceBreakdown || []}
                              dataKey="views"
                              nameKey="source"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ source, percentage }) => `${source}: ${percentage}%`}
                            >
                              {(marketingData?.sourceBreakdown || []).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {lang === 'es' ? 'Sin datos de tráfico aún' : 'No traffic data yet'}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'es' ? 'Páginas Más Visitadas' : 'Top Pages'}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {(marketingData?.topPages || []).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={marketingData?.topPages || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={12} />
                            <YAxis dataKey="path" type="category" width={150} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="views" fill="hsl(var(--chart-2))" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {lang === 'es' ? 'Sin datos de páginas aún' : 'No page data yet'}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'es' ? 'Rendimiento de Partners' : 'Partner Performance'}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {(marketingData?.partnerPerformance || []).length > 0 ? (
                        <div className="space-y-4 overflow-y-auto h-full">
                          {marketingData?.partnerPerformance.map((partner, index) => (
                            <div key={partner.partner} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="font-medium">{partner.partner}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm">
                                  {partner.views} {lang === 'es' ? 'visitas' : 'views'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {partner.quotes} {lang === 'es' ? 'cotizaciones' : 'quotes'} ({partner.conversionRate}%)
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {lang === 'es' ? 'Sin datos de partners aún' : 'No partner data yet'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {(marketingData?.utmPerformance || []).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{lang === 'es' ? 'Rendimiento de Campañas UTM' : 'UTM Campaign Performance'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">{lang === 'es' ? 'Campaña' : 'Campaign'}</th>
                              <th className="text-left py-2">{lang === 'es' ? 'Fuente' : 'Source'}</th>
                              <th className="text-left py-2">{lang === 'es' ? 'Medio' : 'Medium'}</th>
                              <th className="text-right py-2">{lang === 'es' ? 'Visitas' : 'Views'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {marketingData?.utmPerformance.map((utm, index) => (
                              <tr key={index} className="border-b">
                                <td className="py-2">{utm.campaign}</td>
                                <td className="py-2">{utm.source}</td>
                                <td className="py-2">{utm.medium}</td>
                                <td className="py-2 text-right font-medium">{utm.views}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(marketingData?.aiReferrals || []).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        {lang === 'es' ? 'Referencias desde Asistentes de IA' : 'AI Assistant Referrals'}
                      </CardTitle>
                      <CardDescription>
                        {lang === 'es' 
                          ? 'Tráfico proveniente de ChatGPT, Claude, Perplexity y otros'
                          : 'Traffic from ChatGPT, Claude, Perplexity and others'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {marketingData?.aiReferrals.map((ai) => (
                          <div key={ai.source} className="flex items-center justify-between">
                            <span className="font-medium truncate max-w-md">{ai.source}</span>
                            <span className="font-bold">{ai.views} {lang === 'es' ? 'visitas' : 'views'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
