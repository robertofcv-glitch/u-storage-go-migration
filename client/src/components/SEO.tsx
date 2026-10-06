import { useEffect } from 'react';
import { useLocation } from 'wouter';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  canonical?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  structuredData?: object | object[];
}

const BASE_URL = 'https://rukumove.com';
const DEFAULT_TITLE = 'U-Storage Go - Mudanzas y Almacenamiento';
const DEFAULT_DESCRIPTION = 'Movemos lo que valoras, cuidamos lo que importa. Mudanzas y almacenamiento profesional con U-Storage Go: cotizaciones claras, operadores verificados y tranquilidad en cada paso.';
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  canonical,
  article,
  structuredData,
}: SEOProps) {
  const [location] = useLocation();
  
  const fullTitle = title ? `${title} | U-Storage Go` : DEFAULT_TITLE;
  const fullUrl = url || `${BASE_URL}${location}`;
  const canonicalUrl = canonical || fullUrl;
  const fullImage = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  useEffect(() => {
    document.title = fullTitle;

    const updateMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    updateMeta('description', description);
    
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:image', fullImage, true);
    updateMeta('og:url', fullUrl, true);
    updateMeta('og:type', type, true);
    updateMeta('og:site_name', 'U-Storage Go', true);
    updateMeta('og:locale', 'es_MX', true);
    updateMeta('og:locale:alternate', 'en_US', true);

    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', fullImage);

    if (article) {
      if (article.publishedTime) updateMeta('article:published_time', article.publishedTime, true);
      if (article.modifiedTime) updateMeta('article:modified_time', article.modifiedTime, true);
      if (article.author) updateMeta('article:author', article.author, true);
      if (article.section) updateMeta('article:section', article.section, true);
      article.tags?.forEach((tag, i) => {
        updateMeta(`article:tag:${i}`, tag, true);
      });
    }

    let robotsMeta = document.querySelector('meta[name="robots"]:not([data-dashboard])') as HTMLMetaElement;
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    } else if (robotsMeta && !robotsMeta.hasAttribute('data-dashboard')) {
      robotsMeta.remove();
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    const existingHreflang = document.querySelectorAll('link[data-hreflang]');
    existingHreflang.forEach(el => el.remove());

    const urlObj = new URL(window.location.href);
    const basePath = urlObj.pathname;
    
    const esParams = new URLSearchParams(urlObj.search);
    esParams.set('lang', 'es');
    const enParams = new URLSearchParams(urlObj.search);
    enParams.set('lang', 'en');
    
    const hreflangLinks = [
      { lang: 'es', url: `${BASE_URL}${basePath}?${esParams.toString()}` },
      { lang: 'en', url: `${BASE_URL}${basePath}?${enParams.toString()}` },
      { lang: 'x-default', url: canonicalUrl },
    ];

    hreflangLinks.forEach(({ lang, url: hrefUrl }) => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', hrefUrl);
      link.setAttribute('data-hreflang', 'true');
      document.head.appendChild(link);
    });

    const existingStructuredData = document.querySelectorAll('script[data-seo-structured]');
    existingStructuredData.forEach(el => el.remove());

    if (structuredData) {
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];
      dataArray.forEach(data => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-structured', 'true');
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      });
    }

    return () => {
      const dynamicStructuredData = document.querySelectorAll('script[data-seo-structured]');
      dynamicStructuredData.forEach(el => el.remove());
      const dynamicHreflang = document.querySelectorAll('link[data-hreflang]');
      dynamicHreflang.forEach(el => el.remove());
    };
  }, [fullTitle, description, fullImage, fullUrl, type, noindex, canonicalUrl, article, structuredData, location]);

  return null;
}

export const structuredData = {
  localBusiness: (city: string, citySlug: string) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": `U-Storage Go - ${city}`,
    "description": `Solicita y administra servicios de mudanza y almacenamiento en ${city} con U-Storage Go.`,
    "url": `${BASE_URL}/ciudad/${citySlug}`,
    "areaServed": {
      "@type": "City",
      "name": city
    },
    "serviceType": ["Mudanzas", "Bodega y Almacenamiento U-Storage"],
    "priceRange": "$$"
  }),

  article: (article: {
    title: string;
    description: string;
    image: string;
    datePublished: string;
    dateModified?: string;
    author: string;
    url: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "image": article.image.startsWith('http') ? article.image : `${BASE_URL}${article.image}`,
    "datePublished": article.datePublished,
    "dateModified": article.dateModified || article.datePublished,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "U-Storage Go",
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/brand/v1/favicons/icon-512.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url
    }
  }),

  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }),

  breadcrumb: (items: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`
    }))
  })
};
