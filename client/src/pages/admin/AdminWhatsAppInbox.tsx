import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Phone,
  User,
  Truck,
  FileText,
  Clock,
  Search,
  Link2,
  Unlink,
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  Plus,
  RefreshCw,
} from "lucide-react";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  contactPhone: string;
  contactName: string | null;
  status: string;
  assignedAgentId: string | null;
  linkedUserId: string | null;
  linkedMoverProfileId: string | null;
  linkedQuoteId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  assignedAgent: { id: string; fullName: string | null; email: string | null } | null;
  linkedUser: { id: string; fullName: string | null; email: string | null; phone: string | null } | null;
  linkedMoverProfile: { id: string; companyName: string } | null;
  linkedQuote: { id: string; quoteNumber: string | null; status: string | null } | null;
}

interface Message {
  id: string;
  conversationId: string;
  direction: string;
  body: string;
  senderPhone: string | null;
  senderName: string | null;
  agentId: string | null;
  agentName: string | null;
  status: string | null;
  createdAt: string;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

interface Agent {
  id: string;
  fullName: string | null;
  email: string | null;
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  open: { color: "bg-[hsl(var(--success)/.12)] text-[hsl(var(--success))]", icon: MessageSquare },
  pending: { color: "bg-[hsl(var(--action)/.12)] text-[hsl(var(--action))]", icon: Clock },
  resolved: { color: "bg-accent text-accent-foreground", icon: CheckCircle2 },
  closed: { color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function AdminWhatsAppInbox() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === "es";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkType, setLinkType] = useState<"user" | "partner" | "quote">("user");
  const [linkSearch, setLinkSearch] = useState("");
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState("");
  const [newConvName, setNewConvName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useQuery<{ user: any }>({
    queryKey: ["/api/impersonate/current"],
  });

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/whatsapp/conversations", filterTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTab === "mine" && currentUser?.user?.id) {
        params.set("assignedAgentId", currentUser.user.id);
      } else if (filterTab === "unassigned") {
        params.set("unassigned", "true");
      } else if (filterTab === "open") {
        params.set("status", "open");
      } else if (filterTab === "resolved") {
        params.set("status", "resolved");
      }
      const res = await fetch(`/api/admin/whatsapp/conversations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: convDetail, isLoading: detailLoading } = useQuery<ConversationDetail>({
    queryKey: ["/api/admin/whatsapp/conversations", selectedConvId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selectedConvId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!selectedConvId,
    refetchInterval: 10000,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/admin/whatsapp/agents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/whatsapp/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const { data: linkResults = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/whatsapp/search", linkType, linkSearch],
    queryFn: async () => {
      if (linkSearch.length < 2) return [];
      const res = await fetch(`/api/admin/whatsapp/search?type=${linkType}&q=${encodeURIComponent(linkSearch)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: linkSearch.length >= 2,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await fetch(`/api/admin/whatsapp/conversations/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", filterTab] });
    },
    onError: () => {
      toast({ title: "Error", description: isEs ? "No se pudo enviar el mensaje" : "Failed to send message", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/whatsapp/conversations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: isEs ? "Actualizado" : "Updated" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string | null }) => {
      const res = await fetch(`/api/admin/whatsapp/conversations/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: isEs ? "Agente asignado" : "Agent assigned" });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/whatsapp/conversations/${id}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to link");
      return res.json();
    },
    onSuccess: () => {
      setShowLinkDialog(false);
      setLinkSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: isEs ? "Vinculado" : "Linked" });
    },
  });

  const createConvMutation = useMutation({
    mutationFn: async ({ contactPhone, contactName }: { contactPhone: string; contactName: string }) => {
      const res = await fetch("/api/admin/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactPhone, contactName }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data) => {
      setShowNewConvDialog(false);
      setNewConvPhone("");
      setNewConvName("");
      setSelectedConvId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [convDetail?.messages]);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.contactName?.toLowerCase().includes(q) ||
      c.contactPhone?.includes(q) ||
      c.lastMessagePreview?.toLowerCase().includes(q)
    );
  });

  const handleSendReply = () => {
    if (!selectedConvId || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedConvId, body: replyText.trim() });
  };

  const handleLinkEntity = (entityId: string) => {
    if (!selectedConvId) return;
    const data: any = {};
    if (linkType === "user") data.linkedUserId = entityId;
    else if (linkType === "partner") data.linkedMoverProfileId = entityId;
    else if (linkType === "quote") data.linkedQuoteId = entityId;
    linkMutation.mutate({ id: selectedConvId, data });
  };

  const handleUnlink = (type: "user" | "partner" | "quote") => {
    if (!selectedConvId) return;
    const data: any = {};
    if (type === "user") data.linkedUserId = null;
    else if (type === "partner") data.linkedMoverProfileId = null;
    else if (type === "quote") data.linkedQuoteId = null;
    linkMutation.mutate({ id: selectedConvId, data });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
      return d.toLocaleTimeString(isEs ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(isEs ? "es-MX" : "en-US", { month: "short", day: "numeric" });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig.open;
    const Icon = config.icon;
    const labels: Record<string, string> = isEs
      ? { open: "Abierta", pending: "Pendiente", resolved: "Resuelta", closed: "Cerrada" }
      : { open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed" };
    return (
      <Badge data-testid={`status-badge-${status}`} variant="secondary" className={cn("text-xs", config.color)}>
        <Icon className="h-3 w-3 mr-1" />
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {isEs ? "Bandeja WhatsApp" : "WhatsApp Inbox"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEs ? "Gestiona conversaciones de ventas y soporte" : "Manage sales and support conversations"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="button-refresh"
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {isEs ? "Actualizar" : "Refresh"}
            </Button>
            <Button data-testid="button-new-conversation" size="sm" onClick={() => setShowNewConvDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {isEs ? "Nueva conversación" : "New conversation"}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Conversation List */}
          <div className={cn("flex flex-col border rounded-lg bg-card", selectedConvId ? "hidden md:flex w-80 lg:w-96" : "flex-1")}>
            <div className="p-3 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-conversations"
                  placeholder={isEs ? "Buscar conversaciones..." : "Search conversations..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filterTab} onValueChange={setFilterTab}>
                 <TabsList className="w-full min-w-max grid grid-cols-5 h-8">
                  <TabsTrigger data-testid="tab-all" value="all" className="text-xs">{isEs ? "Todas" : "All"}</TabsTrigger>
                  <TabsTrigger data-testid="tab-mine" value="mine" className="text-xs">{isEs ? "Mías" : "Mine"}</TabsTrigger>
                  <TabsTrigger data-testid="tab-unassigned" value="unassigned" className="text-xs">{isEs ? "Sin asignar" : "Unassigned"}</TabsTrigger>
                  <TabsTrigger data-testid="tab-open" value="open" className="text-xs">{isEs ? "Abiertas" : "Open"}</TabsTrigger>
                  <TabsTrigger data-testid="tab-resolved" value="resolved" className="text-xs">{isEs ? "Resueltas" : "Resolved"}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">{isEs ? "Cargando..." : "Loading..."}</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>{isEs ? "No hay conversaciones" : "No conversations"}</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    data-testid={`card-conversation-${conv.id}`}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={cn(
                       "p-3 border-b cursor-pointer hover:bg-muted transition-colors",
                       selectedConvId === conv.id && "bg-accent border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate text-sm">
                            {conv.contactName || conv.contactPhone}
                          </span>
                          {conv.unreadCount > 0 && (
                            <Badge data-testid={`badge-unread-${conv.id}`} className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs h-5 min-w-[20px] flex items-center justify-center">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conv.contactName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {conv.contactPhone}
                          </p>
                        )}
                        {conv.lastMessagePreview && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conv.lastMessagePreview}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatTime(conv.lastMessageAt)}</span>
                        <StatusBadge status={conv.status} />
                      </div>
                    </div>
                    {conv.assignedAgent && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        {conv.assignedAgent.fullName || conv.assignedAgent.email}
                      </p>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Conversation Detail */}
          {selectedConvId ? (
            <div className="flex-1 flex flex-col border rounded-lg bg-card min-w-0">
              {/* Header */}
              <div className="p-3 border-b flex items-center gap-3">
                <Button
                  data-testid="button-back"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConvId(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {convDetail?.contactName || convDetail?.contactPhone || "..."}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {convDetail?.contactPhone}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={convDetail?.status || "open"}
                    onValueChange={(v) => updateStatusMutation.mutate({ id: selectedConvId, status: v })}
                  >
                    <SelectTrigger data-testid="select-status" className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{isEs ? "Abierta" : "Open"}</SelectItem>
                      <SelectItem value="pending">{isEs ? "Pendiente" : "Pending"}</SelectItem>
                      <SelectItem value="resolved">{isEs ? "Resuelta" : "Resolved"}</SelectItem>
                      <SelectItem value="closed">{isEs ? "Cerrada" : "Closed"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={convDetail?.assignedAgentId || "unassigned"}
                    onValueChange={(v) => assignMutation.mutate({ id: selectedConvId, agentId: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger data-testid="select-agent" className="w-40 h-8 text-xs">
                      <SelectValue placeholder={isEs ? "Asignar agente" : "Assign agent"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{isEs ? "Sin asignar" : "Unassigned"}</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.fullName || a.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-1 min-h-0">
                {/* Messages */}
                <div className="flex-1 flex flex-col min-w-0">
                  <ScrollArea className="flex-1 p-4">
                    {detailLoading ? (
                      <div className="text-center text-muted-foreground py-8">{isEs ? "Cargando..." : "Loading..."}</div>
                    ) : convDetail?.messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>{isEs ? "No hay mensajes aún" : "No messages yet"}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {convDetail?.messages.map((msg) => (
                          <div
                            key={msg.id}
                            data-testid={`message-${msg.id}`}
                            className={cn(
                              "flex",
                              msg.direction === "outbound" ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                                msg.direction === "outbound"
                                   ? "bg-primary text-primary-foreground rounded-br-sm"
                                   : "bg-muted text-foreground rounded-bl-sm"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                              <div className={cn(
                                "flex items-center gap-2 mt-1 text-xs",
                                 msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground"
                              )}>
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString(isEs ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {msg.agentName && (
                                  <span>· {msg.agentName}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Compose */}
                  <div className="p-3 border-t">
                    <div className="flex gap-2">
                      <Input
                        data-testid="input-reply"
                        placeholder={isEs ? "Escribe un mensaje..." : "Type a message..."}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        disabled={replyMutation.isPending}
                      />
                      <Button
                        data-testid="button-send"
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || replyMutation.isPending}
                        size="icon"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Context Sidebar */}
                <div className="hidden lg:flex flex-col w-64 border-l">
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                          {isEs ? "Información de contacto" : "Contact Info"}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {convDetail?.contactName || (isEs ? "Sin nombre" : "No name")}
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {convDetail?.contactPhone}
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {convDetail?.createdAt ? new Date(convDetail.createdAt).toLocaleDateString(isEs ? "es-MX" : "en-US") : ""}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Linked User */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                            {isEs ? "Usuario vinculado" : "Linked User"}
                          </h4>
                          {convDetail?.linkedUser ? (
                            <Button data-testid="button-unlink-user" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUnlink("user")}>
                              <Unlink className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              data-testid="button-link-user"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => { setLinkType("user"); setShowLinkDialog(true); }}
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {convDetail?.linkedUser ? (
                           <div className="text-sm space-y-0.5 bg-accent rounded p-2">
                            <p className="font-medium">{convDetail.linkedUser.fullName}</p>
                            <p className="text-xs text-muted-foreground">{convDetail.linkedUser.email}</p>
                            {convDetail.linkedUser.phone && (
                              <p className="text-xs text-muted-foreground">{convDetail.linkedUser.phone}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{isEs ? "Sin vincular" : "Not linked"}</p>
                        )}
                      </div>

                      {/* Linked Partner */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                            {isEs ? "Socio vinculado" : "Linked Partner"}
                          </h4>
                          {convDetail?.linkedMoverProfile ? (
                            <Button data-testid="button-unlink-partner" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUnlink("partner")}>
                              <Unlink className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              data-testid="button-link-partner"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => { setLinkType("partner"); setShowLinkDialog(true); }}
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {convDetail?.linkedMoverProfile ? (
                           <div className="text-sm space-y-0.5 bg-[hsl(var(--success)/.12)] rounded p-2">
                            <p className="font-medium flex items-center gap-1">
                              <Truck className="h-3.5 w-3.5" />
                              {convDetail.linkedMoverProfile.companyName}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{isEs ? "Sin vincular" : "Not linked"}</p>
                        )}
                      </div>

                      {/* Linked Quote */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                            {isEs ? "Cotización vinculada" : "Linked Quote"}
                          </h4>
                          {convDetail?.linkedQuote ? (
                            <Button data-testid="button-unlink-quote" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUnlink("quote")}>
                              <Unlink className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              data-testid="button-link-quote"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => { setLinkType("quote"); setShowLinkDialog(true); }}
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {convDetail?.linkedQuote ? (
                           <div className="text-sm space-y-0.5 bg-muted rounded p-2">
                            <p className="font-medium flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {convDetail.linkedQuote.quoteNumber || convDetail.linkedQuote.id.substring(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">{convDetail.linkedQuote.status}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{isEs ? "Sin vincular" : "Not linked"}</p>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          ) : (
             <div className="hidden md:flex flex-1 items-center justify-center border rounded-lg bg-card">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">{isEs ? "Selecciona una conversación" : "Select a conversation"}</p>
                <p className="text-sm">{isEs ? "Elige una conversación de la lista para ver los mensajes" : "Choose a conversation from the list to view messages"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Link Entity Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {linkType === "user" && (isEs ? "Vincular usuario" : "Link User")}
              {linkType === "partner" && (isEs ? "Vincular socio" : "Link Partner")}
              {linkType === "quote" && (isEs ? "Vincular cotización" : "Link Quote")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-link-search"
                placeholder={isEs ? "Buscar..." : "Search..."}
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-60">
              {linkResults.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  {linkSearch.length < 2
                    ? (isEs ? "Escribe al menos 2 caracteres" : "Type at least 2 characters")
                    : (isEs ? "Sin resultados" : "No results")}
                </p>
              ) : (
                <div className="space-y-1">
                  {linkResults.map((r: any) => (
                    <Button
                      key={r.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleLinkEntity(r.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {linkType === "user" && (r.fullName || r.email)}
                          {linkType === "partner" && r.companyName}
                          {linkType === "quote" && (r.quoteNumber || r.id.substring(0, 8))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {linkType === "user" && (r.email || r.phone)}
                          {linkType === "partner" && r.contactPhone}
                          {linkType === "quote" && (r.contactName || r.status)}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConvDialog} onOpenChange={setShowNewConvDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEs ? "Nueva conversación" : "New Conversation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{isEs ? "Teléfono" : "Phone"} *</label>
              <Input
                data-testid="input-new-conv-phone"
                placeholder="+52 1234567890"
                value={newConvPhone}
                onChange={(e) => setNewConvPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{isEs ? "Nombre" : "Name"}</label>
              <Input
                data-testid="input-new-conv-name"
                placeholder={isEs ? "Nombre del contacto" : "Contact name"}
                value={newConvName}
                onChange={(e) => setNewConvName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConvDialog(false)}>
              {isEs ? "Cancelar" : "Cancel"}
            </Button>
            <Button
              data-testid="button-create-conversation"
              onClick={() => createConvMutation.mutate({ contactPhone: newConvPhone, contactName: newConvName })}
              disabled={!newConvPhone.trim() || createConvMutation.isPending}
            >
              {isEs ? "Crear" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
