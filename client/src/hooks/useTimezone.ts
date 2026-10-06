import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  formatShortDateTime,
  formatTime,
  formatRelativeTime,
  toLocalTime,
  toUTC,
  getCurrentTimeInZone,
  getTimezoneOffset,
  getTimezoneName,
  formatDateForInput,
  formatDateOnly,
  isValidTimezone,
  TIMEZONE_CONFIG,
} from '@shared/timezone';

export interface UseTimezoneOptions {
  timezone?: string;
}

export function useTimezone(options?: UseTimezoneOptions) {
  const { i18n } = useTranslation();
  const locale = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es';
  const timezone = options?.timezone || TIMEZONE_CONFIG.DEFAULT_TIMEZONE;

  const formatters = useMemo(() => ({
    formatDate: (date: Date | string | null | undefined, formatStr: string) =>
      formatDate(date, formatStr, { timezone, locale }),
    
    formatDateTime: (date: Date | string | null | undefined, includeTime = true) =>
      formatDateTime(date, { timezone, locale, includeTime }),
    
    formatShortDate: (date: Date | string | null | undefined) =>
      formatShortDate(date, { timezone, locale }),
    
    formatShortDateTime: (date: Date | string | null | undefined) =>
      formatShortDateTime(date, { timezone, locale }),
    
    formatTime: (date: Date | string | null | undefined, use24Hour = true) =>
      formatTime(date, { timezone, locale, use24Hour }),
    
    formatRelativeTime: (date: Date | string | null | undefined, addSuffix = true) =>
      formatRelativeTime(date, { timezone, locale, addSuffix }),
    
    toLocalTime: (utcDate: Date | string) =>
      toLocalTime(utcDate, timezone),
    
    toUTC: (localDate: Date) =>
      toUTC(localDate, timezone),
    
    getCurrentTime: () =>
      getCurrentTimeInZone(timezone),
    
    formatForInput: (date: Date | string | null | undefined) =>
      formatDateForInput(date, { timezone }),
    
    formatDateOnly: (date: Date | string | null | undefined) =>
      formatDateOnly(date, { timezone }),
  }), [timezone, locale]);

  const timezoneInfo = useMemo(() => ({
    timezone,
    locale,
    offset: getTimezoneOffset(timezone),
    name: getTimezoneName(timezone, locale),
    isValid: isValidTimezone(timezone),
  }), [timezone, locale]);

  return {
    ...formatters,
    ...timezoneInfo,
    DEFAULT_TIMEZONE: TIMEZONE_CONFIG.DEFAULT_TIMEZONE,
  };
}

export { TIMEZONE_CONFIG };
