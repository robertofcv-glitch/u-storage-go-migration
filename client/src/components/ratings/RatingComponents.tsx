import { useState } from "react";
import { Star, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function StarRating({ rating, size = "md", showLabel = false, className }: StarRatingProps) {
  const sizes = {
    sm: "h-3 w-3",
    md: "h-5 w-5",
    lg: "h-7 w-7",
  };
  
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="star-rating-display">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizes[size],
            star <= fullStars
              ? "fill-amber-400 text-amber-400"
              : star === fullStars + 1 && hasHalfStar
              ? "fill-amber-400/50 text-amber-400"
              : "fill-muted text-muted-foreground/30"
          )}
        />
      ))}
      {showLabel && (
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface InteractiveStarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: "md" | "lg";
  disabled?: boolean;
}

export function InteractiveStarRating({ value, onChange, size = "lg", disabled = false }: InteractiveStarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  
  const sizes = {
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  
  return (
    <div 
      className="flex items-center gap-2" 
      data-testid="interactive-star-rating"
      onMouseLeave={() => setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`star-button-${star}`}
        >
          <Star
            className={cn(
              sizes[size],
              "transition-colors cursor-pointer",
              (hoverValue || value) >= star
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

const EXCELLENCE_CATEGORIES_EN = [
  "Professional Service",
  "Careful Handling",
  "On Time",
  "Great Communication",
  "Fair Pricing",
  "Clean & Organized",
];

const EXCELLENCE_CATEGORIES_ES = [
  "Servicio Profesional",
  "Manejo Cuidadoso",
  "Puntuales",
  "Buena Comunicación",
  "Precios Justos",
  "Limpio y Organizado",
];

const IMPROVEMENT_CATEGORIES_EN = [
  "Communication",
  "Punctuality",
  "Item Handling",
  "Pricing Clarity",
  "Professionalism",
];

const IMPROVEMENT_CATEGORIES_ES = [
  "Comunicación",
  "Puntualidad",
  "Manejo de Artículos",
  "Claridad en Precios",
  "Profesionalismo",
];

interface CategorySelectorProps {
  type: "excellence" | "improvement";
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function CategorySelector({ type, selected, onChange, disabled = false }: CategorySelectorProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  const categories = type === "excellence"
    ? (isSpanish ? EXCELLENCE_CATEGORIES_ES : EXCELLENCE_CATEGORIES_EN)
    : (isSpanish ? IMPROVEMENT_CATEGORIES_ES : IMPROVEMENT_CATEGORIES_EN);
  
  const toggleCategory = (category: string) => {
    if (disabled) return;
    if (selected.includes(category)) {
      onChange(selected.filter(c => c !== category));
    } else {
      onChange([...selected, category]);
    }
  };
  
  return (
    <div className="flex flex-wrap gap-2" data-testid={`category-selector-${type}`}>
      {categories.map((category) => (
        <Badge
          key={category}
          variant={selected.includes(category) ? "default" : "outline"}
          className={cn(
            "cursor-pointer transition-colors",
            !disabled && "hover:bg-primary/80",
            type === "excellence" && selected.includes(category) && "bg-green-600 hover:bg-green-700",
            type === "improvement" && selected.includes(category) && "bg-orange-500 hover:bg-orange-600",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => toggleCategory(category)}
          data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {type === "excellence" ? <ThumbsUp className="h-3 w-3 mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
          {category}
        </Badge>
      ))}
    </div>
  );
}

interface RatingFormProps {
  quoteId: string;
  targetUserId: string;
  moverProfileId?: string;
  direction: "client_to_partner" | "partner_to_client";
  companyName?: string;
  clientName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RatingForm({
  quoteId,
  targetUserId,
  moverProfileId,
  direction,
  companyName,
  clientName,
  onSuccess,
  onCancel,
}: RatingFormProps) {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  const [starRating, setStarRating] = useState(0);
  const [excellenceCategories, setExcellenceCategories] = useState<string[]>([]);
  const [improvementCategories, setImprovementCategories] = useState<string[]>([]);
  const [publicComment, setPublicComment] = useState("");
  const [privateComment, setPrivateComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    if (starRating === 0) {
      setError(isSpanish ? "Por favor selecciona una calificación de estrellas" : "Please select a star rating");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quoteId,
          targetUserId,
          moverProfileId,
          direction,
          starRating,
          excellenceCategories,
          improvementCategories,
          publicComment: publicComment.trim() || undefined,
          privateComment: privateComment.trim() || undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to submit rating");
      }
      
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const targetName = direction === "client_to_partner" ? companyName : clientName;
  
  return (
    <Card data-testid="rating-form">
      <CardHeader>
        <CardTitle className="text-lg">
          {isSpanish ? `Califica tu experiencia${targetName ? ` con ${targetName}` : ''}` : `Rate your experience${targetName ? ` with ${targetName}` : ''}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {isSpanish ? "¿Cómo fue tu experiencia?" : "How was your experience?"}
          </p>
          <InteractiveStarRating
            value={starRating}
            onChange={setStarRating}
            disabled={isSubmitting}
          />
          {starRating > 0 && (
            <p className="mt-2 text-sm font-medium text-amber-600">
              {starRating === 5 && (isSpanish ? "¡Excelente!" : "Excellent!")}
              {starRating === 4 && (isSpanish ? "Muy bien" : "Very good")}
              {starRating === 3 && (isSpanish ? "Regular" : "Average")}
              {starRating === 2 && (isSpanish ? "Podría mejorar" : "Could be better")}
              {starRating === 1 && (isSpanish ? "Mala experiencia" : "Poor experience")}
            </p>
          )}
        </div>
        
        {starRating >= 4 && (
          <div>
            <p className="text-sm font-medium mb-2">
              {isSpanish ? "¿Qué destacó?" : "What stood out?"}
            </p>
            <CategorySelector
              type="excellence"
              selected={excellenceCategories}
              onChange={setExcellenceCategories}
              disabled={isSubmitting}
            />
          </div>
        )}
        
        {starRating > 0 && starRating <= 3 && (
          <div>
            <p className="text-sm font-medium mb-2">
              {isSpanish ? "¿Qué podría mejorar?" : "What could improve?"}
            </p>
            <CategorySelector
              type="improvement"
              selected={improvementCategories}
              onChange={setImprovementCategories}
              disabled={isSubmitting}
            />
          </div>
        )}
        
        <div>
          <p className="text-sm font-medium mb-2">
            {isSpanish ? "Comentario público (visible para otros)" : "Public comment (visible to others)"}
          </p>
          <Textarea
            placeholder={isSpanish ? "Comparte tu experiencia..." : "Share your experience..."}
            value={publicComment}
            onChange={(e) => setPublicComment(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            data-testid="input-public-comment"
          />
        </div>
        
        <div>
          <p className="text-sm font-medium mb-2">
            {isSpanish ? "Comentario privado (solo para el equipo de U-Storage Go)" : "Private comment (only for U-Storage Go team)"}
          </p>
          <Textarea
            placeholder={isSpanish ? "Comentarios adicionales privados..." : "Additional private feedback..."}
            value={privateComment}
            onChange={(e) => setPrivateComment(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            data-testid="input-private-comment"
          />
        </div>
        
        {error && (
          <p className="text-sm text-red-600" data-testid="text-error">{error}</p>
        )}
        
        <div className="flex gap-3 justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting} data-testid="button-cancel-rating">
              {isSpanish ? "Cancelar" : "Cancel"}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || starRating === 0}
            className="bg-[#1A1A1A] hover:bg-[#1A1A1A]/90"
            data-testid="button-submit-rating"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isSpanish ? "Enviando..." : "Submitting..."}
              </>
            ) : (
              isSpanish ? "Enviar Calificación" : "Submit Rating"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface RatingSummaryCardProps {
  averageRating: number;
  totalRatings: number;
  size?: "sm" | "md";
  showBreakdown?: boolean;
  breakdown?: { stars: number; count: number }[];
}

export function RatingSummaryCard({ averageRating, totalRatings, size = "md", showBreakdown = false, breakdown }: RatingSummaryCardProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  if (totalRatings === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm" data-testid="no-ratings">
        {isSpanish ? "Sin calificaciones aún" : "No ratings yet"}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-2", size === "sm" ? "text-sm" : "")} data-testid="rating-summary">
      <div className="flex items-center gap-3">
        <span className={cn("font-bold", size === "sm" ? "text-2xl" : "text-4xl")}>
          {averageRating.toFixed(1)}
        </span>
        <div>
          <StarRating rating={averageRating} size={size === "sm" ? "sm" : "md"} />
          <p className="text-muted-foreground text-xs mt-1">
            {totalRatings} {totalRatings === 1 
              ? (isSpanish ? "calificación" : "rating") 
              : (isSpanish ? "calificaciones" : "ratings")}
          </p>
        </div>
      </div>
      
      {showBreakdown && breakdown && (
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((stars) => {
            const item = breakdown.find(b => b.stars === stars);
            const count = item?.count || 0;
            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-right">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PublicReviewCardProps {
  rating: {
    id: string;
    starRating: number;
    createdAt: string;
    publicComment?: string | null;
    raterName?: string;
    excellenceCategories?: string[];
  };
}

export function PublicReviewCard({ rating }: PublicReviewCardProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  return (
    <Card className="p-4" data-testid={`review-card-${rating.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <StarRating rating={rating.starRating} size="sm" />
          <p className="text-xs text-muted-foreground mt-1">
            {rating.raterName || (isSpanish ? "Anónimo" : "Anonymous")}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(rating.createdAt).toLocaleDateString(isSpanish ? "es-MX" : "en-US")}
        </span>
      </div>
      
      {rating.publicComment && (
        <p className="text-sm mt-2">{rating.publicComment}</p>
      )}
      
      {rating.excellenceCategories && rating.excellenceCategories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {rating.excellenceCategories.map((cat, i) => (
            <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              {cat}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
