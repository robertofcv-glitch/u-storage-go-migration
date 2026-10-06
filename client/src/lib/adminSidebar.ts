import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  DollarSign, 
  Activity, 
  Mail, 
  Database, 
  Bot, 
  BarChart3,
  Star,
  Package,
  Search,
  BookOpen,
  CreditCard,
  MessageSquare,
  Warehouse,
  SlidersHorizontal,
  ClipboardList
} from "lucide-react";

export interface SidebarLink {
  href: string;
  label: string;
  labelEs: string;
  icon: any;
  badgeKey?: string;
  permission?: string;
  relatedPermissions?: string[];
}

export const adminSidebarLinks: SidebarLink[] = [
  { href: "/admin/dashboard", label: "Overview", labelEs: "Resumen", icon: LayoutDashboard, permission: "module:dashboard" },
  { href: "/admin/dashboard/analytics", label: "Analytics", labelEs: "Analíticas", icon: BarChart3, permission: "module:analytics" },
  { href: "/admin/dashboard/quotes", label: "Quotes", labelEs: "Cotizaciones", icon: FileText, permission: "module:quotes" },
  { href: "/admin/dashboard/ratings", label: "Ratings", labelEs: "Calificaciones", icon: Star, permission: "module:ratings" },
  { href: "/admin/dashboard/activity", label: "Activity", labelEs: "Actividad", icon: Activity, permission: "module:activity" },
  { href: "/admin/dashboard/communications", label: "Communications", labelEs: "Comunicaciones", icon: Mail, permission: "module:communications" },
  { href: "/admin/dashboard/whatsapp-inbox", label: "WhatsApp Inbox", labelEs: "Bandeja WhatsApp", icon: MessageSquare, badgeKey: "whatsappUnread", permission: "module:whatsapp" },
  { href: "/admin/dashboard/ai-agent", label: "Clara", labelEs: "Clara", icon: Bot, permission: "module:ai_agent" },
  { href: "/admin/dashboard/inventory", label: "Inventory", labelEs: "Inventario", icon: Package, permission: "module:inventory" },
  { href: "/admin/dashboard/pricing", label: "Pricing", labelEs: "Precios", icon: DollarSign, permission: "module:pricing" },
  { href: "/admin/dashboard/ustorage", label: "U-Storage Branches", labelEs: "Sucursales U-Storage", icon: Warehouse, permission: "module:ustorage" },
  { href: "/admin/dashboard/services", label: "Services", labelEs: "Servicios", icon: ClipboardList, permission: "module:quotes" },
  { href: "/admin/dashboard/payments", label: "Payments", labelEs: "Pagos", icon: CreditCard, permission: "module:payments" },
  { href: "/admin/dashboard/database", label: "Database", labelEs: "Base de Datos", icon: Database, permission: "module:database" },
  { href: "/admin/dashboard/seo-marketing", label: "SEO & Marketing", labelEs: "SEO y Marketing", icon: Search, permission: "module:marketing" },
  { href: "/admin/dashboard/blog", label: "Blog", labelEs: "Blog", icon: BookOpen, permission: "module:marketing" },
  { href: "/admin/dashboard/usuarios", label: "Companies & Users", labelEs: "Empresas y usuarios", icon: Users, permission: "module:users", relatedPermissions: ["module:companies"] },
  { href: "/admin/dashboard/roles", label: "Roles & visibility", labelEs: "Roles y visibilidad", icon: SlidersHorizontal, permission: "module:role_management" },
  { href: "/admin/dashboard/settings", label: "Settings", labelEs: "Configuración", icon: Settings, permission: "module:settings" },
];

export function getAdminSidebarLinks(lang: string) {
  return adminSidebarLinks.map(link => ({
    href: link.href,
    label: lang === 'es' ? link.labelEs : link.label,
    icon: link.icon,
    badgeKey: link.badgeKey,
    permission: link.permission,
  }));
}
