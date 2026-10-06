import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowUpRight, Globe2, MessageCircle, Phone } from "lucide-react";
import { SEO } from "@/components/SEO";

const copy = {
  es: {
    title: "Conectamos tu mudanza",
    description: "U-Storage Go conecta a clientes con sucursales U-Storage participantes para coordinar traslados.",
    languageLabel: "Cambiar idioma a inglés",
    heading: "Tus pertenencias, conectadas.",
    intro: "U-Storage Go conecta a clientes con sucursales U-Storage participantes para coordinar traslados que comienzan o terminan en ellas.",
    phoneLabel: "Llámanos",
    quote: "Escríbenos",
    example: "WhatsApp de ejemplo; pendiente de activar.",
    website: "Cotiza tu mudanza",
    websiteLabel: "Cotiza tu mudanza",
    request: "Hola, me gustaría solicitar información para cotizar una mudanza con U-Storage Go.",
  },
  en: {
    title: "Moving, connected",
    description: "U-Storage Go connects customers with participating U-Storage branches to coordinate moves.",
    languageLabel: "Cambiar idioma a español",
    heading: "Your belongings, connected.",
    intro: "U-Storage Go connects customers with participating U-Storage branches to coordinate moves that begin or end at those branches.",
    phoneLabel: "Call us",
    quote: "Message us",
    example: "Example WhatsApp; activation pending.",
    website: "Get a moving quote",
    websiteLabel: "Get a moving quote",
    request: "Hello, I would like information about getting a moving quote with U-Storage Go.",
  },
};

export default function QRLanding() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language.toLowerCase().startsWith("es");
  const text = isSpanish ? copy.es : copy.en;

  const toggleLanguage = () => {
    void i18n.changeLanguage(isSpanish ? "en" : "es");
  };

  const whatsappHref = `https://wa.me/12025550100?text=${encodeURIComponent(text.request)}`;

  return (
    <main
      lang={isSpanish ? "es" : "en"}
      data-testid="qr-landing"
      className="qr-page min-h-[100dvh] bg-[#FBF9F6] px-5 pb-8 text-[#24152E] sm:px-8"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      <SEO title={text.title} description={text.description} />
      <style>{`
        @keyframes qr-arrive {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .qr-arrive { animation: qr-arrive .45s cubic-bezier(.2,.75,.25,1) both; }
        .qr-focus:focus-visible {
          outline: 3px solid #FF6C00;
          outline-offset: 4px;
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-page *, .qr-page *::before, .qr-page *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-5 sm:py-7">
        <img
          src="/brand/v1/logos/official-color.svg"
          alt="U-Storage Go"
           className="h-auto w-[min(200px,65%)] sm:w-[260px]"
        />
        <button
          type="button"
          onClick={toggleLanguage}
          className="qr-focus inline-flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#4E2069] transition-colors hover:bg-[#F4EFF7]"
          aria-label={text.languageLabel}
        >
          <Globe2 className="h-[18px] w-[18px]" aria-hidden="true" />
          <span>{isSpanish ? "EN" : "ES"}</span>
        </button>
      </header>

      <section className="qr-arrive relative mx-auto mt-5 w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#D9D0DF] bg-white shadow-[0_18px_55px_rgba(78,32,105,.08)] sm:mt-10">
        <div className="h-1.5 bg-[#FF6C00]" />
        <div className="px-6 py-7 sm:px-10 sm:py-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[.16em] text-[#6D6075]">
            U-STORAGE GO
          </p>
          <h1 className="max-w-md text-[clamp(2rem,8vw,3.25rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#4E2069]">
            {text.heading}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#6D6075] sm:text-base sm:leading-7">
            {text.intro}
          </p>

          <div className="mt-7 rounded-xl bg-[#F4EFF7] px-4 py-4 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#6D6075]">
              {text.phoneLabel}
            </p>
            <a
              href="tel:8001121068"
              data-testid="qr-phone"
              className="qr-focus mt-1 inline-flex min-h-12 items-center gap-3 rounded-md text-[1.55rem] font-semibold tracking-[-.03em] text-[#4E2069] transition-colors hover:text-[#FF6C00] sm:text-[1.8rem]"
            >
              <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>800 112 1068</span>
            </a>
          </div>

          <div className="mt-5">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
               data-testid="qr-whatsapp"
              className="qr-focus group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#FF6C00] px-5 text-center text-[15px] font-semibold text-[#24152E] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ff8730] active:translate-y-0"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              <span>{text.quote}</span>
              <ArrowUpRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
            <p className="mt-2 text-center text-xs leading-5 text-[#6D6075]" role="note">
              {text.example}
            </p>
          </div>

          <div className="mt-6 border-t border-[#D9D0DF] pt-4 text-center">
            <Link
               href="/quote"
               data-testid="qr-quote"
              aria-label={text.websiteLabel}
              className="qr-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-[#4E2069] transition-colors hover:text-[#FF6C00]"
            >
              {text.website}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
