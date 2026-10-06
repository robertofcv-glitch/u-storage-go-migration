import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Search, Eye, Edit3, Loader2, MessageSquare, ArrowUpDown, ThumbsUp, ThumbsDown, Calendar, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useState } from "react";
import { StarRating } from "@/components/ratings/RatingComponents";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";

interface RatingWithDetails {
  id: string;
  quoteId: string;
  raterUserId: string;
  targetUserId: string;
  moverProfileId: string | null;
  direction: string;
  starRating: number;
  excellenceCategories: string[];
  improvementCategories: string[];
  submittedVia: string;
  createdAt: string;
  updatedAt: string;
  comments?: {
    id: string;
    publicComment: string | null;
    privateComment: string | null;
    createdAt: string;
  } | null;
  aiTags?: {
    id: string;
    positiveTags: string[];
    negativeTags: string[];
    sentiment: string;
    keywords: string[];
    createdAt: string;
  } | null;
  rater?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  target?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  moverProfile?: {
    id: string;
    companyName: string;
  } | null;
  quote?: {
    quoteNumber: string | null;
  } | null;
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-100 text-green-800',
  neutral: 'bg-gray-100 text-gray-800',
  negative: 'bg-red-100 text-red-800',
  mixed: 'bg-yellow-100 text-yellow-800',
};

