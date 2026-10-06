import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, FileText, Globe, Star, Calendar, BarChart3, Loader2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { BlogPost } from "@shared/schema";

interface BlogFormData {
  slug: string;
  titleEs: string;
  titleEn: string;
  excerptEs: string;
  excerptEn: string;
  contentEs: string;
  contentEn: string;
  categoryEs: string;
  categoryEn: string;
  author: string;
  heroImage: string;
  heroImageAlt: string;
  featured: boolean;
  estimatedReadMinutes: number;
  metaTitleEs: string;
  metaTitleEn: string;
  metaDescriptionEs: string;
  metaDescriptionEn: string;
  focusKeywordsEs: string;
  focusKeywordsEn: string;
  canonicalUrl: string;
  ogTitleEs: string;
  ogTitleEn: string;
  ogDescriptionEs: string;
  ogDescriptionEn: string;
  ogImage: string;
}

const initialFormData: BlogFormData = {
  slug: "",
  titleEs: "",
  titleEn: "",
  excerptEs: "",
  excerptEn: "",
  contentEs: "",
  contentEn: "",
  categoryEs: "",
  categoryEn: "",
  author: "",
  heroImage: "",
  heroImageAlt: "",
  featured: false,
  estimatedReadMinutes: 5,
  metaTitleEs: "",
  metaTitleEn: "",
  metaDescriptionEs: "",
  metaDescriptionEn: "",
  focusKeywordsEs: "",
  focusKeywordsEn: "",
  canonicalUrl: "",
  ogTitleEs: "",
  ogTitleEn: "",
  ogDescriptionEs: "",
  ogDescriptionEn: "",
  ogImage: "",
};

