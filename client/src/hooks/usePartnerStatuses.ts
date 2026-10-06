import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export interface PartnerStatus {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  description?: string;
  descriptionEs?: string;
  color: string;
  bgColor: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isFinal: boolean;
  isDefault: boolean;
}

export function usePartnerStatuses() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';

  const query = useQuery<PartnerStatus[]>({
    queryKey: ['/api/partner-statuses'],
    staleTime: 5 * 60 * 1000,
  });

  const getStatusLabel = (statusKey: string | null): string => {
    if (!statusKey) return lang === 'es' ? 'Pendiente' : 'Pending';
    const status = query.data?.find(s => s.key === statusKey);
    if (!status) return statusKey;
    return lang === 'es' ? status.labelEs : status.labelEn;
  };

  const getStatusColor = (statusKey: string | null): { color: string; bgColor: string } => {
    const defaultColors = { color: '#6B7280', bgColor: '#F3F4F6' };
    if (!statusKey) return defaultColors;
    const status = query.data?.find(s => s.key === statusKey);
    return status ? { color: status.color, bgColor: status.bgColor } : defaultColors;
  };

  const getStatusDescription = (statusKey: string | null): string => {
    if (!statusKey) return '';
    const status = query.data?.find(s => s.key === statusKey);
    if (!status) return '';
    return lang === 'es' ? (status.descriptionEs || '') : (status.description || '');
  };

  const getStatusOptions = (includeAll = false): { value: string; label: string }[] => {
    const statuses = query.data || [];
    const options = statuses.map(s => ({
      value: s.key,
      label: lang === 'es' ? s.labelEs : s.labelEn,
    }));
    
    if (includeAll) {
      return [
        { value: 'all', label: lang === 'es' ? 'Todos' : 'All' },
        ...options,
      ];
    }
    return options;
  };

  const getDefaultStatus = (): string => {
    const defaultStatus = query.data?.find(s => s.isDefault);
    return defaultStatus?.key || 'pending';
  };

  const getFinalStatuses = (): string[] => {
    return query.data?.filter(s => s.isFinal).map(s => s.key) || [];
  };

  return {
    statuses: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    getStatusLabel,
    getStatusColor,
    getStatusDescription,
    getStatusOptions,
    getDefaultStatus,
    getFinalStatuses,
  };
}
