import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Globe } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./layout/AppSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@tanstack/react-router";
import { EmployeeDrawerProvider } from "@/contexts/EmployeeDrawerContext";
import { EmployeeDetailDrawer } from "@/components/employee/EmployeeDetailDrawer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useKeyboardShortcuts, CommandPalette } from "@/components/layout/KeyboardShortcuts";
import { OnboardingTour } from "@/components/layout/OnboardingTour";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang, dir } = useI18n();
  const { profile, signOut, role } = useAuth();
  const location = useLocation();
  const { commandPaletteOpen, setCommandPaletteOpen } = useKeyboardShortcuts();
  const isRTL = dir === "rtl";
  const page = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("page") : null;
  const pageTitle = page ? (
    page === "employees" ? t("employees") :
    page === "tasks" ? (role === "employee" ? t("my_tasks") : t("tasks")) :
    page === "productivity" ? t("productivity_table") :
    page === "attendance" ? t("attendance_log") :
    page === "departments" ? t("departments") :
    page === "reports" ? t("reports") :
    page === "audit" ? t("audit_log") :
    page === "settings" ? t("settings") :
    page === "exit-requests" ? t("exit_requests") :
    t("dashboard")
  ) : t("dashboard");

  useRealtimeSync();

  return (
    <EmployeeDrawerProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen bg-surface">
          {/* Header */}
          <header className="sticky top-0 z-10 w-full h-16 bg-white border-b border-border shadow-sm flex items-center justify-between px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg leading-none">إ</span>
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-bold text-primary leading-tight">
                  <span className="sm:hidden">{pageTitle}</span>
                  <span className="hidden sm:inline">{t("app_title") || "نظام إدارة الموظفين"}</span>
                </h1>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5">
                  <span className="sm:hidden">
                    {role === "admin" ? t("role_admin") : role === "manager" ? t("role_manager") : t("role_employee")}
                  </span>
                  <span className="hidden sm:inline">{t("subtitle") || "المراقب"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationsBell />

              <div className="flex items-center gap-2 px-2.5 py-1 bg-green-50 rounded-full border border-green-100 hidden sm:flex">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[11px] font-medium text-green-700">{isRTL ? "مباشر" : "Live"}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                className="text-muted-foreground hover:text-primary"
              >
                <Globe className="w-4 h-4 me-1.5" />
                {lang === "ar" ? "EN" : "AR"}
              </Button>

              <div className="flex items-center gap-3 ps-4 border-s border-border hidden sm:flex">
                <div className="text-end">
                  <p className="text-sm font-semibold text-primary">{profile?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{role}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-accent transition-all">
                  <span className="text-white font-bold text-sm">
                    {profile?.full_name?.[0]?.toUpperCase()}
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-danger hover:bg-red-50 flex"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-20 sm:pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </SidebarInset>
        <EmployeeDetailDrawer />
        <MobileBottomNav />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        <OnboardingTour />
      </SidebarProvider>
    </EmployeeDrawerProvider>
  );
}
