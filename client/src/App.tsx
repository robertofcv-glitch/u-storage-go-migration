import { lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientRoute, ClientCompanyRoute, MoverRoute, AdminRoute } from "@/components/ProtectedRoute";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useTranslation } from "react-i18next";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MoverCompany from "@/pages/mover/MoverCompany";
import { PartnerCompanyProvider } from "@/contexts/PartnerCompanyContext";

const Quote = lazy(() => import("@/pages/Quote"));
const QRLanding = lazy(() => import("@/pages/QRLanding"));
const MudanzaReserva = lazy(() => import("@/pages/MudanzaReserva"));
const About = lazy(() => import("@/pages/About"));
const Login = lazy(() => import("@/pages/Login"));

const PartnersLanding = lazy(() => import("@/pages/PartnersLanding"));
const PartnerOnboarding = lazy(() => import("@/pages/PartnerOnboarding"));
const AdminLanding = lazy(() => import("@/pages/AdminLanding"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const ClientOverview = lazy(() => import("@/pages/client/ClientOverview"));
const ClientQuotes = lazy(() => import("@/pages/client/ClientQuotes"));
const ClientQuoteDetails = lazy(() => import("@/pages/client/ClientQuoteDetails"));
const ClientMoves = lazy(() => import("@/pages/client/ClientMoves"));
const ClientSaved = lazy(() => import("@/pages/client/ClientSaved"));
const ClientCompany = lazy(() => import("@/pages/client/ClientCompany"));
const AcceptClientCompanyInvitation = lazy(() => import("@/pages/client/AcceptCompanyInvitation"));
const ClientNewQuote = lazy(() => import("@/pages/client/ClientNewQuote"));

const MoverOverview = lazy(() => import("@/pages/mover/MoverOverview"));
const MoverProfile = lazy(() => import("@/pages/mover/MoverProfile"));
const MoverDocuments = lazy(() => import("@/pages/mover/MoverDocuments"));
const MoverJobs = lazy(() => import("@/pages/mover/MoverJobs"));
const MoverQuotesPage = lazy(() => import("@/pages/mover/MoverQuotesPage"));
const MoverFleet = lazy(() => import("@/pages/mover/MoverFleet"));
const MoverDrivers = lazy(() => import("@/pages/mover/MoverDrivers"));

const MoverCalendar = lazy(() => import("@/pages/mover/MoverCalendar"));
const AcceptCompanyInvitation = lazy(() => import("@/pages/mover/AcceptCompanyInvitation"));

const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminQuotes = lazy(() => import("@/pages/admin/AdminQuotes"));
const AdminAssistedQuote = lazy(() => import("@/pages/admin/AdminAssistedQuote"));
const AdminQuoteDetails = lazy(() => import("@/pages/admin/AdminQuoteDetails"));
const AdminUstorage = lazy(() => import("@/pages/admin/AdminUstorage"));
const AdminWorkflowStatuses = lazy(() => import("@/pages/admin/AdminWorkflowStatuses"));
const AdminUserDetails = lazy(() => import("@/pages/admin/AdminUserDetails"));
const AdminMoverDetails = lazy(() => import("@/pages/admin/AdminMoverDetails"));
const AdminAdminDetails = lazy(() => import("@/pages/admin/AdminAdminDetails"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity"));
const AdminRatings = lazy(() => import("@/pages/admin/AdminRatings"));
const AdminCommunications = lazy(() => import("@/pages/admin/AdminCommunications"));
const AdminDatabase = lazy(() => import("@/pages/admin/AdminDatabase"));
const AdminAIAgent = lazy(() => import("@/pages/admin/AdminAIAgent"));
const AdminPricing = lazy(() => import("@/pages/admin/AdminPricing"));
const AdminInventory = lazy(() => import("@/pages/admin/AdminInventory"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminSeoMarketing = lazy(() => import("@/pages/admin/AdminSeoMarketing"));
const AdminBlog = lazy(() => import("@/pages/admin/AdminBlog"));
const AdminPayments = lazy(() => import("@/pages/admin/AdminPayments"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminServiceDetails = lazy(() => import("@/pages/admin/AdminServiceDetails"));
const AdminWhatsAppInbox = lazy(() => import("@/pages/admin/AdminWhatsAppInbox"));
const AdminUsuarios = lazy(() => import("@/pages/admin/AdminUsuarios"));
const AdminCompanyDetails = lazy(() => import("@/pages/admin/AdminCompanyDetails"));
const AdminAdmins = lazy(() => import("@/pages/admin/AdminAdmins"));
const AdminPlatformRoles = lazy(() => import("@/pages/admin/AdminPlatformRoles"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const UStorageEmbed = lazy(() => import("@/pages/UStorageEmbed"));
const UStorageHostDemo = lazy(() => import("@/pages/UStorageHostDemo"));
const PitchSlide4 = lazy(() => import("@/pages/PitchSlide4"));
const Presentation = lazy(() => import("@/pages/Presentation"));

function RouteFallback() {
  return (
     <div className="min-h-screen flex items-center justify-center bg-[var(--usg-paper)]">
       <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--usg-orange)] border-t-transparent" />
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const { i18n } = useTranslation();

  if (location === "/admin/dashboard" || location.startsWith("/admin/dashboard/")) {
    return (
      <AdminRoute>
        <DashboardLayout links={getAdminSidebarLinks(i18n.language)} userType="admin">
          <Suspense fallback={<RouteFallback />}>
            <Switch>
              <Route path="/admin/dashboard" component={AdminOverview} />
              <Route path="/admin/dashboard/analytics" component={AdminAnalytics} />
               <Route path="/admin/dashboard/quotes/assisted" component={AdminAssistedQuote} />
               <Route path="/admin/dashboard/quotes/assisted/:draftId" component={AdminAssistedQuote} />
               <Route path="/admin/dashboard/quotes" component={AdminQuotes} />
               <Route path="/admin/dashboard/quotes/:quoteId" component={AdminQuoteDetails} />
               <Route path="/admin/dashboard/services/:serviceId" component={AdminServiceDetails} />
               <Route path="/admin/dashboard/services" component={AdminServices} />
              <Route path="/admin/dashboard/workflow-statuses" component={AdminWorkflowStatuses} />
              <Route path="/admin/dashboard/usuarios" component={AdminUsuarios} />
              <Route path="/admin/dashboard/companies/:companyId" component={AdminCompanyDetails} />
              <Route path="/admin/dashboard/roles/new" component={AdminPlatformRoles} />
              <Route path="/admin/dashboard/roles/:roleId" component={AdminPlatformRoles} />
              <Route path="/admin/dashboard/roles" component={AdminPlatformRoles} />
              <Route path="/admin/dashboard/users"><Redirect to="/admin/dashboard/usuarios?tab=users" /></Route>
              <Route path="/admin/dashboard/users/:userId" component={AdminUserDetails} />
              <Route path="/admin/dashboard/movers"><Redirect to="/admin/dashboard/usuarios?profile=mover" /></Route>
              <Route path="/admin/dashboard/movers/:moverId" component={AdminMoverDetails} />
              {/* Administrator lists now live in the Organization command center.
                  Keep this URL as a deep-link-compatible redirect. */}
              <Route path="/admin/dashboard/admins"><Redirect to="/admin/dashboard/usuarios?profile=admin" /></Route>
              <Route path="/admin/dashboard/admins/:adminId" component={AdminAdminDetails} />
              <Route path="/admin/dashboard/activity" component={AdminActivity} />
              <Route path="/admin/dashboard/ratings" component={AdminRatings} />
              <Route path="/admin/dashboard/communications" component={AdminCommunications} />
              <Route path="/admin/dashboard/database" component={AdminDatabase} />
              <Route path="/admin/dashboard/ai-agent" component={AdminAIAgent} />
              <Route path="/admin/dashboard/pricing" component={AdminPricing} />
              <Route path="/admin/dashboard/ustorage" component={AdminUstorage} />
              <Route path="/admin/dashboard/inventory" component={AdminInventory} />
              <Route path="/admin/dashboard/seo-marketing" component={AdminSeoMarketing} />
              <Route path="/admin/dashboard/blog" component={AdminBlog} />
              <Route path="/admin/dashboard/payments" component={AdminPayments} />
              <Route path="/admin/dashboard/whatsapp-inbox" component={AdminWhatsAppInbox} />
              <Route path="/admin/dashboard/settings" component={AdminSettings} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </DashboardLayout>
      </AdminRoute>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      {/* Permanent printed-QR entry point; all case/slash variants share this page. */}
      <Route path={/^\/qr\/?$/i} component={QRLanding} />
      {/* Canonical, embeddable u-storage experience (single source of truth). */}
      <Route path="/embed/u-storage" component={UStorageEmbed} />
      {/* Demo of the embed hosted inside a recreation of the real u-storage.com.mx page. */}
      <Route path="/u-storage" component={UStorageHostDemo} />
      <Route path="/login" component={Login} />
      <Route path="/quote" component={Quote} />
      <Route path="/mudanza/reserva" component={MudanzaReserva} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogArticle} />
      <Route path="/mover" component={PartnersLanding} />
      <Route path="/mover/onboarding" component={PartnerOnboarding} />
      <Route path="/mover/invitations/:token" component={AcceptCompanyInvitation} />
      <Route path="/admin" component={AdminLanding} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/accept-company-invitation/:token" component={AcceptClientCompanyInvitation} />
      <Route path="/pitch/slide4" component={PitchSlide4} />
      <Route path="/presentation" component={Presentation} />
      
      {/* Protected client routes */}
      <Route path="/dashboard">{() => <ClientRoute><ClientOverview /></ClientRoute>}</Route>
      <Route path="/dashboard/quotes">{() => <ClientRoute><ClientQuotes /></ClientRoute>}</Route>
      <Route path="/dashboard/quotes/:quoteId">{() => <ClientRoute><ClientQuoteDetails /></ClientRoute>}</Route>
      <Route path="/dashboard/moves">{() => <ClientRoute><ClientMoves /></ClientRoute>}</Route>
      <Route path="/dashboard/saved">{() => <ClientRoute><ClientSaved /></ClientRoute>}</Route>
      <Route path="/dashboard/company">{() => <ClientCompanyRoute><ClientCompany /></ClientCompanyRoute>}</Route>
      <Route path="/dashboard/new-quote">{() => <ClientRoute><ClientNewQuote /></ClientRoute>}</Route>
      
      {/* Protected mover routes */}
      <Route path="/mover/dashboard">{() => <MoverRoute><MoverOverview /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/profile">{() => <MoverRoute><MoverProfile /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/company">{() => <MoverRoute><MoverCompany /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/documents">{() => <MoverRoute><MoverDocuments /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/jobs">{() => <MoverRoute><MoverJobs /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/quotes">{() => <MoverRoute><MoverQuotesPage /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/fleet">{() => <MoverRoute><MoverFleet /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/drivers">{() => <MoverRoute><MoverDrivers /></MoverRoute>}</Route>
      <Route path="/mover/dashboard/calendar">{() => <MoverRoute><MoverCalendar /></MoverRoute>}</Route>
      
      {/* Protected admin routes */}
      <Route path="/admin/dashboard">{() => <AdminRoute><AdminOverview /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/analytics">{() => <AdminRoute><AdminAnalytics /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/quotes/assisted">{() => <AdminRoute><AdminAssistedQuote /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/quotes/assisted/:draftId">{() => <AdminRoute><AdminAssistedQuote /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/quotes">{() => <AdminRoute><AdminQuotes /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/quotes/:quoteId">{() => <AdminRoute><AdminQuoteDetails /></AdminRoute>}</Route>
       <Route path="/admin/dashboard/services/:serviceId">{() => <AdminRoute><AdminServiceDetails /></AdminRoute>}</Route>
       <Route path="/admin/dashboard/services">{() => <AdminRoute><AdminServices /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/workflow-statuses">{() => <AdminRoute><AdminWorkflowStatuses /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/usuarios">{() => <AdminRoute><AdminUsuarios /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/companies/:companyId">{() => <AdminRoute><AdminCompanyDetails /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/roles/new">{() => <AdminRoute><AdminPlatformRoles /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/roles/:roleId">{() => <AdminRoute><AdminPlatformRoles /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/roles">{() => <AdminRoute><AdminPlatformRoles /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/users">{() => <Redirect to="/admin/dashboard/usuarios?tab=users" />}</Route>
      <Route path="/admin/dashboard/users/:userId">{() => <AdminRoute><AdminUserDetails /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/movers">{() => <Redirect to="/admin/dashboard/usuarios?profile=mover" />}</Route>
      <Route path="/admin/dashboard/movers/:moverId">{() => <AdminRoute><AdminMoverDetails /></AdminRoute>}</Route>
      {/* Legacy administrator list URL; the canonical Organization list owns all user views. */}
      <Route path="/admin/dashboard/admins">{() => <Redirect to="/admin/dashboard/usuarios?profile=admin" />}</Route>
      <Route path="/admin/dashboard/admins/:adminId">{() => <AdminRoute><AdminAdminDetails /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/activity">{() => <AdminRoute><AdminActivity /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/ratings">{() => <AdminRoute><AdminRatings /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/communications">{() => <AdminRoute><AdminCommunications /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/database">{() => <AdminRoute><AdminDatabase /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/ai-agent">{() => <AdminRoute><AdminAIAgent /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/pricing">{() => <AdminRoute><AdminPricing /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/ustorage">{() => <AdminRoute><AdminUstorage /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/inventory">{() => <AdminRoute><AdminInventory /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/seo-marketing">{() => <AdminRoute><AdminSeoMarketing /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/blog">{() => <AdminRoute><AdminBlog /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/payments">{() => <AdminRoute><AdminPayments /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/whatsapp-inbox">{() => <AdminRoute><AdminWhatsAppInbox /></AdminRoute>}</Route>
      <Route path="/admin/dashboard/settings">{() => <AdminRoute><AdminSettings /></AdminRoute>}</Route>
      
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function PageTracker() {
  const { i18n } = useTranslation();
  usePageTracking(i18n.language);
  return null;
}

function ConditionalAnalytics() {
  const [location] = useLocation();
  // Never fire analytics on the password-reset page — the URL may still
  // contain the reset token when third-party scripts initialise.
  if (location.startsWith('/reset-password')) return null;
  return <AnalyticsScripts />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ConditionalAnalytics />
        <PageTracker />
        <PartnerCompanyProvider><Router /></PartnerCompanyProvider>
        <MobileBottomNav />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
