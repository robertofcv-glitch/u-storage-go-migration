import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatchRequest } from "@/components/mover/dispatchApi";
import { useLocation } from "wouter";

export type PartnerCompany = { id: string; companyName: string; isInternal?: boolean; partnerStatus?: string; verified?: boolean; operatingTimezone?: string | null; travelBufferMinutes?: number | null; turnaroundBufferMinutes?: number | null };
export type CompanyMembership = { id: string; role: string; status: string };
export type CompanyAccess = { company: PartnerCompany; membership: CompanyMembership; permissions: string[] };
type CompanyResponse = { companies: CompanyAccess[]; activeCompanyId?: string };
type CompanyContextValue = { companies: CompanyAccess[]; active?: CompanyAccess; loading: boolean; error: boolean; can: (permission: string) => boolean; switchCompany: (id: string) => void; switching: boolean; refetch: () => void };

const CompanyContext = createContext<CompanyContextValue | null>(null);

const permissionList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key);
  return [];
};

export function PartnerCompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [localActiveId, setLocalActiveId] = useState<string>();
  const query = useQuery({
    queryKey: ["partner-companies"],
    queryFn: async () => {
      const response = await dispatchRequest<CompanyResponse>("/api/partner/companies");
      return { ...response, companies: (response.companies || []).map((item) => ({ ...item, permissions: permissionList(item.permissions) })) };
    },
    enabled: location.startsWith("/mover/dashboard"),
    retry: false,
  });
  const switchMutation = useMutation({
    mutationFn: (companyId: string) => dispatchRequest("/api/partner/companies/active", { method: "PUT", body: JSON.stringify({ companyId }) }),
    onSuccess: (_, companyId) => { setLocalActiveId(companyId); queryClient.invalidateQueries({ queryKey: ["partner-company"] }); queryClient.invalidateQueries({ queryKey: ["partner-company-members"] }); queryClient.invalidateQueries({ queryKey: ["mover-documents"] }); queryClient.invalidateQueries({ queryKey: ["mover-invitations"] }); queryClient.invalidateQueries({ queryKey: ["mover-bids"] }); queryClient.invalidateQueries({ queryKey: ["partner-fleet"] }); queryClient.invalidateQueries({ queryKey: ["partner-availability"] }); queryClient.invalidateQueries({ queryKey: ["partner-assignments"] }); query.refetch(); },
  });
  const value = useMemo<CompanyContextValue>(() => {
    const companies = query.data?.companies || [];
    const active = companies.find((item) => item.company.id === (localActiveId || query.data?.activeCompanyId)) || companies[0];
    const permissions = active?.permissions || [];
    return { companies, active, loading: query.isLoading, error: query.isError, can: (permission) => permissions.includes(permission) || permissions.includes("*") || permissions.includes(permission.replace(/-/g, "_")), switchCompany: (id) => switchMutation.mutate(id), switching: switchMutation.isPending, refetch: () => query.refetch() };
  }, [query.data, query.isLoading, query.isError, localActiveId, switchMutation]);
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function usePartnerCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("usePartnerCompany must be used inside PartnerCompanyProvider");
  return context;
}