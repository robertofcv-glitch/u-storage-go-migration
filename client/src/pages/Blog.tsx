import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Calendar, Clock, User, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import type { BlogPost } from "@shared/schema";
import { blogArticles as staticBlogArticles } from "@/data/blogData";

export default function Blog() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';
  const isSpanish = lang === 'es';

  const { data, isLoading, error } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ['/api/blog/posts'],
    queryFn: async () => {
      const res = await fetch('/api/blog/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const posts = data?.posts || [];
  const hasDbPosts = posts.length > 0;

  const displayArticles = hasDbPosts 
    ? posts.map(post => ({
        id: post.id,
        slug: post.slug,
        title: lang === 'es' ? post.titleEs : post.titleEn,
        excerpt: lang === 'es' ? post.excerptEs : post.excerptEn,
        category: lang === 'es' ? post.categoryEs : post.categoryEn,
        author: post.author,
        date: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : '',
        readTime: post.estimatedReadMinutes || 5,
        image: post.heroImage || '',
      }))
    : staticBlogArticles.map(article => ({
        id: article.id,
        slug: article.slug,
        title: lang === 'es' ? article.titleEs : article.titleEn,
        excerpt: lang === 'es' ? article.excerptEs : article.excerptEn,
        category: lang === 'es' ? article.categoryEs : article.categoryEn,
        author: article.author,
        date: article.date,
        readTime: article.readTime,
        image: article.image,
      }));

  return (
    <div className="min-h-screen bg-white font-sans">
      <SEO
        title={isSpanish ? "Blog de Mudanzas y Bodegas" : "Moving and Storage Blog"}
        description={isSpanish 
          ? "Consejos y guías para planear tu mudanza, organizar tus cosas y elegir una bodega U-Storage cuando necesites más espacio."
          : "Tips and guides to plan your move, organize your belongings, and choose U-Storage when you need more space."}
      />
      <Navbar />
      
      {/* Hero - dusk brand style */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-28 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img loading="eager" decoding="async" fetchPriority="high"
            src="/brand/brand-packed-boxes.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/80 via-[#2A123B]/60 to-[#160B1E]/90" />
        </div>
        <div className="container px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-white mb-4" data-testid="text-blog-title">
              {lang === 'es' ? (
                <>Mudanzas y <span className="text-[#EF7521]">Bodegas</span></>
              ) : (
                <>Moving and <span className="text-[#EF7521]">Storage</span></>
              )}
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-4">
              {lang === 'es' 
                ? 'Ideas para mover, organizar y guardar lo que importa'
                : 'Ideas to move, organize, and store what matters'}
            </p>
            <p className="text-base font-display italic text-white/60 max-w-2xl mx-auto mb-8">
              {lang === 'es'
                ? 'Tu mudanza y tu bodega, en un solo lugar.'
                : 'Your move and your storage, in one place.'}
            </p>
            <Link href="/quote">
              <Button className="h-12 px-8 text-base font-bold bg-[#EF7521] hover:bg-[#d96513] text-white shadow-lg shadow-[#EF7521]/25" data-testid="button-blog-cta">
                {t('nav.getQuote')} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="container px-4 md:px-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#EF7521]" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/blog/${article.slug}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group h-full" data-testid={`card-article-${article.id}`}>
                      {article.image && (
                        <div className="relative h-48 overflow-hidden">
                          <img loading="lazy" decoding="async" 
                            src={article.image} 
                            alt={article.title || ''}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {article.category && (
                            <Badge className="absolute top-3 left-3 bg-[#EF7521] hover:bg-[#EF7521]">
                              {article.category}
                            </Badge>
                          )}
                        </div>
                      )}
                      <CardContent className="p-5">
                        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2 group-hover:text-[#EF7521] transition-colors line-clamp-2">
                          {article.title}
                        </h2>
                        <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {article.author}
                            </span>
                            {article.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(article.date)}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {article.readTime} min
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {!isLoading && displayArticles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>{lang === 'es' ? 'No hay artículos publicados.' : 'No published articles.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* Storage CTA banner */}
      <section className="relative py-20 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img loading="lazy" decoding="async"
            src="/brand/brand-storage-unit.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#160B1E]/95 via-[#2A123B]/80 to-[#160B1E]/70" />
        </div>
        <div className="container px-4 md:px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4" data-testid="text-blog-cta-title">
            {isSpanish ? (
              <>¿Listo para tu <span className="text-[#EF7521]">mudanza</span>?</>
            ) : (
              <>Ready for your <span className="text-[#EF7521]">move</span>?</>
            )}
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            {isSpanish
              ? "Mudanza y almacenamiento en un solo lugar, con el cuidado de U-Storage Go."
              : "Moving and storage in one place, with U-Storage Go care."}
          </p>
          <Link href="/quote">
            <Button className="h-12 px-8 text-base font-bold bg-[#EF7521] hover:bg-[#d96513] text-white shadow-lg shadow-[#EF7521]/25" data-testid="button-blog-bottom-cta">
              {t('nav.getQuote')} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
