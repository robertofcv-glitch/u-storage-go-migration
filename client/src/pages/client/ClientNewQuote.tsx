import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Package, Truck, MapPin, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { QuoteWizard, QuoteFormData } from "@/components/quote/QuoteWizard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Clear quote session data from sessionStorage to prevent quote reuse
const cleanupQuoteSession = () => {
  const sessionId = sessionStorage.getItem('ruku_quote_session_id');
  if (sessionId) {
    sessionStorage.removeItem(`ruku_partial_quote_${sessionId}`);
    sessionStorage.removeItem('ruku_quote_session_id');
  }
};

export default function ClientNewQuote() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sidebarLinks = [
    { href: "/dashboard", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "/dashboard/moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "/dashboard/quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "/dashboard/saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      // Use the partial quote ID from the wizard to finalize the existing quote
      // This prevents creating duplicate quotes
      if (!data.partialQuoteId) {
        throw new Error('No quote ID found. Please try again.');
      }
      
      const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
      const response = await fetch(`/api/quotes/${data.partialQuoteId}/link-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPartial: false, quoteSessionId: quoteSessionId || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit quote');
      }
      return response.json();
    },
    onSuccess: () => {
      cleanupQuoteSession();
      toast({
        title: t('common.success'),
        description: t('quote.submitSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['client-quotes'] });
      setLocation('/dashboard/quotes');
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuoteSubmit = (data: QuoteFormData) => {
    submitQuoteMutation.mutate(data);
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
      <div className="w-full max-w-full overflow-x-hidden px-4 py-4">
        <QuoteWizard
          skipAccountStep={true}
          onSubmit={handleQuoteSubmit}
          onCancel={() => {
            cleanupQuoteSession();
            setLocation('/dashboard');
          }}
        />
      </div>
    </DashboardLayout>
  );
}
