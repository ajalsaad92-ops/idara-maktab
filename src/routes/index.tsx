import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { LoginPage } from "@/components/auth/LoginPage";
import AppShell from "@/components/AppShell";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";
import { Toaster } from "@/components/ui/sonner";
import { EmployeeManagementPage } from "@/components/pages/EmployeeManagementPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { ExitRequestsPage } from "@/components/pages/ExitRequestsPage";
import { TasksPage } from "@/components/pages/TasksPage";
import { AttendancePage } from "@/components/pages/AttendancePage";
import ProductivityPage from "@/components/pages/ProductivityPage";
import { ReportsPage } from "@/components/pages/ReportsPage";
import { DepartmentsPage } from "@/components/pages/DepartmentsPage";
import { AuditPage } from "@/components/pages/AuditPage";
import { HelpPage } from "@/components/pages/HelpPage";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { task_id?: string; page?: string } => {
    return {
      task_id: search.task_id as string | undefined,
      page: search.page as string | undefined,
    };
  },
  ssr: false,
  head: () => ({
    meta: [
      { title: "ديوان المحافظة — نظام إدارة الموظفين والمهام" },
      { name: "description", content: "Bilingual employee attendance and task management system." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Toaster richColors position="top-center" />
        <Gate />
      </AuthProvider>
    </I18nProvider>
  );
}

function Gate() {
  const { user, loading, role } = useAuth();
  const { page } = Route.useSearch();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">…</p>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  
  const renderPage = () => {
    switch (page) {
      case "employees":
        return <EmployeeManagementPage />;
      case "settings":
        return <SettingsPage />;
      case "exit-requests":
        return <ExitRequestsPage />;
      case "tasks":
        return <TasksPage />;
      case "attendance":
        return <AttendancePage />;
      case "productivity":
        return <ProductivityPage />;
      case "reports":
        return <ReportsPage />;
      case "departments":
        return <DepartmentsPage />;
      case "audit":
        return <AuditPage />;
      case "help":
        return <HelpPage />;
      default:
        return role === "employee" ? <EmployeeDashboard /> : <ManagerDashboard />;
    }
  };
  
  return (
    <AppShell>
      {renderPage()}
    </AppShell>
  );
}
