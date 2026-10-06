import { Home, Truck, Package, MapPin, Users } from "lucide-react";

export function getClientSidebarLinks(t: any) {
  return [
    { href: "/dashboard", label: t("dashboard.client.nav.overview"), icon: Home },
    { href: "/dashboard/moves", label: t("dashboard.client.nav.moves"), icon: Truck },
    { href: "/dashboard/quotes", label: t("dashboard.client.nav.quotes"), icon: Package },
    { href: "/dashboard/saved", label: t("dashboard.client.nav.saved"), icon: MapPin },
    { href: "/dashboard/company", label: t("dashboard.client.nav.company", "Company & team"), icon: Users },
  ];
}