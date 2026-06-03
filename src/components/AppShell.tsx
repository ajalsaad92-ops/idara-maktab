import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Globe } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  const roleLabel = role === "admin" ? t("role_admin") : role === "manager" ? t("role_manager") : t("role_employee");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground sticky top-0 z-30 shadow-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gold/20 ring-2 ring-gold/40 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-gold" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold leading-tight truncate">{t("app_name")}</h1>
              <p className="text-xs opacity-75 truncate">{profile?.full_name} · {roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/10"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              title={lang === "ar" ? "English" : "العربية"}
            >
              <Globe className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/10"
              onClick={signOut}
              title={t("logout")}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 pb-20">{children}</main>
    </div>
  );
}
