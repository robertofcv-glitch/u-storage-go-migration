import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import { Key, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      // Strip the token from the URL immediately to prevent it from being
      // captured by analytics scripts, browser history, or referrer headers.
      window.history.replaceState(null, '', window.location.pathname);
      verifyToken(urlToken);
    } else {
      setVerifying(false);
      setTokenValid(false);
    }
  }, [search]);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch(`/api/auth/verify-reset-token?token=${tokenToVerify}`);
      const data = await response.json();
      setTokenValid(data.valid === true);
    } catch (error) {
      setTokenValid(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('forgotPassword.emailRequired'),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('forgotPassword.passwordMismatch'),
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('login.error.passwordLength'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('forgotPassword.error'));
      }

      setResetComplete(true);
      toast({
        title: t('common.success'),
        description: t('forgotPassword.resetSuccess'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('forgotPassword.error'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--usg-paper)] font-sans">
      <Navbar />
      
      <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center py-20 overflow-hidden bg-[var(--usg-purple)] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex items-center justify-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md mx-auto"
            >
              <Card className="w-full border-none shadow-2xl bg-white text-slate-900">
                <CardContent className="p-6 md:p-8">
                  {verifying ? (
                    <div className="text-center py-8">
                       <div className="w-12 h-12 border-4 border-[var(--usg-orange)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-slate-500">{t('common.loading')}</p>
                    </div>
                  ) : !tokenValid ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('forgotPassword.invalidToken')}</h3>
                      <Button
                        className="mt-4 bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
                        onClick={() => setLocation('/admin')}
                        data-testid="button-back-to-login"
                      >
                        {t('forgotPassword.goToLogin')}
                      </Button>
                    </div>
                  ) : resetComplete ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 text-green-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('forgotPassword.resetSuccess')}</h3>
                      <Button
                        className="mt-4 bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
                        onClick={() => setLocation('/admin')}
                        data-testid="button-go-to-login"
                      >
                        {t('forgotPassword.goToLogin')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <div className="w-12 h-12 bg-[var(--usg-lavender)] rounded-full flex items-center justify-center mx-auto mb-3">
                         <Key className="h-6 w-6 text-[var(--usg-purple)]" />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--usg-ink)]">{t('forgotPassword.resetTitle')}</h3>
                        <p className="text-slate-500 text-sm">{t('forgotPassword.resetDescription')}</p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="new-password" className="text-sm">{t('forgotPassword.newPassword')}</Label>
                          <Input 
                            id="new-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="confirm-password" className="text-sm">{t('forgotPassword.confirmPassword')}</Label>
                          <Input 
                            id="confirm-password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="h-10 bg-slate-50"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                            data-testid="input-confirm-password"
                          />
                        </div>
                        <Button 
                           className="w-full bg-[var(--usg-orange)] hover:bg-orange-600 text-[var(--usg-ink)] min-h-12 font-semibold"
                          onClick={handleResetPassword}
                          disabled={loading}
                          data-testid="button-reset-password"
                        >
                          {loading ? t('common.loading') : t('forgotPassword.resetButton')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
