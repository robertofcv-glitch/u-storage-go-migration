import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSidebarLinks } from "@/lib/adminSidebar";
import { AdminCompaniesUsers } from "./AdminCompaniesUsers";

export default function AdminUsuarios() {
  const { i18n } = useTranslation();
  const sidebarLinks = getAdminSidebarLinks(i18n.language);

  return (
    <DashboardLayout links={sidebarLinks} userType="admin">
      <AdminCompaniesUsers />
    </DashboardLayout>
  );
}
