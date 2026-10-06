import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Truck,
  Warehouse,
  ShieldCheck,
  Clock,
  CheckCircle2,
  MapPin,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete, type UStorageBranch } from "@/components/ui/address-autocomplete";
import { QuoteWizard, QuoteFormData } from "@/components/quote/QuoteWizard";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  captureAttribution,
  updateAttributionPartner,
} from "@/lib/attribution";
import { PARTNER_THEMES } from "@/lib/partnerThemes";
import { isEmbedded, useEmbedResize } from "@/lib/embed";
import { useStorageServicePolicy } from "@/hooks/useStorageServicePolicy";

const PARTNER_ID = "u-storage";
const PRIMARY = "#FF6C00";
const SECONDARY = "#4E2069";

export default function UStorageEmbed() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const theme = PARTNER_THEMES[PARTNER_ID];
  const embedded = isEmbedded();
  const { postHeight, scrollParentTop } = useEmbedResize(embedded);

  const params = new URLSearchParams(window.location.search);
  const [fromAddress, setFromAddress] = useState(params.get("from") || "");
  const [toAddress, setToAddress] = useState(params.get("to") || "");
  const [fromBranch, setFromBranch] = useState<UStorageBranch | null>(null);
  const [toBranch, setToBranch] = useState<UStorageBranch | null>(null);
  const { policy } = useStorageServicePolicy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wizardStarted, setWizardStarted] = useState(false);

  const wizardRef = useRef<HTMLDivElement>(null);

  // Capture attribution from the query string (utm_*, partner) and force the
  // partner to u-storage so every lead from this experience is attributed
  // correctly, even when no explicit partner param is present.
  useEffect(() => {
    captureAttribution();
    updateAttributionPartner(PARTNER_ID);
  }, []);

  const t = (es: string, en: string) => (isSpanish ? es : en);

  const scrollToWizard = () => {
    // The wizard replaces the hero's quick-start bar and continues the
    // experience right there — mount it, then scroll once it renders.
    setWizardStarted(true);
    setTimeout(() => {
      scrollToWizardTop();
      postHeight();
    }, 50);
  };

  // One clean scroll to the wizard. Embedded: let the host do the single
  // smooth scroll (child scrollIntoView would also drag the parent page,
  // causing a down-then-up jump). Standalone: scroll ourselves.
  const scrollToWizardTop = () => {
    if (embedded) {
      // Measure against the live layout (rect + current scroll) so the offset
      // is correct on any screen size or layout configuration.
      const rect = wizardRef.current?.getBoundingClientRect();
      const offset = rect ? rect.top + window.scrollY : 0;
      scrollParentTop(Math.max(0, offset));
    } else {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const hasInteractedWithWizard = useRef(false);

  const handleStepChange = () => {
    // The wizard fires this once on mount (step 1). Skip scrolling then so the
    // host page isn't yanked down past its own hero on load; scrollIntoView on
    // a same-origin iframe also scrolls the parent document.
    if (!hasInteractedWithWizard.current) {
      hasInteractedWithWizard.current = true;
      postHeight();
      return;
    }
    // Keep the wizard header in view as the user advances — a single smooth
    // scroll handled by whichever page actually owns the scrollbar.
    scrollToWizardTop();
    postHeight();
  };

  const cleanupQuoteSession = () => {
    const sessionId = sessionStorage.getItem("ruku_quote_session_id");
    if (sessionId) {
      sessionStorage.removeItem(`ruku_partial_quote_${sessionId}`);
      sessionStorage.removeItem("ruku_quote_session_id");
    }
  };

  const onSuccess = () => {
    cleanupQuoteSession();
    setSubmitted(true);
    scrollParentTop();
    // Height changes drastically when the success screen replaces the wizard.
    setTimeout(postHeight, 50);
  };

  const handleLoggedInSubmit = async (data: QuoteFormData) => {
    setIsSubmitting(true);
    try {
      if (!data.partialQuoteId) {
        throw new Error(
          t(
            "No se encontró la cotización. Por favor intenta de nuevo.",
            "Quote not found. Please try again.",
          ),
        );
      }
      const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
      const res = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPartial: false, partner: PARTNER_ID, quoteSessionId: quoteSessionId || undefined }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.message ||
            t("Error al enviar la cotización", "Failed to submit quote"),
        );
      }
      onSuccess();
    } catch (error: any) {
      toast({
        title: t("Error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSubmit = async (data: QuoteFormData) => {
    setIsSubmitting(true);
    try {
      const quoteSessionIdForRegister = sessionStorage.getItem('ruku_quote_session_id');
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.name || data.contactName,
          userType: "client",
          phone: data.contactPhone,
          quoteSessionId: quoteSessionIdForRegister || undefined,
        }),
      });
      if (!registerRes.ok) {
        const error = await registerRes.json().catch(() => ({}));
        throw new Error(
          error.message ||
            t("Error al crear la cuenta", "Failed to create account"),
        );
      }

      if (!data.partialQuoteId) {
        throw new Error(
          t(
            "No se encontró la cotización. Por favor intenta de nuevo.",
            "Quote not found. Please try again.",
          ),
        );
      }
      const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
      const linkRes = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPartial: false, partner: PARTNER_ID, quoteSessionId: quoteSessionId || undefined }),
      });
      if (!linkRes.ok) {
        const error = await linkRes.json().catch(() => ({}));
        throw new Error(
          error.message ||
            t("Error al enviar la cotización", "Failed to submit quote"),
        );
      }
      onSuccess();
    } catch (error: any) {
      toast({
        title: t("Error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = isAuthenticated ? handleLoggedInSubmit : handleGuestSubmit;

  const benefits = [
    {
      icon: Truck,
      title: t("Mudanza profesional", "Professional moving"),
      desc: t(
        "Equipos verificados que cuidan tus cosas de principio a fin.",
        "Verified crews that handle your belongings end to end.",
      ),
    },
    {
      icon: Warehouse,
      title: t("Bodega segura", "Secure storage"),
      desc: t(
        "Guarda lo que no cabe hoy en las bodegas U-Storage.",
        "Store what doesn't fit today in U-Storage units.",
      ),
    },
    {
      icon: Sparkles,
      title: t("Estimado en minutos", "Estimate in minutes"),
      desc: t(
        "Cotiza en minutos con nuestro asistente con IA.",
        "Quote in minutes with our AI assistant.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("Sin sorpresas", "No surprises"),
      desc: t(
        "Estimado transparente basado en tu inventario real.",
        "Transparent estimate based on your real inventory.",
      ),
    },
  ];

  const steps = [
    {
      num: "1",
      title: t("Cuéntanos tu mudanza", "Tell us about your move"),
      desc: t(
        "Origen, destino y qué necesitas mover o guardar.",
        "Origin, destination and what you need to move or store.",
      ),
    },
    {
      num: "2",
      title: t("Arma tu inventario", "Build your inventory"),
      desc: t(
        "Selecciona tus artículos o descríbelos a nuestro asistente.",
        "Pick your items or describe them to our assistant.",
      ),
    },
    {
      num: "3",
      title: t("Recibe tu estimado", "Get your estimate"),
      desc: t(
        "Obtén un estimado inicial y recibe acompañamiento para confirmar tu servicio.",
        "Get an initial estimate and guidance to confirm your service.",
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-[#faf8f5]">
        <div
          className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: PRIMARY, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: "#faf8f5" }}
    >
      <SEO
        noindex
        title={t(
          "Mudanza y Bodegas U-Storage",
          "U-Storage Moving & Storage",
        )}
        description={t(
          "Cotiza tu mudanza y conéctala con una bodega U-Storage. Recibe un estimado inicial en minutos.",
          "Quote your move and connect it with a U-Storage unit. Get an initial estimate in minutes.",
        )}
      />

      {/* Minimal branded top bar — only when the widget runs standalone; the
          host page already provides its own header when embedded */}
      {!embedded && (
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {theme.logo && (
              <img
                src={theme.logo}
                alt="U-Storage Go"
                className="h-7 object-contain"
                data-testid="img-ustorage-logo"
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:hola@u-storage.com.mx"
              className="hidden sm:flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
              data-testid="link-email"
            >
              <Mail className="h-4 w-4" /> hola@u-storage.com.mx
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => i18n.changeLanguage(isSpanish ? "en" : "es")}
              className="text-sm font-semibold"
              data-testid="button-toggle-language"
            >
              {isSpanish ? "EN" : "ES"}
            </Button>
          </div>
        </div>
      </header>
      )}

      {submitted ? (
        <SuccessScreen
          isSpanish={isSpanish}
          onReset={() => window.location.reload()}
          onDashboard={
            isAuthenticated ? () => setLocation("/dashboard") : undefined
          }
        />
      ) : (
        <>
          {/* Hero */}
          <section
            className="relative text-white"
            style={{
              background: `linear-gradient(135deg, ${SECONDARY} 0%, #24152E 100%)`,
            }}
          >
            <div className="container px-4 md:px-6 py-14 md:py-20">
              <div className="max-w-3xl">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold mb-5"
                  style={{ backgroundColor: SECONDARY }}
                >
                  <Sparkles className="h-4 w-4" />
                  {t("Mudanza + Bodega", "Moving + Storage")}
                </span>
                <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
                  {t(
                    "Ahora no solo guardamos tus cosas. También te ayudamos a llevarlas",
                    "Now we don't just store your belongings. We help you move them, too",
                  )}
                </h1>
                <p className="text-lg md:text-xl text-white/80 mb-8">
                  {t(
                      policy?.generalMovesEnabled
                        ? "Cotiza un traslado hacia una bodega U-Storage, desde la bodega o entre dos domicilios."
                        : "Servicios exclusivos hacia y desde bodegas de U-Storage.",
                      policy?.generalMovesEnabled
                        ? "Quote a move to U-Storage, from storage, or between two addresses."
                        : "During launch, your origin or destination must be a participating U-Storage branch.",
                  )}
                </p>

                {/* Quick-start address capture — hidden once the wizard takes over */}
                {!wizardStarted && (
                <div className="bg-white rounded-2xl p-4 md:p-5 shadow-2xl grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                  <div className="text-slate-900">
                    <AddressAutocomplete
                      value={fromAddress}
                      allowBranchSelection={Boolean(policy?.branchMovesEnabled && policy?.outOfStorageEnabled)}
                      onChange={(value) => setFromAddress(value)}
                      selectedBranch={fromBranch}
                      disabled={Boolean(fromBranch)}
                      onBranchSelect={setFromBranch}
                      onClearSelection={() => { setFromBranch(null); setFromAddress(""); }}
                      placeholder={t("Origen", "From")}
                      className="h-12 bg-slate-50"
                      data-testid="input-hero-from"
                    />
                  </div>
                  <div className="text-slate-900">
                    <AddressAutocomplete
                      value={toAddress}
                      allowBranchSelection={Boolean(policy?.branchMovesEnabled && policy?.intoStorageEnabled)}
                      onChange={(value) => setToAddress(value)}
                      selectedBranch={toBranch}
                      disabled={Boolean(toBranch)}
                      onBranchSelect={setToBranch}
                      onClearSelection={() => { setToBranch(null); setToAddress(""); }}
                      placeholder={t("Destino", "To")}
                      className="h-12 bg-slate-50"
                      data-testid="input-hero-to"
                    />
                  </div>
                  <Button
                    onClick={scrollToWizard}
                    className="h-12 px-8 font-bold text-white"
                    style={{ backgroundColor: SECONDARY }}
                    data-testid="button-hero-quote"
                  >
                    {t("Cotizar mudanza + bodega", "Quote moving + storage")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm text-white/70">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: SECONDARY }} />
                    {t("Sin costo ni compromiso", "No cost, no commitment")}
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: SECONDARY }} />
                    {t("Estimado en minutos", "Estimate in minutes")}
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: SECONDARY }} />
                    {t("Equipos verificados", "Verified crews")}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Wizard — continues the experience right where the quick-start bar was */}
          {wizardStarted && (
            <section
              ref={wizardRef}
              className="container px-2 sm:px-4 md:px-6 py-14 scroll-mt-20"
            >
              <div className="text-center mb-8">
                <h2
                  className="text-3xl md:text-4xl font-black mb-3"
                  style={{ color: PRIMARY }}
                >
                  {t("Cotiza tu mudanza", "Quote your move")}
                </h2>
                <p className="text-slate-500 max-w-xl mx-auto">
                  {t(
                    "Completa los datos y recibe un estimado inicial en minutos.",
                    "Fill in the details and get an initial estimate in minutes.",
                  )}
                </p>
              </div>
              <div className="max-w-4xl mx-auto">
                {isSubmitting && (
                  <div className="text-center text-sm text-slate-500 mb-4">
                    {t("Enviando tu cotización…", "Submitting your quote…")}
                  </div>
                )}
                <QuoteWizard
                  skipAccountStep={isAuthenticated}
                  onSubmit={handleSubmit}
                  onStepChange={handleStepChange}
                  initialFromAddress={fromAddress}
                  initialToAddress={toAddress}
                  initialFromBranchId={fromBranch?.id}
                  initialToBranchId={toBranch?.id}
                  initialContactName={user?.fullName || ""}
                  initialContactEmail={user?.email || ""}
                  partnerTheme={theme}
                />
              </div>
            </section>
          )}

          {/* Benefits */}
          <section className="container px-4 md:px-6 py-14">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm"
                  data-testid={`card-benefit-${i}`}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${PRIMARY}12` }}
                  >
                    <b.icon className="h-6 w-6" style={{ color: PRIMARY }} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{b.title}</h3>
                  <p className="text-sm text-slate-500">{b.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="container px-4 md:px-6 pb-4">
            <div className="text-center mb-10">
              <h2
                className="text-3xl md:text-4xl font-black mb-3"
                style={{ color: PRIMARY }}
              >
                {t("Así de fácil", "This easy")}
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                {t(
                  "Tres pasos para cotizar tu mudanza y bodega.",
                  "Three steps to quote your move and storage.",
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white mb-4"
                    style={{ backgroundColor: SECONDARY }}
                  >
                    {s.num}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer — only when standalone; the host page has its own footer */}
          {!embedded && (
          <footer className="text-white py-10" style={{ backgroundColor: SECONDARY }}>
            <div className="container px-4 md:px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {theme.logo && (
                    <img
                      src={theme.logo}
                      alt="U-Storage Go"
                      className="h-7 object-contain"
                    />
                  )}
                </div>
                <p className="text-sm text-white/60 text-center">
                  © {new Date().getFullYear()}{" "}
                  {t(
                    "U-Storage Go. Movemos lo que valoras, cuidamos lo que importa.",
                    "U-Storage Go. We move what you value, we care for what matters.",
                  )}
                </p>
              </div>
            </div>
          </footer>
          )}
        </>
      )}
    </div>
  );
}

function SuccessScreen({
  isSpanish,
  onReset,
  onDashboard,
}: {
  isSpanish: boolean;
  onReset: () => void;
  onDashboard?: () => void;
}) {
  const t = (es: string, en: string) => (isSpanish ? es : en);
  return (
    <section className="container px-4 md:px-6 py-20">
      <div className="max-w-lg mx-auto text-center bg-white rounded-3xl p-10 border border-slate-100 shadow-sm">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${SECONDARY}18` }}
        >
          <CheckCircle2 className="h-9 w-9" style={{ color: SECONDARY }} />
        </div>
        <h2 className="text-2xl font-black mb-3" style={{ color: PRIMARY }}>
          {t("¡Cotización enviada!", "Quote submitted!")}
        </h2>
        <p className="text-slate-500 mb-8">
          {t(
            "Recibimos tu solicitud. Un asesor de U-Storage Go se pondrá en contacto contigo muy pronto para agendar tu mudanza.",
            "We received your request. A U-Storage Go advisor will reach out shortly to schedule your move.",
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={onReset}
            className="font-bold text-white"
            style={{ backgroundColor: SECONDARY }}
            data-testid="button-new-quote"
          >
            {t("Nueva cotización", "New quote")}
          </Button>
          {onDashboard && (
            <Button
              variant="outline"
              onClick={onDashboard}
              data-testid="button-go-dashboard"
            >
              {t("Ver mi panel", "View my dashboard")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
