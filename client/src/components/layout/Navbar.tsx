import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Globe, Menu, ChevronDown, User, Truck, Shield, LogOut, LayoutDashboard, Home, UserCircle } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UserRole {
  id: number;
  userId: number;
  role: string;
}

interface CurrentUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  roles?: UserRole[];
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading } = useQuery<{ user: CurrentUser | null; isImpersonated: boolean } | null>({
    queryKey: ["/api/impersonate/current"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/impersonate/current", { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });
  
  const currentUser = sessionData?.user || null;

  const isLoggedIn = !!currentUser;
  const userRoles = currentUser?.roles?.map(r => r.role) || [];

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(newLang);
  };

  const getUserDisplayName = (user: CurrentUser) => {
    if (user.fullName) return user.fullName;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    return user.email;
  };

  const getUserInitials = (user: CurrentUser) => {
    const name = getUserDisplayName(user);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    if (role === 'client') return i18n.language === 'es' ? 'Panel Cliente' : 'Client Dashboard';
    if (role === 'mover') return i18n.language === 'es' ? 'Panel Socio' : 'Partner Dashboard';
    return i18n.language === 'es' ? 'Panel Admin' : 'Admin Dashboard';
  };

  const getRoleIcon = (role: string) => {
    if (role === 'client') return UserCircle;
    if (role === 'mover') return Truck;
    return Shield;
  };

  const getRoleDashboardPath = (role: string) => {
    if (role === 'client') return '/dashboard';
    if (role === 'mover') return '/mover/dashboard';
    return '/admin/dashboard';
  };

  const getPreferredDashboard = () => {
    if (userRoles.includes('admin')) return '/admin/dashboard';
    if (userRoles.includes('mover')) return '/mover/dashboard';
    if (userRoles.includes('client')) return '/dashboard';
    return '/dashboard';
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/email-logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        queryClient.clear();
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navLinkClass = (active: boolean) =>
    cn(
      "rounded-md px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:text-go-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      active && "text-go-purple underline decoration-go-orange decoration-2 underline-offset-8",
    );

  const NavLinks = () => (
    <>
      <Link href="/" className={navLinkClass(location === "/")}>
        {t('nav.home')}
      </Link>
      <Link href="/about" className={navLinkClass(location === "/about")}>
        {t('nav.about')}
      </Link>
      <Link href="/blog" className={navLinkClass(location === "/blog" || location.startsWith("/blog/"))}>
        Blog
      </Link>
      <Link href="/u-storage" className={navLinkClass(location === "/u-storage")}>
        U-Storage
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container flex h-[72px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="/brand/v1/logos/official-color.svg"
              alt="U-Storage Go" 
              className="h-8 w-auto object-contain"
              data-testid="img-navbar-logo"
            />
          </Link>
        </div>

        {/* Desktop Nav - Links Centered */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLinks />
        </nav>

        {/* Desktop Nav - Actions Right */}
        <div className="hidden md:flex items-center gap-4 border-l border-neutral-200 pl-6">
          {isLoggedIn && currentUser ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-go-purple text-white text-xs">
                        {getUserInitials(currentUser)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline max-w-[120px] truncate">{getUserDisplayName(currentUser)}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getUserDisplayName(currentUser)}</p>
                      <p className="text-xs leading-none text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {i18n.language === 'es' ? 'Mis Paneles' : 'My Dashboards'}
                  </DropdownMenuLabel>
                  {userRoles.map((role) => {
                    const Icon = getRoleIcon(role);
                    return (
                      <DropdownMenuItem
                        key={role}
                        onSelect={() => setLocation(getRoleDashboardPath(role))}
                        className="cursor-pointer"
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {getRoleLabel(role)}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    {i18n.language === 'es' ? 'Cerrar Sesión' : 'Log Out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900">
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('nav.login')}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setLocation('/login')} className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    {i18n.language === 'es' ? 'Cliente' : 'Client'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation('/mover')} className="cursor-pointer">
                    <Truck className="mr-2 h-4 w-4" />
                    {i18n.language === 'es' ? 'Socio' : 'Partner'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation('/admin')} className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button variant="ghost" size="icon" onClick={toggleLanguage} className="rounded-full text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900">
            <Globe className="h-4 w-4" />
            <span className="sr-only">Toggle Language</span>
            <span className="text-xs font-medium ml-1">{i18n.language.toUpperCase()}</span>
          </Button>
          
          <Button 
            className="bg-go-orange text-go-ink hover:bg-go-orange/85 font-bold"
            onClick={() => setLocation('/quote')}
          >
            {t('nav.getQuote')}
          </Button>
        </div>

        {/* Mobile Nav */}
        <div className="flex md:hidden items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleLanguage} className="rounded-full text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium ml-1">{i18n.language.toUpperCase()}</span>
          </Button>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-6 mt-8">
                {isLoggedIn && currentUser && (
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-go-purple text-white">
                        {getUserInitials(currentUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{getUserDisplayName(currentUser)}</p>
                      <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col gap-4">
                  <NavLinks />
                  <div className="h-px bg-border my-2" />
                  
                  {isLoggedIn && currentUser ? (
                    <>
                      <div className="text-sm font-semibold text-muted-foreground px-2">
                        {i18n.language === 'es' ? 'Mis Paneles' : 'My Dashboards'}
                      </div>
                      {userRoles.map((role) => {
                        const Icon = getRoleIcon(role);
                        return (
                          <Button 
                            key={role}
                            variant="ghost" 
                            className="justify-start" 
                            onClick={() => setLocation(getRoleDashboardPath(role))}
                          >
                            <Icon className="mr-2 h-4 w-4" /> {getRoleLabel(role)}
                          </Button>
                        );
                      })}
                      <div className="h-px bg-border my-2" />
                      <Button 
                        variant="ghost" 
                        className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50" 
                        onClick={handleLogout}
                      >
                        <LogOut className="mr-2 h-4 w-4" /> 
                        {i18n.language === 'es' ? 'Cerrar Sesión' : 'Log Out'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-muted-foreground px-2">
                        {i18n.language === 'es' ? 'Acceso' : 'Access'}
                      </div>
                      <Button variant="ghost" className="justify-start" onClick={() => setLocation('/login')}>
                        <UserCircle className="mr-2 h-4 w-4" /> {i18n.language === 'es' ? 'Cliente' : 'Client'}
                      </Button>
                      <Button variant="ghost" className="justify-start" onClick={() => setLocation('/mover')}>
                        <Truck className="mr-2 h-4 w-4" /> {i18n.language === 'es' ? 'Socio' : 'Partner'}
                      </Button>
                      <Button variant="ghost" className="justify-start" onClick={() => setLocation('/admin')}>
                        <Shield className="mr-2 h-4 w-4" /> Admin
                      </Button>
                    </>
                  )}
                </div>
                <div className="h-px bg-border my-2" />
                <Button className="w-full" onClick={() => setLocation('/quote')}>
                  {t('nav.getQuote')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
