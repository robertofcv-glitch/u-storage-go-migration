import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Loader2, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuoteWizard, type QuoteFormData } from "@/components/quote/QuoteWizard";
import { useToast } from "@/hooks/use-toast";

type Customer = { id: string; fullName?: string | null; name?: string | null; email?: string | null; phone?: string | null };
type Draft = { id: string; customer?: Customer | null; customerName?: string; customerEmail?: string; customerPhone?: string; status?: string; assistedSessionId?: string };

const clearQuoteSession = () => {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith("ruku_quote_session_id") || key.startsWith("ruku_partial_quote_") || key.startsWith("ruku_assisted_quote_session_id_") || key.startsWith("ruku_customer_") || key.startsWith("assisted_customer_")) sessionStorage.removeItem(key);
  }
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Request failed");
  return body;
}

export default function AdminAssistedQuote() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams<{ draftId?: string }>();
  const { toast } = useToast();
  const isSpanish = i18n.language.startsWith("es");
  const isResume = Boolean(params.draftId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [searched, setSearched] = useState(false);
  const [continueAsNew, setContinueAsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(isResume);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.draftId) {
      clearQuoteSession();
      return;
    }
     jsonRequest(`/api/admin/assisted-quotes/drafts/${params.draftId}/resume`, { method: "POST" }).then((data) => {
      const value = data.quote || data.draft || data;
      setDraft(value);
      setName(value.customerName || value.customer?.fullName || value.customer?.name || "");
      setPhone(value.customerPhone || value.customer?.phone || "");
      setEmail(value.customerEmail || value.customer?.email || "");
      setSelected(value.customer || null);
    }).catch(() => setError(isSpanish ? "No pudimos cargar este borrador." : "We couldn't load this draft."));
  }, [params.draftId, isSpanish]);

  const identityReady = name.trim().length >= 2 && (phone.trim().length > 0 || email.trim().length > 0);
  const exactMatch = useMemo(() => matches.find((customer) =>
    (email && customer.email?.toLowerCase() === email.trim().toLowerCase()) ||
    (phone && customer.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""))
  ), [matches, email, phone]);

  const searchCustomers = async () => {
    if (search.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      const data = await jsonRequest(`/api/admin/assisted-quotes/customers?q=${encodeURIComponent(search.trim())}`);
      setMatches(data.customers || data.results || []);
      setSearched(true);
    } catch { setError(isSpanish ? "La búsqueda de clientes está protegida o no disponible." : "Customer search is protected or unavailable."); }
    finally { setBusy(false); }
  };

  const begin = async () => {
    if (!identityReady) return;
    setBusy(true); setError("");
    try {
      if (!selected && !continueAsNew) {
        const query = new URLSearchParams();
        if (email.trim()) query.set("email", email.trim());
        if (phone.trim()) query.set("phone", phone.trim());
        const duplicateData = await jsonRequest(`/api/admin/assisted-quotes/customers?${query.toString()}`);
        const exactCustomers = duplicateData.exactMatches || [];
        if (exactCustomers.length > 0) {
          setMatches(exactCustomers);
          setSearched(true);
          setBusy(false);
          return;
        }
      }
       const data = await jsonRequest("/api/admin/assisted-quotes/drafts", {
        method: "POST",
         body: JSON.stringify({ customerId: selected?.id, customerName: name.trim(), customerPhone: phone.trim() || undefined, customerEmail: email.trim() || undefined, confirmNewLead: continueAsNew }),
      });
      const value = data.quote || data.draft || data;
      setDraft(value);
      setStarted(true);
      clearQuoteSession();
    } catch (caught) {
      const fallback = isSpanish ? "No pudimos crear el borrador. Intenta de nuevo." : "We couldn't create the draft. Try again.";
      setError(caught instanceof Error && caught.message !== "Request failed" ? caught.message : fallback);
    }
    finally { setBusy(false); }
  };

  const finish = async (data: QuoteFormData) => {
    if (!draft?.id) return;
    setBusy(true);
    try {
       await jsonRequest(`/api/admin/assisted-quotes/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify(data) });
       await jsonRequest(`/api/admin/assisted-quotes/drafts/${draft.id}/finalize`, { method: "POST" });
      clearQuoteSession();
      toast({
        title: isSpanish ? "Cotización creada" : "Quote created",
        description: isSpanish
          ? "La cotización se guardó correctamente y ya aparece en Cotizaciones."
          : "The quote was saved successfully and now appears in Quotes.",
      });
      setLocation("/admin/dashboard/quotes");
    } catch {
      const message = isSpanish ? "No pudimos finalizar la cotización." : "We couldn't finalize the quote.";
      setError(message);
      toast({
        variant: "destructive",
        title: isSpanish ? "No se creó la cotización" : "Quote not created",
        description: message,
      });
    }
    finally { setBusy(false); }
  };

  if (started && draft) return (
    <div className="workspace-page space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/admin/dashboard/quotes")}><ArrowLeft className="mr-2 h-4 w-4" />{isSpanish ? "Cotizaciones" : "Quotes"}</Button>
        <Badge className="bg-[#4e2069]">{isSpanish ? "Asistida" : "Assisted"}</Badge>
      </div>
      <div className="rounded-2xl bg-[#4e2069] p-5 text-[#fbf9f6] shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ffb27d]">{isSpanish ? "Sesión de ventas" : "Sales session"}</p>
        <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-[#eadff0]">{phone || email} · {isSpanish ? "Borrador guardado automáticamente" : "Draft saves automatically"}</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
       <QuoteWizard skipAccountStep assistedMode assistedSessionId={draft.id} initialDraftData={draft} initialContactName={name} initialContactPhone={phone} initialContactEmail={email} onSubmit={finish} onCancel={() => setLocation("/admin/dashboard/quotes")} />
      {busy && <div className="fixed bottom-5 right-5 rounded-full bg-[#24152e] px-4 py-2 text-sm text-white"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{isSpanish ? "Guardando…" : "Saving…"}</div>}
    </div>
  );

  return (
    <div className="workspace-page max-w-4xl space-y-6">
      <Button variant="ghost" onClick={() => setLocation("/admin/dashboard/quotes")}><ArrowLeft className="mr-2 h-4 w-4" />{isSpanish ? "Cotizaciones" : "Quotes"}</Button>
      <div className="workspace-hero"><p className="workspace-kicker text-[#ffb27d]">{isSpanish ? "Ventas / Sales" : "Sales workspace"}</p><h1 className="mt-2 text-3xl">{isSpanish ? "Crear cotización asistida" : "Create assisted quote"}</h1><p className="mt-2 max-w-xl text-sm text-[#eadff0]">{isSpanish ? "Primero identifica al cliente. Después completa la misma ruta, inventario y estimado que ya conoce tu equipo." : "Identify the customer first, then complete the same route, inventory and estimate journey your team already knows."}</p></div>
      <Card className="workspace-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#4e2069]" />{isSpanish ? "Identidad del cliente" : "Customer identity"}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">{isSpanish ? "Nombre completo" : "Full name"} *<Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isSpanish ? "Nombre y apellido" : "Name and surname"} /></label>
            <label className="space-y-1 text-sm font-medium">{isSpanish ? "Teléfono" : "Phone"}<Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52 55..." /></label>
            <label className="space-y-1 text-sm font-medium">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@correo.com" /></label>
          </div>
          <div className="border-t pt-5">
            <p className="mb-2 text-sm font-semibold">{isSpanish ? "Buscar cliente existente (opcional)" : "Search existing customer (optional)"}</p>
            <div className="flex gap-2"><Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchCustomers()} placeholder={isSpanish ? "Teléfono, email o nombre" : "Phone, email or name"} /><Button variant="outline" onClick={searchCustomers} disabled={busy || search.trim().length < 3}><Search className="mr-2 h-4 w-4" />{isSpanish ? "Buscar" : "Search"}</Button></div>
            {searched && <div className="mt-3 space-y-2">{matches.length === 0 ? <p className="text-sm text-muted-foreground">{isSpanish ? "Sin coincidencias exactas." : "No exact matches."}</p> : matches.map((customer) => <button type="button" key={customer.id} onClick={() => { setSelected(customer); setName(customer.fullName || customer.name || ""); setPhone(customer.phone || ""); setEmail(customer.email || ""); }} className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${selected?.id === customer.id ? "border-[#ff6c00] bg-[#fff1e6]" : "hover:bg-muted"}`}><span><strong>{customer.fullName || customer.name || "Customer"}</strong><span className="ml-3 text-sm text-muted-foreground">{customer.phone || customer.email}</span></span>{selected?.id === customer.id && <Check className="h-4 w-4 text-[#4e2069]" />}</button>)}</div>}
            {exactMatch && !selected && !continueAsNew && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{isSpanish ? "Encontramos una coincidencia exacta. Asocia este cliente o confirma que deseas registrar un prospecto separado." : "We found an exact match. Associate this customer or confirm that you want a separate lead."}<div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { setSelected(exactMatch); setContinueAsNew(false); setName(exactMatch.fullName || exactMatch.name || name); setPhone(exactMatch.phone || phone); setEmail(exactMatch.email || email); }}>{isSpanish ? "Asociar cliente" : "Associate customer"}</Button><Button size="sm" variant="outline" onClick={() => setContinueAsNew(true)}>{isSpanish ? "Crear prospecto separado" : "Create separate lead"}</Button></div></div>}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button onClick={begin} disabled={!identityReady || busy} className="bg-[#ff6c00] text-[#24152e] hover:bg-[#e85f00]"><UserPlus className="mr-2 h-4 w-4" />{isSpanish ? "Empezar cotización" : "Start quote"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}