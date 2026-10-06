import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Truck, User, Settings, ArrowRight, CheckCircle2, Box, MapPin, Calendar, ShieldCheck, MessageSquare, Archive, HeartHandshake, Smartphone, BadgeCheck, Plus } from "lucide-react";
import { motion } from "framer-motion";
const heroImage = '/brand/home-hero-dusk.webp';
import { AddressAutocomplete, type UStorageBranch } from "@/components/ui/address-autocomplete";
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { useStorageServicePolicy } from "@/hooks/useStorageServicePolicy";

export default function Home() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';
  const [_, setLocation] = useLocation();
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromBranch, setFromBranch] = useState<UStorageBranch | null>(null);
  const [toBranch, setToBranch] = useState<UStorageBranch | null>(null);
  const [fromLocation, setFromLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toLocation, setToLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { policy } = useStorageServicePolicy();

  const handleGetQuote = () => {
    // Pass data via query params
    const params = new URLSearchParams();
    if (fromAddress) params.append('from', fromAddress);
    if (toAddress) params.append('to', toAddress);
    if (fromBranch) params.append('fromBranchId', fromBranch.id);
    if (toBranch) params.append('toBranchId', toBranch.id);
    setLocation(`/quote?${params.toString()}`);
  };

  const services = [
    {
      id: 'local',
      icon: Truck,
      color: "text-go-orange",
      bg: "bg-go-orange/10",
      image: "/brand/brand-movers-team.webp"
    },
    {
      id: 'storage',
      icon: Archive,
      color: "text-go-purple",
      bg: "bg-go-purple/10",
      image: "/brand/brand-storage-unit.webp"
    }
  ];

  const valueProps = [
    { id: 'crews', icon: BadgeCheck },
    { id: 'care', icon: HeartHandshake },
    { id: 'digital', icon: Smartphone },
    { id: 'clarity', icon: ShieldCheck }
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <SEO
        title={isSpanish ? "Mudanzas y Bodegas en México" : "Moving and Storage in Mexico"}
        description={isSpanish 
          ? "U-Storage Go coordina traslados que comienzan o terminan en sucursales U-Storage participantes."
          : "U-Storage Go coordinates moves that begin or end at participating U-Storage branches."}
      />
      <Navbar />
      
      {/* Hero Section - Option 2 brand banner: dark photo, orange brand name, white italic tagline */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-28 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/75 via-[#2A123B]/50 to-[#160B1E]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#160B1E]/70 via-transparent to-transparent" />
        </div>
        <div className="container px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="mb-6 flex justify-center lg:justify-start" data-testid="text-hero-brand">
                  <img
                    src="/brand/v1/logos/official-reverse.svg"
                    alt="U-Storage Go"
                    className="h-12 lg:h-16 w-auto object-contain"
                  />
                </h1>
                <p className="text-3xl lg:text-4xl font-display italic font-medium text-white leading-snug mb-6 text-center lg:text-left" data-testid="text-hero-tagline">
                  {isSpanish
                    ? "Ahora no solo guardamos tus cosas. También te ayudamos a llevarlas."
                    : "Now we don't just store your belongings. We help you move them, too."}
                </p>
                <p className="text-lg text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed text-center lg:text-left">
                  {policy?.generalMovesEnabled
                    ? (isSpanish
                      ? "Cotiza el traslado a tu bodega U-Storage, desde la bodega o entre dos domicilios."
                      : "Quote a move to your U-Storage unit, from storage, or between two addresses.")
                    : (isSpanish
                      ? "Servicios exclusivos hacia y desde bodegas de U-Storage."
                      : "Quote a move to or from a participating U-Storage branch.")}
                </p>
              </motion.div>

              {/* Trust Badges */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center lg:justify-start pt-2"
              >
                <div className="flex items-center gap-2 text-white/90 font-medium">
                  <ShieldCheck className="h-5 w-5 text-go-orange" />
                  <span>Mudanza + Bodega</span>
                </div>
              </motion.div>
            </div>

            {/* Right Quote Box */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                 <div className="relative p-8 md:p-10 bg-white/95 backdrop-blur-md rounded-xl shadow-lg">
                     <h3 className="text-2xl font-bold text-go-ink mb-6 text-center">
                      {t('hero.instantQuote')}
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <AddressAutocomplete 
                          value={fromAddress}
                          onChange={(value, placeId) => {
                            setFromAddress(value);
                            if (!placeId) setFromLocation(null);
                          }}
                          onLocationSelect={(location) => {
                            setFromLocation(location);
                            if (location) {
                              setToAddress("");
                              setToLocation(null);
                              setToBranch(null);
                            }
                          }}
                          selectedBranch={fromBranch}
                          nearbyLocation={!toBranch ? toLocation : null}
                          allowBranchSelection={Boolean(policy?.branchMovesEnabled && policy?.outOfStorageEnabled)}
                          disabled={Boolean(fromBranch)}
                          onBranchSelect={(branch) => { setFromBranch(branch); setFromLocation(null); }}
                          onClearSelection={() => { setFromBranch(null); setFromAddress(""); setFromLocation(null); }}
                          placeholder="Ej: Av. Paseo de la Reforma 505, CDMX"
                          className="h-12 rounded-lg border border-border bg-muted focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
                          data-testid="input-from-address"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <AddressAutocomplete 
                          value={toAddress}
                          onChange={(value, placeId) => {
                            setToAddress(value);
                            if (!placeId) setToLocation(null);
                          }}
                          onLocationSelect={setToLocation}
                          selectedBranch={toBranch}
                          nearbyLocation={!fromBranch ? fromLocation : null}
                          allowBranchSelection={Boolean(policy?.branchMovesEnabled && policy?.intoStorageEnabled)}
                          disabled={Boolean(toBranch)}
                          onBranchSelect={(branch) => { setToBranch(branch); setToLocation(null); }}
                          onClearSelection={() => { setToBranch(null); setToAddress(""); setToLocation(null); }}
                          placeholder={fromLocation
                            ? (isSpanish ? "Elige la bodega U-Storage de tu preferencia" : "Choose your preferred U-Storage branch")
                            : (isSpanish ? "Ej: U-Storage Roma" : "e.g. U-Storage Roma")}
                          className="h-12 rounded-lg border border-border bg-muted focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
                          data-testid="input-to-address"
                        />
                      </div>

                      {policy?.branchMovesEnabled && (
                        <p className="text-xs text-center text-slate-500">
                          {fromLocation
                            ? (isSpanish
                              ? "Elige la sucursal de tu preferencia; las opciones aparecen ordenadas por cercanía."
                              : "Choose your preferred branch; options are ordered by proximity.")
                            : policy.generalMovesEnabled
                            ? (isSpanish
                              ? "También puedes buscar una sucursal por nombre, por ejemplo: U-Storage Polanco."
                              : "You can also search for a branch by name, for example: U-Storage Polanco.")
                            : (isSpanish
                              ? "Escribe una dirección o sucursal, por ejemplo: U-Storage Polanco. El origen o destino debe ser una sucursal oficial."
                              : "Enter an address or branch, for example: U-Storage Polanco. The origin or destination must be an official branch.")}
                        </p>
                      )}

                      <Button 
                        onClick={handleGetQuote} 
                        className="w-full h-14 text-lg font-bold bg-go-purple text-white hover:bg-go-purple/90 rounded-lg mt-4"
                      >
                          {isSpanish ? "Cotizar" : "Get a quote"} <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                      
                      <p className="text-xs text-center text-slate-500 mt-4">
                        {t('quote.disclaimer')}
                      </p>
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Intro Video Section */}
      <section className="relative py-20 overflow-hidden bg-white">
        <div className="container px-4 md:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-go-ink mb-4 flex flex-wrap items-center justify-center gap-3">
              <span>{isSpanish ? "Conoce a" : "Meet"}</span>
              <img src="/brand/v1/logos/official-color.svg" alt="U-Storage Go" className="h-8 md:h-10 w-auto object-contain inline-block" />
            </h2>
            <div className="h-1 w-20 bg-go-orange mx-auto rounded-full" />
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
              <video 
                controls 
                playsInline
                preload="none"
                className="w-full aspect-video"
                poster="/intro-video-storage-upbeat.jpg"
                data-testid="intro-video"
              >
                <source src="/intro-video-storage-upbeat.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-white">
        <div className="container px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-go-ink mb-4">
              {t('hero.howItWorks.title')}
            </h2>
            <div className="h-1 w-20 bg-go-orange mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connector Line */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-10" />

            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 border-2 border-go-orange/25 group-hover:border-go-orange transition-colors">
                <MessageSquare className="h-10 w-10 text-go-orange" />
              </div>
              <h3 className="text-xl font-bold text-go-ink mb-3">1. {t('hero.howItWorks.step1.title')}</h3>
              <p className="text-slate-600 max-w-xs">{t('hero.howItWorks.step1.desc')}</p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 border-2 border-go-orange/25 group-hover:border-go-orange transition-colors">
                <Truck className="h-10 w-10 text-go-orange" />
              </div>
              <h3 className="text-xl font-bold text-go-ink mb-3">2. {t('hero.howItWorks.step2.title')}</h3>
              <p className="text-slate-600 max-w-xs">{t('hero.howItWorks.step2.desc')}</p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 border-2 border-go-orange/25 group-hover:border-go-orange transition-colors">
                <CheckCircle2 className="h-10 w-10 text-go-orange" />
              </div>
              <h3 className="text-xl font-bold text-go-ink mb-3">3. {t('hero.howItWorks.step3.title')}</h3>
              <p className="text-slate-600 max-w-xs">{t('hero.howItWorks.step3.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-20 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover blur-md scale-110 opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/90 via-[#160B1E]/75 to-[#160B1E]/90" />
        </div>
        <div className="container relative px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              {t('servicesPage.title')}
            </h2>
            <p className="text-slate-300 text-lg">
              {t('servicesPage.subtitle')}
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 max-w-4xl mx-auto">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-go-orange ring-4 ring-white/20 shadow-lg flex items-center justify-center" data-testid="icon-services-plus">
                <Plus className="h-7 w-7 text-go-ink" strokeWidth={3} />
              </div>
            </div>
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden border-slate-100 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group" data-testid={`card-service-${service.id}`}>
                <div className="h-44 overflow-hidden">
                  <img loading="lazy" decoding="async"
                    src={service.image}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${service.bg} flex items-center justify-center mb-2 transition-colors`}>
                    <service.icon className={`h-6 w-6 ${service.color} transition-colors`} />
                  </div>
                  <CardTitle className="text-go-ink">{t(`servicesPage.items.${service.id}.title`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    {t(`servicesPage.items.${service.id}.desc`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Value Props */}
          <div className="mt-20">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-3">
                {t('servicesPage.valueProps.title')}
              </h3>
              <p className="text-slate-300 italic">
                {t('servicesPage.valueProps.subtitle')}
              </p>
              <div className="h-1 w-20 bg-go-orange mx-auto rounded-full mt-4" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {valueProps.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6"
                  data-testid={`card-valueprop-${prop.id}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-go-orange/10 flex items-center justify-center mb-4">
                    <prop.icon className="h-6 w-6 text-go-orange" />
                  </div>
                  <h4 className="font-bold text-go-ink mb-2">{t(`servicesPage.valueProps.${prop.id}.title`)}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{t(`servicesPage.valueProps.${prop.id}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
