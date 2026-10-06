import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Search, Globe, Bot, FileText, Share2, Loader2, Save, TrendingUp } from "lucide-react";
import type { SeoSettings } from "@shared/schema";

export default function AdminSeoMarketing() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sidebarLinks = getAdminSidebarLinks(lang);

  const [formData, setFormData] = useState<Partial<SeoSettings>>({});

  const { data: seoSettings, isLoading: loadingSettings } = useQuery<SeoSettings>({
    queryKey: ['/api/admin/seo/settings'],
  });

  const updateSettings = useMutation({
    mutationFn: async (data: Partial<SeoSettings>) => {
      const res = await fetch('/api/admin/seo/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/seo/settings'] });
      toast({
        title: lang === 'es' ? 'Configuración guardada' : 'Settings saved',
        description: lang === 'es' ? 'Los cambios se han guardado correctamente.' : 'Changes have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: lang === 'es' ? 'No se pudieron guardar los cambios.' : 'Failed to save changes.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateSettings.mutate({ ...seoSettings, ...formData });
  };

  const handleInputChange = (field: keyof SeoSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getDisplayValue = (field: keyof SeoSettings) => {
    return formData[field] !== undefined ? formData[field] : seoSettings?.[field] ?? '';
  };

  if (loadingSettings) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {lang === 'es' ? 'Configuración SEO' : 'SEO Configuration'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {lang === 'es' 
                ? 'Configura SEO, meta tags y discoverabilidad por IA'
                : 'Configure SEO, meta tags and AI discoverability'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="seo-basics" className="space-y-4">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList
              className="h-auto min-w-max justify-start"
              aria-label={lang === 'es' ? 'Temas de configuración de marketing' : 'Marketing settings topics'}
            >
              <TabsTrigger value="seo-basics">{lang === 'es' ? 'SEO básico' : 'SEO basics'}</TabsTrigger>
              <TabsTrigger value="social-sharing">{lang === 'es' ? 'Compartir en redes' : 'Social sharing'}</TabsTrigger>
              <TabsTrigger value="analytics">{lang === 'es' ? 'Analytics y tracking' : 'Analytics and tracking'}</TabsTrigger>
              <TabsTrigger value="ai-discovery">{lang === 'es' ? 'Descubrimiento por IA' : 'AI discovery'}</TabsTrigger>
              <TabsTrigger value="structured-data">{lang === 'es' ? 'Datos estructurados' : 'Structured data'}</TabsTrigger>
              <TabsTrigger value="crawling">{lang === 'es' ? 'Rastreo e indexación' : 'Crawling and indexing'}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="seo-basics">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {lang === 'es' ? 'Meta Tags por Defecto' : 'Default Meta Tags'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Plantillas para títulos y descripciones de páginas'
                  : 'Templates for page titles and descriptions'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-title-template">{lang === 'es' ? 'Plantilla de Título (EN)' : 'Title Template (EN)'}</Label>
                <Input 
                  id="default-title-template"
                  value={getDisplayValue('defaultTitleTemplate') as string}
                  onChange={(e) => handleInputChange('defaultTitleTemplate', e.target.value)}
                  placeholder="{{page}} | U-Storage Go"
                  data-testid="input-title-template-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-title-template-es">{lang === 'es' ? 'Plantilla de Título (ES)' : 'Title Template (ES)'}</Label>
                <Input 
                  id="default-title-template-es"
                  value={getDisplayValue('defaultTitleTemplateEs') as string}
                  onChange={(e) => handleInputChange('defaultTitleTemplateEs', e.target.value)}
                  placeholder="{{page}} | U-Storage Go"
                  data-testid="input-title-template-es"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-description">{lang === 'es' ? 'Descripción por Defecto (EN)' : 'Default Description (EN)'}</Label>
                <Textarea 
                  id="default-description"
                  value={getDisplayValue('defaultDescription') as string}
                  onChange={(e) => handleInputChange('defaultDescription', e.target.value)}
                  placeholder="Professional moving services..."
                  rows={3}
                  data-testid="input-description-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-description-es">{lang === 'es' ? 'Descripción por Defecto (ES)' : 'Default Description (ES)'}</Label>
                <Textarea 
                  id="default-description-es"
                  value={getDisplayValue('defaultDescriptionEs') as string}
                  onChange={(e) => handleInputChange('defaultDescriptionEs', e.target.value)}
                  placeholder="Servicios profesionales de mudanza..."
                  rows={3}
                  data-testid="input-description-es"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social-sharing">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                {lang === 'es' ? 'Redes Sociales' : 'Social Media'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Configuración para compartir en redes sociales'
                  : 'Settings for social media sharing'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-og-image">{lang === 'es' ? 'Imagen OG por Defecto' : 'Default OG Image'}</Label>
                <Input 
                  id="default-og-image"
                  value={getDisplayValue('defaultOgImage') as string}
                  onChange={(e) => handleInputChange('defaultOgImage', e.target.value)}
                  placeholder="https://rukumove.com/opengraph.jpg"
                  data-testid="input-og-image"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter-handle">Twitter Handle</Label>
                <Input 
                  id="twitter-handle"
                  value={getDisplayValue('twitterHandle') as string}
                  onChange={(e) => handleInputChange('twitterHandle', e.target.value)}
                  placeholder="@ustoragego"
                  data-testid="input-twitter-handle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook-app-id">Facebook App ID</Label>
                <Input 
                  id="facebook-app-id"
                  value={getDisplayValue('facebookAppId') as string}
                  onChange={(e) => handleInputChange('facebookAppId', e.target.value)}
                  placeholder="123456789"
                  data-testid="input-facebook-app-id"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-discovery">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                {lang === 'es' ? 'Discoverabilidad por IA' : 'AI Discoverability'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Configura cómo los asistentes de IA descubren tu sitio'
                  : 'Configure how AI assistants discover your site'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="allow-ai-crawlers">{lang === 'es' ? 'Permitir rastreadores de IA' : 'Allow AI Crawlers'}</Label>
                  <p id="allow-ai-crawlers-description" className="text-sm text-muted-foreground">
                    {lang === 'es' ? 'GPTBot, ClaudeBot, PerplexityBot' : 'GPTBot, ClaudeBot, PerplexityBot'}
                  </p>
                </div>
                <Switch 
                  id="allow-ai-crawlers"
                  checked={Boolean(getDisplayValue('allowAiCrawlers'))}
                  onCheckedChange={(checked) => handleInputChange('allowAiCrawlers', checked)}
                  aria-describedby="allow-ai-crawlers-description"
                  data-testid="switch-ai-crawlers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llms-txt-content">llms.txt {lang === 'es' ? '(Resumen)' : '(Summary)'}</Label>
                <Textarea 
                  id="llms-txt-content"
                  value={getDisplayValue('llmsTxtContent') as string}
                  onChange={(e) => handleInputChange('llmsTxtContent', e.target.value)}
                  placeholder="# U-Storage Go..."
                  rows={4}
                  data-testid="input-llms-txt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llms-full-txt-content">llms-full.txt {lang === 'es' ? '(Documentación completa)' : '(Full documentation)'}</Label>
                <Textarea 
                  id="llms-full-txt-content"
                  value={getDisplayValue('llmsFullTxtContent') as string}
                  onChange={(e) => handleInputChange('llmsFullTxtContent', e.target.value)}
                  placeholder="# Complete documentation..."
                  rows={6}
                  data-testid="input-llms-full-txt"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {lang === 'es' ? 'Tracking de Analytics' : 'Analytics Tracking'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'IDs de servicios de analytics externos'
                  : 'External analytics service IDs'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-analytics-id">Google Analytics ID</Label>
                <Input 
                  id="google-analytics-id"
                  value={getDisplayValue('googleAnalyticsId') as string}
                  onChange={(e) => handleInputChange('googleAnalyticsId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  data-testid="input-ga-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-tag-manager-id">Google Tag Manager ID</Label>
                <Input 
                  id="google-tag-manager-id"
                  value={getDisplayValue('googleTagManagerId') as string}
                  onChange={(e) => handleInputChange('googleTagManagerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  data-testid="input-gtm-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook-pixel-id">Facebook Pixel ID</Label>
                <Input 
                  id="facebook-pixel-id"
                  value={getDisplayValue('facebookPixelId') as string}
                  onChange={(e) => handleInputChange('facebookPixelId', e.target.value)}
                  placeholder="123456789"
                  data-testid="input-fb-pixel-id"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structured-data">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {lang === 'es' ? 'Structured Data' : 'Structured Data'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Información de la organización para schema.org'
                  : 'Organization info for schema.org'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organization-name">{lang === 'es' ? 'Nombre de la Organización' : 'Organization Name'}</Label>
                <Input 
                  id="organization-name"
                  value={getDisplayValue('organizationName') as string}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  placeholder="U-Storage Go"
                  data-testid="input-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-logo">{lang === 'es' ? 'URL del Logo' : 'Logo URL'}</Label>
                <Input 
                  id="organization-logo"
                  value={getDisplayValue('organizationLogo') as string}
                  onChange={(e) => handleInputChange('organizationLogo', e.target.value)}
                  placeholder="https://rukumove.com/brand/v1/favicons/icon-512.png"
                  data-testid="input-org-logo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-phone">{lang === 'es' ? 'Teléfono' : 'Phone'}</Label>
                <Input 
                  id="organization-phone"
                  value={getDisplayValue('organizationPhone') as string}
                  onChange={(e) => handleInputChange('organizationPhone', e.target.value)}
                  placeholder={lang === 'es' ? 'Solo si está verificado' : 'Only if verified'}
                  data-testid="input-org-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-email">Email</Label>
                <Input 
                  id="organization-email"
                  value={getDisplayValue('organizationEmail') as string}
                  onChange={(e) => handleInputChange('organizationEmail', e.target.value)}
                  placeholder={lang === 'es' ? 'Solo si está verificado' : 'Only if verified'}
                  data-testid="input-org-email"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crawling">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                {lang === 'es' ? 'Configuración de Robots' : 'Robots Configuration'}
              </CardTitle>
              <CardDescription>
                {lang === 'es' 
                  ? 'Reglas personalizadas para robots.txt'
                  : 'Custom rules for robots.txt'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="robots-custom-rules">{lang === 'es' ? 'Reglas Personalizadas' : 'Custom Rules'}</Label>
                <Textarea 
                  id="robots-custom-rules"
                  value={getDisplayValue('robotsTxtCustomRules') as string}
                  onChange={(e) => handleInputChange('robotsTxtCustomRules', e.target.value)}
                  placeholder="Disallow: /private/&#10;Allow: /blog/"
                  rows={4}
                  data-testid="input-robots-rules"
                />
                <p className="text-xs text-muted-foreground">
                  {lang === 'es' 
                    ? 'Estas reglas se añadirán al robots.txt existente'
                    : 'These rules will be added to the existing robots.txt'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="sitemap-auto-update">{lang === 'es' ? 'Actualización automática del sitemap' : 'Auto-update sitemap'}</Label>
                  <p id="sitemap-auto-update-description" className="text-sm text-muted-foreground">
                    {lang === 'es' ? 'Regenerar sitemap.xml automáticamente' : 'Automatically regenerate sitemap.xml'}
                  </p>
                </div>
                <Switch 
                  id="sitemap-auto-update"
                  checked={Boolean(getDisplayValue('sitemapAutoUpdate'))}
                  onCheckedChange={(checked) => handleInputChange('sitemapAutoUpdate', checked)}
                  aria-describedby="sitemap-auto-update-description"
                  data-testid="switch-sitemap-auto"
                />
              </div>
            </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button 
            onClick={handleSave} 
            disabled={updateSettings.isPending}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-save-seo"
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {lang === 'es' ? 'Guardar Cambios' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
