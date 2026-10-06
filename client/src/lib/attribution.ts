const ATTRIBUTION_KEY = 'ruku_attribution';
const ATTRIBUTION_TTL_DAYS = 30;

export interface AttributionData {
  partner?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrerUrl?: string;
  capturedAt: number;
}

export function captureAttribution(): void {
  const params = new URLSearchParams(window.location.search);
  const existing = getAttribution();
  
  const newPartner = params.get('partner') || undefined;
  const newUtmSource = params.get('utm_source') || undefined;
  const newUtmMedium = params.get('utm_medium') || undefined;
  const newUtmCampaign = params.get('utm_campaign') || undefined;
  const newUtmTerm = params.get('utm_term') || undefined;
  const newUtmContent = params.get('utm_content') || undefined;
  
  const hasNewUtmData = newUtmSource || newUtmMedium || newUtmCampaign || newUtmTerm || newUtmContent;
  
  const fullLandingUrl = window.location.pathname + window.location.search;
  
  const attribution: AttributionData = {
    partner: newPartner ?? existing?.partner,
    utmSource: newUtmSource ?? existing?.utmSource,
    utmMedium: newUtmMedium ?? existing?.utmMedium,
    utmCampaign: newUtmCampaign ?? existing?.utmCampaign,
    utmTerm: newUtmTerm ?? existing?.utmTerm,
    utmContent: newUtmContent ?? existing?.utmContent,
    landingPage: existing?.landingPage || fullLandingUrl,
    referrerUrl: existing?.referrerUrl || document.referrer || undefined,
    capturedAt: hasNewUtmData ? Date.now() : (existing?.capturedAt || Date.now()),
  };
  
  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
}

export function getAttribution(): AttributionData | null {
  try {
    const stored = localStorage.getItem(ATTRIBUTION_KEY);
    if (!stored) return null;
    
    const attribution: AttributionData = JSON.parse(stored);
    
    const ttlMs = ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - attribution.capturedAt > ttlMs) {
      localStorage.removeItem(ATTRIBUTION_KEY);
      return null;
    }
    
    return attribution;
  } catch {
    return null;
  }
}

/**
 * Merge attribution params received out-of-band (e.g. via postMessage from a
 * host page embedding the widget in an iframe). Accepts either raw query-string
 * keys (`utm_source`, `partner`) or the camelCase equivalents. Existing values
 * are preserved when a param is not present.
 */
export function mergeAttributionParams(
  params: Record<string, string | undefined>,
): void {
  if (!params || typeof params !== "object") return;

  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = params[key];
      if (value) return value;
    }
    return undefined;
  };

  const existing = getAttribution();
  const fullLandingUrl = window.location.pathname + window.location.search;

  const newPartner = pick("partner");
  const newUtmSource = pick("utm_source", "utmSource");
  const newUtmMedium = pick("utm_medium", "utmMedium");
  const newUtmCampaign = pick("utm_campaign", "utmCampaign");
  const newUtmTerm = pick("utm_term", "utmTerm");
  const newUtmContent = pick("utm_content", "utmContent");

  const hasNewUtmData =
    newUtmSource || newUtmMedium || newUtmCampaign || newUtmTerm || newUtmContent;

  if (!newPartner && !hasNewUtmData) return;

  const attribution: AttributionData = {
    partner: newPartner ?? existing?.partner,
    utmSource: newUtmSource ?? existing?.utmSource,
    utmMedium: newUtmMedium ?? existing?.utmMedium,
    utmCampaign: newUtmCampaign ?? existing?.utmCampaign,
    utmTerm: newUtmTerm ?? existing?.utmTerm,
    utmContent: newUtmContent ?? existing?.utmContent,
    landingPage: existing?.landingPage || fullLandingUrl,
    referrerUrl: existing?.referrerUrl || document.referrer || undefined,
    capturedAt: hasNewUtmData ? Date.now() : existing?.capturedAt || Date.now(),
  };

  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
}

export function updateAttributionPartner(partner: string): void {
  const existing = getAttribution();
  if (existing) {
    existing.partner = partner;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(existing));
  } else {
    const fullLandingUrl = window.location.pathname + window.location.search;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({
      partner,
      landingPage: fullLandingUrl,
      capturedAt: Date.now(),
    }));
  }
}

export function clearAttribution(): void {
  localStorage.removeItem(ATTRIBUTION_KEY);
}
