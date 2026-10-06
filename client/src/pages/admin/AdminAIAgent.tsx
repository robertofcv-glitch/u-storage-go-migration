import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save, Brain, Shield, Package, Sparkles, FileImage, FileText, AlertTriangle, Languages, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";

// Prompt field pairs for consistency tracking
const PROMPT_PAIRS = [
  { en: 'greeting', es: 'greetingEs', label: 'Greeting' },
  { en: 'systemPrompt', es: 'systemPromptEs', label: 'System Prompt' },
  { en: 'mission', es: 'missionEs', label: 'Mission' },
  { en: 'guardrails', es: 'guardrailsEs', label: 'Guardrails' },
  { en: 'inventoryRules', es: 'inventoryRulesEs', label: 'Inventory Rules' },
  { en: 'imageAnalysisPrompt', es: 'imageAnalysisPromptEs', label: 'Image Analysis' },
  { en: 'documentParsePrompt', es: 'documentParsePromptEs', label: 'Document Parse' },
];

export default function AdminAIAgent() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-agent-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-agent/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load config');
      return res.json();
    }
  });

  const [formData, setFormData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  
  // Translation dialog state
  const [translateDialog, setTranslateDialog] = useState<{
    open: boolean;
    field: string;
    fromLanguage: 'en' | 'es';
    sourceText: string;
    targetField: string;
  } | null>(null);
  
  // Consistency fix dialog state
  const [consistencyDialog, setConsistencyDialog] = useState<{
    open: boolean;
    fieldPair: typeof PROMPT_PAIRS[0] | null;
  }>({ open: false, fieldPair: null });

  useEffect(() => {
    if (config && !formData) {
      setFormData(config);
      setOriginalData(config);
    }
  }, [config, formData]);

  // Translation mutation
  const translateMutation = useMutation({
    mutationFn: async ({ field, fromLanguage, sourceText }: { field: string; fromLanguage: string; sourceText: string }) => {
      const res = await fetch('/api/admin/ai-agent/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ field, fromLanguage, sourceText }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Translation failed');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Find the target field
      const pair = PROMPT_PAIRS.find(p => p.en === variables.field || p.es === variables.field);
      if (pair) {
        const targetField = variables.fromLanguage === 'en' ? pair.es : pair.en;
        setFormData((prev: any) => ({
          ...prev,
          [targetField]: data.translatedText,
          promptConsistency: { ...(prev.promptConsistency || {}), [pair.en]: true }
        }));
        toast({
          title: isSpanish ? "Traducido" : "Translated",
          description: isSpanish ? "El texto se tradujo correctamente" : "Text was translated successfully",
        });
      }
      setTranslateDialog(null);
      setConsistencyDialog({ open: false, fieldPair: null });
    },
    onError: (error: Error) => {
      toast({
        title: isSpanish ? "Error de traducción" : "Translation error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Check if a field pair is consistent
  const isConsistent = useCallback((fieldKey: string): boolean => {
    const consistency = formData?.promptConsistency || {};
    return consistency[fieldKey] !== false; // Default to true if not set
  }, [formData?.promptConsistency]);

  // Mark a field pair as inconsistent
  const markInconsistent = useCallback((fieldKey: string) => {
    setFormData((prev: any) => ({
      ...prev,
      promptConsistency: { ...(prev.promptConsistency || {}), [fieldKey]: false }
    }));
  }, []);

  // Handle field change with translation prompt
  const handleFieldChange = useCallback((field: string, value: string, isEnglish: boolean) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    
    // Find the pair for this field
    const pair = PROMPT_PAIRS.find(p => (isEnglish ? p.en : p.es) === field);
    if (pair && value.trim()) {
      // Debounced - will show dialog on blur instead
    }
  }, []);

  // Handle blur - prompt for translation
  const handleFieldBlur = useCallback((field: string, isEnglish: boolean) => {
    const pair = PROMPT_PAIRS.find(p => (isEnglish ? p.en : p.es) === field);
    if (!pair) return;
    
    const currentValue = formData?.[field] || '';
    const originalValue = originalData?.[field] || '';
    
    // Check if the value actually changed
    if (currentValue !== originalValue && currentValue.trim()) {
      setTranslateDialog({
        open: true,
        field: pair.en, // Use the English key as the identifier
        fromLanguage: isEnglish ? 'en' : 'es',
        sourceText: currentValue,
        targetField: isEnglish ? pair.es : pair.en,
      });
    }
  }, [formData, originalData]);

  // Handle translation accept
  const handleAcceptTranslation = () => {
    if (translateDialog) {
      translateMutation.mutate({
        field: translateDialog.field,
        fromLanguage: translateDialog.fromLanguage,
        sourceText: translateDialog.sourceText,
      });
    }
  };

  // Handle translation decline
  const handleDeclineTranslation = () => {
    if (translateDialog) {
      markInconsistent(translateDialog.field);
      setTranslateDialog(null);
    }
  };

  // Handle consistency fix
  const handleFixConsistency = (pair: typeof PROMPT_PAIRS[0], fromLanguage: 'en' | 'es') => {
    const sourceText = formData?.[fromLanguage === 'en' ? pair.en : pair.es] || '';
    translateMutation.mutate({
      field: pair.en,
      fromLanguage,
      sourceText,
    });
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/ai-agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save config');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isSpanish ? "Guardado" : "Saved",
        description: isSpanish ? "Configuración actualizada correctamente" : "Configuration updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-config'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData || config);
  };

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const currentData = formData || config || {};

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Clara AI</h1>
              <p className="text-slate-500">
                {isSpanish ? "Configura el asistente de inventario y estimación" : "Configure the inventory and estimation assistant"}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-config">
            <Save className="h-4 w-4 mr-2" />
            {isSpanish ? "Guardar cambios" : "Save changes"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="general" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Comportamiento" : "Behavior"}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Inventario" : "Inventory"}</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <FileImage className="h-4 w-4" />
              <span className="hidden sm:inline">{isSpanish ? "Archivos" : "Files"}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {isSpanish ? "Configuración General" : "General Settings"}
                </CardTitle>
                <CardDescription>
                  {isSpanish ? "Nombre, saludo y estado del agente" : "Agent name, greeting and status"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{isSpanish ? "Agente activo" : "Agent active"}</Label>
                    <p className="text-sm text-slate-500">
                      {isSpanish ? "Habilita o deshabilita el agente" : "Enable or disable the agent"}
                    </p>
                  </div>
                  <Switch
                    checked={currentData.active}
                    onCheckedChange={(v) => updateField('active', v)}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{isSpanish ? "Nombre del agente" : "Agent name"}</Label>
                    <Input
                      value={currentData.name || 'Clara'}
                      onChange={(e) => updateField('name', e.target.value)}
                      data-testid="input-agent-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isSpanish ? "Modelo AI" : "AI Model"}</Label>
                    <Select
                      value={currentData.model || 'claude-sonnet-4-6'}
                      onValueChange={(v) => updateField('model', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isSpanish ? "Seleccionar modelo" : "Select model"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 ({isSpanish ? "Principal" : "Primary"})</SelectItem>
                        <SelectItem value="gpt-5">GPT-5 ({isSpanish ? "Respaldo" : "Fallback"})</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {isSpanish
                        ? "Claude Sonnet 4.6 es el modelo principal. GPT-5 está disponible como respaldo si el proveedor principal no está disponible. Estos son los únicos modelos compatibles actualmente."
                        : "Claude Sonnet 4.6 is the primary model. GPT-5 is available as a fallback if the primary provider is unavailable. These are the only models currently supported."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">{isSpanish ? "Saludo inicial" : "Initial greeting"}</Label>
                    {!isConsistent('greeting') && (
                      <Badge 
                        variant="outline" 
                        className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                        onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'greeting') || null })}
                        data-testid="badge-inconsistent-greeting"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {isSpanish ? "No consistente" : "Not consistent"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-blue-600 flex items-center gap-1">
                        🇺🇸 English
                      </Label>
                      <Textarea
                        value={currentData.greeting || ''}
                        onChange={(e) => handleFieldChange('greeting', e.target.value, true)}
                        onBlur={() => handleFieldBlur('greeting', true)}
                        rows={3}
                        placeholder="Hello! I'm Clara, your moving assistant..."
                        data-testid="input-greeting-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-green-600 flex items-center gap-1">
                        🇲🇽 Español
                      </Label>
                      <Textarea
                        value={currentData.greetingEs || ''}
                        onChange={(e) => handleFieldChange('greetingEs', e.target.value, false)}
                        onBlur={() => handleFieldBlur('greetingEs', false)}
                        rows={3}
                        placeholder="¡Hola! Soy Clara, tu asistente de mudanzas..."
                        data-testid="input-greeting-es"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  {isSpanish ? "Misión y Personalidad" : "Mission and Personality"}
                </CardTitle>
                <CardDescription>
                  {isSpanish ? "Define el propósito y comportamiento del agente" : "Define the agent's purpose and behavior"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <Label className="text-base font-semibold">{isSpanish ? "Prompt del Sistema" : "System Prompt"}</Label>
                      <p className="text-xs text-slate-500 mt-1">
                        {isSpanish 
                          ? "Instrucciones principales para definir la personalidad y rol del agente" 
                          : "Main instructions to define the agent's personality and role"}
                      </p>
                    </div>
                    {!isConsistent('systemPrompt') && (
                      <Badge 
                        variant="outline" 
                        className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                        onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'systemPrompt') || null })}
                        data-testid="badge-inconsistent-systemPrompt"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {isSpanish ? "No consistente" : "Not consistent"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-blue-600 flex items-center gap-1">
                        🇺🇸 English
                      </Label>
                      <Textarea
                        value={currentData.systemPrompt || ''}
                        onChange={(e) => handleFieldChange('systemPrompt', e.target.value, true)}
                        onBlur={() => handleFieldBlur('systemPrompt', true)}
                        rows={6}
                        placeholder="You are Clara, a friendly and professional moving assistant..."
                        data-testid="input-system-prompt-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-green-600 flex items-center gap-1">
                        🇲🇽 Español
                      </Label>
                      <Textarea
                        value={currentData.systemPromptEs || ''}
                        onChange={(e) => handleFieldChange('systemPromptEs', e.target.value, false)}
                        onBlur={() => handleFieldBlur('systemPromptEs', false)}
                        rows={6}
                        placeholder="Eres Clara, un asistente amable y profesional para mudanzas..."
                        data-testid="input-system-prompt-es"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">{isSpanish ? "Misión" : "Mission"}</Label>
                    {!isConsistent('mission') && (
                      <Badge 
                        variant="outline" 
                        className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                        onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'mission') || null })}
                        data-testid="badge-inconsistent-mission"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {isSpanish ? "No consistente" : "Not consistent"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-blue-600 flex items-center gap-1">
                        🇺🇸 English
                      </Label>
                      <Textarea
                        value={currentData.mission || ''}
                        onChange={(e) => handleFieldChange('mission', e.target.value, true)}
                        onBlur={() => handleFieldBlur('mission', true)}
                        rows={3}
                        placeholder="Help customers inventory their belongings for a stress-free move..."
                        data-testid="input-mission-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-green-600 flex items-center gap-1">
                        🇲🇽 Español
                      </Label>
                      <Textarea
                        value={currentData.missionEs || ''}
                        onChange={(e) => handleFieldChange('missionEs', e.target.value, false)}
                        onBlur={() => handleFieldBlur('missionEs', false)}
                        rows={3}
                        placeholder="Ayudar a los clientes a inventariar sus pertenencias para una mudanza sin estrés..."
                        data-testid="input-mission-es"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-500" />
                  {isSpanish ? "Guardarraíles de Seguridad" : "Safety Guardrails"}
                </CardTitle>
                <CardDescription>
                  {isSpanish ? "Restricciones y límites del agente" : "Agent restrictions and limits"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <Label className="text-base font-semibold">{isSpanish ? "Guardarraíles" : "Guardrails"}</Label>
                      <p className="text-xs text-slate-500 mt-1">
                        {isSpanish 
                          ? "Define los límites de lo que el agente puede y no puede hacer" 
                          : "Define what the agent can and cannot do"}
                      </p>
                    </div>
                    {!isConsistent('guardrails') && (
                      <Badge 
                        variant="outline" 
                        className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                        onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'guardrails') || null })}
                        data-testid="badge-inconsistent-guardrails"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {isSpanish ? "No consistente" : "Not consistent"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-blue-600 flex items-center gap-1">
                        🇺🇸 English
                      </Label>
                      <Textarea
                        value={currentData.guardrails || ''}
                        onChange={(e) => handleFieldChange('guardrails', e.target.value, true)}
                        onBlur={() => handleFieldBlur('guardrails', true)}
                        rows={5}
                        placeholder="- Never give final prices, only estimates\n- Always recommend insurance for valuable items\n- Redirect legal questions to human support"
                        data-testid="input-guardrails-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-green-600 flex items-center gap-1">
                        🇲🇽 Español
                      </Label>
                      <Textarea
                        value={currentData.guardrailsEs || ''}
                        onChange={(e) => handleFieldChange('guardrailsEs', e.target.value, false)}
                        onBlur={() => handleFieldBlur('guardrailsEs', false)}
                        rows={5}
                        placeholder="- Nunca dar precios finales, solo estimaciones\n- Siempre recomendar seguro para artículos valiosos\n- Redirigir preguntas legales a soporte humano"
                        data-testid="input-guardrails-es"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {isSpanish ? "Reglas de Inventario" : "Inventory Rules"}
                </CardTitle>
                <CardDescription>
                  {isSpanish 
                    ? "Guía al agente sobre cómo recopilar el inventario de mudanza" 
                    : "Guide the agent on how to collect the moving inventory"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <Label className="text-base font-semibold">{isSpanish ? "Reglas para recopilar inventario" : "Inventory collection rules"}</Label>
                      <p className="text-xs text-slate-500 mt-1">
                        {isSpanish 
                          ? "Instrucciones paso a paso para que el agente recopile un inventario completo" 
                          : "Step-by-step instructions for the agent to collect a complete inventory"}
                      </p>
                    </div>
                    {!isConsistent('inventoryRules') && (
                      <Badge 
                        variant="outline" 
                        className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                        onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'inventoryRules') || null })}
                        data-testid="badge-inconsistent-inventoryRules"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {isSpanish ? "No consistente" : "Not consistent"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-blue-600 flex items-center gap-1">
                        🇺🇸 English
                      </Label>
                      <Textarea
                        value={currentData.inventoryRules || ''}
                        onChange={(e) => handleFieldChange('inventoryRules', e.target.value, true)}
                        onBlur={() => handleFieldBlur('inventoryRules', true)}
                        rows={8}
                        placeholder="- Start with the largest room (usually living room)\n- Ask about large furniture first (sofas, beds, tables)\n- Then ask about electronics and appliances\n- Finally, estimate boxes for small items\n- Always ask about fragile or valuable items"
                        data-testid="input-inventory-rules-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-green-600 flex items-center gap-1">
                        🇲🇽 Español
                      </Label>
                      <Textarea
                        value={currentData.inventoryRulesEs || ''}
                        onChange={(e) => handleFieldChange('inventoryRulesEs', e.target.value, false)}
                        onBlur={() => handleFieldBlur('inventoryRulesEs', false)}
                        rows={8}
                        placeholder="- Comenzar con la habitación más grande (usualmente sala)\n- Preguntar primero por muebles grandes (sofás, camas, mesas)\n- Luego preguntar por electrónicos y electrodomésticos\n- Finalmente, estimar cajas para artículos pequeños\n- Siempre preguntar por artículos frágiles o valiosos"
                        data-testid="input-inventory-rules-es"
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            <Card className="border-dashed border-2">
              <CardContent className="py-6 text-center">
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 mb-2">
                  {isSpanish 
                    ? "¿Necesitas gestionar categorías, habitaciones o presets de inventario?" 
                    : "Need to manage inventory categories, rooms, or presets?"}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/admin/dashboard/inventory'}
                >
                  {isSpanish ? "Ir a Gestión de Inventario" : "Go to Inventory Management"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-primary" />
                  {isSpanish ? "Análisis de Imágenes/Videos" : "Image/Video Analysis"}
                </CardTitle>
                <CardDescription>
                  {isSpanish 
                    ? "Prompt para analizar fotos y videos de habitaciones. Usa {{CATEGORIES}} y {{ROOMS}} como placeholders." 
                    : "Prompt for analyzing room photos and videos. Use {{CATEGORIES}} and {{ROOMS}} as placeholders."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isConsistent('imageAnalysisPrompt') && (
                  <Badge 
                    variant="outline" 
                    className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                    onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'imageAnalysisPrompt') || null })}
                    data-testid="badge-inconsistent-imageAnalysisPrompt"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {isSpanish ? "No consistente" : "Not consistent"}
                  </Badge>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-blue-600 flex items-center gap-1">
                      🇺🇸 English
                    </Label>
                    <Textarea
                      value={currentData.imageAnalysisPrompt || ''}
                      onChange={(e) => handleFieldChange('imageAnalysisPrompt', e.target.value, true)}
                      onBlur={() => handleFieldBlur('imageAnalysisPrompt', true)}
                      rows={10}
                      placeholder="Analyze this image of a room or items for a moving inventory..."
                      data-testid="input-image-analysis-prompt-en"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-green-600 flex items-center gap-1">
                      🇲🇽 Español
                    </Label>
                    <Textarea
                      value={currentData.imageAnalysisPromptEs || ''}
                      onChange={(e) => handleFieldChange('imageAnalysisPromptEs', e.target.value, false)}
                      onBlur={() => handleFieldBlur('imageAnalysisPromptEs', false)}
                      rows={10}
                      placeholder="Analiza esta imagen de una habitación o artículos para un inventario de mudanza..."
                      data-testid="input-image-analysis-prompt-es"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {isSpanish ? "Placeholders disponibles:" : "Available placeholders:"}
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li><code className="bg-white px-1 rounded">{"{{CATEGORIES}}"}</code> - {isSpanish ? "Lista de categorías de inventario" : "List of inventory categories"}</li>
                    <li><code className="bg-white px-1 rounded">{"{{ROOMS}}"}</code> - {isSpanish ? "Lista de habitaciones disponibles" : "List of available rooms"}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {isSpanish ? "Procesamiento de Documentos" : "Document Processing"}
                </CardTitle>
                <CardDescription>
                  {isSpanish 
                    ? "Prompt para analizar documentos (Excel, PDF, etc.) y texto ya transcrito. Usa {{CATEGORIES}}, {{ROOMS}}, {{CATALOG}} y {{CONTENT}} como placeholders."
                    : "Prompt for parsing documents (Excel, PDF, etc.) and already-transcribed text. Use {{CATEGORIES}}, {{ROOMS}}, {{CATALOG}} and {{CONTENT}} as placeholders."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isConsistent('documentParsePrompt') && (
                  <Badge 
                    variant="outline" 
                    className="text-amber-600 border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100"
                    onClick={() => setConsistencyDialog({ open: true, fieldPair: PROMPT_PAIRS.find(p => p.en === 'documentParsePrompt') || null })}
                    data-testid="badge-inconsistent-documentParsePrompt"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {isSpanish ? "No consistente" : "Not consistent"}
                  </Badge>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-blue-600 flex items-center gap-1">
                      🇺🇸 English
                    </Label>
                    <Textarea
                      value={currentData.documentParsePrompt || ''}
                      onChange={(e) => handleFieldChange('documentParsePrompt', e.target.value, true)}
                      onBlur={() => handleFieldBlur('documentParsePrompt', true)}
                      rows={10}
                      placeholder="You are an expert inventory parser for a moving company..."
                      data-testid="input-document-parse-prompt-en"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-green-600 flex items-center gap-1">
                      🇲🇽 Español
                    </Label>
                    <Textarea
                      value={currentData.documentParsePromptEs || ''}
                      onChange={(e) => handleFieldChange('documentParsePromptEs', e.target.value, false)}
                      onBlur={() => handleFieldBlur('documentParsePromptEs', false)}
                      rows={10}
                      placeholder="Eres un experto en análisis de inventarios para una empresa de mudanzas..."
                      data-testid="input-document-parse-prompt-es"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {isSpanish ? "Placeholders disponibles:" : "Available placeholders:"}
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li><code className="bg-white px-1 rounded">{"{{CATEGORIES}}"}</code> - {isSpanish ? "Lista de categorías de inventario" : "List of inventory categories"}</li>
                    <li><code className="bg-white px-1 rounded">{"{{ROOMS}}"}</code> - {isSpanish ? "Lista de habitaciones disponibles" : "List of available rooms"}</li>
                    <li><code className="bg-white px-1 rounded">{"{{CATALOG}}"}</code> - {isSpanish ? "Catálogo de artículos predefinidos" : "Catalog of predefined items"}</li>
                    <li><code className="bg-white px-1 rounded">{"{{CONTENT}}"}</code> - {isSpanish ? "Contenido del documento/transcripción" : "Document/transcription content"}</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-medium">
                    {isSpanish ? "La transcripción de audio es independiente" : "Audio transcription is separate"}
                  </p>
                  <p className="mt-1">
                    {isSpanish
                      ? "Los archivos de audio se transcriben con un modelo de transcripción dedicado. Después, Claude Sonnet 4.6 procesa la transcripción, con GPT-5 como respaldo."
                      : "Audio files are transcribed by a dedicated transcription model. Claude Sonnet 4.6 then processes the transcript, with GPT-5 as fallback."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Translation prompt dialog */}
      <Dialog open={translateDialog?.open || false} onOpenChange={(open) => !open && setTranslateDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              {isSpanish ? "Mantener consistencia" : "Maintain consistency"}
            </DialogTitle>
            <DialogDescription>
              {isSpanish 
                ? "Has modificado el texto. ¿Quieres traducir automáticamente al otro idioma para mantener la consistencia?"
                : "You've modified the text. Would you like to auto-translate to the other language to maintain consistency?"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>{translateDialog?.fromLanguage === 'en' ? '🇺🇸' : '🇲🇽'}</span>
              <span className="font-medium">
                {translateDialog?.fromLanguage === 'en' 
                  ? (isSpanish ? 'Inglés → Español' : 'English → Spanish')
                  : (isSpanish ? 'Español → Inglés' : 'Spanish → English')}
              </span>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleDeclineTranslation}
              disabled={translateMutation.isPending}
              data-testid="button-decline-translate"
            >
              {isSpanish ? "No, dejar diferente" : "No, keep different"}
            </Button>
            <Button
              onClick={handleAcceptTranslation}
              disabled={translateMutation.isPending}
              data-testid="button-accept-translate"
            >
              {translateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSpanish ? "Sí, traducir" : "Yes, translate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consistency fix dialog */}
      <Dialog open={consistencyDialog.open} onOpenChange={(open) => !open && setConsistencyDialog({ open: false, fieldPair: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isSpanish ? "Corregir inconsistencia" : "Fix inconsistency"}
            </DialogTitle>
            <DialogDescription>
              {isSpanish 
                ? "Los textos en inglés y español no están sincronizados. Elige cuál usar como base para la traducción."
                : "The English and Spanish texts are out of sync. Choose which one to use as the base for translation."}
            </DialogDescription>
          </DialogHeader>
          {consistencyDialog.fieldPair && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {isSpanish ? "Usar como base:" : "Use as base:"}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => consistencyDialog.fieldPair && handleFixConsistency(consistencyDialog.fieldPair, 'en')}
                    disabled={translateMutation.isPending}
                    data-testid="button-use-english"
                  >
                    <span className="text-lg">🇺🇸</span>
                    <span className="text-sm">English</span>
                    <span className="text-xs text-slate-500">→ {isSpanish ? "traducir a ES" : "translate to ES"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => consistencyDialog.fieldPair && handleFixConsistency(consistencyDialog.fieldPair, 'es')}
                    disabled={translateMutation.isPending}
                    data-testid="button-use-spanish"
                  >
                    <span className="text-lg">🇲🇽</span>
                    <span className="text-sm">Español</span>
                    <span className="text-xs text-slate-500">→ {isSpanish ? "traducir a EN" : "translate to EN"}</span>
                  </Button>
                </div>
              </div>
              {translateMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isSpanish ? "Traduciendo..." : "Translating..."}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
