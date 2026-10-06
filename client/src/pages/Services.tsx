import { Navbar } from "@/components/layout/Navbar";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Truck, Archive, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function Services() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();

  const services = [
    {
      id: 'local',
      icon: Truck,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      id: 'storage',
      icon: Archive,
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-primary py-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600518464441-9154a4dea21b?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        <div className="container px-4 relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-display font-bold mb-6"
          >
            {t('servicesPage.title')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-200 max-w-2xl mx-auto"
          >
            {t('servicesPage.subtitle')}
          </motion.p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 container px-4">
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {services.map((service) => (
            <motion.div 
              key={service.id}
              variants={item}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-slate-100"
            >
              <div className={`w-16 h-16 ${service.bg} rounded-2xl flex items-center justify-center mb-6`}>
                <service.icon className={`w-8 h-8 ${service.color}`} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                {t(`servicesPage.items.${service.id}.title`)}
              </h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                {t(`servicesPage.items.${service.id}.desc`)}
              </p>
              
              {service.id === 'storage' && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">{t('common.partnership')}</p>
                  <a href="https://u-storage.com.mx/" target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
                    <img 
                      src="https://u-storage.com.mx/wp-content/uploads/2019/10/logo-u-storage.png" 
                      alt="u-Storage" 
                      className="h-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <span className="hidden text-lg font-bold text-[#4A2278]">u-Storage</span>
                  </a>
                </div>
              )}

              <Button variant="link" onClick={() => setLocation('/quote')} className="p-0 h-auto text-primary font-semibold group">
                {t('nav.getQuote')} <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="bg-slate-900 py-20 text-white text-center">
        <div className="container px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">{t('hero.title')}</h2>
          <Button size="lg" onClick={() => setLocation('/quote')} className="bg-accent text-white hover:bg-accent/90 text-lg px-8 py-6 rounded-xl">
            {t('nav.getQuote')} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
