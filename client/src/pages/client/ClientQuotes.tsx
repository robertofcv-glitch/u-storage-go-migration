import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Home, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useWorkflowStatuses } from "@/hooks/useWorkflowStatuses";

interface Quote {
  id: string;
  quoteNumber: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  moveDate: string | null;
  homeSize: string | null;
  workflowStatus: string | null;
  createdAt: string | null;
}

export default function ClientQuotes() {
  const { t } = useTranslation();
  const { getStatusLabel, getStatusColor } = useWorkflowStatuses();
  const [_, setLocation] = useLocation();
  const { user: authUser } = useAuth();

  const { data, isLoading } = useQuery<{ quotes: Quote[] }>({
    queryKey: ['client-quotes'],
    queryFn: async () => {
      const response = await fetch('/api/client/quotes');
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return response.json();
    },
    enabled: !!authUser,
  });

  const sidebarLinks = [
    { href: "/dashboard", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "/dashboard/moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "/dashboard/quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "/dashboard/saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  const quotes = data?.quotes || [];

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">{t('dashboard.client.quotes')}</h1>
            <p className="text-muted-foreground">{t('dashboard.client.allQuotes')} ({quotes.length})</p>
          </div>
          <Button 
            onClick={() => setLocation('/dashboard/new-quote')} 
            className="bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
            data-testid="button-new-quote"
          >
            {t('clients.hero.cta')}
          </Button>
        </div>

        <Card className="workspace-card">
          <CardHeader>
            <CardTitle>{t('dashboard.client.allQuotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length > 0 ? (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <div 
                    key={quote.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/dashboard/quotes/${quote.id}`)}
                    data-testid={`quote-row-${quote.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {quote.quoteNumber && (
                          <span className="text-xs font-mono bg-[var(--usg-purple)] text-[var(--usg-paper)] px-2 py-0.5 rounded">{quote.quoteNumber}</span>
                        )}
                        <h4 className="font-semibold">{quote.fromAddress || t('common.noAddress')} → {quote.toAddress || t('common.noAddress')}</h4>
                      </div>
                      <div className="flex gap-4 text-sm text-slate-500">
                        <span>{quote.homeSize || '-'}</span>
                        <span>{quote.moveDate ? format(new Date(quote.moveDate), 'MMM dd, yyyy') : t('common.noDate')}</span>
                      </div>
                    </div>
                    <span 
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: getStatusColor(quote.workflowStatus).bgColor, color: getStatusColor(quote.workflowStatus).color }}
                    >
                      {getStatusLabel(quote.workflowStatus)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed rounded-lg gap-4">
                <p>{t('dashboard.client.noQuotes')}</p>
                <Button onClick={() => setLocation('/dashboard/new-quote')} variant="outline" data-testid="button-get-quote-empty">
                  {t('clients.hero.cta')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
