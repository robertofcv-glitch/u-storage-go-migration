import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, FileCheck, MapPin, MessageCircle, Target, Sparkles, ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function About() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';

  const proofPoints = [
    {
      icon: FileCheck,
      title: isSpanish ? "Cotizaciones claras" : "Clear quotes",
      desc: isSpanish
        ? "Sabes exactamente qué incluye tu mudanza antes de comprometerte. Sin sorpresas, sin letras pequeñas."
        : "You know exactly what your move includes before you commit. No surprises, no fine print.",
    },
    {
      icon: Shield,
      title: isSpanish ? "Equipos verificados" : "Verified crews",
      desc: isSpanish
        ? "Sabes quién realizará tu servicio. Las opciones de protección se confirman según las condiciones de cada mudanza."
        : "Know who will handle your service. Protection options are confirmed according to each move's terms.",
    },
    {
      icon: MapPin,
      title: isSpanish ? "Mudanza y bodega conectadas" : "Moving and storage connected",
      desc: isSpanish
        ? "Coordinamos tu traslado con una bodega U-Storage cuando necesitas liberar espacio."
        : "We coordinate your move with a U-Storage unit when you need to free up space.",
    },
    {
      icon: MessageCircle,
      title: isSpanish ? "Acompañamiento claro" : "Clear guidance",
      desc: isSpanish
        ? "Te mantenemos informado por los canales disponibles para tu servicio, desde la cotización hasta la coordinación."
        : "We keep you informed through the channels available for your service, from quote to coordination.",
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <SEO
        title={isSpanish ? "Nosotros" : "About Us"}
        description={isSpanish
          ? "U-Storage Go nace de U-Storage para habilitar nuevos comienzos. No movemos cajas: movemos lo que valoras y cuidamos lo que importa."
          : "U-Storage Go was born from U-Storage to enable new beginnings. We don't move boxes: we move what you value and care for what matters."}
      />
      <Navbar />

      {/* Hero - dusk brand style */}
      <section className="relative pt-20 pb-24 lg:pt-28 lg:pb-32 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img loading="eager" decoding="async" fetchPriority="high"
            src="/brand/brand-city-delivery.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/80 via-[#2A123B]/60 to-[#160B1E]/90" />
        </div>
        <div className="container px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 text-sm font-medium text-white mb-6"
          >
            <Sparkles className="mr-2 h-4 w-4 text-go-orange" />
            {isSpanish ? "Una marca de U-Storage" : "A U-Storage brand"}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-display font-bold text-white mb-6"
            data-testid="text-about-title"
          >
            {isSpanish ? "No solo guardamos tus cosas." : "We don't just store your belongings."}
            <br />
            <span className="text-go-orange">
              {isSpanish ? "También te ayudamos a llevarlas." : "We help you move them, too."}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-display italic text-white/90 max-w-2xl mx-auto mb-8"
          >
            {isSpanish
              ? "De tu casa a una bodega U-Storage, o de la bodega a tu nuevo espacio."
              : "From your home to a U-Storage unit, or from storage to your new space."}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link href="/quote">
              <Button className="h-12 px-8 text-base font-bold bg-go-orange hover:bg-go-orange/85 text-go-ink" data-testid="button-about-cta">
                {t('nav.getQuote')} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 container px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden shadow-2xl"
          >
            <img loading="lazy" decoding="async"
              src="/brand/brand-movers-team.webp"
              alt={isSpanish ? "Equipo de U-Storage Go" : "U-Storage Go crew"}
              className="w-full h-full object-cover"
              data-testid="img-about-team"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 text-center lg:text-left"
          >
            <div className="inline-flex items-center rounded-full bg-go-purple/10 px-4 py-2 text-sm font-medium text-go-purple">
              <Target className="mr-2 h-4 w-4" /> {t('aboutPage.story.title')}
            </div>
            <div className="h-1 w-20 bg-go-orange rounded-full mx-auto lg:mx-0" />
            <div className="text-lg text-slate-600 leading-relaxed whitespace-pre-line" data-testid="text-about-story">
              {t('aboutPage.story.desc')}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust through evidence - dusk section */}
      <section className="relative py-20 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img loading="lazy" decoding="async"
            src="/brand/brand-packed-boxes.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover blur-md scale-110 opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/90 via-[#160B1E]/75 to-[#160B1E]/90" />
        </div>
        <div className="container px-4 relative z-10">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              {isSpanish ? "Confianza que se demuestra" : "Trust you can see"}
            </h2>
            <p className="text-slate-300 italic">
              {isSpanish
                ? "La confianza no se pide: se demuestra con evidencia en cada mudanza."
                : "Trust isn't asked for: it's proven with evidence on every move."}
            </p>
            <div className="h-1 w-20 bg-go-orange mx-auto rounded-full mt-4" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {proofPoints.map((p, i) => (
              <div key={i} className="p-8 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-proof-${i}`}>
                <div className="w-12 h-12 bg-go-orange/10 text-go-orange rounded-lg flex items-center justify-center mb-4">
                  <p.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold mb-3 text-go-ink">{p.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parent brand connection */}
      <section className="py-20 bg-white">
        <div className="container px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="space-y-6 text-center lg:text-left order-2 lg:order-1">
              <p className="flex items-center justify-center lg:justify-start gap-3">
                <img src="/ustorage-logo.svg" alt="U-Storage" className="h-6 w-auto object-contain" />
                <span className="text-go-orange font-semibold">→</span>
                <img src="/brand/v1/logos/official-color.svg" alt="U-Storage Go" className="h-6 w-auto object-contain" />
              </p>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-go-ink">
                {isSpanish
                  ? "De la bodega a tu nuevo espacio, todo conectado."
                  : "From storage to your new space, everything connected."}
              </h2>
              <p className="text-slate-600 text-lg">
                {isSpanish
                  ? "U-Storage ofrece el espacio para guardar. U-Storage Go coordina la mudanza y la conexión entre ambos servicios para que mover y almacenar sea un solo proceso."
                  : "U-Storage provides the space to store. U-Storage Go coordinates the move and connects both services so moving and storage become one process."}
              </p>
              <Link href="/quote">
                <Button className="h-12 px-8 text-base font-bold bg-go-purple hover:bg-go-purple/90 text-white" data-testid="button-about-parent-cta">
                  {t('nav.getQuote')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl order-1 lg:order-2">
              <img loading="lazy" decoding="async"
                src="/brand/brand-facility-night.webp"
                alt={isSpanish ? "Instalaciones de U-Storage" : "U-Storage facility"}
                className="w-full h-full object-cover"
                data-testid="img-about-facility"
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
