import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { TrendingUp, ShieldCheck, Smartphone, ArrowRight, Truck, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

export default function PartnersLanding() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';
  const [_, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, refetch } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const userType = (user as any).userType;
      if (userType === "mover") {
        setLocation('/mover/dashboard');
      } else if (userType === "admin") {
        setLocation('/admin/dashboard');
      }
    }
  }, [isAuthenticated, user, setLocation]);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast({
        title: t('common.error'),
        description: t('login.error.required'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('login.error.invalid'));
      }

      toast({
        title: t('common.success'),
        description: t('login.success'),
      });
      
      // Refetch auth state - the useEffect will handle redirect once authenticated
      await refetch();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('login.error.invalid'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      toast({
        title: t('common.error'),
        description: t('login.error.allFieldsRequired'),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t('common.error'),
        description: t('login.error.passwordLength'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const quoteSessionId = sessionStorage.getItem('ruku_quote_session_id');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          fullName,
          userType: 'mover',
          quoteSessionId: quoteSessionId || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('login.error.registration'));
      }

      toast({
        title: t('common.success'),
        description: t('login.signupSuccess'),
      });
      
      setLocation('/mover/dashboard');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <SEO
        title={isSpanish ? "Únete como Socio de Mudanzas" : "Join as a Moving Partner"}
        description={isSpanish 
          ? "Trabaja con U-Storage Go. Recibe trabajos de mudanza, aumenta tus ingresos y haz crecer tu negocio."
          : "Work with U-Storage Go. Receive moving jobs, increase your income, and grow your business."}
      />
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-[#160B1E]">
        <div className="absolute inset-0">
          <img
            src="/brand/brand-movers-team.webp"
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#160B1E]/75 via-[#2A123B]/50 to-[#160B1E]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#160B1E]/70 via-transparent to-transparent" />
        </div>
        <div className="container px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center justify-center lg:justify-start rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 text-sm font-medium text-white mb-6">
                  <Truck className="mr-2 h-4 w-4 text-go-orange" /> {t('partners.hero.badge')}
                </div>
                <h1 className="text-4xl lg:text-6xl font-display font-bold text-white leading-[1.1] tracking-tight mb-6">
                  {t('partners.hero.title')}
                </h1>
                <p className="text-xl text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {t('partners.hero.subtitle')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                   <Button size="lg" className="bg-go-orange hover:bg-go-orange/85 text-go-ink font-bold text-lg px-8 h-14 w-full sm:w-auto" onClick={() => setLocation('/mover/onboarding')} data-testid="button-become-partner">
                    {t('partners.hero.cta')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                   <p className="text-xs text-white/60 text-center sm:text-left ml-1">{t('partners.cta.title')}</p>
                </div>
              </motion.div>
              
              {/* Trust Badges */}
               <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4"
              >
                <div className="flex items-center gap-2 text-white/90 font-medium">
                  <TrendingUp className="h-5 w-5 text-go-orange" />
                  <span>{t('partners.benefits.1.title')}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 font-medium">
                  <ShieldCheck className="h-5 w-5 text-go-orange" />
                  <span>{t('partners.benefits.3.title')}</span>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
              id="auth-card"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="relative p-6 md:p-8 bg-white/95 backdrop-blur-md rounded-xl shadow-lg">
                  <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="login" data-testid="tab-mover-login">{t('login.tabLogin')}</TabsTrigger>
                      <TabsTrigger value="signup" data-testid="tab-mover-signup">{t('login.tabSignup')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="login" className="space-y-4">
                      <div className="text-center mb-4">
                         <h3 className="text-xl font-bold text-go-ink">{t('partners.login.welcome')}</h3>
                        <p className="text-slate-500 text-sm">{t('partners.login.subtitle')}</p>
                      </div>

                      {/* Email/Password Login */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="mover-login-email" className="text-sm">{t('common.email')}</Label>
                          <Input 
                            id="mover-login-email" 
                            type="email" 
                            placeholder="contact@empresa.com" 
                            className="h-10 bg-slate-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                            data-testid="input-mover-login-email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="mover-login-password" className="text-sm">{t('common.password')}</Label>
                          <Input 
                            id="mover-login-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                            data-testid="input-mover-login-password"
                          />
                        </div>
                        <Button 
                           className="w-full bg-go-orange hover:bg-go-orange/85 text-go-ink h-12 font-bold gap-2" 
                          onClick={handleEmailLogin}
                          disabled={loading}
                          data-testid="button-mover-email-login"
                        >
                          <Mail className="h-4 w-4" />
                          {loading ? t('common.loading') : t('login.signInEmail')}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="signup" className="space-y-4">
                      <div className="text-center mb-4">
                         <h3 className="text-xl font-bold text-go-ink">{t('partners.signup.title')}</h3>
                        <p className="text-slate-500 text-sm">{t('partners.signup.subtitle')}</p>
                      </div>

                      {/* Email/Password Signup */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="mover-signup-name" className="text-sm">{t('login.fullName')}</Label>
                          <Input 
                            id="mover-signup-name" 
                            type="text" 
                            placeholder="Juan García" 
                            className="h-10 bg-slate-50"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            data-testid="input-mover-signup-name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="mover-signup-email" className="text-sm">{t('common.email')}</Label>
                          <Input 
                            id="mover-signup-email" 
                            type="email" 
                            placeholder="contact@empresa.com" 
                            className="h-10 bg-slate-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            data-testid="input-mover-signup-email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="mover-signup-password" className="text-sm">{t('common.password')}</Label>
                          <Input 
                            id="mover-signup-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            data-testid="input-mover-signup-password"
                          />
                          <p className="text-xs text-slate-400">{t('login.passwordHint')}</p>
                        </div>
                        <Button 
                           className="w-full bg-go-orange hover:bg-go-orange/85 text-go-ink h-12 font-bold" 
                          onClick={handleSignup}
                          disabled={loading}
                          data-testid="button-mover-signup"
                        >
                          {loading ? t('common.loading') : t('partners.signup.button')}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-50">
        <div className="container px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-go-ink mb-4">
              {t('partners.benefits.title')}
            </h2>
            <p className="text-slate-600 text-lg">
              {t('partners.benefits.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-md">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[#F8D9BF]/30 flex items-center justify-center mb-6">
                  <TrendingUp className="h-7 w-7 text-go-purple" />
                </div>
                <h3 className="text-xl font-bold text-go-ink mb-3">{t('partners.benefits.1.title')}</h3>
                <p className="text-slate-600">{t('partners.benefits.1.desc')}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[#F8D9BF]/30 flex items-center justify-center mb-6">
                  <Smartphone className="h-7 w-7 text-go-purple" />
                </div>
                <h3 className="text-xl font-bold text-go-ink mb-3">{t('partners.benefits.2.title')}</h3>
                <p className="text-slate-600">{t('partners.benefits.2.desc')}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[#F8D9BF]/30 flex items-center justify-center mb-6">
                  <ShieldCheck className="h-7 w-7 text-go-purple" />
                </div>
                <h3 className="text-xl font-bold text-go-ink mb-3">{t('partners.benefits.3.title')}</h3>
                <p className="text-slate-600">{t('partners.benefits.3.desc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-go-purple text-white">
        <div className="container px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            {t('partners.cta.title')}
          </h2>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
            {t('partners.cta.subtitle')}
          </p>
          <Button size="lg" className="bg-go-orange hover:bg-go-orange/85 text-go-ink font-bold text-lg px-10 h-14" onClick={() => setLocation('/mover/onboarding')} data-testid="button-cta-become-partner">
            {t('partners.hero.cta')}
          </Button>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
