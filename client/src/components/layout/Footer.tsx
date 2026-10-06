import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Mail, MapPin } from "lucide-react";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-go-purple text-white/85 py-12 border-t border-white/10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img 
                src="/brand/v1/logos/official-reverse.svg"
                alt="U-Storage Go" 
                className="h-8 w-auto object-contain"
                data-testid="img-footer-logo"
              />
            </div>
            <p className="text-sm leading-relaxed max-w-xs text-neutral-300">
              {t('footer.description', 'We move what you value, we care for what matters. Professional moving and storage, powered by U-Storage.')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.quickLinks', 'Quick Links')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <a href="/#services" className="hover:text-white transition-colors">
                  {t('nav.services')}
                </a>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link href="/quote" className="hover:text-white transition-colors">
                  {t('nav.getQuote')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal/Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.company', 'Company')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/mover" className="hover:text-white transition-colors">
                  {t('nav.partners')}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  {t('nav.login')}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.contact', 'Contact Us')}</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4" />
                <a href="mailto:hola@u-storage.com.mx" className="hover:text-white">hola@u-storage.com.mx</a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{t('footer.location', 'Mexico City, Mexico')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-sm text-neutral-400">
          <p>&copy; {new Date().getFullYear()} U-Storage Go. {t('footer.rights', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  );
}
