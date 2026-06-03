import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { LoginPage } from "@/components/auth/LoginPage";
import { AppShell } from "@/components/AppShell";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
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
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">…</p>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return (
    <AppShell>
      {role === "employee" ? <EmployeeDashboard /> : <ManagerDashboard />}
    </AppShell>
  );
}
