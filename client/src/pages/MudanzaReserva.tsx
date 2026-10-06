import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { QuoteWizard, type QuoteFormData, type ReservationContext } from "@/components/quote/QuoteWizard";
import { captureAttribution, mergeAttributionParams } from "@/lib/attribution";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type ExchangeState = "loading" | "ready" | "manual" | "submitted";

function safeDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 14);
  return date >= today && date <= max ? value : "";
}

export default function MudanzaReserva() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [state, setState] = useState<ExchangeState>("loading");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<ReservationContext | undefined>();
  const [manualUnitCode, setManualUnitCode] = useState("");
  const [manualUnitSize, setManualUnitSize] = useState("");
  const [manualRentalStart, setManualRentalStart] = useState("");
  const [, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const quoteSessionId = useMemo(() => {
    const key = "ruku_reservation_quote_session_id";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `reservation_qs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
    return id;
  }, []);

  const track = (event: string, extra: Record<string, unknown> = {}) => {
    fetch("/api/ustorage/reservations/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ event, ...extra }),
    }).catch(() => undefined);
  };

  const exchange = async () => {
    const token = params.get("t");
    if (!token) {
      setMessage("missing");
      setState("manual");
      track("manual_started", { tokenState: "none" });
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/ustorage/reservations/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: token, quoteSessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status === "invalid" || data.status === "expired" || data.status === "used" || data.status === "unavailable" || data.status === "partial") {
        setMessage(data.status || (response.status === 410 ? "expired" : "unavailable"));
        setState("manual");
        track("exchange_failed", { tokenState: data.status || "unavailable" });
        return;
      }
      const reservation = data.reservation || data;
      const branch = reservation.destinationBranch || reservation.branch || {};
      const unit = reservation.unit || reservation.unitContext || {};
      const contact = reservation.contact || {};
      setContext({
        confirmed: data.status === "confirmed" || data.confirmed === true || reservation.confirmed === true || Array.isArray(data.verifiedFields),
        destinationBranch: {
          id: data.destinationBranchId || data.branchId || branch.id || branch.branchId,
          name: data.destinationBranchName || data.branchName || branch.name || branch.label,
          address: data.destinationBranchAddress || data.branchAddress || branch.address,
        },
        unit: {
          code: data.unitCode || unit.code || unit.unitCode,
          name: data.unitName || unit.name || unit.label,
          usableSizeM2: Number(data.unitSizeM2 || unit.usableSizeM2 || unit.sizeM2) || undefined,
          capacityM3: Number(data.unitCapacityM3 || unit.capacityM3 || unit.capacity) || undefined,
        },
        rentalStart: safeDate(data.rentalStart || reservation.rentalStart || reservation.startDate),
        claim: data.claim || reservation.claim,
        exchangeId: data.exchangeId || reservation.exchangeId || data.claim || reservation.claim,
        provenance: data.provenance || reservation.provenance,
        campaign: "reserva-confirmada",
        contact: {
          name: data.customerName || contact.name || reservation.contactName,
          email: data.customerEmail || contact.email || reservation.contactEmail,
          phone: data.customerPhone || contact.phone || reservation.contactPhone,
        },
      });
      if (typeof data.locale === "string" && /^(es|en)(-|$)/i.test(data.locale)) {
        i18n.changeLanguage(data.locale.toLowerCase().startsWith("en") ? "en" : "es");
      }
      setState("ready");
      track("exchange_confirmed", { tokenState: "confirmed", verified: true });
    } catch {
      setMessage("unavailable");
      setState("manual");
      track("exchange_failed", { tokenState: "unavailable" });
    }
  };

  useEffect(() => {
    // Remove the opaque code and any unexpected parameters before attribution
    // captures the landing URL. The memoized params retain the code only long
    // enough for the server exchange.
    const safeParams = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "lang", "variant"]) {
      const value = params.get(key);
      if (value) safeParams.set(key, value);
    }
    const safeSearch = safeParams.toString();
    window.history.replaceState({}, "", `/mudanza/reserva${safeSearch ? `?${safeSearch}` : ""}`);
    captureAttribution();
    mergeAttributionParams({
      partner: "u-storage",
      utm_campaign: "reserva-confirmada",
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_term: params.get("utm_term") || undefined,
      utm_content: params.get("utm_content") || undefined,
    });
    track("arrival", { tokenState: params.has("t") ? "confirmed" : "none" });
    exchange();
  }, []); // token is intentionally read once for this landing session

  const branchId = context?.destinationBranch?.id;
  const branchAddress = context?.destinationBranch?.address || "";
  const branchName = context?.destinationBranch?.name || "";
  const manualContext: ReservationContext | undefined = state === "ready" ? context : {
    unit: { code: manualUnitCode || undefined, usableSizeM2: Number(manualUnitSize) || undefined },
    rentalStart: safeDate(manualRentalStart) || undefined,
    campaign: "reserva-confirmada",
  };

  const cleanup = () => {
    sessionStorage.removeItem(`ruku_partial_quote_${quoteSessionId}`);
    sessionStorage.removeItem("ruku_reservation_quote_session_id");
  };
  const finish = async (data: QuoteFormData) => {
    setIsSubmitting(true);
    try {
      if (data.partialQuoteId) {
        if (!isAuthenticated) {
          const register = await fetch("/api/auth/register", {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({
              email: data.email, password: data.password, fullName: data.name || data.contactName,
              userType: "client", phone: data.contactPhone, quoteSessionId,
            }),
          });
          if (!register.ok) {
            const error = await register.json().catch(() => ({}));
            throw new Error(error.message || "No pudimos crear tu cuenta.");
          }
        }
        const link = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ isPartial: false, partner: "u-storage", quoteSessionId }),
        });
        if (!link.ok) {
          const error = await link.json().catch(() => ({}));
          throw new Error(error.message || "No pudimos finalizar la cotización.");
        }
      } else throw new Error("No encontramos tu cotización. Intenta de nuevo.");
      cleanup();
      toast({ title: "¡Cotización enviada!", description: "Nuestro equipo revisará tu mudanza y te contactará pronto." });
      track("quote_submitted", { verified: context?.confirmed === true });
      setState("submitted");
    } catch (error) {
      toast({ title: "No pudimos enviar la cotización", description: error instanceof Error ? error.message : "Intenta de nuevo.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        {state !== "submitted" && (
          <section className="mx-auto mb-6 max-w-4xl rounded-3xl bg-[#351d3d] px-6 py-8 text-white shadow-sm md:px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#ffb273]">U-Storage Go</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Tu bodega está lista. Ahora llevemos tus cosas.</h1>
            <p className="mt-3 max-w-2xl text-white/80">Cotiza el traslado hacia tu sucursal U-Storage. Si recibimos datos verificados de tu reserva, los encontrarás precargados; cualquier dato faltante se puede completar aquí.</p>
          </section>
        )}
        {state === "loading" && (
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
            <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-[#4E2069]" />
            <h1 className="text-xl font-semibold text-slate-900">Preparando tu cotización</h1>
            <p className="mt-2 text-sm text-slate-600">Estamos verificando tu reserva de U-Storage.</p>
          </div>
        )}
        {state === "manual" && message !== "missing" && (
          <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h1 className="font-semibold">No pudimos confirmar el enlace</h1>
                <p className="mt-1 text-sm">No pasa nada: puedes continuar manualmente. Completa la sucursal, unidad, fecha y contacto para preparar tu cotización.</p>
                <button onClick={exchange} className="mt-3 inline-flex items-center text-sm font-semibold underline"><RefreshCw className="mr-1 h-4 w-4" />Intentar de nuevo</button>
              </div>
            </div>
          </div>
        )}
        {state === "submitted" && (
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
            <h1 className="text-2xl font-semibold">Recibimos tu información</h1>
            <p className="mt-2 text-sm text-slate-600">Nuestro equipo revisará tu mudanza y te contactará pronto.</p>
            <Link href="/" className="mt-5 inline-block font-semibold text-[#4E2069] underline">Volver al inicio</Link>
          </div>
        )}
        {(state === "ready" || state === "manual") && (
          <>
          {state === "manual" && (
            <section className="mx-auto mb-6 max-w-3xl rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Contexto de tu reserva</h2>
              <p className="mt-1 text-sm text-slate-600">Estos datos son orientativos y editables. La sucursal se verifica dentro de la cotización.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium">Código de unidad<input value={manualUnitCode} onChange={e => setManualUnitCode(e.target.value)} className="mt-1 w-full rounded-md border p-2 font-normal" /></label>
                <label className="text-sm font-medium">Tamaño (m²)<input value={manualUnitSize} onChange={e => setManualUnitSize(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border p-2 font-normal" /></label>
                <label className="text-sm font-medium">Inicio de renta<input type="date" min={new Date().toISOString().slice(0, 10)} value={manualRentalStart} onChange={e => setManualRentalStart(e.target.value)} className="mt-1 w-full rounded-md border p-2 font-normal" /></label>
              </div>
              <p className="mt-3 text-xs text-slate-500">Puedes acceder desde el inicio de renta; coordinaremos la entrega de tu mudanza por separado.</p>
            </section>
          )}
          <QuoteWizard
            onSubmit={finish}
            onStepChange={(step) => {
              if (step > 1) track("step_completed", { step: step - 1, verified: context?.confirmed === true });
            }}
            skipAccountStep={isAuthenticated}
            quoteSessionId={quoteSessionId}
            initialToAddress={branchAddress || branchName}
            initialToBranchId={branchId}
            initialContactName={context?.contact?.name || ""}
            initialContactEmail={context?.contact?.email || ""}
            initialContactPhone={context?.contact?.phone || ""}
            reservationContext={manualContext}
          />
          </>
        )}
      </main>
    </div>
  );
}