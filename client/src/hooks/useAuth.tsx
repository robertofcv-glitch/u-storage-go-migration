import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UserWithRoles {
  id: string;
  email: string;
  fullName?: string;
  userType?: string;
  roles: { role: string }[];
}

async function fetchCurrentSession(): Promise<{ user: UserWithRoles | null; isImpersonated: boolean } | null> {
  try {
    const response = await fetch("/api/impersonate/current", { credentials: "include" });
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: sessionData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/impersonate/current"],
    queryFn: fetchCurrentSession,
    retry: false,
    staleTime: 30000,
  });
  
  const user = sessionData?.user || null;
  const isImpersonated = sessionData?.isImpersonated || false;

  const logout = async () => {
    // Try both logout endpoints
    await Promise.all([
      fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {}),
      fetch("/api/auth/email-logout", { method: "POST", credentials: "include" }).catch(() => {}),
    ]);
    queryClient.setQueryData(["/api/impersonate/current"], null);
    queryClient.invalidateQueries({ queryKey: ["/api/impersonate/current"] });
    // Redirect to landing page
    window.location.href = "/";
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isImpersonated,
    error,
    logout,
    refetch,
  };
}
