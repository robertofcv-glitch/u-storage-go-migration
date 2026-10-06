import { useEffect, useRef, useState } from "react";
import { EMBED_NAMESPACE } from "@/lib/embed";

const USTORAGE_URL = "https://u-storage.com.mx";

const NAV_LINKS = [
  { label: "Sucursales", href: `${USTORAGE_URL}/sucursales` },
  { label: "Servicios", href: `${USTORAGE_URL}/servicios` },
  { label: "Información", href: `${USTORAGE_URL}/informacion` },
];

export default function UStorageHostDemo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const goSectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [iframeHeight, setIframeHeight] = useState(900);

  const scrollToGoSection = () => {
    goSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    let seenFirstScrollRequest = false;
    const handleMessage = (event: MessageEvent) => {
      // Only accept protocol messages coming from our own embed iframe.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === `${EMBED_NAMESPACE}:ready`) {
        // Forward host URL params (utm_*, partner) to the widget, like the real host page would.
        const params: Record<string, string> = {};
        new URLSearchParams(window.location.search).forEach((value, key) => {
          params[key] = value;
        });
        iframeRef.current?.contentWindow?.postMessage(
          { type: `${EMBED_NAMESPACE}:params`, params: { partner: "u-storage", ...params } },
          "*",
        );
      }

      if (data.type === `${EMBED_NAMESPACE}:resize` && typeof data.height === "number") {
        setIframeHeight(Math.max(600, data.height));
      }

      if (data.type === `${EMBED_NAMESPACE}:scrollToTop`) {
        // Ignore only the very first scroll request (fired around widget
        // mount) so visitors see the recreated U-Storage hero first.
        if (seenFirstScrollRequest) {
          const offset = typeof data.offset === "number" ? data.offset : 0;
          // Wait two frames so the iframe height update from the accompanying
          // resize message is applied before we measure — otherwise the target
          // position is computed against a stale layout.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const iframe = iframeRef.current;
              if (!iframe) return;
              // Single precise scroll: iframe's document offset + position of
              // the target inside the iframe - the actual sticky header height
              // (measured, so it adapts to any screen size/configuration).
              const headerHeight =
                headerRef.current?.getBoundingClientRect().height ?? 0;
              const top =
                iframe.getBoundingClientRect().top +
                window.scrollY +
                offset -
                headerHeight -
                12;
              window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }),
          );
        } else {
          seenFirstScrollRequest = true;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ===== Recreated u-storage.com.mx header ===== */}
      <header ref={headerRef} className="sticky top-0 z-50 w-full bg-white shadow-sm">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-4 lg:px-8">
          <a
            href={USTORAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center"
            data-testid="link-ustorage-logo"
          >
            <img src="/ustorage-logo.svg" alt="U-Storage" className="h-10 w-auto" />
          </a>

          <nav className="hidden items-center gap-4 whitespace-nowrap lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium text-neutral-800 transition-colors hover:text-go-orange"
                data-testid={`link-ustorage-${link.label.toLowerCase()}`}
              >
                {link.label} ▾
              </a>
            ))}
            <button
              type="button"
              onClick={scrollToGoSection}
              className="flex shrink-0 flex-col items-center transition-opacity hover:opacity-80"
              data-testid="button-ustorage-go-logo"
            >
              <img src="/brand/v1/logos/official-color.svg" alt="U-Storage Go" className="h-4 w-auto shrink-0 object-contain" />
              <span className="mt-0.5 whitespace-nowrap text-[8px] font-semibold uppercase tracking-wide text-go-purple">
                Mudanza + Bodega
              </span>
            </button>
            <a
              href={`${USTORAGE_URL}/calcula-tu-espacio`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-go-purple px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              data-testid="link-ustorage-calcula"
            >
              Calcula tu Espacio 🧮
            </a>
            <a
              href={`${USTORAGE_URL}/reservar`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-go-orange px-4 py-2 text-sm font-semibold text-go-ink transition-opacity hover:opacity-90"
              data-testid="link-ustorage-reservar"
            >
              Reservar 🗓
            </a>
            <a
              href={`${USTORAGE_URL}/pagar-en-linea`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-200"
              data-testid="link-ustorage-pagar"
            >
              Pagar en Línea
            </a>
          </nav>

          <a
            href={USTORAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-go-purple lg:hidden"
          >
            Menú
          </a>
        </div>
      </header>

      {/* ===== U-Storage Go section — the iframe starts right below the top bar ===== */}
      <section ref={goSectionRef} className="scroll-mt-[72px] bg-white">
        {/* The embed iframe exactly as it would be placed on u-storage.com.mx */}
        <iframe
          ref={iframeRef}
          src="/embed/u-storage"
          title="U-Storage Go — Mudanza + Bodega"
          style={{ height: iframeHeight }}
          className="w-full border-0"
          data-testid="iframe-ustorage-go-embed"
        />
      </section>

      {/* ===== Recreated footer ===== */}
      <footer className="bg-go-purple text-white">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-12 md:grid-cols-3 lg:px-8">
          <div>
            <img
              src="/ustorage-logo.svg"
              alt="U-Storage"
              className="h-9 w-auto brightness-0 invert"
              data-testid="img-footer-ustorage-logo"
            />
            <p className="mt-3 text-sm text-white/80">
              Renta de mini bodegas en México. Seguridad, flexibilidad y la mejor atención.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/90">
              Enlaces
            </h3>
            <ul className="space-y-2 text-sm text-white/80">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-go-orange"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={`${USTORAGE_URL}/reservar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-go-orange"
                >
                  Reservar
                </a>
              </li>
            </ul>
          </div>
          <div>
            <img
              src="/brand/v1/logos/official-reverse.svg"
              alt="U-Storage Go"
              className="mb-3 h-7 w-auto"
              data-testid="img-footer-ustorage-go-logo"
            />
            <p className="text-sm text-white/80">
              Servicio de mudanza con equipos y camiones propios, integrado con tu bodega
              U-Storage.
            </p>
          </div>
        </div>
        <div className="border-t border-white/20 py-4 text-center text-xs text-white/60">
          © {new Date().getFullYear()} U-Storage. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
