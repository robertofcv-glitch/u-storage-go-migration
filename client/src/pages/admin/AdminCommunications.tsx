import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { 
  Mail, 
  Settings2, 
  Send, 
  FileText, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Megaphone,
  ShieldCheck,
  Bell,
  Plug,
  Zap,
  Eye,
  Edit2,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Star,
  Info,
  Sparkles,
  Code,
  Eye as EyeIcon,
  MessageSquare,
  MessageCircle,
  Phone,
  Users
} from "lucide-react";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";

interface EmailConfig {
  id: string;
  provider: string;
  isConfigured: boolean;
  senderName: string;
  senderEmail: string | null;
  replyToEmail: string | null;
  functionalEmailsEnabled: boolean;
  transactionalEmailsEnabled: boolean;
  marketingEmailsEnabled: boolean;
}

interface EmailTemplate {
  id: string;
  templateKey: string;
  category: string;
  channel: string;
  sendMode: string;
  triggerId: string | null;
  senderId: string | null;
  nameEn: string | null;
  nameEs: string | null;
  subjectEn: string;
  subjectEs: string;
  bodyHtmlEn: string;
  bodyHtmlEs: string;
  bodyTextEn: string | null;
  bodyTextEs: string | null;
  twilioContentSid: string | null;
  mediaUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailTrigger {
  id: string;
  eventKey: string;
  eventNameEn: string;
  eventNameEs: string;
  eventDescriptionEn: string;
  eventDescriptionEs: string;
  channel: string;
  templateId: string | null;
  isEnabled: boolean;
  delayMinutes: number;
  recipientType: string;
}

interface EmailEventType {
  id: string;
  eventKey: string;
  category: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  defaultRecipientType: string;
}

interface EmailLog {
  id: string;
  templateKey: string | null;
  channel: string;
  recipientEmail: string;
  recipientPhone: string | null;
  subject: string;
  category: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface EmailStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  delivered: number;
  read: number;
}

interface GmailStatus {
  isConnected: boolean;
  primaryEmail: string | null;
  sendAsAddresses: Array<{ email: string; displayName: string; isDefault: boolean; isPrimary: boolean }>;
  error?: string;
}

interface WhatsappStatus {
  isConnected: boolean;
  whatsappNumber: string | null;
  accountSid: string | null;
  connectionStatus: string;
  lastChecked: string | null;
  error?: string;
}

interface WhatsappConfigData {
  isConfigured: boolean;
  twilioAccountSid: string | null;
  whatsappNumber: string | null;
  isActive: boolean;
  connectionStatus: string;
  lastConnectionCheck: string | null;
}

interface EmailSender {
  id: string;
  displayName: string;
  email: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCommunications() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language === 'es';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<'es' | 'en'>('es');
  const [showPreview, setShowPreview] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<EmailTrigger | null>(null);
  const [showAddSenderDialog, setShowAddSenderDialog] = useState(false);
  const [newSender, setNewSender] = useState({ displayName: '', email: '' });
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [newTemplate, setNewTemplate] = useState({
    templateKey: '',
    nameEn: '',
    nameEs: '',
    category: 'transactional',
    channel: 'email',
    sendMode: 'manual',
    triggerId: '',
    senderId: '',
    subjectEn: '',
    subjectEs: '',
    bodyHtmlEn: '',
    bodyHtmlEs: '',
    twilioContentSid: '',
    mediaUrl: '',
  });
  const [showManualSendDialog, setShowManualSendDialog] = useState(false);
  const [manualSendTemplate, setManualSendTemplate] = useState<EmailTemplate | null>(null);
  const [manualSendAudience, setManualSendAudience] = useState('all_users');
  const [showCreateCampaignDialog, setShowCreateCampaignDialog] = useState(false);
  const [showCreateTriggerDialog, setShowCreateTriggerDialog] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    eventTypeId: '',
    templateId: '',
    channel: 'email',
    delayMinutes: 0,
  });
  const [templateViewMode, setTemplateViewMode] = useState<'html' | 'preview'>('html');
  const [newTemplateViewMode, setNewTemplateViewMode] = useState<'html' | 'preview'>('html');
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    category: 'marketing',
    channel: 'email',
    templateId: '',
    senderId: '',
    targetSegment: 'all_users',
  });

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const { data: emailConfig, isLoading: configLoading } = useQuery<EmailConfig>({
    queryKey: ['/api/admin/email-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-config');
      if (!res.ok) throw new Error('Failed to fetch email config');
      return res.json();
    },
  });

  const { data: gmailStatus, isLoading: gmailStatusLoading, refetch: refetchGmailStatus } = useQuery<GmailStatus>({
    queryKey: ['/api/admin/gmail-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/gmail-status');
      if (!res.ok) throw new Error('Failed to fetch Gmail status');
      return res.json();
    },
  });

  const { data: whatsappConfigData, isLoading: waConfigLoading, refetch: refetchWaConfig } = useQuery<WhatsappConfigData>({
    queryKey: ['/api/admin/whatsapp-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/whatsapp-config');
      if (!res.ok) throw new Error('Failed to fetch WhatsApp config');
      return res.json();
    },
  });

  const { data: whatsappStatus, isLoading: waStatusLoading, refetch: refetchWaStatus } = useQuery<WhatsappStatus>({
    queryKey: ['/api/admin/whatsapp-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/whatsapp-status');
      if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
      return res.json();
    },
    enabled: !!whatsappConfigData?.isConfigured,
  });

  const [waEditing, setWaEditing] = useState(false);
  const [waForm, setWaForm] = useState({ twilioAccountSid: '', twilioAuthToken: '', whatsappNumber: '' });

  const saveWhatsappConfigMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch('/api/admin/whatsapp-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save WhatsApp config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-status'] });
      setWaEditing(false);
      toast({ title: isEs ? 'Configuración guardada' : 'Configuration saved' });
    },
    onError: (err: any) => {
      toast({ title: isEs ? 'Error' : 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const { data: emailSenders, isLoading: sendersLoading } = useQuery<EmailSender[]>({
    queryKey: ['/api/admin/email-senders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-senders');
      if (!res.ok) throw new Error('Failed to fetch email senders');
      return res.json();
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/admin/email-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const { data: triggers, isLoading: triggersLoading } = useQuery<EmailTrigger[]>({
    queryKey: ['/api/admin/email-triggers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-triggers');
      if (!res.ok) throw new Error('Failed to fetch triggers');
      return res.json();
    },
  });

  const { data: eventTypes } = useQuery<EmailEventType[]>({
    queryKey: ['/api/admin/email-event-types'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-event-types');
      if (!res.ok) throw new Error('Failed to fetch event types');
      return res.json();
    },
  });

  const { data: emailLogs } = useQuery<EmailLog[]>({
    queryKey: ['/api/admin/email-logs', channelFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      const res = await fetch(`/api/admin/email-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch email logs');
      return res.json();
    },
  });

  const { data: emailStats } = useQuery<EmailStats>({
    queryKey: ['/api/admin/email-stats', channelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      const res = await fetch(`/api/admin/email-stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch email stats');
      return res.json();
    },
  });

  interface EmailCampaign {
    id: string;
    name: string;
    description: string | null;
    category: string;
    channel: string;
    templateId: string | null;
    senderId: string | null;
    status: string;
    targetSegment: string | null;
    scheduledAt: string | null;
    lastRunAt: string | null;
    recipientCount: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    openCount: number;
    clickCount: number;
    failedCount: number;
    isActive: boolean;
    createdAt: string;
  }

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<EmailCampaign[]>({
    queryKey: ['/api/admin/email-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-campaigns');
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
  });

  useEffect(() => {
    if (emailConfig) {
      setConfig(emailConfig);
    }
  }, [emailConfig]);

  const saveConfigMutation = useMutation({
    mutationFn: async (configData: Partial<EmailConfig>) => {
      const res = await fetch('/api/admin/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });
      if (!res.ok) throw new Error('Failed to save config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-config'] });
      toast({
        title: isEs ? 'Guardado' : 'Saved',
        description: isEs ? 'Configuración guardada exitosamente' : 'Configuration saved successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo guardar la configuración' : 'Failed to save configuration',
        variant: "destructive",
      });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const res = await fetch(`/api/admin/email-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error('Failed to save template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
      setEditingTemplate(null);
      toast({
        title: isEs ? 'Guardado' : 'Saved',
        description: isEs ? 'Plantilla guardada exitosamente' : 'Template saved successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo guardar la plantilla' : 'Failed to save template',
        variant: "destructive",
      });
    },
  });

  const saveTriggerMutation = useMutation({
    mutationFn: async (trigger: EmailTrigger) => {
      const res = await fetch(`/api/admin/email-triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trigger),
      });
      if (!res.ok) throw new Error('Failed to save trigger');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-triggers'] });
      setEditingTrigger(null);
      toast({
        title: isEs ? 'Guardado' : 'Saved',
        description: isEs ? 'Disparador guardado exitosamente' : 'Trigger saved successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo guardar el disparador' : 'Failed to save trigger',
        variant: "destructive",
      });
    },
  });

  const createTriggerMutation = useMutation({
    mutationFn: async (data: { eventTypeId: string; templateId?: string; delayMinutes?: number }) => {
      const payload = {
        ...data,
        templateId: data.templateId === 'none' ? null : data.templateId || null,
      };
      const res = await fetch('/api/admin/email-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create trigger');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-triggers'] });
      setShowCreateTriggerDialog(false);
      setNewTrigger({ eventTypeId: '', templateId: '', delayMinutes: 0 });
      toast({
        title: isEs ? 'Creado' : 'Created',
        description: isEs ? 'Disparador creado exitosamente' : 'Trigger created successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo crear el disparador' : 'Failed to create trigger',
        variant: "destructive",
      });
    },
  });

  const deleteTriggerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email-triggers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete trigger');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-triggers'] });
      toast({
        title: isEs ? 'Eliminado' : 'Deleted',
        description: isEs ? 'Disparador eliminado' : 'Trigger deleted',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo eliminar el disparador' : 'Failed to delete trigger',
        variant: "destructive",
      });
    },
  });

  const createSenderMutation = useMutation({
    mutationFn: async (data: { displayName: string; email: string }) => {
      const res = await fetch('/api/admin/email-senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create sender');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-senders'] });
      setShowAddSenderDialog(false);
      setNewSender({ displayName: '', email: '' });
      toast({
        title: isEs ? 'Creado' : 'Created',
        description: isEs ? 'Remitente creado exitosamente' : 'Sender created successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo crear el remitente' : 'Failed to create sender',
        variant: "destructive",
      });
    },
  });

  const deleteSenderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email-senders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sender');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-senders'] });
      toast({
        title: isEs ? 'Eliminado' : 'Deleted',
        description: isEs ? 'Remitente eliminado' : 'Sender deleted',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo eliminar el remitente' : 'Failed to delete sender',
        variant: "destructive",
      });
    },
  });

  const setDefaultSenderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email-senders/${id}/set-default`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to set default sender');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-senders'] });
      toast({
        title: isEs ? 'Actualizado' : 'Updated',
        description: isEs ? 'Remitente predeterminado actualizado' : 'Default sender updated',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo actualizar el remitente' : 'Failed to update sender',
        variant: "destructive",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof newTemplate) => {
      const payload = {
        ...data,
        senderId: data.senderId || null,
        triggerId: data.triggerId || null,
      };
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
      setShowCreateTemplateDialog(false);
      setNewTemplate({
        templateKey: '', nameEn: '', nameEs: '', category: 'transactional',
        sendMode: 'manual', triggerId: '',
        senderId: '', subjectEn: '', subjectEs: '', bodyHtmlEn: '', bodyHtmlEs: '',
      });
      toast({
        title: isEs ? 'Creada' : 'Created',
        description: isEs ? 'Plantilla creada exitosamente' : 'Template created successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo crear la plantilla' : 'Failed to create template',
        variant: "destructive",
      });
    },
  });

  const manualSendMutation = useMutation({
    mutationFn: async ({ templateId, audience }: { templateId: string; audience: string }) => {
      const res = await fetch('/api/admin/email-templates/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, audience }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to send emails');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-logs'] });
      setShowManualSendDialog(false);
      setManualSendTemplate(null);
      toast({
        title: isEs ? 'Enviado' : 'Sent',
        description: isEs 
          ? `Correos enviados a ${data.recipientCount} destinatarios`
          : `Emails sent to ${data.recipientCount} recipients`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: error.message || (isEs ? 'No se pudieron enviar los correos' : 'Failed to send emails'),
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
      toast({
        title: isEs ? 'Eliminada' : 'Deleted',
        description: isEs ? 'Plantilla eliminada' : 'Template deleted',
      });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof newCampaign) => {
      const payload = {
        ...data,
        senderId: data.senderId || null,
        templateId: data.templateId || null,
      };
      const res = await fetch('/api/admin/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create campaign');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
      setShowCreateCampaignDialog(false);
      setNewCampaign({
        name: '', description: '', category: 'marketing',
        templateId: '', senderId: '', targetSegment: 'all_users',
      });
      toast({
        title: isEs ? 'Creada' : 'Created',
        description: isEs ? 'Campaña creada exitosamente' : 'Campaign created successfully',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo crear la campaña' : 'Failed to create campaign',
        variant: "destructive",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
      toast({
        title: isEs ? 'Eliminada' : 'Deleted',
        description: isEs ? 'Campaña eliminada' : 'Campaign deleted',
      });
    },
  });

  const translateTemplateMutation = useMutation({
    mutationFn: async (data: { subjectEs: string; bodyHtmlEs: string }) => {
      const res = await fetch('/api/admin/translate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Translation failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          subjectEn: data.subjectEn || editingTemplate.subjectEn,
          bodyHtmlEn: data.bodyHtmlEn || editingTemplate.bodyHtmlEn,
        });
      }
      toast({
        title: isEs ? 'Traducido' : 'Translated',
        description: isEs ? 'Contenido traducido con IA' : 'Content translated with AI',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo traducir el contenido' : 'Failed to translate content',
        variant: "destructive",
      });
    },
  });

  const translateNewTemplateMutation = useMutation({
    mutationFn: async (data: { subjectEs: string; bodyHtmlEs: string }) => {
      const res = await fetch('/api/admin/translate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Translation failed');
      return res.json();
    },
    onSuccess: (data) => {
      setNewTemplate(t => ({
        ...t,
        subjectEn: data.subjectEn || t.subjectEn,
        bodyHtmlEn: data.bodyHtmlEn || t.bodyHtmlEn,
      }));
      toast({
        title: isEs ? 'Traducido' : 'Translated',
        description: isEs ? 'Contenido traducido con IA' : 'Content translated with AI',
      });
    },
    onError: () => {
      toast({
        title: isEs ? 'Error' : 'Error',
        description: isEs ? 'No se pudo traducir el contenido' : 'Failed to translate content',
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    if (config) {
      saveConfigMutation.mutate(config);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-[hsl(var(--success)/.12)] text-[hsl(var(--success))]"><CheckCircle2 className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'delivered':
        return <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'read':
        return <Badge className="bg-accent text-accent-foreground"><Eye className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'pending':
        return <Badge className="bg-[hsl(var(--action)/.12)] text-[hsl(var(--action))]"><Clock className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'failed':
      case 'bounced':
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'whatsapp' 
      ? <MessageCircle className="w-4 h-4 text-[hsl(var(--success))]" />
      : <Mail className="w-4 h-4 text-primary" />;
  };

  const getChannelBadge = (channel: string) => {
    return channel === 'whatsapp'
      ? <Badge className="bg-[hsl(var(--success)/.12)] text-[hsl(var(--success))] text-xs"><MessageCircle className="w-3 h-3 mr-1" /> WhatsApp</Badge>
      : <Badge className="bg-accent text-accent-foreground text-xs"><Mail className="w-3 h-3 mr-1" /> Email</Badge>;
  };

  const ChannelFilterButtons = () => (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1" data-testid="channel-filter">
      <Button
        variant={channelFilter === 'all' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setChannelFilter('all')}
        className="h-7 text-xs"
        data-testid="filter-channel-all"
      >
        {isEs ? 'Todos' : 'All'}
      </Button>
      <Button
        variant={channelFilter === 'email' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setChannelFilter('email')}
        className="h-7 text-xs gap-1"
        data-testid="filter-channel-email"
      >
        <Mail className="w-3 h-3" /> Email
      </Button>
      <Button
        variant={channelFilter === 'whatsapp' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setChannelFilter('whatsapp')}
        className="h-7 text-xs gap-1"
        data-testid="filter-channel-whatsapp"
      >
        <MessageCircle className="w-3 h-3" /> WhatsApp
      </Button>
    </div>
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'functional':
        return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      case 'transactional':
        return <Bell className="w-4 h-4 text-green-500" />;
      case 'marketing':
        return <Megaphone className="w-4 h-4 text-purple-500" />;
      default:
        return <Mail className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, { en: string; es: string }> = {
      functional: { en: 'Functional', es: 'Funcional' },
      transactional: { en: 'Transactional', es: 'Transaccional' },
      marketing: { en: 'Marketing', es: 'Marketing' },
    };
    return labels[category]?.[isEs ? 'es' : 'en'] || category;
  };

  const getRecipientLabel = (type: string) => {
    const labels: Record<string, { en: string; es: string }> = {
      user: { en: 'User', es: 'Usuario' },
      client: { en: 'Client', es: 'Cliente' },
      mover: { en: 'Mover', es: 'Socio' },
      admin: { en: 'Admin', es: 'Admin' },
    };
    return labels[type]?.[isEs ? 'es' : 'en'] || type;
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEs ? 'Comunicaciones' : 'Communications'}
          </h1>
          <p className="text-muted-foreground">
            {isEs ? 'Gestiona email y WhatsApp: plantillas, campañas y disparadores' : 'Manage email & WhatsApp: templates, campaigns and triggers'}
          </p>
        </div>

        <Tabs defaultValue="connection" className="space-y-4">
          <TabsList className="grid grid-cols-6 w-full max-w-3xl min-w-max overflow-x-auto">
            <TabsTrigger value="connection" className="gap-2">
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Conexión' : 'Connection'}</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Plantillas' : 'Templates'}</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Campañas' : 'Campaigns'}</span>
            </TabsTrigger>
            <TabsTrigger value="triggers" className="gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Disparadores' : 'Triggers'}</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Historial' : 'Logs'}</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{isEs ? 'Estadísticas' : 'Stats'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <Card className="border-2 border-[hsl(var(--success)/.2)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[hsl(var(--success)/.12)] rounded-xl">
                      <MessageCircle className="w-8 h-8 text-[hsl(var(--success))]" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">WhatsApp</CardTitle>
                      <CardDescription>
                        {isEs ? 'Canal de mensajería WhatsApp vía Twilio' : 'WhatsApp messaging channel via Twilio'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-[hsl(var(--action)/.12)] text-[hsl(var(--action))] py-1.5 px-3">
                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                    {isEs ? 'Configuración Externa' : 'External Setup'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-[hsl(var(--success)/.08)] border border-[hsl(var(--success)/.25)] rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[hsl(var(--success))] mt-0.5" />
                    <div>
                      <p className="font-medium text-[hsl(var(--success))]">
                        {isEs ? 'Plantillas de WhatsApp' : 'WhatsApp Templates'}
                      </p>
                      <p className="text-sm text-[hsl(var(--success))] mt-1">
                        {isEs 
                          ? 'Las plantillas de WhatsApp deben ser pre-aprobadas por Meta a través de la consola de Twilio. Crea las plantillas aquí y luego envíalas para aprobación en Twilio.'
                          : 'WhatsApp templates must be pre-approved by Meta via the Twilio console. Create templates here, then submit them for approval in Twilio.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 border rounded-lg text-center">
                    <FileText className="w-6 h-6 mx-auto text-green-500 mb-2" />
                    <p className="text-sm font-medium">{isEs ? 'Plantillas WA' : 'WA Templates'}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {templates?.filter(t => t.channel === 'whatsapp').length || 0}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Megaphone className="w-6 h-6 mx-auto text-green-500 mb-2" />
                    <p className="text-sm font-medium">{isEs ? 'Campañas WA' : 'WA Campaigns'}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {campaigns?.filter(c => c.channel === 'whatsapp').length || 0}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Zap className="w-6 h-6 mx-auto text-green-500 mb-2" />
                    <p className="text-sm font-medium">{isEs ? 'Disparadores WA' : 'WA Triggers'}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {triggers?.filter(t => t.channel === 'whatsapp').length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-destructive/10 rounded-xl">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-xl">Gmail</CardTitle>
                      <CardDescription>
                        {isEs ? 'Integración de correo electrónico' : 'Email integration'}
                        {gmailStatus?.primaryEmail && (
                          <span className="ml-2 text-action">({gmailStatus.primaryEmail})</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchGmailStatus()}
                      disabled={gmailStatusLoading}
                      data-testid="button-refresh-gmail-status"
                    >
                      <RefreshCw className={`w-4 h-4 ${gmailStatusLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    {gmailStatus?.isConnected ? (
                      <Badge className="bg-[hsl(var(--success)/.12)] text-[hsl(var(--success))] py-1.5 px-3">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        {isEs ? 'Conectado' : 'Connected'}
                      </Badge>
                    ) : (
                      <Badge className="bg-[hsl(var(--action)/.12)] text-[hsl(var(--action))] py-1.5 px-3">
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        {isEs ? 'No Configurado' : 'Not Configured'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {gmailStatus?.isConnected ? (
                  <div className="p-4 bg-[hsl(var(--success)/.08)] border border-[hsl(var(--success)/.25)] rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] mt-0.5" />
                      <div>
                        <p className="font-medium text-[hsl(var(--success))]">
                          {isEs ? 'Gmail está conectado y listo para enviar' : 'Gmail is connected and ready to send'}
                        </p>
                        <p className="text-sm text-[hsl(var(--success))] mt-1">
                          {isEs 
                            ? `Cuenta conectada: ${gmailStatus.primaryEmail}`
                            : `Connected account: ${gmailStatus.primaryEmail}`}
                        </p>
                        {gmailStatus.sendAsAddresses.length > 1 && (
                          <p className="text-sm text-[hsl(var(--success))] mt-1">
                            {isEs 
                              ? `${gmailStatus.sendAsAddresses.length} direcciones de envío disponibles`
                              : `${gmailStatus.sendAsAddresses.length} send-as addresses available`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-accent border border-border rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-accent-foreground">
                          {isEs ? 'Configuración requerida' : 'Configuration required'}
                        </p>
                        <p className="text-sm text-accent-foreground mt-1">
                          {isEs 
                            ? 'Conecta Gmail en la sección de integraciones de Replit para habilitar el envío de correos.'
                            : 'Connect Gmail in the Replit integrations section to enable email sending.'}
                        </p>
                        {gmailStatus?.error && (
                          <p className="text-xs text-red-600 mt-2">
                            Error: {gmailStatus.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{isEs ? 'Correos de Remitente Disponibles' : 'Available Sender Emails'}</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddSenderDialog(true)}
                      data-testid="button-add-sender"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isEs ? 'Agregar Correo' : 'Add Email'}
                    </Button>
                  </div>
                  
                  {sendersLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      {isEs ? 'Cargando...' : 'Loading...'}
                    </div>
                  ) : emailSenders && emailSenders.length > 0 ? (
                    <div className="space-y-2">
                      {emailSenders.map((sender) => (
                        <div 
                          key={sender.id} 
                          className={`flex items-center justify-between p-3 border rounded-lg ${sender.isDefault ? 'border-primary bg-primary/5' : ''}`}
                          data-testid={`sender-row-${sender.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <Mail className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{sender.displayName}</span>
                                {sender.isDefault && (
                                  <Badge className="bg-action/20 text-action text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    {isEs ? 'Predeterminado' : 'Default'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500">{sender.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!sender.isDefault && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setDefaultSenderMutation.mutate(sender.id)}
                                  disabled={setDefaultSenderMutation.isPending}
                                  data-testid={`button-set-default-${sender.id}`}
                                >
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => deleteSenderMutation.mutate(sender.id)}
                                  disabled={deleteSenderMutation.isPending}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`button-delete-sender-${sender.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Mail className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-slate-500">
                        {isEs ? 'No hay correos de remitente configurados' : 'No sender emails configured'}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAddSenderDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {isEs ? 'Agregar el primero' : 'Add the first one'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">{isEs ? 'Categorías de Correo' : 'Email Categories'}</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <ShieldCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{isEs ? 'Funcionales' : 'Functional'}</p>
                          <p className="text-xs text-slate-500">{isEs ? 'Contraseñas, verificación' : 'Passwords, verification'}</p>
                        </div>
                      </div>
                      <Switch
                        checked={config?.functionalEmailsEnabled ?? true}
                        onCheckedChange={(v) => setConfig(c => c ? {...c, functionalEmailsEnabled: v} : null)}
                        data-testid="switch-functional-emails"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Bell className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{isEs ? 'Transaccionales' : 'Transactional'}</p>
                          <p className="text-xs text-slate-500">{isEs ? 'Cotizaciones, ofertas' : 'Quotes, bids'}</p>
                        </div>
                      </div>
                      <Switch
                        checked={config?.transactionalEmailsEnabled ?? true}
                        onCheckedChange={(v) => setConfig(c => c ? {...c, transactionalEmailsEnabled: v} : null)}
                        data-testid="switch-transactional-emails"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Megaphone className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Marketing</p>
                          <p className="text-xs text-slate-500">{isEs ? 'Promociones, noticias' : 'Promotions, news'}</p>
                        </div>
                      </div>
                      <Switch
                        checked={config?.marketingEmailsEnabled ?? false}
                        onCheckedChange={(v) => setConfig(c => c ? {...c, marketingEmailsEnabled: v} : null)}
                        data-testid="switch-marketing-emails"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleSaveConfig}
                    disabled={saveConfigMutation.isPending}
                    data-testid="button-save-email-config"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveConfigMutation.isPending 
                      ? (isEs ? 'Guardando...' : 'Saving...') 
                      : (isEs ? 'Guardar Configuración' : 'Save Configuration')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">WhatsApp</CardTitle>
                      <CardDescription>
                        {isEs ? 'Integración de mensajería via Twilio' : 'Messaging integration via Twilio'}
                        {whatsappConfigData?.whatsappNumber && (
                          <span className="ml-2 text-green-600">({whatsappConfigData.whatsappNumber})</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { refetchWaConfig(); refetchWaStatus(); }}
                      disabled={waConfigLoading || waStatusLoading}
                      data-testid="button-refresh-whatsapp-status"
                    >
                      <RefreshCw className={`w-4 h-4 ${(waConfigLoading || waStatusLoading) ? 'animate-spin' : ''}`} />
                    </Button>
                    {whatsappStatus?.isConnected ? (
                      <Badge className="bg-green-100 text-green-700 py-1.5 px-3">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        {isEs ? 'Conectado' : 'Connected'}
                      </Badge>
                    ) : whatsappConfigData?.isConfigured ? (
                      <Badge className="bg-yellow-100 text-yellow-700 py-1.5 px-3">
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        {isEs ? 'Error de conexión' : 'Connection Error'}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-700 py-1.5 px-3">
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        {isEs ? 'No Configurado' : 'Not Configured'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {whatsappStatus?.isConnected ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-800">
                          {isEs ? 'WhatsApp está conectado y listo para enviar' : 'WhatsApp is connected and ready to send'}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {isEs
                            ? `Número configurado: ${whatsappConfigData?.whatsappNumber}`
                            : `Configured number: ${whatsappConfigData?.whatsappNumber}`}
                        </p>
                        {whatsappStatus.accountSid && (
                          <p className="text-sm text-green-600 mt-1">
                            Twilio Account: {whatsappStatus.accountSid.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : whatsappConfigData?.isConfigured ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">
                          {isEs ? 'Credenciales configuradas pero no se pudo conectar' : 'Credentials configured but connection failed'}
                        </p>
                        {whatsappStatus?.error && (
                          <p className="text-xs text-red-600 mt-2">
                            Error: {whatsappStatus.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">
                          {isEs ? 'Configuración requerida' : 'Configuration required'}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          {isEs
                            ? 'Ingresa tus credenciales de Twilio para habilitar WhatsApp.'
                            : 'Enter your Twilio credentials to enable WhatsApp.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{isEs ? 'Credenciales de Twilio' : 'Twilio Credentials'}</h3>
                    {!waEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setWaForm({
                            twilioAccountSid: '',
                            twilioAuthToken: '',
                            whatsappNumber: whatsappConfigData?.whatsappNumber || '',
                          });
                          setWaEditing(true);
                        }}
                        data-testid="button-edit-whatsapp-config"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        {isEs ? 'Editar' : 'Edit'}
                      </Button>
                    )}
                  </div>

                  {waEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label>{isEs ? 'Account SID de Twilio' : 'Twilio Account SID'}</Label>
                        <Input
                          type="text"
                          value={waForm.twilioAccountSid}
                          onChange={(e) => setWaForm(f => ({ ...f, twilioAccountSid: e.target.value }))}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          data-testid="input-twilio-account-sid"
                        />
                      </div>
                      <div>
                        <Label>{isEs ? 'Auth Token de Twilio' : 'Twilio Auth Token'}</Label>
                        <Input
                          type="password"
                          value={waForm.twilioAuthToken}
                          onChange={(e) => setWaForm(f => ({ ...f, twilioAuthToken: e.target.value }))}
                          placeholder="••••••••••••••••••••••••••••••••"
                          data-testid="input-twilio-auth-token"
                        />
                      </div>
                      <div>
                        <Label>{isEs ? 'Número de WhatsApp' : 'WhatsApp Number'}</Label>
                        <Input
                          type="text"
                          value={waForm.whatsappNumber}
                          onChange={(e) => setWaForm(f => ({ ...f, whatsappNumber: e.target.value }))}
                          placeholder="+5215512345678"
                          data-testid="input-whatsapp-number"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          {isEs
                            ? 'Número registrado en Twilio para WhatsApp Business (incluir código de país)'
                            : 'Number registered with Twilio for WhatsApp Business (include country code)'}
                        </p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setWaEditing(false)} data-testid="button-cancel-whatsapp-config">
                          {isEs ? 'Cancelar' : 'Cancel'}
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          disabled={saveWhatsappConfigMutation.isPending}
                          onClick={() => {
                            const data: Record<string, any> = {};
                            if (waForm.twilioAccountSid) data.twilioAccountSid = waForm.twilioAccountSid;
                            if (waForm.twilioAuthToken) data.twilioAuthToken = waForm.twilioAuthToken;
                            if (waForm.whatsappNumber) data.whatsappNumber = waForm.whatsappNumber;
                            data.isActive = true;
                            saveWhatsappConfigMutation.mutate(data);
                          }}
                          data-testid="button-save-whatsapp-config"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saveWhatsappConfigMutation.isPending
                            ? (isEs ? 'Guardando...' : 'Saving...')
                            : (isEs ? 'Guardar' : 'Save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Settings2 className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Account SID</p>
                            <p className="text-sm text-slate-500">
                              {whatsappConfigData?.twilioAccountSid || (isEs ? 'No configurado' : 'Not configured')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Phone className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{isEs ? 'Número de WhatsApp' : 'WhatsApp Number'}</p>
                            <p className="text-sm text-slate-500">
                              {whatsappConfigData?.whatsappNumber || (isEs ? 'No configurado' : 'Not configured')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-3">{isEs ? 'Webhooks' : 'Webhooks'}</h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="text-xs font-medium text-slate-600 mb-1">{isEs ? 'URL de mensajes entrantes' : 'Inbound Messages URL'}</p>
                      <code className="text-xs text-slate-800 break-all" data-testid="text-webhook-inbound-url">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp/inbound` : '/api/webhooks/whatsapp/inbound'}
                      </code>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="text-xs font-medium text-slate-600 mb-1">{isEs ? 'URL de estado de entrega' : 'Delivery Status URL'}</p>
                      <code className="text-xs text-slate-800 break-all" data-testid="text-webhook-status-url">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp/status` : '/api/webhooks/whatsapp/status'}
                      </code>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {isEs
                        ? 'Configura estas URLs en tu cuenta de Twilio para recibir mensajes y actualizaciones de estado.'
                        : 'Configure these URLs in your Twilio account to receive messages and status updates.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{isEs ? 'Plantillas de Comunicación' : 'Communication Templates'}</CardTitle>
                    <CardDescription>
                      {isEs 
                        ? 'Gestiona plantillas de email y WhatsApp. Usa {{variable}} para datos dinámicos.'
                        : 'Manage email and WhatsApp templates. Use {{variable}} for dynamic data.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChannelFilterButtons />
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => setShowCreateTemplateDialog(true)}
                      data-testid="button-create-template"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isEs ? 'Nueva Plantilla' : 'New Template'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : templates && templates.filter(t => channelFilter === 'all' || t.channel === channelFilter).length > 0 ? (
                  <div className="space-y-3">
                    {templates.filter(t => channelFilter === 'all' || t.channel === channelFilter).map((template) => (
                      <div 
                        key={template.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {getChannelIcon(template.channel)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{isEs ? template.subjectEs : template.subjectEn}</p>
                              {getChannelBadge(template.channel)}
                              {!template.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  {isEs ? 'Inactivo' : 'Inactive'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {template.templateKey}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {getCategoryLabel(template.category)}
                              </span>
                              <Badge 
                                variant={template.sendMode === 'automated' ? 'default' : template.sendMode === 'both' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {template.sendMode === 'automated' 
                                  ? (isEs ? 'Automático' : 'Automated')
                                  : template.sendMode === 'both'
                                  ? (isEs ? 'Manual + Auto' : 'Manual + Auto')
                                  : (isEs ? 'Manual' : 'Manual')}
                              </Badge>
                              {template.channel === 'whatsapp' && template.twilioContentSid && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  SID: {template.twilioContentSid}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(template.sendMode === 'manual' || template.sendMode === 'both') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-action border-action hover:bg-action/10"
                              onClick={() => {
                                setManualSendTemplate(template);
                                setShowManualSendDialog(true);
                              }}
                              data-testid={`button-send-template-${template.templateKey}`}
                            >
                              <Send className="w-4 h-4" />
                              {isEs ? 'Enviar' : 'Send'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTemplate(template);
                              setShowPreview(true);
                            }}
                            data-testid={`button-preview-template-${template.templateKey}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                            data-testid={`button-edit-template-${template.templateKey}`}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            {isEs ? 'Editar' : 'Edit'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{isEs ? 'No hay plantillas configuradas' : 'No templates configured'}</p>
                    <p className="text-sm mt-1">
                      {isEs ? 'Las plantillas se crearán automáticamente' : 'Templates will be created automatically'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-action" />
                      {isEs ? 'Campañas' : 'Campaigns'}
                    </CardTitle>
                    <CardDescription>
                      {isEs 
                        ? 'Gestiona campañas de email y WhatsApp'
                        : 'Manage email and WhatsApp campaigns'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChannelFilterButtons />
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => setShowCreateCampaignDialog(true)}
                      data-testid="button-create-campaign"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isEs ? 'Nueva Campaña' : 'New Campaign'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : campaigns && campaigns.filter(c => channelFilter === 'all' || c.channel === channelFilter).length > 0 ? (
                  <div className="space-y-4">
                    {campaigns.filter(c => channelFilter === 'all' || c.channel === channelFilter).map((campaign) => (
                      <div 
                        key={campaign.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                        data-testid={`card-campaign-${campaign.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            campaign.status === 'active' ? 'bg-green-100' :
                            campaign.status === 'scheduled' ? 'bg-blue-100' :
                            campaign.status === 'draft' ? 'bg-slate-100' : 'bg-slate-100'
                          }`}>
                            {campaign.channel === 'whatsapp' 
                              ? <MessageCircle className={`w-5 h-5 ${campaign.status === 'active' ? 'text-green-600' : campaign.status === 'scheduled' ? 'text-blue-600' : 'text-slate-400'}`} />
                              : <Megaphone className={`w-5 h-5 ${campaign.status === 'active' ? 'text-green-600' : campaign.status === 'scheduled' ? 'text-blue-600' : 'text-slate-400'}`} />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{campaign.name}</p>
                              {getChannelBadge(campaign.channel)}
                              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                {campaign.status === 'active' ? (isEs ? 'Activa' : 'Active') :
                                 campaign.status === 'scheduled' ? (isEs ? 'Programada' : 'Scheduled') :
                                 campaign.status === 'completed' ? (isEs ? 'Completada' : 'Completed') :
                                 (isEs ? 'Borrador' : 'Draft')}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-500">{campaign.description}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {campaign.recipientCount || 0} {isEs ? 'destinatarios' : 'recipients'}
                              </span>
                              {campaign.sentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <Send className="w-3 h-3" />
                                  {campaign.sentCount} {isEs ? 'enviados' : 'sent'}
                                </span>
                              )}
                              {campaign.channel === 'whatsapp' && (campaign.deliveredCount || 0) > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {campaign.deliveredCount} {isEs ? 'entregados' : 'delivered'}
                                </span>
                              )}
                              {campaign.channel === 'whatsapp' && (campaign.readCount || 0) > 0 && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {campaign.readCount} {isEs ? 'leídos' : 'read'}
                                </span>
                              )}
                              {campaign.scheduledAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(campaign.scheduledAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" data-testid={`button-view-campaign-${campaign.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-campaign-${campaign.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-600"
                            onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                            data-testid={`button-delete-campaign-${campaign.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">{isEs ? 'No hay campañas' : 'No campaigns yet'}</p>
                    <p className="text-sm mt-1">
                      {isEs 
                        ? 'Crea tu primera campaña de marketing'
                        : 'Create your first marketing campaign'}
                    </p>
                    <Button 
                      className="mt-4 bg-action hover:bg-action/90"
                      onClick={() => setShowCreateCampaignDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isEs ? 'Crear Campaña' : 'Create Campaign'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{isEs ? 'Disparadores' : 'Triggers'}</CardTitle>
                  <CardDescription>
                    {isEs 
                      ? 'Configura qué eventos envían mensajes automáticamente por email o WhatsApp.'
                      : 'Configure which events send messages automatically via email or WhatsApp.'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <ChannelFilterButtons />
                  <Button
                    className="bg-action hover:bg-action/90"
                    onClick={() => setShowCreateTriggerDialog(true)}
                    data-testid="button-create-trigger"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isEs ? 'Nuevo Disparador' : 'New Trigger'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {triggersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : triggers && triggers.filter(t => channelFilter === 'all' || t.channel === channelFilter).length > 0 ? (
                  <div className="space-y-3">
                    {triggers.filter(t => channelFilter === 'all' || t.channel === channelFilter).map((trigger) => {
                      const linkedTemplate = templates?.find(t => t.id === trigger.templateId);
                      return (
                        <div 
                          key={trigger.id} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${trigger.isEnabled ? 'bg-green-100' : 'bg-slate-100'}`}>
                              {trigger.channel === 'whatsapp' 
                                ? <MessageCircle className={`w-5 h-5 ${trigger.isEnabled ? 'text-green-600' : 'text-slate-400'}`} />
                                : <Zap className={`w-5 h-5 ${trigger.isEnabled ? 'text-green-600' : 'text-slate-400'}`} />
                              }
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {isEs ? trigger.eventNameEs : trigger.eventNameEn}
                                </p>
                                {getChannelBadge(trigger.channel)}
                                {!trigger.isEnabled && (
                                  <Badge variant="secondary" className="text-xs">
                                    {isEs ? 'Deshabilitado' : 'Disabled'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {trigger.eventKey}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  → {getRecipientLabel(trigger.recipientType)}
                                </span>
                                {linkedTemplate && (
                                  <span className="text-xs text-action">
                                    ({linkedTemplate.templateKey})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={trigger.isEnabled}
                              onCheckedChange={(enabled) => {
                                saveTriggerMutation.mutate({ ...trigger, isEnabled: enabled });
                              }}
                              data-testid={`switch-trigger-${trigger.eventKey}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingTrigger(trigger)}
                              data-testid={`button-edit-trigger-${trigger.eventKey}`}
                            >
                              <Settings2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm(isEs ? '¿Eliminar este disparador?' : 'Delete this trigger?')) {
                                  deleteTriggerMutation.mutate(trigger.id);
                                }
                              }}
                              data-testid={`button-delete-trigger-${trigger.eventKey}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{isEs ? 'No hay disparadores configurados' : 'No triggers configured'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{isEs ? 'Historial de Mensajes' : 'Message History'}</CardTitle>
                    <CardDescription>
                      {isEs ? 'Últimos 50 mensajes enviados' : 'Last 50 messages sent'}
                    </CardDescription>
                  </div>
                  <ChannelFilterButtons />
                </div>
              </CardHeader>
              <CardContent>
                {emailLogs && emailLogs.length > 0 ? (
                  <div className="space-y-2">
                    {emailLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`log-entry-${log.id}`}>
                        <div className="flex items-center gap-3">
                          {getChannelIcon(log.channel)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{log.subject}</p>
                              {getChannelBadge(log.channel)}
                            </div>
                            <p className="text-xs text-slate-500">
                              {log.channel === 'whatsapp' && log.recipientPhone 
                                ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {log.recipientPhone}</span>
                                : log.recipientEmail}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(log.status)}
                          {log.deliveredAt && (
                            <span className="text-xs text-blue-500" title={isEs ? 'Entregado' : 'Delivered'}>
                              <CheckCircle2 className="w-3 h-3 inline" />
                            </span>
                          )}
                          {log.readAt && (
                            <span className="text-xs text-indigo-500" title={isEs ? 'Leído' : 'Read'}>
                              <Eye className="w-3 h-3 inline" />
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{isEs ? 'No hay mensajes en el historial' : 'No messages in history'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="flex justify-end mb-2">
              <ChannelFilterButtons />
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Total' : 'Total'}</p>
                      <p className="text-2xl font-bold">{emailStats?.total || 0}</p>
                    </div>
                    <Mail className="w-8 h-8 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Enviados' : 'Sent'}</p>
                      <p className="text-2xl font-bold text-green-600">{emailStats?.sent || 0}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-300" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Entregados' : 'Delivered'}</p>
                      <p className="text-2xl font-bold text-blue-600">{emailStats?.delivered || 0}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-blue-300" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Leídos' : 'Read'}</p>
                      <p className="text-2xl font-bold text-indigo-600">{emailStats?.read || 0}</p>
                    </div>
                    <Eye className="w-8 h-8 text-indigo-300" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Pendientes' : 'Pending'}</p>
                      <p className="text-2xl font-bold text-yellow-600">{emailStats?.pending || 0}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-300" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{isEs ? 'Fallidos' : 'Failed'}</p>
                      <p className="text-2xl font-bold text-red-600">{emailStats?.failed || 0}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-300" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingTemplate && !showPreview} onOpenChange={(open) => !open && setEditingTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEs ? 'Editar Plantilla' : 'Edit Template'}: {editingTemplate?.templateKey}
              </DialogTitle>
              <DialogDescription>
                {isEs 
                  ? 'Modifica el contenido del correo en ambos idiomas.'
                  : 'Modify email content in both languages.'}
              </DialogDescription>
            </DialogHeader>
            {editingTemplate && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>{isEs ? 'Categoría' : 'Category'}</Label>
                    <Select
                      value={editingTemplate.category}
                      onValueChange={(v) => setEditingTemplate({...editingTemplate, category: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="functional">{isEs ? 'Funcional' : 'Functional'}</SelectItem>
                        <SelectItem value="transactional">{isEs ? 'Transaccional' : 'Transactional'}</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Label>{isEs ? 'Activo' : 'Active'}</Label>
                    <Switch
                      checked={editingTemplate.isActive}
                      onCheckedChange={(v) => setEditingTemplate({...editingTemplate, isActive: v})}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={templateViewMode === 'html' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateViewMode('html')}
                    >
                      <Code className="w-4 h-4 mr-1" />
                      HTML
                    </Button>
                    <Button
                      variant={templateViewMode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateViewMode('preview')}
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      {isEs ? 'Vista Previa' : 'Preview'}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => translateTemplateMutation.mutate({
                      subjectEs: editingTemplate.subjectEs,
                      bodyHtmlEs: editingTemplate.bodyHtmlEs,
                    })}
                    disabled={translateTemplateMutation.isPending || !editingTemplate.subjectEs}
                    className="gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    {translateTemplateMutation.isPending 
                      ? (isEs ? 'Traduciendo...' : 'Translating...') 
                      : (isEs ? 'Traducir ES → EN con IA' : 'Translate ES → EN with AI')}
                  </Button>
                </div>

                <Tabs defaultValue="spanish" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 min-w-max overflow-x-auto">
                    <TabsTrigger value="spanish">Español</TabsTrigger>
                    <TabsTrigger value="english">English</TabsTrigger>
                  </TabsList>
                  <TabsContent value="spanish" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{isEs ? 'Asunto (ES)' : 'Subject (ES)'}</Label>
                      <Input
                        value={editingTemplate.subjectEs}
                        onChange={(e) => setEditingTemplate({...editingTemplate, subjectEs: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{isEs ? 'Contenido (ES)' : 'Content (ES)'}</Label>
                      </div>
                      {templateViewMode === 'html' ? (
                        <Textarea
                          value={editingTemplate.bodyHtmlEs}
                          onChange={(e) => setEditingTemplate({...editingTemplate, bodyHtmlEs: e.target.value})}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="border rounded-lg p-4 bg-white min-h-[200px]">
                          <div dangerouslySetInnerHTML={{ __html: editingTemplate.bodyHtmlEs }} />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="english" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{isEs ? 'Asunto (EN)' : 'Subject (EN)'}</Label>
                      <Input
                        value={editingTemplate.subjectEn}
                        onChange={(e) => setEditingTemplate({...editingTemplate, subjectEn: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{isEs ? 'Contenido (EN)' : 'Content (EN)'}</Label>
                      </div>
                      {templateViewMode === 'html' ? (
                        <Textarea
                          value={editingTemplate.bodyHtmlEn}
                          onChange={(e) => setEditingTemplate({...editingTemplate, bodyHtmlEn: e.target.value})}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="border rounded-lg p-4 bg-white min-h-[200px]">
                          <div dangerouslySetInnerHTML={{ __html: editingTemplate.bodyHtmlEn }} />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => editingTemplate && saveTemplateMutation.mutate(editingTemplate)}
                disabled={saveTemplateMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveTemplateMutation.isPending 
                  ? (isEs ? 'Guardando...' : 'Saving...') 
                  : (isEs ? 'Guardar' : 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPreview} onOpenChange={(open) => { setShowPreview(open); if (!open) setEditingTemplate(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEs ? 'Vista Previa' : 'Preview'}: {editingTemplate?.templateKey}
              </DialogTitle>
              <DialogDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant={previewLanguage === 'es' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewLanguage('es')}
                  >
                    Español
                  </Button>
                  <Button
                    variant={previewLanguage === 'en' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewLanguage('en')}
                  >
                    English
                  </Button>
                </div>
              </DialogDescription>
            </DialogHeader>
            {editingTemplate && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <p className="text-sm text-slate-500">{isEs ? 'Asunto' : 'Subject'}:</p>
                  <p className="font-medium">
                    {previewLanguage === 'es' ? editingTemplate.subjectEs : editingTemplate.subjectEn}
                  </p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: previewLanguage === 'es' ? editingTemplate.bodyHtmlEs : editingTemplate.bodyHtmlEn 
                    }} 
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowPreview(false); setEditingTemplate(null); }}>
                {isEs ? 'Cerrar' : 'Close'}
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {isEs ? 'Editar' : 'Edit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingTrigger} onOpenChange={(open) => !open && setEditingTrigger(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isEs ? 'Configurar Disparador' : 'Configure Trigger'}
              </DialogTitle>
              <DialogDescription>
                {editingTrigger && (isEs ? editingTrigger.eventDescriptionEs : editingTrigger.eventDescriptionEn)}
              </DialogDescription>
            </DialogHeader>
            {editingTrigger && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{isEs ? 'Canal' : 'Channel'}</Label>
                  <Select
                    value={editingTrigger.channel}
                    onValueChange={(v) => setEditingTrigger({...editingTrigger, channel: v, templateId: null})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                      </SelectItem>
                      <SelectItem value="whatsapp">
                        <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{isEs ? 'Plantilla' : 'Template'}</Label>
                  <Select
                    value={editingTrigger.templateId || ''}
                    onValueChange={(v) => setEditingTrigger({...editingTrigger, templateId: v || null})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isEs ? 'Seleccionar plantilla' : 'Select template'} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.filter(t => t.channel === editingTrigger.channel).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.templateKey} - {isEs ? t.subjectEs : t.subjectEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{isEs ? 'Retraso (minutos)' : 'Delay (minutes)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingTrigger.delayMinutes}
                    onChange={(e) => setEditingTrigger({...editingTrigger, delayMinutes: parseInt(e.target.value) || 0})}
                  />
                  <p className="text-xs text-slate-500">
                    {isEs 
                      ? '0 = envío inmediato. Usa un retraso para agrupar notificaciones.'
                      : '0 = immediate send. Use a delay to batch notifications.'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{isEs ? 'Habilitado' : 'Enabled'}</p>
                    <p className="text-xs text-slate-500">
                      {isEs ? 'Enviar correos cuando ocurra este evento' : 'Send emails when this event occurs'}
                    </p>
                  </div>
                  <Switch
                    checked={editingTrigger.isEnabled}
                    onCheckedChange={(v) => setEditingTrigger({...editingTrigger, isEnabled: v})}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTrigger(null)}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => editingTrigger && saveTriggerMutation.mutate(editingTrigger)}
                disabled={saveTriggerMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveTriggerMutation.isPending 
                  ? (isEs ? 'Guardando...' : 'Saving...') 
                  : (isEs ? 'Guardar' : 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddSenderDialog} onOpenChange={setShowAddSenderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEs ? 'Agregar Correo de Remitente' : 'Add Sender Email'}</DialogTitle>
              <DialogDescription>
                {isEs 
                  ? 'Agrega un nuevo correo electrónico para enviar comunicaciones.'
                  : 'Add a new email address to send communications from.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-sender-name">{isEs ? 'Nombre del Remitente' : 'Display Name'}</Label>
                <Input
                  id="new-sender-name"
                  value={newSender.displayName}
                  onChange={(e) => setNewSender(s => ({...s, displayName: e.target.value}))}
                  placeholder={isEs ? 'Ej: Soporte U-Storage Go' : 'E.g., U-Storage Go Support'}
                  data-testid="input-new-sender-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-sender-email">{isEs ? 'Correo Electrónico' : 'Email Address'}</Label>
                <Input
                  id="new-sender-email"
                  type="email"
                  value={newSender.email}
                  onChange={(e) => setNewSender(s => ({...s, email: e.target.value}))}
                  placeholder="correo@u-storage-go.com"
                  data-testid="input-new-sender-email"
                />
                <p className="text-xs text-slate-500">
                  {isEs 
                    ? 'Debe ser un correo verificado en tu cuenta de Gmail.'
                    : 'Must be a verified email in your Gmail account.'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddSenderDialog(false);
                setNewSender({ displayName: '', email: '' });
              }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => createSenderMutation.mutate(newSender)}
                disabled={createSenderMutation.isPending || !newSender.displayName || !newSender.email}
                data-testid="button-submit-new-sender"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createSenderMutation.isPending 
                  ? (isEs ? 'Agregando...' : 'Adding...') 
                  : (isEs ? 'Agregar Correo' : 'Add Email')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Template Dialog */}
        <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEs ? 'Nueva Plantilla' : 'New Template'}</DialogTitle>
              <DialogDescription>
                {isEs 
                  ? 'Crea una nueva plantilla de email o WhatsApp para mensajes automáticos o campañas.'
                  : 'Create a new email or WhatsApp template for automated messages or campaigns.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{isEs ? 'Clave de Plantilla' : 'Template Key'}</Label>
                  <Input
                    value={newTemplate.templateKey}
                    onChange={(e) => setNewTemplate(t => ({...t, templateKey: e.target.value.toLowerCase().replace(/\s/g, '_')}))}
                    placeholder="welcome_email"
                    data-testid="input-template-key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isEs ? 'Canal' : 'Channel'}</Label>
                  <Select 
                    value={newTemplate.channel}
                    onValueChange={(v) => setNewTemplate(t => ({...t, channel: v}))}
                  >
                    <SelectTrigger data-testid="select-template-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                      </SelectItem>
                      <SelectItem value="whatsapp">
                        <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isEs ? 'Categoría' : 'Category'}</Label>
                  <Select 
                    value={newTemplate.category}
                    onValueChange={(v) => setNewTemplate(t => ({...t, category: v}))}
                  >
                    <SelectTrigger data-testid="select-template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactional">{isEs ? 'Transaccional' : 'Transactional'}</SelectItem>
                      <SelectItem value="notification">{isEs ? 'Notificación' : 'Notification'}</SelectItem>
                      <SelectItem value="marketing">{isEs ? 'Marketing' : 'Marketing'}</SelectItem>
                      <SelectItem value="reminder">{isEs ? 'Recordatorio' : 'Reminder'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newTemplate.channel === 'whatsapp' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="text-sm text-green-700">
                      <p className="font-medium">{isEs ? 'Plantilla WhatsApp' : 'WhatsApp Template'}</p>
                      <p className="mt-1">
                        {isEs 
                          ? 'El contenido debe ser texto plano (sin HTML). La plantilla debe ser aprobada por Meta vía Twilio antes de poder enviarla.'
                          : 'Content must be plain text (no HTML). The template must be approved by Meta via Twilio before it can be sent.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {newTemplate.channel === 'whatsapp' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Twilio Content SID</Label>
                    <Input
                      value={newTemplate.twilioContentSid}
                      onChange={(e) => setNewTemplate(t => ({...t, twilioContentSid: e.target.value}))}
                      placeholder="HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      data-testid="input-template-twilio-sid"
                    />
                    <p className="text-xs text-slate-500">
                      {isEs ? 'SID de la plantilla aprobada en Twilio' : 'SID of the approved template in Twilio'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{isEs ? 'URL de Media (opcional)' : 'Media URL (optional)'}</Label>
                    <Input
                      value={newTemplate.mediaUrl}
                      onChange={(e) => setNewTemplate(t => ({...t, mediaUrl: e.target.value}))}
                      placeholder="https://..."
                      data-testid="input-template-media-url"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEs ? 'Nombre (EN)' : 'Name (EN)'}</Label>
                  <Input
                    value={newTemplate.nameEn}
                    onChange={(e) => setNewTemplate(t => ({...t, nameEn: e.target.value}))}
                    placeholder="Welcome Email"
                    data-testid="input-template-name-en"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isEs ? 'Nombre (ES)' : 'Name (ES)'}</Label>
                  <Input
                    value={newTemplate.nameEs}
                    onChange={(e) => setNewTemplate(t => ({...t, nameEs: e.target.value}))}
                    placeholder="Correo de Bienvenida"
                    data-testid="input-template-name-es"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {newTemplate.channel === 'email' && (
                  <div className="space-y-2">
                    <Label>{isEs ? 'Remitente' : 'Sender'}</Label>
                    <Select 
                      value={newTemplate.senderId}
                      onValueChange={(v) => setNewTemplate(t => ({...t, senderId: v}))}
                    >
                      <SelectTrigger data-testid="select-template-sender">
                        <SelectValue placeholder={isEs ? 'Seleccionar remitente...' : 'Select sender...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {emailSenders?.map((sender) => (
                          <SelectItem key={sender.id} value={sender.id}>
                            {sender.displayName} ({sender.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{isEs ? 'Modo de Envío' : 'Send Mode'}</Label>
                  <Select 
                    value={newTemplate.sendMode}
                    onValueChange={(v) => setNewTemplate(t => ({...t, sendMode: v, triggerId: v === 'manual' ? '' : t.triggerId}))}
                  >
                    <SelectTrigger data-testid="select-template-send-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{isEs ? 'Manual' : 'Manual'}</SelectItem>
                      <SelectItem value="automated">{isEs ? 'Automático (Trigger)' : 'Automated (Trigger)'}</SelectItem>
                      <SelectItem value="both">{isEs ? 'Ambos' : 'Both'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(newTemplate.sendMode === 'automated' || newTemplate.sendMode === 'both') && (
                <div className="space-y-2">
                  <Label>{isEs ? 'Evento Disparador' : 'Trigger Event'}</Label>
                  <Select 
                    value={newTemplate.triggerId}
                    onValueChange={(v) => setNewTemplate(t => ({...t, triggerId: v}))}
                  >
                    <SelectTrigger data-testid="select-template-trigger">
                      <SelectValue placeholder={isEs ? 'Seleccionar evento...' : 'Select event...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {triggers?.map((trigger) => (
                        <SelectItem key={trigger.id} value={trigger.id}>
                          <div className="flex flex-col">
                            <span>{isEs ? trigger.eventNameEs : trigger.eventNameEn}</span>
                            <span className="text-xs text-slate-500">{trigger.eventKey}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {isEs 
                      ? 'Esta plantilla se enviará automáticamente cuando ocurra el evento seleccionado.'
                      : 'This template will be sent automatically when the selected event occurs.'}
                  </p>
                </div>
              )}

              {newTemplate.channel === 'email' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={newTemplateViewMode === 'html' ? 'default' : 'outline'}
                      size="sm"
                      type="button"
                      onClick={() => setNewTemplateViewMode('html')}
                    >
                      <Code className="w-4 h-4 mr-1" />
                      HTML
                    </Button>
                    <Button
                      variant={newTemplateViewMode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      type="button"
                      onClick={() => setNewTemplateViewMode('preview')}
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      {isEs ? 'Vista Previa' : 'Preview'}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => translateNewTemplateMutation.mutate({
                      subjectEs: newTemplate.subjectEs,
                      bodyHtmlEs: newTemplate.bodyHtmlEs,
                    })}
                    disabled={translateNewTemplateMutation.isPending || !newTemplate.subjectEs}
                    className="gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    {translateNewTemplateMutation.isPending 
                      ? (isEs ? 'Traduciendo...' : 'Translating...') 
                      : (isEs ? 'Traducir ES → EN con IA' : 'Translate ES → EN with AI')}
                  </Button>
                </div>
              )}

              <Tabs defaultValue="spanish" className="w-full">
                <TabsList className="grid w-full grid-cols-2 min-w-max overflow-x-auto">
                  <TabsTrigger value="spanish">Español</TabsTrigger>
                  <TabsTrigger value="english">English</TabsTrigger>
                </TabsList>
                <TabsContent value="spanish" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{isEs ? 'Asunto (ES)' : 'Subject (ES)'}</Label>
                    <Input
                      value={newTemplate.subjectEs}
                      onChange={(e) => setNewTemplate(t => ({...t, subjectEs: e.target.value}))}
                      placeholder={newTemplate.channel === 'whatsapp' ? (isEs ? 'Nombre de plantilla WA' : 'WA template name') : "¡Bienvenido a U-Storage Go!"}
                      data-testid="input-template-subject-es"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {newTemplate.channel === 'whatsapp' 
                        ? (isEs ? 'Mensaje (ES) - Texto plano' : 'Message (ES) - Plain text')
                        : (isEs ? 'Contenido (ES)' : 'Content (ES)')}
                    </Label>
                    {newTemplate.channel === 'whatsapp' ? (
                      <Textarea
                        value={newTemplate.bodyHtmlEs}
                        onChange={(e) => setNewTemplate(t => ({...t, bodyHtmlEs: e.target.value}))}
                        placeholder={isEs ? 'Hola {{1}}, tu mudanza está confirmada para el {{2}}.' : 'Hello {{1}}, your move is confirmed for {{2}}.'}
                        className="min-h-[150px] text-sm"
                        maxLength={1024}
                        data-testid="input-template-body-es"
                      />
                    ) : newTemplateViewMode === 'html' ? (
                      <Textarea
                        value={newTemplate.bodyHtmlEs}
                        onChange={(e) => setNewTemplate(t => ({...t, bodyHtmlEs: e.target.value}))}
                        placeholder="<p>Hola {{userName}}, ¡bienvenido a U-Storage Go!</p>"
                        className="min-h-[150px] font-mono text-sm"
                        data-testid="input-template-body-es"
                      />
                    ) : (
                      <div className="border rounded-lg p-4 bg-white min-h-[150px]">
                        <div dangerouslySetInnerHTML={{ __html: newTemplate.bodyHtmlEs || '<p class="text-slate-400">Vista previa vacía...</p>' }} />
                      </div>
                    )}
                    {newTemplate.channel === 'whatsapp' && (
                      <p className="text-xs text-slate-500">{newTemplate.bodyHtmlEs.length}/1024 {isEs ? 'caracteres' : 'characters'}</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="english" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{isEs ? 'Asunto (EN)' : 'Subject (EN)'}</Label>
                    <Input
                      value={newTemplate.subjectEn}
                      onChange={(e) => setNewTemplate(t => ({...t, subjectEn: e.target.value}))}
                      placeholder={newTemplate.channel === 'whatsapp' ? 'WA template name' : "Welcome to U-Storage Go!"}
                      data-testid="input-template-subject-en"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {newTemplate.channel === 'whatsapp' 
                        ? (isEs ? 'Mensaje (EN) - Texto plano' : 'Message (EN) - Plain text')
                        : (isEs ? 'Contenido (EN)' : 'Content (EN)')}
                    </Label>
                    {newTemplate.channel === 'whatsapp' ? (
                      <Textarea
                        value={newTemplate.bodyHtmlEn}
                        onChange={(e) => setNewTemplate(t => ({...t, bodyHtmlEn: e.target.value}))}
                        placeholder="Hello {{1}}, your move is confirmed for {{2}}."
                        className="min-h-[150px] text-sm"
                        maxLength={1024}
                        data-testid="input-template-body-en"
                      />
                    ) : newTemplateViewMode === 'html' ? (
                      <Textarea
                        value={newTemplate.bodyHtmlEn}
                        onChange={(e) => setNewTemplate(t => ({...t, bodyHtmlEn: e.target.value}))}
                        placeholder="<p>Hello {{userName}}, welcome to U-Storage Go!</p>"
                        className="min-h-[150px] font-mono text-sm"
                        data-testid="input-template-body-en"
                      />
                    ) : (
                      <div className="border rounded-lg p-4 bg-white min-h-[150px]">
                        <div dangerouslySetInnerHTML={{ __html: newTemplate.bodyHtmlEn || '<p class="text-slate-400">Empty preview...</p>' }} />
                      </div>
                    )}
                    {newTemplate.channel === 'whatsapp' && (
                      <p className="text-xs text-slate-500">{newTemplate.bodyHtmlEn.length}/1024 {isEs ? 'caracteres' : 'characters'}</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className={`p-3 rounded-lg ${newTemplate.channel === 'whatsapp' ? 'bg-green-50' : 'bg-blue-50'}`}>
                <p className={`text-sm ${newTemplate.channel === 'whatsapp' ? 'text-green-700' : 'text-blue-700'}`}>
                  <Info className="w-4 h-4 inline mr-2" />
                  {newTemplate.channel === 'whatsapp'
                    ? (isEs 
                      ? 'Usa {{1}}, {{2}}, etc. para variables. WhatsApp usa numeración secuencial para variables.'
                      : 'Use {{1}}, {{2}}, etc. for variables. WhatsApp uses sequential numbering for variables.')
                    : (isEs 
                      ? 'Usa {{variable}} para insertar datos dinámicos. Variables disponibles: userName, userEmail, quoteNumber, etc.'
                      : 'Use {{variable}} to insert dynamic data. Available: userName, userEmail, quoteNumber, etc.')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateTemplateDialog(false);
                setNewTemplate({
                  templateKey: '', nameEn: '', nameEs: '', category: 'transactional',
                  channel: 'email', sendMode: 'manual', triggerId: '', senderId: '',
                  subjectEn: '', subjectEs: '', bodyHtmlEn: '', bodyHtmlEs: '',
                  twilioContentSid: '', mediaUrl: '',
                });
              }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => createTemplateMutation.mutate(newTemplate)}
                disabled={createTemplateMutation.isPending || !newTemplate.templateKey || !newTemplate.subjectEn}
                data-testid="button-submit-template"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createTemplateMutation.isPending 
                  ? (isEs ? 'Creando...' : 'Creating...') 
                  : (isEs ? 'Crear Plantilla' : 'Create Template')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Campaign Dialog */}
        <Dialog open={showCreateCampaignDialog} onOpenChange={setShowCreateCampaignDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-action" />
                {isEs ? 'Nueva Campaña' : 'New Campaign'}
              </DialogTitle>
              <DialogDescription>
                {isEs 
                  ? 'Crea una campaña de email o WhatsApp para un grupo de usuarios.'
                  : 'Create an email or WhatsApp campaign for a group of users.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isEs ? 'Nombre de la Campaña' : 'Campaign Name'}</Label>
                <Input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign(c => ({...c, name: e.target.value}))}
                  placeholder={isEs ? 'Ej: Promoción de Verano' : 'E.g., Summer Promotion'}
                  data-testid="input-campaign-name"
                />
              </div>

              <div className="space-y-2">
                <Label>{isEs ? 'Descripción' : 'Description'}</Label>
                <Textarea
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign(c => ({...c, description: e.target.value}))}
                  placeholder={isEs ? 'Describe el objetivo de esta campaña...' : 'Describe the goal of this campaign...'}
                  className="min-h-[80px]"
                  data-testid="input-campaign-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{isEs ? 'Canal' : 'Channel'}</Label>
                  <Select 
                    value={newCampaign.channel}
                    onValueChange={(v) => setNewCampaign(c => ({...c, channel: v, templateId: ''}))}
                  >
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                      </SelectItem>
                      <SelectItem value="whatsapp">
                        <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isEs ? 'Categoría' : 'Category'}</Label>
                  <Select 
                    value={newCampaign.category}
                    onValueChange={(v) => setNewCampaign(c => ({...c, category: v}))}
                  >
                    <SelectTrigger data-testid="select-campaign-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketing">{isEs ? 'Marketing' : 'Marketing'}</SelectItem>
                      <SelectItem value="promotional">{isEs ? 'Promocional' : 'Promotional'}</SelectItem>
                      <SelectItem value="newsletter">{isEs ? 'Newsletter' : 'Newsletter'}</SelectItem>
                      <SelectItem value="announcement">{isEs ? 'Anuncio' : 'Announcement'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{isEs ? 'Segmento de Usuarios' : 'User Segment'}</Label>
                  <Select 
                    value={newCampaign.targetSegment}
                    onValueChange={(v) => setNewCampaign(c => ({...c, targetSegment: v}))}
                  >
                    <SelectTrigger data-testid="select-campaign-segment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_users">{isEs ? 'Todos los usuarios' : 'All Users'}</SelectItem>
                      <SelectItem value="clients">{isEs ? 'Solo clientes' : 'Clients Only'}</SelectItem>
                      <SelectItem value="movers">{isEs ? 'Solo partners' : 'Movers Only'}</SelectItem>
                      <SelectItem value="active">{isEs ? 'Usuarios activos' : 'Active Users'}</SelectItem>
                      <SelectItem value="inactive">{isEs ? 'Usuarios inactivos' : 'Inactive Users'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isEs ? 'Plantilla' : 'Template'}</Label>
                <Select 
                  value={newCampaign.templateId}
                  onValueChange={(v) => setNewCampaign(c => ({...c, templateId: v}))}
                >
                  <SelectTrigger data-testid="select-campaign-template">
                    <SelectValue placeholder={isEs ? 'Seleccionar plantilla...' : 'Select template...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.filter(t => t.isActive && t.channel === newCampaign.channel).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <span className="flex items-center gap-2">
                          {getChannelIcon(template.channel)}
                          {isEs ? template.subjectEs : template.subjectEn}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newCampaign.channel === 'email' && (
                <div className="space-y-2">
                  <Label>{isEs ? 'Remitente' : 'Sender'}</Label>
                  <Select 
                    value={newCampaign.senderId}
                    onValueChange={(v) => setNewCampaign(c => ({...c, senderId: v}))}
                  >
                    <SelectTrigger data-testid="select-campaign-sender">
                      <SelectValue placeholder={isEs ? 'Seleccionar remitente...' : 'Select sender...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {emailSenders?.map((sender) => (
                        <SelectItem key={sender.id} value={sender.id}>
                          {sender.displayName} ({sender.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateCampaignDialog(false);
                setNewCampaign({
                  name: '', description: '', category: 'marketing',
                  channel: 'email', templateId: '', senderId: '', targetSegment: 'all_users',
                });
              }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => createCampaignMutation.mutate(newCampaign)}
                disabled={createCampaignMutation.isPending || !newCampaign.name}
                data-testid="button-submit-campaign"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createCampaignMutation.isPending 
                  ? (isEs ? 'Creando...' : 'Creating...') 
                  : (isEs ? 'Crear Campaña' : 'Create Campaign')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Trigger Dialog */}
        <Dialog open={showCreateTriggerDialog} onOpenChange={setShowCreateTriggerDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-action" />
                {isEs ? 'Nuevo Disparador' : 'New Trigger'}
              </DialogTitle>
              <DialogDescription>
                {isEs 
                  ? 'Crea un nuevo disparador para enviar mensajes automáticamente por email o WhatsApp.'
                  : 'Create a new trigger to automatically send messages via email or WhatsApp.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isEs ? 'Tipo de Evento' : 'Event Type'}</Label>
                <Select 
                  value={newTrigger.eventTypeId}
                  onValueChange={(v) => setNewTrigger(t => ({...t, eventTypeId: v}))}
                >
                  <SelectTrigger data-testid="select-trigger-event-type">
                    <SelectValue placeholder={isEs ? 'Seleccionar evento...' : 'Select event...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes?.map((eventType) => (
                      <SelectItem key={eventType.id} value={eventType.id}>
                        <div className="flex flex-col">
                          <span>{isEs ? eventType.nameEs : eventType.nameEn}</span>
                          <span className="text-xs text-slate-500">{eventType.eventKey}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newTrigger.eventTypeId && eventTypes && (
                  <p className="text-xs text-slate-500">
                    {isEs 
                      ? eventTypes.find(e => e.id === newTrigger.eventTypeId)?.descriptionEs
                      : eventTypes.find(e => e.id === newTrigger.eventTypeId)?.descriptionEn}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{isEs ? 'Canal de Entrega' : 'Delivery Channel'}</Label>
                <Select 
                  value={newTrigger.channel}
                  onValueChange={(v) => setNewTrigger(t => ({...t, channel: v, templateId: ''}))}
                >
                  <SelectTrigger data-testid="select-trigger-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isEs ? 'Plantilla (opcional)' : 'Template (optional)'}</Label>
                <Select 
                  value={newTrigger.templateId}
                  onValueChange={(v) => setNewTrigger(t => ({...t, templateId: v}))}
                >
                  <SelectTrigger data-testid="select-trigger-template">
                    <SelectValue placeholder={isEs ? 'Seleccionar plantilla...' : 'Select template...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isEs ? 'Sin plantilla' : 'No template'}</SelectItem>
                    {templates?.filter(t => t.isActive && t.channel === newTrigger.channel).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <span className="flex items-center gap-2">
                          {getChannelIcon(template.channel)}
                          {isEs ? template.subjectEs : template.subjectEn}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isEs ? 'Retraso (minutos)' : 'Delay (minutes)'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={newTrigger.delayMinutes}
                  onChange={(e) => setNewTrigger(t => ({...t, delayMinutes: parseInt(e.target.value) || 0}))}
                  placeholder="0"
                  data-testid="input-trigger-delay"
                />
                <p className="text-xs text-slate-500">
                  {isEs 
                    ? 'Cuánto tiempo esperar antes de enviar el correo después del evento.'
                    : 'How long to wait before sending the email after the event.'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateTriggerDialog(false);
                setNewTrigger({ eventTypeId: '', templateId: '', channel: 'email', delayMinutes: 0 });
              }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => createTriggerMutation.mutate(newTrigger)}
                disabled={createTriggerMutation.isPending || !newTrigger.eventTypeId}
                data-testid="button-submit-trigger"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createTriggerMutation.isPending 
                  ? (isEs ? 'Creando...' : 'Creating...') 
                  : (isEs ? 'Crear Disparador' : 'Create Trigger')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Send Dialog */}
        <Dialog open={showManualSendDialog} onOpenChange={setShowManualSendDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-action" />
                {isEs ? 'Enviar Correo Manual' : 'Send Manual Email'}
              </DialogTitle>
              <DialogDescription>
                {manualSendTemplate && (
                  <span className="font-medium text-slate-700">
                    {isEs ? manualSendTemplate.subjectEs : manualSendTemplate.subjectEn}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isEs ? 'Audiencia de Destino' : 'Target Audience'}</Label>
                <Select 
                  value={manualSendAudience}
                  onValueChange={setManualSendAudience}
                >
                  <SelectTrigger data-testid="select-manual-send-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_users">{isEs ? 'Todos los usuarios' : 'All Users'}</SelectItem>
                    <SelectItem value="clients">{isEs ? 'Solo clientes' : 'Clients Only'}</SelectItem>
                    <SelectItem value="movers">{isEs ? 'Solo partners' : 'Movers Only'}</SelectItem>
                    <SelectItem value="admins">{isEs ? 'Solo administradores' : 'Admins Only'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {isEs ? 'Confirmación Requerida' : 'Confirmation Required'}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {isEs 
                        ? 'Esta acción enviará correos a todos los usuarios de la audiencia seleccionada. Esta acción no se puede deshacer.'
                        : 'This action will send emails to all users in the selected audience. This action cannot be undone.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowManualSendDialog(false);
                  setManualSendTemplate(null);
                  setManualSendAudience('all_users');
                }}
              >
                {isEs ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                className="bg-action hover:bg-action/90"
                onClick={() => {
                  if (manualSendTemplate) {
                    manualSendMutation.mutate({
                      templateId: manualSendTemplate.id,
                      audience: manualSendAudience,
                    });
                  }
                }}
                disabled={manualSendMutation.isPending || !manualSendTemplate}
                data-testid="button-confirm-send"
              >
                <Send className="w-4 h-4 mr-2" />
                {manualSendMutation.isPending 
                  ? (isEs ? 'Enviando...' : 'Sending...') 
                  : (isEs ? 'Enviar Ahora' : 'Send Now')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
