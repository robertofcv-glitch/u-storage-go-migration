import { Navbar } from "@/components/layout/Navbar";
import { QuoteWizard, QuoteFormData } from "@/components/quote/QuoteWizard";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { captureAttribution } from "@/lib/attribution";
import { useAuth } from "@/hooks/useAuth";
import { PARTNER_THEMES } from "@/lib/partnerThemes";
import { SEO, structuredData } from "@/components/SEO";

export default function Quote() {
  const { t, i18n } = useTranslation();
  const [_, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const isSpanish = i18n.language === "es";
  
  const params = new URLSearchParams(window.location.search);
  const partner = params.get('partner');
  const partnerTheme = partner ? PARTNER_THEMES[partner] : undefined;

  useEffect(() => {
    captureAttribution();
  }, []);

  // Helper to clean up quote session storage after successful submission
  const cleanupQuoteSession = () => {
    const sessionId = sessionStorage.getItem('ruku_quote_session_id');
    if (sessionId) {
      sessionStorage.removeItem(`ruku_partial_quote_${sessionId}`);
      sessionStorage.removeItem('ruku_quote_session_id');
    }
  };

  const handleLoggedInSubmit = async (data: QuoteFormData) => {
    setIsSubmitting(true);
    
    try {
      if (data.partialQuoteId) {
        const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
        const linkResponse = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            isPartial: false,
            partner: partner || undefined,
            quoteSessionId: quoteSessionId || undefined,
          }),
        });

        if (!linkResponse.ok) {
          const error = await linkResponse.json();
          throw new Error(error.message || (isSpanish ? 'Error al vincular la cotización' : 'Failed to link quote'));
        }
      } else {
        // For logged-in users, we should always have a partialQuoteId from the wizard
        // If missing, log an error and throw - don't create a duplicate quote
        console.error('[Quote] Missing partialQuoteId for logged-in user submission. This indicates a state management issue.');
        throw new Error(isSpanish 
          ? 'Error interno: no se encontró la cotización. Por favor intenta de nuevo.' 
          : 'Internal error: quote not found. Please try again.');
      }

      // Clean up session storage after successful submission
      cleanupQuoteSession();

      toast({
        title: isSpanish ? "¡Cotización enviada!" : "Quote submitted!",
        description: isSpanish 
          ? "Tu cotización ha sido enviada. Puedes verla en tu panel." 
          : "Your quote has been submitted. You can view it in your dashboard.",
      });

      setLocation('/dashboard');
    } catch (error: any) {
      toast({
        title: isSpanish ? "Error" : "Error",
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
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.name || data.contactName,
          userType: 'client',
          phone: data.contactPhone,
          quoteSessionId: quoteSessionIdForRegister || undefined,
        }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(error.message || (isSpanish ? 'Error al crear la cuenta' : 'Failed to create account'));
      }

      if (data.partialQuoteId) {
        const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
        const linkResponse = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            isPartial: false,
            partner: partner || undefined,
            quoteSessionId: quoteSessionId || undefined,
          }),
        });

        if (!linkResponse.ok) {
          const error = await linkResponse.json();
          throw new Error(error.message || (isSpanish ? 'Error al vincular la cotización' : 'Failed to link quote'));
        }
      } else {
        // For guest users, we should also have a partialQuoteId from the wizard (created at contact step)
        // If missing, log an error and throw - don't create a duplicate quote
        console.error('[Quote] Missing partialQuoteId for guest user submission. This indicates a state management issue.');
        throw new Error(isSpanish 
          ? 'Error interno: no se encontró la cotización. Por favor intenta de nuevo.' 
          : 'Internal error: quote not found. Please try again.');
      }

      // Clean up session storage after successful submission
      cleanupQuoteSession();

      toast({
        title: isSpanish ? "¡Cuenta creada!" : "Account created!",
        description: isSpanish 
          ? "Tu cuenta ha sido creada y tu cotización enviada." 
          : "Your account has been created and quote submitted.",
      });

      setLocation('/dashboard');
    } catch (error: any) {
      toast({
        title: isSpanish ? "Error" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = isAuthenticated ? handleLoggedInSubmit : handleGuestSubmit;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#4E2069] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">{isSpanish ? 'Cargando...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (partnerTheme) {
    return (
      <div className="min-h-[100dvh] font-sans pb-20 bg-[#FBF9F6]">
        {/* Partner-branded header */}
        <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            <Link href="/u-storage" className="flex items-center gap-3">
              {partnerTheme.logo && (
                <img src={partnerTheme.logo} alt={partnerTheme.name} className="h-8 object-contain" />
              )}
              <span className="text-sm text-slate-400 hidden sm:inline">×</span>
              <img src="/logo.png" alt="U-Storage Go" className="h-6 w-auto object-contain hidden sm:inline" />
            </Link>
            
            <div className="text-center flex-1">
              <span className="text-sm font-medium" style={{ color: partnerTheme.primaryColor }}>
                {partnerTheme.headerText}
              </span>
            </div>

            <Link href="/u-storage" className="text-sm text-slate-500 hover:text-slate-700">
              {isSpanish ? 'Volver' : 'Back'}
            </Link>
          </div>
        </header>
        
        <div className="w-full px-4 md:px-8 lg:px-12 pt-12">
          <QuoteWizard
            skipAccountStep={isAuthenticated}
            onSubmit={handleSubmit}
            initialFromAddress={params.get('from') || ""}
            initialToAddress={params.get('to') || ""}
            initialFromBranchId={params.get('fromBranchId') || undefined}
            initialToBranchId={params.get('toBranchId') || undefined}
            initialContactName={user?.fullName || ""}
            initialContactEmail={user?.email || ""}
            partnerTheme={partnerTheme}
          />
        </div>
      </div>
    );
  }

  const quoteFaqs = [
    {
      question: isSpanish ? "¿Cómo funciona la cotización?" : "How does the quote work?",
      answer: isSpanish 
         ? "Selecciona una sucursal U-Storage oficial como origen o destino, agrega tus detalles y recibe un estimado inicial."
         : "Select an official U-Storage branch as your origin or destination, add your details, and receive an initial estimate."
    },
    {
      question: isSpanish ? "¿Cuánto cuesta una mudanza?" : "How much does a move cost?",
      answer: isSpanish
        ? "El costo depende del volumen de artículos, la distancia y servicios adicionales como empaque o almacenamiento."
        : "The cost depends on the volume of items, distance, and additional services like packing or storage."
    },
    {
      question: isSpanish ? "¿Quién realiza mi mudanza?" : "Who performs my move?",
      answer: isSpanish
        ? "Tu mudanza la realizan los equipos propios de U-Storage Go: personal capacitado, identificado y asegurado, con camiones propios."
        : "Your move is carried out by U-Storage Go's own crews: trained, identified, and insured staff using our own trucks."
    }
  ];

  return (
    <div className="min-h-[100dvh] bg-[#FBF9F6] font-sans pb-20">
      <SEO
        title={isSpanish ? "Cotización de Mudanza" : "Moving Quote"}
        description={isSpanish 
          ? "Obtén una cotización instantánea para tu mudanza con U-Storage Go. Precios transparentes y agenda tu mudanza fácilmente."
          : "Get an instant quote for your move with U-Storage Go. Transparent pricing and easy scheduling."}
        structuredData={structuredData.faqPage(quoteFaqs)}
      />
      <Navbar />
      
      <div className="w-full px-4 md:px-8 lg:px-12 pt-12">
        <QuoteWizard
          skipAccountStep={isAuthenticated}
          onSubmit={handleSubmit}
          initialFromAddress={params.get('from') || ""}
          initialToAddress={params.get('to') || ""}
          initialFromBranchId={params.get('fromBranchId') || undefined}
          initialToBranchId={params.get('toBranchId') || undefined}
          initialContactName={user?.fullName || ""}
          initialContactEmail={user?.email || ""}
        />
      </div>
    </div>
  );
}
