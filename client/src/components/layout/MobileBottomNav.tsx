import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Home, Newspaper, Users, Truck, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = [
  "/dashboard",
  "/mover/dashboard",
  "/admin/dashboard",
  "/embed",
  "/presentation",
  "/pitch",
  "/reset-password",
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();

  if (HIDDEN_PREFIXES.some((p) => location.startsWith(p))) return null;

  const items = [
    { href: "/", icon: Home, label: t("nav.home"), active: location === "/" },
    {
      href: "/blog",
      icon: Newspaper,
      label: "Blog",
      active: location === "/blog" || location.startsWith("/blog/"),
    },
    null, // center CTA slot
    {
      href: "/about",
      icon: Users,
      label: t("nav.about"),
      active: location === "/about",
    },
    {
      href: "/login",
      icon: UserCircle,
      label: t("nav.login"),
      active: location === "/login",
    },
  ];

  return (
    <>
      {/* Spacer so fixed bar never covers page content/footer */}
      <div
        className="md:hidden"
        style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }}
        aria-hidden="true"
      />
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-[var(--usg-border)] bg-[var(--usg-paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--usg-paper)]/90"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-testid="nav-mobile-bottom"
      >
        <div className="grid grid-cols-5 h-16">
          {items.map((item, i) =>
            item ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                   item.active ? "text-[var(--usg-orange)]" : "text-[var(--usg-muted)]"
                )}
                data-testid={`link-bottomnav-${item.href === "/" ? "home" : item.href.slice(1)}`}
              >
                <item.icon className="h-5 w-5" strokeWidth={item.active ? 2.4 : 2} />
                <span className="leading-none">{item.label}</span>
              </Link>
            ) : (
              <div key="cta" className="relative flex items-center justify-center">
                <Link
                  href="/quote"
                  className="absolute -top-5 flex flex-col items-center"
                  data-testid="link-bottomnav-quote"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--usg-orange)] text-[var(--usg-ink)] shadow-lg shadow-orange-950/20 ring-4 ring-[var(--usg-paper)]">
                    <Truck className="h-6 w-6" />
                  </span>
                   <span className="mt-1 text-[11px] font-semibold leading-none text-[var(--usg-orange)]">
                    {t("nav.getQuote")}
                  </span>
                </Link>
              </div>
            )
          )}
        </div>
      </nav>
    </>
  );
}
