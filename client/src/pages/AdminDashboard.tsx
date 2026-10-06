import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Shield, Users, Activity, Plus, MoreHorizontal, CheckCircle, XCircle, LayoutDashboard, Bot, Truck, Building2, Eye, Clock, AlertCircle, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { QuotesManagement } from "@/components/admin/QuotesManagement";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Partner {
  id: number;
  userId: string;
  companyName: string;
  businessEmail: string | null;
  contactPhone: string | null;
  fleetSize: number | null;
  crewSize: number | null;
  moveTypes: string[] | null;
  serviceAreas: string[] | null;
  verified: boolean | null;
  onboardingComplete: boolean | null;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    createdAt: string;
  };
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [admins, setAdmins] = useState([
    { id: 1, name: "Roberto", email: "robertofcv@gmail.com", role: "super", status: "active" },
    { id: 2, name: "Support Team", email: "support@u-storage-go.com", role: "support", status: "active" },
    { id: 3, name: "Auditor", email: "audit@u-storage-go.com", role: "viewer", status: "inactive" },
  ]);

  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [showNewPartnerDialog, setShowNewPartnerDialog] = useState(false);
  
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    userType: 'client',
  });

  const [newPartner, setNewPartner] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    businessEmail: '',
    contactPhone: '',
    taxId: '',
    fleetSize: '',
    crewSize: '',
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowNewUserDialog(false);
      setNewUser({ fullName: '', email: '', phone: '', userType: 'client' });
      toast.success(t('dashboard.admin.users.createSuccess'));
    },
    onError: () => {
      toast.error(t('dashboard.admin.users.createError'));
    },
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: typeof newPartner) => {
      const response = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create partner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      setShowNewPartnerDialog(false);
      setNewPartner({
        fullName: '', email: '', phone: '', companyName: '',
        businessEmail: '', contactPhone: '', taxId: '', fleetSize: '', crewSize: '',
      });
      toast.success(t('dashboard.admin.partners.createSuccess'));
    },
    onError: () => {
      toast.error(t('dashboard.admin.partners.createError'));
    },
  });

  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const response = await fetch('/api/admin/partners');
      if (!response.ok) throw new Error('Failed to fetch partners');
      const data = await response.json();
      return data.partners as Partner[];
    },
  });

  const sidebarLinks = [
    { href: "#overview", label: t('dashboard.admin.nav.overview'), icon: LayoutDashboard },
    { href: "#quotes", label: t('dashboard.admin.nav.quotes'), icon: FileText },
    { href: "#partners", label: t('dashboard.admin.nav.partners'), icon: Truck },
    { href: "#users", label: t('dashboard.admin.nav.users'), icon: Users },
    { href: "#verification", label: t('dashboard.admin.nav.verification'), icon: Shield },
  ];

  const getOnboardingStatus = (partner: Partner) => {
    if (partner.verified) return 'verified';
    if (partner.onboardingComplete) return 'pending_verification';
    if (partner.companyName && partner.moveTypes && partner.moveTypes.length > 0) return 'profile_complete';
    if (partner.companyName) return 'in_progress';
    return 'started';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" /> {t('dashboard.admin.partners.status.verified')}
          </Badge>
        );
      case 'pending_verification':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" /> {t('dashboard.admin.partners.status.pending')}
          </Badge>
        );
      case 'profile_complete':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <CheckCircle className="h-3 w-3 mr-1" /> {t('dashboard.admin.partners.status.profileComplete')}
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
            <AlertCircle className="h-3 w-3 mr-1" /> {t('dashboard.admin.partners.status.inProgress')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" /> {t('dashboard.admin.partners.status.started')}
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.admin.title')}</h1>
            <p className="text-muted-foreground">{t('dashboard.admin.subtitle')}</p>
          </div>
        </div>

        {/* Admin Management Section */}
        <section id="overview" className="flex flex-col gap-8">
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Shield className="h-5 w-5 text-primary" />
                  {t('dashboard.admin.admins.title')}
                </CardTitle>
                <CardDescription>{t('dashboard.admin.admins.description')}</CardDescription>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" /> {t('dashboard.admin.admins.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('dashboard.admin.admins.add')}</DialogTitle>
                    <DialogDescription>
                      {t('dashboard.admin.admins.addDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">{t('dashboard.admin.admins.table.name')}</Label>
                      <Input id="name" placeholder="John Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">{t('dashboard.admin.admins.table.email')}</Label>
                      <Input id="email" placeholder="john@example.com" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">{t('dashboard.admin.admins.table.role')}</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={t('dashboard.admin.admins.selectRole')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super">{t('dashboard.admin.admins.roles.super')}</SelectItem>
                          <SelectItem value="support">{t('dashboard.admin.admins.roles.support')}</SelectItem>
                          <SelectItem value="viewer">{t('dashboard.admin.admins.roles.viewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-primary">{t('dashboard.admin.admins.addButton')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.admin.admins.table.name')}</TableHead>
                    <TableHead>{t('dashboard.admin.admins.table.email')}</TableHead>
                    <TableHead>{t('dashboard.admin.admins.table.role')}</TableHead>
                    <TableHead>{t('dashboard.admin.admins.table.status')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.admin.admins.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          admin.role === 'super' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                          admin.role === 'support' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }>
                          {t(`dashboard.admin.admins.roles.${admin.role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {admin.status === 'active' ? (
                          <div className="flex items-center text-green-600 text-sm">
                            <CheckCircle className="h-3 w-3 mr-1" /> {t('dashboard.admin.status.active')}
                          </div>
                        ) : (
                          <div className="flex items-center text-slate-400 text-sm">
                            <XCircle className="h-3 w-3 mr-1" /> {t('dashboard.admin.status.inactive')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </section>

        {/* Quotes Management Section */}
        <QuotesManagement />

        {/* Partners Management Section */}
        <section id="partners" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.admin.partners.title')}</h2>
          <Card className="border-t-4 border-t-action">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-action" /> {t('dashboard.admin.partners.subtitle')}
                </CardTitle>
                <CardDescription>{t('dashboard.admin.partners.description')}</CardDescription>
              </div>
              <Button 
                className="bg-action text-action-foreground hover:bg-action/90"
                onClick={() => setShowNewPartnerDialog(true)}
                data-testid="button-new-partner"
              >
                <Plus className="mr-2 h-4 w-4" /> {t('dashboard.admin.partners.add')}
              </Button>
            </CardHeader>
            <CardContent>
              {partnersLoading ? (
                <div className="flex items-center justify-center h-40 text-slate-400">
                  {t('common.loading')}
                </div>
              ) : partnersData && partnersData.length > 0 ? (
                <div className="overflow-x-auto"><Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.admin.partners.table.company')}</TableHead>
                      <TableHead>{t('dashboard.admin.partners.table.contact')}</TableHead>
                      <TableHead>{t('dashboard.admin.partners.table.fleet')}</TableHead>
                      <TableHead>{t('dashboard.admin.partners.table.services')}</TableHead>
                      <TableHead>{t('dashboard.admin.partners.table.status')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.admin.partners.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnersData.map((partner) => (
                      <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{partner.companyName || '-'}</p>
                            <p className="text-xs text-muted-foreground">{partner.user.fullName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{partner.businessEmail || partner.user.email || '-'}</p>
                            {partner.contactPhone && (
                              <p className="text-xs text-muted-foreground">{partner.contactPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {partner.fleetSize ? (
                              <p>{partner.fleetSize} {t('dashboard.admin.partners.vehicles')}</p>
                            ) : '-'}
                            {partner.crewSize && (
                              <p className="text-xs text-muted-foreground">{partner.crewSize} {t('dashboard.admin.partners.crew')}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {partner.moveTypes && partner.moveTypes.length > 0 ? (
                              partner.moveTypes.slice(0, 2).map((type) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {t(`onboarding.moveTypes.${type}`)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                            {partner.moveTypes && partner.moveTypes.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{partner.moveTypes.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(getOnboardingStatus(partner))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" data-testid={`button-view-partner-${partner.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Building2 className="h-12 w-12 mb-4" />
                  <p>{t('dashboard.admin.partners.empty')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="users" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.admin.users.sectionTitle')}</h2>
          <Card className="border-t-4 border-t-secondary">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-secondary" /> {t('dashboard.admin.users.title')}
              </CardTitle>
              <Button 
                className="bg-secondary hover:bg-secondary/90"
                onClick={() => setShowNewUserDialog(true)}
                data-testid="button-new-user"
              >
                <Plus className="mr-2 h-4 w-4" /> {t('dashboard.admin.users.add')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                  <span>{t('dashboard.admin.users.newRegistrations')}</span>
                  <span className="font-bold text-lg">24</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                  <span>{t('dashboard.admin.users.totalUsers')}</span>
                  <span className="font-bold text-lg">1,204</span>
                </div>
                <Button className="w-full" variant="outline">{t('dashboard.admin.users.manage')}</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="verification" className="flex flex-col gap-4 py-6 border-t">
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.admin.verification.sectionTitle')}</h2>
          <Card className="border-t-4 border-t-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-action" /> {t('dashboard.admin.verification.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                  <span>{t('dashboard.admin.verification.pendingMovers')}</span>
                  <span className="font-bold text-lg text-orange-600">
                    {partnersData?.filter(p => p.onboardingComplete && !p.verified).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                  <span>{t('dashboard.admin.verification.documentReviews')}</span>
                  <span className="font-bold text-lg">7</span>
                </div>
                <Button className="w-full" variant="outline">{t('dashboard.admin.verification.review')}</Button>
              </div>
            </CardContent>
          </Card>
        </section>
        
        <section id="settings" className="flex flex-col gap-4 py-6 border-t">
           <h2 className="text-2xl font-bold text-foreground">{t('dashboard.admin.settings.title')}</h2>
           <Card>
             <CardContent className="py-8">
               <div className="flex items-center justify-center h-40 text-slate-400">
                  {t('dashboard.admin.settings.placeholder')}
               </div>
             </CardContent>
           </Card>
        </section>
      </div>

      {/* New User Dialog */}
      <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.users.newUserTitle')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.users.newUserDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user-fullName">{t('dashboard.admin.users.form.fullName')}</Label>
              <Input
                id="user-fullName"
                value={newUser.fullName}
                onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                placeholder="Juan Pérez"
                data-testid="input-new-user-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">{t('dashboard.admin.users.form.email')}</Label>
              <Input
                id="user-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="cliente@email.com"
                data-testid="input-new-user-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-phone">{t('dashboard.admin.users.form.phone')}</Label>
              <Input
                id="user-phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                placeholder="+52 55 1234 5678"
                data-testid="input-new-user-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-type">{t('dashboard.admin.users.form.userType')}</Label>
              <Select 
                value={newUser.userType} 
                onValueChange={(value) => setNewUser({...newUser, userType: value})}
              >
                <SelectTrigger data-testid="select-user-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">{t('dashboard.admin.users.types.client')}</SelectItem>
                  <SelectItem value="mover">{t('dashboard.admin.users.types.mover')}</SelectItem>
                  <SelectItem value="admin">{t('dashboard.admin.users.types.admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewUserDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={() => createUserMutation.mutate(newUser)}
              disabled={createUserMutation.isPending || !newUser.email || !newUser.fullName}
              className="bg-secondary"
              data-testid="button-submit-new-user"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('dashboard.admin.users.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Partner Dialog */}
      <Dialog open={showNewPartnerDialog} onOpenChange={setShowNewPartnerDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.partners.newPartnerTitle')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.partners.newPartnerDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <h4 className="font-medium text-sm text-slate-500">{t('dashboard.admin.partners.form.userInfo')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="partner-fullName">{t('dashboard.admin.partners.form.fullName')}</Label>
                <Input
                  id="partner-fullName"
                  value={newPartner.fullName}
                  onChange={(e) => setNewPartner({...newPartner, fullName: e.target.value})}
                  placeholder="Juan Pérez"
                  data-testid="input-new-partner-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partner-email">{t('dashboard.admin.partners.form.email')}</Label>
                <Input
                  id="partner-email"
                  type="email"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner({...newPartner, email: e.target.value})}
                  placeholder="socio@email.com"
                  data-testid="input-new-partner-email"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="partner-phone">{t('dashboard.admin.partners.form.phone')}</Label>
              <Input
                id="partner-phone"
                value={newPartner.phone}
                onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                placeholder="+52 55 1234 5678"
                data-testid="input-new-partner-phone"
              />
            </div>
            
            <h4 className="font-medium text-sm text-slate-500 mt-4">{t('dashboard.admin.partners.form.companyInfo')}</h4>
            <div className="grid gap-2">
              <Label htmlFor="partner-companyName">{t('dashboard.admin.partners.form.companyName')}</Label>
              <Input
                id="partner-companyName"
                value={newPartner.companyName}
                onChange={(e) => setNewPartner({...newPartner, companyName: e.target.value})}
                placeholder="Mudanzas Express S.A."
                data-testid="input-new-partner-company"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="partner-businessEmail">{t('dashboard.admin.partners.form.businessEmail')}</Label>
                <Input
                  id="partner-businessEmail"
                  type="email"
                  value={newPartner.businessEmail}
                  onChange={(e) => setNewPartner({...newPartner, businessEmail: e.target.value})}
                  placeholder="contacto@empresa.com"
                  data-testid="input-new-partner-business-email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partner-contactPhone">{t('dashboard.admin.partners.form.contactPhone')}</Label>
                <Input
                  id="partner-contactPhone"
                  value={newPartner.contactPhone}
                  onChange={(e) => setNewPartner({...newPartner, contactPhone: e.target.value})}
                  placeholder="+52 55 1234 5678"
                  data-testid="input-new-partner-contact-phone"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="partner-taxId">{t('dashboard.admin.partners.form.taxId')}</Label>
              <Input
                id="partner-taxId"
                value={newPartner.taxId}
                onChange={(e) => setNewPartner({...newPartner, taxId: e.target.value})}
                placeholder="RFC123456789"
                data-testid="input-new-partner-tax-id"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="partner-fleetSize">{t('dashboard.admin.partners.form.fleetSize')}</Label>
                <Input
                  id="partner-fleetSize"
                  type="number"
                  value={newPartner.fleetSize}
                  onChange={(e) => setNewPartner({...newPartner, fleetSize: e.target.value})}
                  placeholder="5"
                  data-testid="input-new-partner-fleet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partner-crewSize">{t('dashboard.admin.partners.form.crewSize')}</Label>
                <Input
                  id="partner-crewSize"
                  type="number"
                  value={newPartner.crewSize}
                  onChange={(e) => setNewPartner({...newPartner, crewSize: e.target.value})}
                  placeholder="10"
                  data-testid="input-new-partner-crew"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPartnerDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={() => createPartnerMutation.mutate(newPartner)}
              disabled={createPartnerMutation.isPending || !newPartner.email || !newPartner.companyName}
              className="bg-action text-action-foreground"
              data-testid="button-submit-new-partner"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('dashboard.admin.partners.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
