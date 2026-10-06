import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { es, enUS } from 'date-fns/locale';

export const TIMEZONE_CONFIG = {
  DEFAULT_TIMEZONE: 'America/Mexico_City',
} as const;

export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getTimezoneName(timezone: string, locale?: 'en' | 'es'): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      timeZone: timezone,
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(new Date());
    const namePart = parts.find(p => p.type === 'timeZoneName');
    return namePart?.value || timezone;
  } catch {
    return timezone;
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export interface TimezoneContext {
  timezone: string;
  locale: 'en' | 'es';
}

const getLocale = (lang: 'en' | 'es') => (lang === 'es' ? es : enUS);

export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string,
  options?: { timezone?: string; locale?: 'en' | 'es' }
): string {
  if (!date) return '';
  
  const timezone = options?.timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE;
  const locale = getLocale(options?.locale || 'es');
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  return formatInTimeZone(dateObj, timezone, formatStr, { locale });
}

export function formatDateTime(
  date: Date | string | null | undefined,
  options?: { timezone?: string; locale?: 'en' | 'es'; includeTime?: boolean }
): string {
  if (!date) return '';
  
  const includeTime = options?.includeTime ?? true;
  const formatStr = includeTime ? 'PPP p' : 'PPP';
  
  return formatDate(date, formatStr, options);
}

export function formatShortDate(
  date: Date | string | null | undefined,
  options?: { timezone?: string; locale?: 'en' | 'es' }
): string {
  return formatDate(date, 'dd/MM/yyyy', options);
}

export function formatShortDateTime(
  date: Date | string | null | undefined,
  options?: { timezone?: string; locale?: 'en' | 'es' }
): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm', options);
}

export function formatTime(
  date: Date | string | null | undefined,
  options?: { timezone?: string; locale?: 'en' | 'es'; use24Hour?: boolean }
): string {
  const formatStr = options?.use24Hour !== false ? 'HH:mm' : 'h:mm a';
  return formatDate(date, formatStr, options);
}

export function formatRelativeTime(
  date: Date | string | null | undefined,
  options?: { timezone?: string; locale?: 'en' | 'es'; addSuffix?: boolean }
): string {
  if (!date) return '';
  
  const locale = getLocale(options?.locale || 'es');
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  return formatDistanceToNow(dateObj, { 
    locale, 
    addSuffix: options?.addSuffix ?? true 
  });
}

export function toLocalTime(
  utcDate: Date | string,
  timezone?: string
): Date {
  const tz = timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE;
  const dateObj = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(dateObj, tz);
}

export function toUTC(
  localDate: Date,
  timezone?: string
): Date {
  const tz = timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE;
  return fromZonedTime(localDate, tz);
}

/** Convert an HTML date/time wall-clock value in an IANA zone to UTC. */
export function wallClockToUTC(value: string, timezone?: string): Date {
  return fromZonedTime(value, timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE);
}

/** Render a UTC instant as an HTML date/time wall-clock value in an IANA zone. */
export function utcToWallClockInput(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  if (!date) return '';
  return formatInTimeZone(
    typeof date === 'string' ? parseISO(date) : date,
    timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE,
    "yyyy-MM-dd'T'HH:mm",
  );
}

export function getCurrentTimeInZone(timezone?: string): Date {
  const tz = timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE;
  return toZonedTime(new Date(), tz);
}

export function formatDateForInput(
  date: Date | string | null | undefined,
  options?: { timezone?: string }
): string {
  if (!date) return '';
  return formatDate(date, "yyyy-MM-dd'T'HH:mm", options);
}

export function formatDateOnly(
  date: Date | string | null | undefined,
  options?: { timezone?: string }
): string {
  if (!date) return '';
  return formatDate(date, 'yyyy-MM-dd', options);
}
