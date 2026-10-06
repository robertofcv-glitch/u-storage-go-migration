import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Key, Mail, Shield, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function AdminLanding() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const { user, isAuthenticated, refetch } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [requestForm, setRequestForm] = useState({
    email: "",
    fullName: "",
    phone: "",
    company: "",
    justification: "",
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const userType = (user as any).userType;
      if (userType === "admin") {
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

      const userType = data.user?.userType;
      if (userType !== "admin") {
        toast({
          title: t('common.error'),
          description: t('adminLanding.error.notAdmin'),
          variant: "destructive",
        });
        return;
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

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      toast({
        title: t('common.error'),
        description: t('forgotPassword.emailRequired'),
        variant: "destructive",
      });
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('forgotPassword.error'));
      }

      setForgotPasswordSent(true);
      toast({
        title: t('common.success'),
        description: t('forgotPassword.success'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('forgotPassword.error'),
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setForgotPasswordSent(false);
  };

  const handleRequestAccess = async () => {
    if (!requestForm.email || !requestForm.fullName) {
      toast({
        title: t('common.error'),
        description: t('adminLanding.request.error.required'),
        variant: "destructive",
      });
      return;
    }

    setRequestLoading(true);
    try {
      const response = await fetch('/api/admin/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message);
      }

      setRequestSent(true);
      toast({
        title: t('common.success'),
        description: t('adminLanding.request.success'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCloseRequestAccess = () => {
    setShowRequestAccess(false);
    setRequestForm({ email: "", fullName: "", phone: "", company: "", justification: "" });
    setRequestSent(false);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center py-20 overflow-hidden bg-primary text-primary-foreground">
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
              <Card className="w-full border-none shadow-2xl bg-card text-card-foreground">
                <CardContent className="p-6 md:p-8">
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Key className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{t('adminLanding.login.title')}</h3>
                      <p className="text-slate-500 text-sm">{t('adminLanding.login.subtitle')}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="admin-login-email" className="text-sm">{t('common.email')}</Label>
                        <Input 
                          id="admin-login-email" 
                          type="email" 
                          placeholder="admin@u-storage-go.com" 
                          className="h-10 bg-slate-50"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                          data-testid="input-admin-login-email"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="admin-login-password" className="text-sm">{t('common.password')}</Label>
                        <Input 
                          id="admin-login-password" 
                          type="password" 
                          placeholder="••••••••" 
                          className="h-10 bg-slate-50"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                          data-testid="input-admin-login-password"
                        />
                      </div>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 font-semibold gap-2"
                        onClick={handleEmailLogin}
                        disabled={loading}
                        data-testid="button-admin-email-login"
                      >
                        <Mail className="h-4 w-4" />
                        {loading ? t('common.loading') : t('adminLanding.login.button')}
                      </Button>
                      <button 
                        type="button"
                        className="w-full text-center text-sm text-action hover:text-foreground transition-colors mt-2"
                        onClick={() => setShowForgotPassword(true)}
                        data-testid="link-forgot-password"
                      >
                        {t('forgotPassword.link')}
                      </button>
                    </div>
                    
                    <div className="border-t pt-4 mt-4">
                      <p className="text-center text-sm text-slate-500 mb-3">
                        {t('adminLanding.noAccount')}
                      </p>
                      <Button 
                        variant="outline"
                        className="w-full border-action text-action hover:bg-action/10 h-10 font-semibold gap-2"
                        onClick={() => setShowRequestAccess(true)}
                        data-testid="button-request-access"
                      >
                        <UserPlus className="h-4 w-4" />
                        {t('adminLanding.requestAccess')}
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-center text-xs text-slate-400 mt-6">
                    {t('adminLanding.securityNote')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />

      <Dialog open={showForgotPassword} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {forgotPasswordSent ? t('forgotPassword.sentTitle') : t('forgotPassword.title')}
            </DialogTitle>
            <DialogDescription>
              {forgotPasswordSent ? t('forgotPassword.sentDescription') : t('forgotPassword.description')}
            </DialogDescription>
          </DialogHeader>
          
          {!forgotPasswordSent ? (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t('common.email')}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="admin@u-storage-go.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                  data-testid="input-forgot-email"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseForgotPassword}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  data-testid="button-forgot-submit"
                >
                  {forgotPasswordLoading ? t('common.loading') : t('forgotPassword.sendButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 text-sm">{t('forgotPassword.checkEmail')}</p>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleCloseForgotPassword}
              >
                {t('forgotPassword.backToLogin')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRequestAccess} onOpenChange={handleCloseRequestAccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {requestSent ? t('adminLanding.request.sentTitle') : t('adminLanding.request.title')}
            </DialogTitle>
            <DialogDescription>
              {requestSent ? t('adminLanding.request.sentDescription') : t('adminLanding.request.description')}
            </DialogDescription>
          </DialogHeader>
          
          {!requestSent ? (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="request-name">{t('login.fullName')} *</Label>
                <Input
                  id="request-name"
                  type="text"
                  placeholder={t('adminLanding.request.namePlaceholder')}
                  value={requestForm.fullName}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, fullName: e.target.value }))}
                  data-testid="input-request-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-email">{t('common.email')} *</Label>
                <Input
                  id="request-email"
                  type="email"
                  placeholder="admin@company.com"
                  value={requestForm.email}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-request-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-phone">{t('common.phone')}</Label>
                <Input
                  id="request-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={requestForm.phone}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-request-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-company">{t('adminLanding.request.company')}</Label>
                <Input
                  id="request-company"
                  type="text"
                  placeholder={t('adminLanding.request.companyPlaceholder')}
                  value={requestForm.company}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, company: e.target.value }))}
                  data-testid="input-request-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-justification">{t('adminLanding.request.justification')}</Label>
                <Textarea
                  id="request-justification"
                  placeholder={t('adminLanding.request.justificationPlaceholder')}
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, justification: e.target.value }))}
                  rows={3}
                  data-testid="input-request-justification"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseRequestAccess}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleRequestAccess}
                  disabled={requestLoading}
                  data-testid="button-request-submit"
                >
                  {requestLoading ? t('common.loading') : t('adminLanding.request.submit')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 text-sm">{t('adminLanding.request.successMessage')}</p>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleCloseRequestAccess}
              >
                {t('common.close')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