export default function AdminRatings() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';
  const locale = isSpanish ? es : enUS;
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [starFilter, setStarFilter] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<RatingWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedStarRating, setEditedStarRating] = useState(0);
  const [editedPublicComment, setEditedPublicComment] = useState('');
  const [editedPrivateComment, setEditedPrivateComment] = useState('');

  const { data: ratingsData, isLoading } = useQuery<RatingWithDetails[]>({
    queryKey: ['/api/admin/ratings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/ratings', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch ratings');
      return response.json();
    },
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['/api/admin/permissions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/permissions', { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const isSuperAdmin = permissionsData?.isSuperAdmin || false;

  const updateRatingMutation = useMutation({
    mutationFn: async (data: { ratingId: string; starRating?: number; publicComment?: string; privateComment?: string }) => {
      const response = await fetch(`/api/admin/ratings/${data.ratingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          starRating: data.starRating,
          publicComment: data.publicComment,
          privateComment: data.privateComment,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to update rating');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ratings'] });
      setIsEditDialogOpen(false);
      setSelectedRating(null);
    },
  });

  const ratings = ratingsData || [];

  const filteredRatings = ratings.filter(rating => {
    const matchesSearch = searchQuery === '' || 
      rating.rater?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rating.rater?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rating.target?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rating.moverProfile?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rating.quote?.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDirection = directionFilter === 'all' || rating.direction === directionFilter;
    const matchesStar = starFilter === 'all' || rating.starRating === parseInt(starFilter);
    
    return matchesSearch && matchesDirection && matchesStar;
  });

  const openEditDialog = (rating: RatingWithDetails) => {
    setSelectedRating(rating);
    setEditedStarRating(rating.starRating);
    setEditedPublicComment(rating.comments?.publicComment || '');
    setEditedPrivateComment(rating.comments?.privateComment || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedRating) return;
    updateRatingMutation.mutate({
      ratingId: selectedRating.id,
      starRating: editedStarRating,
      publicComment: editedPublicComment,
      privateComment: editedPrivateComment,
    });
  };

  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  const stats = {
    total: ratings.length,
    averageRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.starRating, 0) / ratings.length : 0,
    clientToPartner: ratings.filter(r => r.direction === 'client_to_partner').length,
    partnerToClient: ratings.filter(r => r.direction === 'partner_to_client').length,
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
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isSpanish ? 'Gestión de Calificaciones' : 'Ratings Management'}
            </h1>
            <p className="text-muted-foreground">
              {isSpanish 
                ? 'Ver y administrar calificaciones de clientes y socios' 
                : 'View and manage ratings from clients and partners'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isSpanish ? 'Total' : 'Total'}</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isSpanish ? 'Promedio' : 'Average'}</CardTitle>
              <Star className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {stats.averageRating.toFixed(1)}
                <StarRating rating={stats.averageRating} size="sm" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isSpanish ? 'Cliente → Socio' : 'Client → Partner'}</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.clientToPartner}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isSpanish ? 'Socio → Cliente' : 'Partner → Client'}</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground rotate-180" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.partnerToClient}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isSpanish ? 'Buscar por nombre, email, empresa...' : 'Search by name, email, company...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-ratings"
                />
              </div>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-direction-filter">
                  <SelectValue placeholder={isSpanish ? 'Dirección' : 'Direction'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? 'Todas' : 'All'}</SelectItem>
                  <SelectItem value="client_to_partner">{isSpanish ? 'Cliente → Socio' : 'Client → Partner'}</SelectItem>
                  <SelectItem value="partner_to_client">{isSpanish ? 'Socio → Cliente' : 'Partner → Client'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={starFilter} onValueChange={setStarFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-star-filter">
                  <SelectValue placeholder={isSpanish ? 'Estrellas' : 'Stars'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? 'Todas' : 'All'}</SelectItem>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <SelectItem key={star} value={star.toString()}>
                      {star} {star === 1 ? (isSpanish ? 'estrella' : 'star') : (isSpanish ? 'estrellas' : 'stars')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredRatings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isSpanish ? 'No se encontraron calificaciones' : 'No ratings found'}
                </div>
              ) : (
                filteredRatings.map((rating) => (
                  <Card key={rating.id} className="p-4" data-testid={`rating-row-${rating.id}`}>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <StarRating rating={rating.starRating} size="md" showLabel />
                            <Badge variant="outline" className={rating.direction === 'client_to_partner' ? 'bg-blue-50' : 'bg-green-50'}>
                              {rating.direction === 'client_to_partner' 
                                ? (isSpanish ? 'Cliente → Socio' : 'Client → Partner')
                                : (isSpanish ? 'Socio → Cliente' : 'Partner → Client')}
                            </Badge>
                            {rating.aiTags?.sentiment && (
                              <Badge className={sentimentColors[rating.aiTags.sentiment]}>
                                {rating.aiTags.sentiment}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(rating.createdAt), 'PPp', { locale })}
                            </span>
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(rating)}
                                data-testid={`button-edit-rating-${rating.id}`}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{isSpanish ? 'De:' : 'From:'}</span>
                            <p className="font-medium">{rating.rater?.fullName || rating.rater?.email || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{isSpanish ? 'Para:' : 'To:'}</span>
                            <p className="font-medium">
                              {rating.moverProfile?.companyName || rating.target?.fullName || rating.target?.email || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{isSpanish ? 'Cotización:' : 'Quote:'}</span>
                            <p className="font-medium">{rating.quote?.quoteNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{isSpanish ? 'Vía:' : 'Via:'}</span>
                            <p className="font-medium capitalize">{rating.submittedVia}</p>
                          </div>
                        </div>

                        {(rating.excellenceCategories?.length > 0 || rating.improvementCategories?.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            {rating.excellenceCategories?.map((cat, i) => (
                              <Badge key={`exc-${i}`} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <ThumbsUp className="h-3 w-3 mr-1" />{cat}
                              </Badge>
                            ))}
                            {rating.improvementCategories?.map((cat, i) => (
                              <Badge key={`imp-${i}`} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                <ThumbsDown className="h-3 w-3 mr-1" />{cat}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {(rating.comments?.publicComment || rating.comments?.privateComment) && (
                          <div className="space-y-2 pt-2 border-t">
                            {rating.comments?.publicComment && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {isSpanish ? 'Comentario público' : 'Public comment'}
                                </div>
                                <p className="text-sm">{rating.comments.publicComment}</p>
                              </div>
                            )}
                            {rating.comments?.privateComment && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-xs text-amber-700 mb-1">
                                  <Eye className="h-3 w-3" />
                                  {isSpanish ? 'Comentario privado (solo admin)' : 'Private comment (admin only)'}
                                </div>
                                <p className="text-sm">{rating.comments.privateComment}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {rating.aiTags && (rating.aiTags.positiveTags?.length > 0 || rating.aiTags.negativeTags?.length > 0) && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t">
                            <span className="text-xs text-muted-foreground mr-2">{isSpanish ? 'Tags IA:' : 'AI Tags:'}</span>
                            {rating.aiTags.positiveTags?.map((tag, i) => (
                              <Badge key={`pos-${i}`} className="text-xs bg-emerald-100 text-emerald-800">
                                +{tag}
                              </Badge>
                            ))}
                            {rating.aiTags.negativeTags?.map((tag, i) => (
                              <Badge key={`neg-${i}`} className="text-xs bg-rose-100 text-rose-800">
                                -{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isSpanish ? 'Editar Calificación' : 'Edit Rating'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isSpanish ? 'Calificación de estrellas' : 'Star Rating'}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditedStarRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors cursor-pointer ${
                          editedStarRating >= star
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isSpanish ? 'Comentario público' : 'Public Comment'}
                </label>
                <Textarea
                  value={editedPublicComment}
                  onChange={(e) => setEditedPublicComment(e.target.value)}
                  rows={3}
                  data-testid="input-edit-public-comment"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isSpanish ? 'Comentario privado' : 'Private Comment'}
                </label>
                <Textarea
                  value={editedPrivateComment}
                  onChange={(e) => setEditedPrivateComment(e.target.value)}
                  rows={2}
                  data-testid="input-edit-private-comment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                disabled={updateRatingMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-save-rating-edit"
              >
                {updateRatingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isSpanish ? 'Guardando...' : 'Saving...'}
                  </>
                ) : (
                  isSpanish ? 'Guardar Cambios' : 'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
