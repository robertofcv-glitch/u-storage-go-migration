import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LayoutDashboard, FileText, Car, Building2, Truck, Users, Loader2, FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MoverQuotes } from "@/components/mover/MoverQuotes";
import { useQuery } from "@tanstack/react-query";
import { usePartnerCompany } from "@/contexts/PartnerCompanyContext";

export default function MoverQuotesPage() {
  const { t, i18n } = useTranslation();
  const { active } = usePartnerCompany();
  const isSpanish = i18n.language === 'es';

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

  const sidebarLinks = [
    { href: "/mover/dashboard", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "/mover/dashboard/profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "/mover/dashboard/documents", label: isSpanish ? 'Documentos' : 'Documents', icon: FileCheck },
    { href: "/mover/dashboard/jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "/mover/dashboard/quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "/mover/dashboard/fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "/mover/dashboard/drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
  ];

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">{t('dashboard.mover.nav.quotes')}</h1>
          <p className="text-muted-foreground">{isSpanish ? "Las nuevas asignaciones llegan por despacho directo. Las ofertas históricas permanecen aquí." : "New work arrives through direct dispatch. Legacy bids remain here for reference."}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
          </div>
        ) : profileData?.id ? (
          <MoverQuotes moverProfileId={profileData.id} />
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed rounded-lg">
            {t('dashboard.mover.profile.noProfile')}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
