import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";
import { Calendar, Clock, User, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { blogArticles, articleContent } from "@/data/blogData";
import { SEO, structuredData } from "@/components/SEO";
import type { BlogPost } from "@shared/schema";

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'en';

  const { data, isLoading, error } = useQuery<{ post: BlogPost }>({
    queryKey: ['/api/blog/posts', slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) {
        if (res.status === 404) return { post: null };
        throw new Error('Failed to fetch post');
      }
      return res.json();
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const dbPost = data?.post;
  const staticArticle = blogArticles.find(a => a.slug === slug);
  const staticContent = slug ? articleContent[slug] : null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="container px-4 py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#EF7521]" />
        </div>
        <Footer />
      </div>
    );
  }

  const hasDbPost = dbPost && dbPost.id;
  const hasStaticPost = staticArticle && staticContent;

  if (!hasDbPost && !hasStaticPost) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="container px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-4">
            {lang === 'es' ? 'Artículo no encontrado' : 'Article not found'}
          </h1>
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'Volver al blog' : 'Back to blog'}
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const article = hasDbPost ? {
    title: lang === 'es' ? dbPost.titleEs : dbPost.titleEn,
    excerpt: lang === 'es' ? dbPost.excerptEs : dbPost.excerptEn,
    content: lang === 'es' ? dbPost.contentEs : dbPost.contentEn,
    category: lang === 'es' ? dbPost.categoryEs : dbPost.categoryEn,
    author: dbPost.author,
    date: dbPost.publishedAt ? new Date(dbPost.publishedAt).toISOString().split('T')[0] : '',
    readTime: dbPost.estimatedReadMinutes || 5,
    image: dbPost.heroImage || '',
    slug: dbPost.slug,
    metaTitle: lang === 'es' ? dbPost.metaTitleEs : dbPost.metaTitleEn,
    metaDescription: lang === 'es' ? dbPost.metaDescriptionEs : dbPost.metaDescriptionEn,
    ogTitle: lang === 'es' ? dbPost.ogTitleEs : dbPost.ogTitleEn,
    ogDescription: lang === 'es' ? dbPost.ogDescriptionEs : dbPost.ogDescriptionEn,
    ogImage: dbPost.ogImage,
  } : {
    title: lang === 'es' ? staticArticle!.titleEs : staticArticle!.titleEn,
    excerpt: lang === 'es' ? staticArticle!.excerptEs : staticArticle!.excerptEn,
    content: lang === 'es' ? staticContent!.es : staticContent!.en,
    category: lang === 'es' ? staticArticle!.categoryEs : staticArticle!.categoryEn,
    author: staticArticle!.author,
    date: staticArticle!.date,
    readTime: staticArticle!.readTime,
    image: staticArticle!.image,
    slug: staticArticle!.slug,
    metaTitle: null,
    metaDescription: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
  };

  const articleData = {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt || '',
    image: article.ogImage || article.image,
    datePublished: article.date,
    author: article.author,
    url: `https://rukumove.com/blog/${article.slug}`
  };

  const renderContent = (content: string) => {
    return content
      .replace(/## /g, '<h2 class="text-xl font-bold text-[#1A1A1A] mt-8 mb-4">')
      .replace(/### /g, '<h3 class="text-lg font-semibold text-[#1A1A1A] mt-6 mb-3">')
      .replace(/\n\n/g, '</h2></h3><p class="mb-4">')
      .replace(/- /g, '• ');
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <SEO
        title={article.metaTitle || article.title || ''}
        description={article.metaDescription || article.excerpt || ''}
        image={article.ogImage || article.image}
        type="article"
        article={{
          publishedTime: article.date,
          author: article.author,
          section: article.category || '',
        }}
        structuredData={structuredData.article(articleData)}
      />
      <Navbar />
      
      <article className="pt-8 pb-20">
        <div className="container px-4 md:px-6 max-w-4xl mx-auto">
          <Link href="/blog">
            <Button variant="ghost" className="mb-6 text-slate-600 hover:text-[#1A1A1A]" data-testid="button-back-blog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {lang === 'es' ? 'Volver al blog' : 'Back to blog'}
            </Button>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {article.category && (
              <Badge className="mb-4 bg-[#EF7521] hover:bg-[#EF7521]">
                {article.category}
              </Badge>
            )}
            
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-[#1A1A1A] mb-4">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {article.author}
              </span>
              {article.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(article.date)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.readTime} min {lang === 'es' ? 'de lectura' : 'read'}
              </span>
            </div>

            {article.image && (
              <div className="relative rounded-xl overflow-hidden mb-8 shadow-lg">
                <img 
                  src={article.image} 
                  alt={article.title || ''}
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            )}

            <div className="prose prose-lg max-w-none prose-headings:text-[#1A1A1A] prose-a:text-[#EF7521]">
              <div 
                className="whitespace-pre-line text-slate-700 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: renderContent(article.content || '')
                }}
              />
            </div>

            <Card className="mt-12 bg-[#F8D9BF]/30 border-[#EF7521]/20">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">
                  {lang === 'es' ? '¿Listo para tu próxima mudanza?' : 'Ready for your next move?'}
                </h3>
                <p className="text-slate-600 mb-4">
                  {lang === 'es' 
                    ? 'Obtén una cotización gratuita en minutos con nuestra IA asistente'
                    : 'Get a free quote in minutes with our AI assistant'}
                </p>
                <Link href="/quote">
                  <Button className="bg-[#EF7521] hover:bg-[#1A1A1A]" data-testid="button-get-quote">
                    {lang === 'es' ? 'Obtener Cotización' : 'Get Quote'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
