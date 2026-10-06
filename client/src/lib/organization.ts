import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const organizationQueryKeys = {
  companies: (params = "") => ["/api/admin/organization/companies", params] as const,
  users: ["/api/admin/organization/users"] as const,
  all: ["/api/admin/organization"] as const,
};

export type OrganizationStatus = "active" | "inactive" | "suspended" | "invited" | string;
export type CompanyClassification = "client" | "partner" | "both" | string;
export type MembershipRole = "owner" | "admin" | "member" | "viewer" | "dispatcher" | "fleet_manager" | "accountant" | string;

export interface OrganizationCompany {
  id: string;
  name?: string;
  companyName?: string;
  classification?: CompanyClassification;
  isActive?: boolean;
  status?: OrganizationStatus;
  ownerUserId?: string | null;
  memberCount?: number;
  [key: string]: unknown;
}

export interface OrganizationMembership {
  id?: string;
  role?: MembershipRole;
  status?: OrganizationStatus;
  invitedEmail?: string | null;
  invitationExpiresAt?: string | null;
  [key: string]: unknown;
}

export interface OrganizationUser {
  id: string;
  email?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: OrganizationStatus;
  userType?: string;
  platformRoles?: string[];
  roles?: Array<{ role: string }>;
  profiles?: string[];
  memberships?: Array<{ membership?: OrganizationMembership; company?: OrganizationCompany; [key: string]: unknown }>;
  [key: string]: unknown;
}

export function normalizeCompanies(payload: unknown): OrganizationCompany[] {
  if (Array.isArray(payload)) return payload as OrganizationCompany[];
  const response = payload as { companies?: OrganizationCompany[]; organizations?: OrganizationCompany[] } | undefined;
  return response?.organizations || response?.companies || [];
}

export function normalizeUsers(payload: unknown): OrganizationUser[] {
  if (Array.isArray(payload)) return payload as OrganizationUser[];
  return (payload as { users?: OrganizationUser[] } | undefined)?.users || [];
}

export async function organizationRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = options
    ? await apiRequest(options.method || "GET", url, options.body ? JSON.parse(String(options.body)) : undefined)
    : await apiRequest("GET", url);
  return response.json() as Promise<T>;
}

/** Invalidate every organization projection, including legacy-compatible detail keys. */
export function invalidateOrganizationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/users"] }),
    queryClient.invalidateQueries({ predicate: query => {
      const key = query.queryKey[0];
      return typeof key === "string" && (
        key.startsWith("/api/admin/companies/") ||
        key.startsWith("/api/admin/users/")
      );
    }}),
  ]);
}

export function useOrganizationQueries(search = "", access: { companies?: boolean; users?: boolean } = { companies: true, users: true }) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const companies = useQuery<{ companies: OrganizationCompany[] }>({
    queryKey: organizationQueryKeys.companies(params),
    queryFn: () => organizationRequest(`/api/admin/organization/companies${params}`),
    enabled: access.companies !== false,
  });
  const users = useQuery<{ users: OrganizationUser[] }>({
    queryKey: organizationQueryKeys.users,
    queryFn: () => organizationRequest("/api/admin/organization/users"),
    enabled: access.users !== false,
  });
  return { companies, users };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; classification: string; ownerUserId: string }) =>
      organizationRequest("/api/admin/companies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => invalidateOrganizationQueries(queryClient),
  });
}

export function useInviteOrganizationUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; memberships: Array<{ companyId: string; role: string }> }) =>
      organizationRequest("/api/admin/companies/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => invalidateOrganizationQueries(queryClient),
  });
}