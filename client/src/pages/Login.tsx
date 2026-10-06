import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ShieldCheck, Star, Zap, User, ArrowRight, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, refetch } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const userType = (user as any).userType;
      if (userType === "admin") {
        setLocation('/admin/dashboard');
      } else if (userType === "mover") {
        setLocation('/mover/dashboard');
      } else {
        setLocation('/dashboard');
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
        body: JSON.stringify({ email, password, fullName, userType: 'client', quoteSessionId: quoteSessionId || undefined }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('login.error.registration'));
      }

      toast({
        title: t('common.success'),
        description: t('login.signupSuccess'),
      });
      
      setLocation('/dashboard');
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
    <div className="min-h-screen bg-[var(--usg-paper)] font-sans">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden bg-[var(--usg-purple)]">
        <div className="absolute inset-0">
          <img
            src="/brand/brand-packed-boxes.webp"
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--usg-purple)]/80 via-[var(--usg-purple)]/55 to-[var(--usg-ink)]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--usg-purple)]/80 via-transparent to-transparent" />
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
                  <User className="mr-2 h-4 w-4 text-[var(--usg-orange)]" /> {t('clients.hero.badge')}
                </div>
                <h1 className="text-4xl lg:text-6xl font-display font-bold text-white leading-[1.1] tracking-tight mb-6">
                  {t('clients.hero.title')}
                </h1>
                <p className="text-xl text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {t('clients.hero.subtitle')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                   <Button size="lg" className="bg-[var(--usg-orange)] hover:bg-orange-600 text-[var(--usg-ink)] font-bold text-lg px-8 h-14 shadow-lg shadow-orange-950/20 w-full sm:w-auto" onClick={() => setLocation('/quote')}>
                    {t('clients.hero.cta')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-xs text-white/60 text-center sm:text-left ml-1">{t('clients.cta.title')}</p>
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
                  <ShieldCheck className="h-5 w-5 text-[var(--usg-orange)]" />
                  <span>{t('hero.features.verified')}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 font-medium">
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  <span>4.9/5 {t('hero.rating')}</span>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="relative p-6 md:p-8 bg-white/95 backdrop-blur-md rounded-xl shadow-lg">
                  <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="login" data-testid="tab-login">{t('login.tabLogin')}</TabsTrigger>
                      <TabsTrigger value="signup" data-testid="tab-signup">{t('login.tabSignup')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="login" className="space-y-4">
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-[var(--usg-ink)]">{t('login.welcomeBack')}</h3>
                        <p className="text-slate-500 text-sm">{t('login.subtitle')}</p>
                      </div>

                      {/* Email/Password Login */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="login-email" className="text-sm">{t('common.email')}</Label>
                          <Input 
                            id="login-email" 
                            type="email" 
                            placeholder="name@example.com" 
                            className="h-10 bg-slate-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                            data-testid="input-login-email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="login-password" className="text-sm">{t('common.password')}</Label>
                          <Input 
                            id="login-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                            data-testid="input-login-password"
                          />
                        </div>
                        <Button 
                          className="w-full bg-[var(--usg-orange)] hover:bg-orange-600 text-[var(--usg-ink)] min-h-12 font-semibold gap-2 shadow-lg shadow-orange-950/20"
                          onClick={handleEmailLogin}
                          disabled={loading}
                          data-testid="button-email-login"
                        >
                          <Mail className="h-4 w-4" />
                          {loading ? t('common.loading') : t('login.signInEmail')}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="signup" className="space-y-4">
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-[var(--usg-ink)]">{t('login.createAccount')}</h3>
                        <p className="text-slate-500 text-sm">{t('login.signupSubtitle')}</p>
                      </div>

                      {/* Email/Password Signup */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="signup-name" className="text-sm">{t('login.fullName')}</Label>
                          <Input 
                            id="signup-name" 
                            type="text" 
                            placeholder="Juan García" 
                            className="h-10 bg-slate-50"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            data-testid="input-signup-name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="signup-email" className="text-sm">{t('common.email')}</Label>
                          <Input 
                            id="signup-email" 
                            type="email" 
                            placeholder="name@example.com" 
                            className="h-10 bg-slate-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            data-testid="input-signup-email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="signup-password" className="text-sm">{t('common.password')}</Label>
                          <Input 
                            id="signup-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            data-testid="input-signup-password"
                          />
                          <p className="text-xs text-slate-400">{t('login.passwordHint')}</p>
                        </div>
                        <Button 
                          className="w-full bg-[var(--usg-orange)] hover:bg-orange-600 text-[var(--usg-ink)] min-h-12 font-semibold shadow-lg shadow-orange-950/20"
                          onClick={handleSignup}
                          disabled={loading}
                          data-testid="button-signup"
                        >
                          {loading ? t('common.loading') : t('login.createAccountBtn')}
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
      <section className="py-20 bg-[var(--usg-lavender)]/55">
        <div className="container px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[var(--usg-ink)] mb-4">
              {t('clients.benefits.title')}
            </h2>
            <p className="text-slate-600 text-lg">
              {t('clients.benefits.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center mb-6">
                  <ShieldCheck className="h-7 w-7 text-[var(--usg-purple)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--usg-ink)] mb-3">{t('clients.benefits.1.title')}</h3>
                <p className="text-slate-600">{t('clients.benefits.1.desc')}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center mb-6">
                  <Star className="h-7 w-7 text-[var(--usg-purple)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--usg-ink)] mb-3">{t('clients.benefits.2.title')}</h3>
                <p className="text-slate-600">{t('clients.benefits.2.desc')}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-14 h-14 rounded-full bg-[var(--usg-lavender)] flex items-center justify-center mb-6">
                  <Zap className="h-7 w-7 text-[var(--usg-purple)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--usg-ink)] mb-3">{t('clients.benefits.3.title')}</h3>
                <p className="text-slate-600">{t('clients.benefits.3.desc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[var(--usg-ink)] text-white">
        <div className="container px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            {t('clients.cta.title')}
          </h2>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
            {t('clients.cta.subtitle')}
          </p>
          <Button size="lg" className="bg-[var(--usg-orange)] hover:bg-orange-600 text-[var(--usg-ink)] font-bold text-lg px-10 h-14 shadow-lg shadow-orange-950/20" onClick={() => setLocation('/quote')}>
            {t('clients.hero.cta')}
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
