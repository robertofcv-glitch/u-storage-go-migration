import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Package, Truck, Users, LayoutDashboard, FileText, Car, Building2, Loader2, Star, FileCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { RatingSummaryCard, PublicReviewCard } from "@/components/ratings/RatingComponents";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";

export default function MoverOverview() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const isSpanish = i18n.language === 'es';
  const { active } = usePartnerCompany();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['partner-company', active?.company.id],
    queryFn: async () => {
      const response = await fetch('/api/partner/company');
      if (!response.ok) return null;
      const data = await response.json();
      return data.company;
    },
    enabled: !!active?.company.id,
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['mover-ratings', profileData?.id],
    queryFn: async () => {
      if (!profileData?.id) return null;
      const response = await fetch(`/api/mover-profiles/${profileData.id}/ratings`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!profileData?.id,
  });

  const sidebarLinks = [
    { href: "/mover/dashboard", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "/mover/dashboard/profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "/mover/dashboard/documents", label: isSpanish ? 'Documentos' : 'Documents', icon: FileCheck },
    { href: "/mover/dashboard/jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "/mover/dashboard/quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "/mover/dashboard/fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "/mover/dashboard/drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
  ];

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="mover">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
       <div className="flex flex-col gap-5 lg:gap-7">
        <div className="workspace-hero">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              <Sparkles className="h-4 w-4" />
              {i18n.language === 'es' ? 'Espacio de socios' : 'Partner workspace'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('dashboard.mover.title')}</h1>
            <p className="mt-2 text-sm text-white/75">
               {active?.company.companyName || (profileData?.companyName ? `${t('dashboard.mover.welcome').replace('FastMoves Inc.', profileData.companyName)}` : t('dashboard.mover.welcome'))}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/mover/dashboard/jobs')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.mover.activeJobs')}</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.mover.activeJobsSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/mover/dashboard/quotes')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.mover.pendingQuotes')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.mover.pendingQuotesSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.mover.revenue')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$12,500</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.mover.revenueSub')}</p>
            </CardContent>
          </Card>
          <Card className="workspace-stat cursor-pointer" onClick={() => setLocation('/mover/dashboard/drivers')}>
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="workspace-card">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t('dashboard.mover.nav.jobs')}</CardTitle>
                <Button variant="link" onClick={() => setLocation('/mover/dashboard/jobs')} className="text-[var(--usg-orange)]">
                {t('common.viewAll')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-slate-400 border-2 border-dashed rounded-lg">
                {t('dashboard.mover.jobsPlaceholder')}
              </div>
            </CardContent>
          </Card>
          <Card className="workspace-card">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t('dashboard.mover.nav.quotes')}</CardTitle>
                <Button variant="link" onClick={() => setLocation('/mover/dashboard/quotes')} className="text-[var(--usg-orange)]">
                {t('common.viewAll')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-slate-400 border-2 border-dashed rounded-lg">
                {t('dashboard.mover.quotesPlaceholder')}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="ratings-overview-card">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              {t('dashboard.mover.ratings', 'Calificaciones de Clientes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg">
                <RatingSummaryCard
                  averageRating={ratingsData?.summary?.averageRating || 0}
                  totalRatings={ratingsData?.summary?.totalRatings || 0}
                  showBreakdown
                  breakdown={ratingsData?.summary?.breakdown}
                />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {t('dashboard.mover.recentReviews', 'Reseñas Recientes')}
                </h4>
                {ratingsData?.ratings && ratingsData.ratings.length > 0 ? (
                  ratingsData.ratings.slice(0, 2).map((rating: any) => (
                    <PublicReviewCard key={rating.id} rating={rating} />
                  ))
                ) : (
                  <div className="flex items-center justify-center h-24 text-slate-400 border-2 border-dashed rounded-lg text-sm">
                    {t('dashboard.mover.noReviewsYet', 'Sin reseñas todavía')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
