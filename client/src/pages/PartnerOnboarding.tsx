import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Building2, Truck, MapPin, Phone, UserPlus, Check, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const MOVE_TYPES = [
  { id: "local", labelKey: "onboarding.moveTypes.local" },
  { id: "commercial", labelKey: "onboarding.moveTypes.commercial" },
  { id: "residential", labelKey: "onboarding.moveTypes.residential" },
  { id: "packing", labelKey: "onboarding.moveTypes.packing" },
  { id: "storage", labelKey: "onboarding.moveTypes.storage" },
  { id: "specialItems", labelKey: "onboarding.moveTypes.specialItems" },
  { id: "international", labelKey: "onboarding.moveTypes.international" },
];

const VEHICLE_TYPES = [
  { id: "van", labelKey: "onboarding.vehicleTypes.van" },
  { id: "smallTruck", labelKey: "onboarding.vehicleTypes.smallTruck" },
  { id: "mediumTruck", labelKey: "onboarding.vehicleTypes.mediumTruck" },
  { id: "largeTruck", labelKey: "onboarding.vehicleTypes.largeTruck" },
  { id: "trailer", labelKey: "onboarding.vehicleTypes.trailer" },
  { id: "motorcycle", labelKey: "onboarding.vehicleTypes.motorcycle" },
];

const STEPS = [
  { id: 1, icon: Building2, titleKey: "onboarding.steps.company" },
  { id: 2, icon: Truck, titleKey: "onboarding.steps.fleet" },
  { id: 3, icon: MapPin, titleKey: "onboarding.steps.areas" },
  { id: 4, icon: Phone, titleKey: "onboarding.steps.contact" },
  { id: 5, icon: UserPlus, titleKey: "onboarding.steps.account" },
];

