import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LayoutDashboard, FileText, Car, Building2, Truck, Users, FileCheck, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PartnerFleetManager } from "@/components/mover/PartnerFleetManager";

export default function MoverFleet() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';

  const sidebarLinks = [
    { href: "/mover/dashboard", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "/mover/dashboard/profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "/mover/dashboard/documents", label: isSpanish ? 'Documentos' : 'Documents', icon: FileCheck },
    { href: "/mover/dashboard/jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "/mover/dashboard/quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "/mover/dashboard/fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "/mover/dashboard/drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
    { href: "/mover/dashboard/calendar", label: isSpanish ? "Calendario operativo" : "Operations calendar", icon: CalendarDays },
  ];

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">{t('dashboard.mover.nav.fleet')}</h1>
          <p className="text-muted-foreground">{isSpanish ? "Disponibilidad clara para cada salida." : "Clear availability for every dispatch."}</p>
        </div>

        <PartnerFleetManager />
      </div>
    </DashboardLayout>
  );
}