export default function AdminBlog() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const locale = lang === 'es' ? es : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sidebarLinks = getAdminSidebarLinks(lang);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState<BlogFormData>(initialFormData);
  const [activeTab, setActiveTab] = useState("content");

  const { data: postsData, isLoading } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ['/api/admin/blog/posts'],
  });

  const createPost = useMutation({
    mutationFn: async (data: BlogFormData) => {
      const res = await fetch('/api/admin/blog/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          focusKeywordsEs: data.focusKeywordsEs ? data.focusKeywordsEs.split(',').map(k => k.trim()) : [],
          focusKeywordsEn: data.focusKeywordsEn ? data.focusKeywordsEn.split(',').map(k => k.trim()) : [],
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create post');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/posts'] });
      setShowDialog(false);
      setFormData(initialFormData);
      toast({
        title: lang === 'es' ? 'Artículo creado' : 'Post created',
        description: lang === 'es' ? 'El artículo se ha guardado como borrador.' : 'The post has been saved as draft.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BlogFormData }) => {
      const res = await fetch(`/api/admin/blog/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          focusKeywordsEs: data.focusKeywordsEs ? data.focusKeywordsEs.split(',').map(k => k.trim()) : [],
          focusKeywordsEn: data.focusKeywordsEn ? data.focusKeywordsEn.split(',').map(k => k.trim()) : [],
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update post');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/posts'] });
      setShowDialog(false);
      setEditingPost(null);
      setFormData(initialFormData);
      toast({
        title: lang === 'es' ? 'Artículo actualizado' : 'Post updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: lang === 'es' ? 'Error' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/blog/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/posts'] });
      setShowDeleteDialog(false);
      setDeletingPost(null);
      toast({
        title: lang === 'es' ? 'Artículo eliminado' : 'Post deleted',
      });
    },
    onError: () => {
      toast({
        title: lang === 'es' ? 'Error al eliminar' : 'Delete failed',
        variant: 'destructive',
      });
    },
  });

  const publishPost = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/blog/posts/${id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to publish post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/posts'] });
      toast({
        title: lang === 'es' ? 'Artículo publicado' : 'Post published',
      });
    },
  });

  const unpublishPost = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/blog/posts/${id}/unpublish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to unpublish post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/posts'] });
      toast({
        title: lang === 'es' ? 'Artículo despublicado' : 'Post unpublished',
      });
    },
  });

  const openCreateDialog = () => {
    setEditingPost(null);
    setFormData(initialFormData);
    setActiveTab("content");
    setShowDialog(true);
  };

  const openEditDialog = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      slug: post.slug,
      titleEs: post.titleEs,
      titleEn: post.titleEn,
      excerptEs: post.excerptEs || "",
      excerptEn: post.excerptEn || "",
      contentEs: post.contentEs,
      contentEn: post.contentEn,
      categoryEs: post.categoryEs || "",
      categoryEn: post.categoryEn || "",
      author: post.author,
      heroImage: post.heroImage || "",
      heroImageAlt: post.heroImageAlt || "",
      featured: post.featured || false,
      estimatedReadMinutes: post.estimatedReadMinutes || 5,
      metaTitleEs: post.metaTitleEs || "",
      metaTitleEn: post.metaTitleEn || "",
      metaDescriptionEs: post.metaDescriptionEs || "",
      metaDescriptionEn: post.metaDescriptionEn || "",
      focusKeywordsEs: post.focusKeywordsEs?.join(', ') || "",
      focusKeywordsEn: post.focusKeywordsEn?.join(', ') || "",
      canonicalUrl: post.canonicalUrl || "",
      ogTitleEs: post.ogTitleEs || "",
      ogTitleEn: post.ogTitleEn || "",
      ogDescriptionEs: post.ogDescriptionEs || "",
      ogDescriptionEn: post.ogDescriptionEn || "",
      ogImage: post.ogImage || "",
    });
    setActiveTab("content");
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.slug || !formData.titleEs || !formData.titleEn || !formData.contentEs || !formData.contentEn || !formData.author) {
      toast({
        title: lang === 'es' ? 'Campos requeridos' : 'Required fields',
        description: lang === 'es' ? 'Por favor complete todos los campos obligatorios.' : 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (editingPost) {
      updatePost.mutate({ id: editingPost.id, data: formData });
    } else {
      createPost.mutate(formData);
    }
  };

  const generateSlug = () => {
    const title = formData.titleEs || formData.titleEn;
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setFormData({ ...formData, slug });
  };

  const posts = postsData?.posts || [];
  const filteredPosts = posts.filter(post => {
    const matchesSearch = searchQuery === '' || 
      post.titleEs.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800">{lang === 'es' ? 'Publicado' : 'Published'}</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">{lang === 'es' ? 'Borrador' : 'Draft'}</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">{lang === 'es' ? 'Programado' : 'Scheduled'}</Badge>;
      case 'archived':
        return <Badge className="bg-gray-100 text-gray-800">{lang === 'es' ? 'Archivado' : 'Archived'}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              {lang === 'es' ? 'Gestión de Blog' : 'Blog Management'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {lang === 'es' 
                ? 'Crea y gestiona artículos del blog para atraer tráfico'
                : 'Create and manage blog posts to drive traffic'}
            </p>
          </div>
          <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90" data-testid="button-create-post">
            <Plus className="h-4 w-4 mr-2" />
            {lang === 'es' ? 'Nuevo Artículo' : 'New Post'}
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={lang === 'es' ? 'Buscar artículos...' : 'Search posts...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-posts"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder={lang === 'es' ? 'Estado' : 'Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === 'es' ? 'Todos' : 'All'}</SelectItem>
              <SelectItem value="draft">{lang === 'es' ? 'Borrador' : 'Draft'}</SelectItem>
              <SelectItem value="published">{lang === 'es' ? 'Publicado' : 'Published'}</SelectItem>
              <SelectItem value="archived">{lang === 'es' ? 'Archivado' : 'Archived'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{lang === 'es' ? 'Total Artículos' : 'Total Posts'}</p>
                  <p className="text-2xl font-bold">{posts.length}</p>
                </div>
                <FileText className="h-8 w-8 text-action" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{lang === 'es' ? 'Publicados' : 'Published'}</p>
                  <p className="text-2xl font-bold">{posts.filter(p => p.status === 'published').length}</p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{lang === 'es' ? 'Borradores' : 'Drafts'}</p>
                  <p className="text-2xl font-bold">{posts.filter(p => p.status === 'draft').length}</p>
                </div>
                <EyeOff className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{lang === 'es' ? 'Vistas Totales' : 'Total Views'}</p>
                  <p className="text-2xl font-bold">{posts.reduce((sum, p) => sum + (p.viewCount || 0), 0)}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {lang === 'es' ? 'Artículos del Blog' : 'Blog Posts'}
            </CardTitle>
            <CardDescription>
              {lang === 'es' ? `${filteredPosts.length} artículos encontrados` : `${filteredPosts.length} posts found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{lang === 'es' ? 'No hay artículos que mostrar' : 'No posts to display'}</p>
                <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {lang === 'es' ? 'Crear primer artículo' : 'Create first post'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`blog-post-${post.id}`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {post.heroImage && (
                        <img
                          src={post.heroImage}
                          alt={post.heroImageAlt || post.titleEs}
                          className="w-20 h-14 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">
                            {lang === 'es' ? post.titleEs : post.titleEn}
                          </h3>
                          {getStatusBadge(post.status)}
                          {post.featured && (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Star className="h-3 w-3 mr-1" />
                              {lang === 'es' ? 'Destacado' : 'Featured'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          /{post.slug}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>{post.author}</span>
                          <span>•</span>
                          <span>{post.categoryEs || post.categoryEn || '-'}</span>
                          <span>•</span>
                          <span>{post.estimatedReadMinutes} min</span>
                          <span>•</span>
                          <span>{post.viewCount || 0} {lang === 'es' ? 'vistas' : 'views'}</span>
                          {post.publishedAt && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true, locale })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {post.status === 'draft' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishPost.mutate(post.id)}
                          disabled={publishPost.isPending}
                          data-testid={`button-publish-${post.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {lang === 'es' ? 'Publicar' : 'Publish'}
                        </Button>
                      ) : post.status === 'published' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unpublishPost.mutate(post.id)}
                          disabled={unpublishPost.isPending}
                          data-testid={`button-unpublish-${post.id}`}
                        >
                          <EyeOff className="h-4 w-4 mr-1" />
                          {lang === 'es' ? 'Despublicar' : 'Unpublish'}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(post)}
                        data-testid={`button-edit-${post.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDeletingPost(post); setShowDeleteDialog(true); }}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-${post.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPost 
                ? (lang === 'es' ? 'Editar Artículo' : 'Edit Post')
                : (lang === 'es' ? 'Nuevo Artículo' : 'New Post')}
            </DialogTitle>
            <DialogDescription>
              {lang === 'es' 
                ? 'Complete los campos para crear o editar el artículo del blog.'
                : 'Fill in the fields to create or edit the blog post.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">
                <FileText className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Contenido' : 'Content'}
              </TabsTrigger>
              <TabsTrigger value="seo">
                <Globe className="h-4 w-4 mr-2" />
                SEO
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Star className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Configuración' : 'Settings'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Slug (URL) *' : 'Slug (URL) *'}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="articulo-ejemplo"
                      data-testid="input-slug"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generateSlug}>
                      {lang === 'es' ? 'Generar' : 'Generate'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Autor *' : 'Author *'}</Label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Equipo U-Storage Go"
                    data-testid="input-author"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Título (Español) *' : 'Title (Spanish) *'}</Label>
                  <Input
                    value={formData.titleEs}
                    onChange={(e) => setFormData({ ...formData, titleEs: e.target.value })}
                    data-testid="input-title-es"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Título (Inglés) *' : 'Title (English) *'}</Label>
                  <Input
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    data-testid="input-title-en"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Extracto (Español)' : 'Excerpt (Spanish)'}</Label>
                  <Textarea
                    value={formData.excerptEs}
                    onChange={(e) => setFormData({ ...formData, excerptEs: e.target.value })}
                    rows={3}
                    data-testid="input-excerpt-es"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Extracto (Inglés)' : 'Excerpt (English)'}</Label>
                  <Textarea
                    value={formData.excerptEn}
                    onChange={(e) => setFormData({ ...formData, excerptEn: e.target.value })}
                    rows={3}
                    data-testid="input-excerpt-en"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Contenido (Español) * - Markdown' : 'Content (Spanish) * - Markdown'}</Label>
                  <Textarea
                    value={formData.contentEs}
                    onChange={(e) => setFormData({ ...formData, contentEs: e.target.value })}
                    rows={12}
                    placeholder="## Título&#10;&#10;Párrafo..."
                    data-testid="input-content-es"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Contenido (Inglés) * - Markdown' : 'Content (English) * - Markdown'}</Label>
                  <Textarea
                    value={formData.contentEn}
                    onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
                    rows={12}
                    placeholder="## Title&#10;&#10;Paragraph..."
                    data-testid="input-content-en"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Categoría (Español)' : 'Category (Spanish)'}</Label>
                  <Input
                    value={formData.categoryEs}
                    onChange={(e) => setFormData({ ...formData, categoryEs: e.target.value })}
                    placeholder="Consejos"
                    data-testid="input-category-es"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'es' ? 'Categoría (Inglés)' : 'Category (English)'}</Label>
                  <Input
                    value={formData.categoryEn}
                    onChange={(e) => setFormData({ ...formData, categoryEn: e.target.value })}
                    placeholder="Tips"
                    data-testid="input-category-en"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Meta Tags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Meta Title (ES) <span className="text-xs text-muted-foreground">({formData.metaTitleEs.length}/60)</span></Label>
                      <Input
                        value={formData.metaTitleEs}
                        onChange={(e) => setFormData({ ...formData, metaTitleEs: e.target.value })}
                        maxLength={60}
                        data-testid="input-meta-title-es"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Title (EN) <span className="text-xs text-muted-foreground">({formData.metaTitleEn.length}/60)</span></Label>
                      <Input
                        value={formData.metaTitleEn}
                        onChange={(e) => setFormData({ ...formData, metaTitleEn: e.target.value })}
                        maxLength={60}
                        data-testid="input-meta-title-en"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Meta Description (ES) <span className="text-xs text-muted-foreground">({formData.metaDescriptionEs.length}/160)</span></Label>
                      <Textarea
                        value={formData.metaDescriptionEs}
                        onChange={(e) => setFormData({ ...formData, metaDescriptionEs: e.target.value })}
                        maxLength={160}
                        rows={3}
                        data-testid="input-meta-desc-es"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Description (EN) <span className="text-xs text-muted-foreground">({formData.metaDescriptionEn.length}/160)</span></Label>
                      <Textarea
                        value={formData.metaDescriptionEn}
                        onChange={(e) => setFormData({ ...formData, metaDescriptionEn: e.target.value })}
                        maxLength={160}
                        rows={3}
                        data-testid="input-meta-desc-en"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Palabras Clave (ES)' : 'Focus Keywords (ES)'}</Label>
                      <Input
                        value={formData.focusKeywordsEs}
                        onChange={(e) => setFormData({ ...formData, focusKeywordsEs: e.target.value })}
                        placeholder="mudanza, consejos, empacar"
                        data-testid="input-keywords-es"
                      />
                      <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Separar con comas' : 'Separate with commas'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'es' ? 'Palabras Clave (EN)' : 'Focus Keywords (EN)'}</Label>
                      <Input
                        value={formData.focusKeywordsEn}
                        onChange={(e) => setFormData({ ...formData, focusKeywordsEn: e.target.value })}
                        placeholder="moving, tips, packing"
                        data-testid="input-keywords-en"
                      />
                      <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Separar con comas' : 'Separate with commas'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Canonical URL</Label>
                    <Input
                      value={formData.canonicalUrl}
                      onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                      placeholder="https://rukumove.com/blog/articulo"
                      data-testid="input-canonical-url"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Open Graph / Social</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>OG Title (ES)</Label>
                      <Input
                        value={formData.ogTitleEs}
                        onChange={(e) => setFormData({ ...formData, ogTitleEs: e.target.value })}
                        data-testid="input-og-title-es"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OG Title (EN)</Label>
                      <Input
                        value={formData.ogTitleEn}
                        onChange={(e) => setFormData({ ...formData, ogTitleEn: e.target.value })}
                        data-testid="input-og-title-en"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>OG Description (ES)</Label>
                      <Textarea
                        value={formData.ogDescriptionEs}
                        onChange={(e) => setFormData({ ...formData, ogDescriptionEs: e.target.value })}
                        rows={2}
                        data-testid="input-og-desc-es"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OG Description (EN)</Label>
                      <Textarea
                        value={formData.ogDescriptionEn}
                        onChange={(e) => setFormData({ ...formData, ogDescriptionEn: e.target.value })}
                        rows={2}
                        data-testid="input-og-desc-en"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>OG Image URL</Label>
                    <Input
                      value={formData.ogImage}
                      onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-og-image"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'es' ? 'Imagen Principal' : 'Hero Image'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'URL de Imagen' : 'Image URL'}</Label>
                    <Input
                      value={formData.heroImage}
                      onChange={(e) => setFormData({ ...formData, heroImage: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      data-testid="input-hero-image"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Texto Alternativo' : 'Alt Text'}</Label>
                    <Input
                      value={formData.heroImageAlt}
                      onChange={(e) => setFormData({ ...formData, heroImageAlt: e.target.value })}
                      data-testid="input-hero-image-alt"
                    />
                  </div>
                  {formData.heroImage && (
                    <div className="mt-2">
                      <img src={formData.heroImage} alt="Preview" className="max-h-32 rounded object-cover" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'es' ? 'Opciones' : 'Options'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{lang === 'es' ? 'Artículo Destacado' : 'Featured Post'}</Label>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'es' ? 'Mostrar en posición destacada' : 'Show in featured position'}
                      </p>
                    </div>
                    <Switch
                      checked={formData.featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                      data-testid="switch-featured"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'es' ? 'Tiempo de Lectura (minutos)' : 'Read Time (minutes)'}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={formData.estimatedReadMinutes}
                      onChange={(e) => setFormData({ ...formData, estimatedReadMinutes: parseInt(e.target.value) || 5 })}
                      data-testid="input-read-time"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createPost.isPending || updatePost.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-post"
            >
              {(createPost.isPending || updatePost.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPost
                ? (lang === 'es' ? 'Guardar Cambios' : 'Save Changes')
                : (lang === 'es' ? 'Crear Borrador' : 'Create Draft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'es' ? 'Eliminar Artículo' : 'Delete Post'}</DialogTitle>
            <DialogDescription>
              {lang === 'es'
                ? `¿Estás seguro de que quieres eliminar "${deletingPost?.titleEs}"? Esta acción no se puede deshacer.`
                : `Are you sure you want to delete "${deletingPost?.titleEn}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPost && deletePost.mutate(deletingPost.id)}
              disabled={deletePost.isPending}
              data-testid="button-confirm-delete"
            >
              {deletePost.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {lang === 'es' ? 'Eliminar' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