export default function PartnerOnboarding() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: "",
    description: "",
    yearsInBusiness: "",
    taxId: "",
    fleetSize: "",
    crewSize: "",
    moveTypes: [] as string[],
    vehicleTypes: [] as string[],
    serviceAreas: "",
    operatingHours: "",
    contactPhone: "",
    businessEmail: "",
    website: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const updateField = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: string, item: string) => {
    const current = formData[field as keyof typeof formData] as string[];
    if (current.includes(item)) {
      updateField(field, current.filter(i => i !== item));
    } else {
      updateField(field, [...current, item]);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
      case 2:
      case 3:
      case 4:
        return true;
      case 5:
        return formData.fullName.trim() !== "" && 
               formData.email.trim() !== "" && 
               formData.password.length >= 6 &&
               formData.password === formData.confirmPassword;
      default:
        return true;
    }
  };

  const handleSocialLogin = () => {
    localStorage.setItem('partnerOnboardingData', JSON.stringify(formData));
    window.location.href = "/api/login";
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth/partner-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          profile: {
            companyName: formData.companyName,
            description: formData.description,
            yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
            fleetSize: formData.fleetSize ? parseInt(formData.fleetSize) : null,
            crewSize: formData.crewSize ? parseInt(formData.crewSize) : null,
            moveTypes: formData.moveTypes,
            vehicleTypes: formData.vehicleTypes,
            serviceAreas: formData.serviceAreas.split(',').map(s => s.trim()),
            operatingHours: formData.operatingHours,
            contactPhone: formData.contactPhone,
            businessEmail: formData.businessEmail || formData.email,
            website: formData.website,
            taxId: formData.taxId,
          }
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('login.error.registration'));
      }

      toast({
        title: t('common.success'),
        description: t('onboarding.success'),
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]">{t('onboarding.company.title')}</h3>
              <p className="text-slate-500 text-sm">{t('onboarding.company.subtitle')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('onboarding.company.name')}</Label>
              <Input 
                id="companyName"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder={t('onboarding.company.namePlaceholder')}
                className="h-11"
                data-testid="input-company-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('onboarding.company.description')}</Label>
              <Textarea 
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t('onboarding.company.descriptionPlaceholder')}
                rows={3}
                data-testid="input-company-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearsInBusiness">{t('onboarding.company.years')}</Label>
                <Input 
                  id="yearsInBusiness"
                  type="number"
                  min="0"
                  value={formData.yearsInBusiness}
                  onChange={(e) => updateField('yearsInBusiness', e.target.value)}
                  placeholder="5"
                  className="h-11"
                  data-testid="input-years-business"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">{t('onboarding.company.taxId')}</Label>
                <Input 
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateField('taxId', e.target.value)}
                  placeholder="ABC123456XYZ"
                  className="h-11"
                  data-testid="input-tax-id"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]">{t('onboarding.fleet.title')}</h3>
              <p className="text-slate-500 text-sm">{t('onboarding.fleet.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fleetSize">{t('onboarding.fleet.size')}</Label>
                <Input 
                  id="fleetSize"
                  type="number"
                  min="1"
                  value={formData.fleetSize}
                  onChange={(e) => updateField('fleetSize', e.target.value)}
                  placeholder="3"
                  className="h-11"
                  data-testid="input-fleet-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crewSize">{t('onboarding.fleet.crew')}</Label>
                <Input 
                  id="crewSize"
                  type="number"
                  min="1"
                  value={formData.crewSize}
                  onChange={(e) => updateField('crewSize', e.target.value)}
                  placeholder="8"
                  className="h-11"
                  data-testid="input-crew-size"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('onboarding.fleet.vehicleTypes')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`vehicle-${type.id}`}
                      checked={formData.vehicleTypes.includes(type.id)}
                      onCheckedChange={() => toggleArrayItem('vehicleTypes', type.id)}
                      data-testid={`checkbox-vehicle-${type.id}`}
                    />
                    <label htmlFor={`vehicle-${type.id}`} className="text-sm cursor-pointer">
                      {t(type.labelKey)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('onboarding.fleet.moveTypes')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {MOVE_TYPES.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`move-${type.id}`}
                      checked={formData.moveTypes.includes(type.id)}
                      onCheckedChange={() => toggleArrayItem('moveTypes', type.id)}
                      data-testid={`checkbox-move-${type.id}`}
                    />
                    <label htmlFor={`move-${type.id}`} className="text-sm cursor-pointer">
                      {t(type.labelKey)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]">{t('onboarding.areas.title')}</h3>
              <p className="text-slate-500 text-sm">{t('onboarding.areas.subtitle')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceAreas">{t('onboarding.areas.coverage')}</Label>
              <Textarea 
                id="serviceAreas"
                value={formData.serviceAreas}
                onChange={(e) => updateField('serviceAreas', e.target.value)}
                placeholder={t('onboarding.areas.placeholder')}
                rows={4}
                data-testid="input-service-areas"
              />
              <p className="text-xs text-slate-400">{t('onboarding.areas.hint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingHours">{t('onboarding.areas.hours')}</Label>
              <Input 
                id="operatingHours"
                value={formData.operatingHours}
                onChange={(e) => updateField('operatingHours', e.target.value)}
                placeholder={t('onboarding.areas.hoursPlaceholder')}
                className="h-11"
                data-testid="input-hours"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]">{t('onboarding.contact.title')}</h3>
              <p className="text-slate-500 text-sm">{t('onboarding.contact.subtitle')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t('onboarding.contact.phone')}</Label>
              <Input 
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => updateField('contactPhone', e.target.value)}
                placeholder="+52 55 1234 5678"
                className="h-11"
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessEmail">{t('onboarding.contact.email')}</Label>
              <Input 
                id="businessEmail"
                type="email"
                value={formData.businessEmail}
                onChange={(e) => updateField('businessEmail', e.target.value)}
                placeholder="contacto@tuempresa.com"
                className="h-11"
                data-testid="input-business-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t('onboarding.contact.website')}</Label>
              <Input 
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://www.tuempresa.com"
                className="h-11"
                data-testid="input-website"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[#1A1A1A]">{t('onboarding.account.title')}</h3>
              <p className="text-slate-500 text-sm">{t('onboarding.account.subtitle')}</p>
            </div>

            <Button 
              variant="outline"
              className="w-full h-11 gap-2 border-slate-200 hover:bg-slate-50" 
              onClick={handleSocialLogin}
              data-testid="button-social-signup"
            >
              <LogIn className="h-4 w-4" />
              {t('login.signupWith')}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">{t('login.or')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t('login.fullName')} *</Label>
              <Input 
                id="fullName"
                value={formData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="Juan García"
                className="h-11"
                data-testid="input-full-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')} *</Label>
              <Input 
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="tu@email.com"
                className="h-11"
                data-testid="input-email"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('common.password')} *</Label>
                <Input 
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="••••••••"
                  className="h-11"
                  data-testid="input-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('onboarding.account.confirm')} *</Label>
                <Input 
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  className="h-11"
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
            {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-500">{t('onboarding.account.mismatch')}</p>
            )}
            <p className="text-xs text-slate-400">{t('login.passwordHint')}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#F8D9BF]/30 font-sans">
      <Navbar />
      
      <section className="py-12 lg:py-20">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl lg:text-4xl font-display font-bold text-[#1A1A1A] mb-3">
                {t('onboarding.title')}
              </h1>
              <p className="text-slate-600">{t('onboarding.subtitle')}</p>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                {STEPS.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex flex-col items-center ${currentStep >= step.id ? 'text-[#1A1A1A]' : 'text-slate-300'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                      currentStep > step.id 
                        ? 'bg-green-500 text-white' 
                        : currentStep === step.id 
                          ? 'bg-[#1A1A1A] text-white' 
                          : 'bg-slate-200 text-slate-400'
                    }`}>
                      {currentStep > step.id ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">{t(step.titleKey)}</span>
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Card className="border-none shadow-xl">
              <CardContent className="p-6 md:p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>

                <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    disabled={currentStep === 1}
                    className="gap-2"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="h-4 w-4" /> {t('onboarding.back')}
                  </Button>
                  
                  {currentStep < STEPS.length ? (
                    <Button
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      disabled={!canProceed()}
                      className="bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 gap-2"
                      data-testid="button-next"
                    >
                      {t('onboarding.next')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={!canProceed() || loading}
                      className="bg-[#EF7521] hover:bg-[#3E8A9E] gap-2"
                      data-testid="button-submit"
                    >
                      {loading ? t('common.loading') : t('onboarding.submit')} 
                      {!loading && <Check className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-slate-500 mt-6">
              {t('onboarding.loginPrompt')}{' '}
              <a href="/mover" className="text-[#EF7521] hover:underline font-medium">
                {t('onboarding.loginLink')}
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
