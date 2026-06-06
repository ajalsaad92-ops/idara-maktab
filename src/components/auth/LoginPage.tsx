import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Building2, Globe, Loader2 } from "lucide-react";

export function LoginPage() {
  const { t, lang, setLang } = useI18n();
  void lang;
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) toast.error(res.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-[oklch(0.32_0.08_255)] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            <Globe className="h-4 w-4 me-2" /> {lang === "ar" ? "English" : "العربية"}
          </Button>
        </div>

        <Card className="p-8 shadow-2xl border-0">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3 shadow-lg ring-4 ring-gold/30">
              <Building2 className="h-10 w-10 text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-primary">{t("app_name")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                dir="ltr"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                dir="ltr"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("login")}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground mb-2 font-semibold">
              {lang === "ar" ? "حسابات تجريبية (للتطوير)" : "Test accounts (dev)"}:
            </p>
            <div className="space-y-1 text-xs">
              {[
                { e: "admin@test.com", p: "Admin1234", label: lang === "ar" ? "مدير النظام" : "Admin" },
                { e: "manager@test.com", p: "Manager1234", label: lang === "ar" ? "مدير" : "Manager" },
                { e: "employee@test.com", p: "Employee1234", label: lang === "ar" ? "موظف" : "Employee" },
              ].map((a) => (
                <button
                  type="button"
                  key={a.e}
                  onClick={() => {
                    setEmail(a.e);
                    setPassword(a.p);
                  }}
                  className="w-full text-start flex justify-between items-center px-2 py-1.5 rounded hover:bg-accent transition"
                >
                  <span className="font-medium">{a.label}</span>
                  <span dir="ltr" className="text-muted-foreground">{a.e}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
