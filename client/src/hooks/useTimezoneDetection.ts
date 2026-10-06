import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DetectedTimezone {
  timezone: string;
  source: 'detected' | 'manual' | 'admin_override';
}

interface UserTimezoneInfo {
  timezone: string | null;
  timezoneSource: string | null;
  timezoneDetectedAt: string | null;
}

interface ActiveTimezone {
  timezone: string;
  cityName: string;
  countryName: string;
}

const DETECTION_THROTTLE_KEY = 'ruku_tz_last_detect';
const THROTTLE_HOURS = 24;

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Mexico_City';
  }
}

function shouldDetectTimezone(lastDetectedAt: string | null): boolean {
  const lastLocalDetect = localStorage.getItem(DETECTION_THROTTLE_KEY);
  
  if (lastLocalDetect) {
    const lastTime = new Date(lastLocalDetect).getTime();
    const now = Date.now();
    const hoursSinceLastDetect = (now - lastTime) / (1000 * 60 * 60);
    if (hoursSinceLastDetect < THROTTLE_HOURS) {
      return false;
    }
  }
  
  if (lastDetectedAt) {
    const serverTime = new Date(lastDetectedAt).getTime();
    const now = Date.now();
    const hoursSinceServer = (now - serverTime) / (1000 * 60 * 60);
    if (hoursSinceServer < THROTTLE_HOURS) {
      return false;
    }
  }
  
  return true;
}

export function useActiveTimezones() {
  return useQuery<ActiveTimezone[]>({
    queryKey: ['/api/timezones/active'],
    queryFn: async () => {
      const response = await fetch('/api/timezones/active', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch active timezones');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });
}

interface UseTimezoneDetectionOptions {
  enabled?: boolean;
}

export function useTimezoneDetection(
  userTimezone?: UserTimezoneInfo,
  options?: UseTimezoneDetectionOptions
) {
  const queryClient = useQueryClient();
  const hasAttemptedRef = useRef(false);
  const enabled = options?.enabled ?? true;
  
  const updateMutation = useMutation({
    mutationFn: async (data: DetectedTimezone) => {
      const response = await fetch('/api/user/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update timezone');
      }
      return response.json();
    },
    onSuccess: () => {
      localStorage.setItem(DETECTION_THROTTLE_KEY, new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impersonate/current'] });
    },
    onError: () => {
      hasAttemptedRef.current = true;
    },
    retry: false,
  });

  useEffect(() => {
    if (!enabled || hasAttemptedRef.current || updateMutation.isPending) {
      return;
    }
    
    if (userTimezone === undefined) {
      return;
    }
    
    if (!shouldDetectTimezone(userTimezone?.timezoneDetectedAt ?? null)) {
      return;
    }
    
    const browserTz = getBrowserTimezone();
    
    if (userTimezone?.timezone === browserTz && userTimezone?.timezoneSource === 'detected') {
      localStorage.setItem(DETECTION_THROTTLE_KEY, new Date().toISOString());
      return;
    }
    
    if (userTimezone?.timezoneSource === 'manual' || userTimezone?.timezoneSource === 'admin_override') {
      return;
    }
    
    hasAttemptedRef.current = true;
    updateMutation.mutate({
      timezone: browserTz,
      source: 'detected',
    });
  }, [enabled, userTimezone, updateMutation.isPending]);

  const setTimezone = useCallback((timezone: string, source: 'manual' | 'admin_override' = 'manual') => {
    updateMutation.mutate({ timezone, source });
  }, [updateMutation]);

  return {
    browserTimezone: getBrowserTimezone(),
    isUpdating: updateMutation.isPending,
    setTimezone,
  };
}
