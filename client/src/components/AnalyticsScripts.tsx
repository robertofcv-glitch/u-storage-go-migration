import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SeoSettings {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
}

export function AnalyticsScripts() {
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/seo/settings'],
    staleTime: 1000 * 60 * 60,
  });
  
  const [gtmId, setGtmId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;

    if (settings.googleAnalyticsId && !document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`;
      document.head.appendChild(script);

      const inlineScript = document.createElement('script');
      inlineScript.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${settings.googleAnalyticsId}');
      `;
      document.head.appendChild(inlineScript);
    }

    if (settings.googleTagManagerId && !document.querySelector(`script[data-gtm]`)) {
      const script = document.createElement('script');
      script.setAttribute('data-gtm', 'true');
      script.textContent = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${settings.googleTagManagerId}');
      `;
      document.head.appendChild(script);
      setGtmId(settings.googleTagManagerId);
    }

    if (settings.facebookPixelId && !document.querySelector(`script[data-fb-pixel]`)) {
      const script = document.createElement('script');
      script.setAttribute('data-fb-pixel', 'true');
      script.textContent = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${settings.facebookPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    }
  }, [settings]);

  if (gtmId) {
    return (
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    );
  }

  return null;
}
