import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Home, ListChecks, Bell, User, ClipboardList, Shield } from "lucide-react";
import { useNavigate, useLocation } from "@tanstack/react-router";

export function MobileBottomNav() {
  const { t, dir } = useI18n();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const currentPage = (location.search as any)?.page;

  const employeeTabs = [
    { icon: Home, label: t("dashboard"), page: undefined },
    { icon: ListChecks, label: t("my_tasks") || t("tasks"), page: "tasks" },
    { icon: Bell, label: t("notifications"), page: undefined },
    { icon: User, label: t("profile") || t("account"), page: undefined },
  ];

  const managerTabs = [
    { icon: Home, label: t("dashboard"), page: undefined },
    { icon: ListChecks, label: t("tasks"), page: "tasks" },
    { icon: ClipboardList, label: t("exit_requests") || "طلبات", page: "exit-requests" },
    { icon: Shield, label: t("notifications"), page: undefined },
  ];

  const adminTabs = [
    { icon: Home, label: t("dashboard"), page: undefined },
    { icon: ListChecks, label: t("tasks"), page: "tasks" },
    { icon: User, label: t("employees"), page: "employees" },
    { icon: Shield, label: t("settings"), page: "settings" },
  ];

  const tabs = role === "admin" ? adminTabs : role === "manager" ? managerTabs : employeeTabs;

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex items-center justify-around h-16 pb-safe">
      {tabs.map((tab) => {
        const isActive = tab.page
          ? currentPage === tab.page
          : !currentPage;

        return (
          <button
            key={tab.label}
            onClick={() => navigate({ to: "/", search: tab.page ? { page: tab.page } : undefined })}
            className={`flex flex-col items-center gap-1 py-2 px-3 transition-colors relative ${
              isActive
                ? "text-accent"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
