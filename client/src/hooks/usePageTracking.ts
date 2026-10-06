import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { getAttribution } from '@/lib/attribution';

const SESSION_ID_KEY = 'ruku_session_id';

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function isDashboardRoute(path: string): boolean {
  return path.includes('/dashboard') || path.includes('/admin/dashboard') || path.includes('/mover/dashboard');
}

async function trackPageView(path: string, locale: string): Promise<void> {
  if (isDashboardRoute(path)) return;
  
  const attribution = getAttribution();
  const sessionId = getOrCreateSessionId();
  
  try {
    await fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        pagePath: path,
        pageTitle: document.title,
        locale,
        utmSource: attribution?.utmSource,
        utmMedium: attribution?.utmMedium,
        utmCampaign: attribution?.utmCampaign,
        utmTerm: attribution?.utmTerm,
        utmContent: attribution?.utmContent,
        partner: attribution?.partner,
        referrerUrl: attribution?.referrerUrl || document.referrer,
        sessionId,
      }),
    });
  } catch {
  }
}

export function usePageTracking(locale: string = 'es'): void {
  const [location] = useLocation();
  const lastTrackedPath = useRef<string>('');
  
  useEffect(() => {
    if (location !== lastTrackedPath.current) {
      lastTrackedPath.current = location;
      const timer = setTimeout(() => {
        trackPageView(location, locale);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location, locale]);
}
