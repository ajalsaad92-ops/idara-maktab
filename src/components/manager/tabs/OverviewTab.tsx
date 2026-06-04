import { memo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle, Users, MapPin, Megaphone, Loader2 } from "lucide-react";
import { fmtHours } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { toast } from "sonner";

function OverviewTab({ profiles, statusByUser }: any) {
  const { t } = useI18n();
  const { openEmployeeDrawer } = useEmployeeDrawer();
  const { user } = useAuth();
  const [queryingId, setQueryingId] = useState<string | null>(null);

  const sendQuery = async (employeeId: string, queryType: "location_check" | "attendance_reminder") => {
    setQueryingId(employeeId);
    const { error } = await (supabase as any).from("manager_queries").insert({
      manager_id: user?.id,
      employee_id: employeeId,
      query_type: queryType,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      setQueryingId(null);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").single();
    const managerName = profile?.full_name || "";
    const msg = queryType === "location_check"
      ? `${managerName} ${t("manager_query_msg")}`
      : `${managerName} ${t("attendance_reminder")}`;
    await (supabase as any).from("notifications").insert({
      user_id: employeeId,
      type: "manager_query",
      message: msg,
      link_data: { route: "/dashboard", action: "respond_to_query" },
      is_read: false,
    });
    toast.success(queryType === "location_check" ? t("location_check") : t("attendance_reminder"));
    setQueryingId(null);
  };

  if (!profiles || profiles.length === 0) {
    return (
      <div className="py-8">
        <EmptyState 
          icon={<Users className="h-12 w-12 text-muted-foreground/50" />}
          title={t("no_data")} 
          description={t("no_employees_desc")}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {profiles.map((p: any) => {
        const s = statusByUser[p.id];
        const color =
          s.status === "in" ? "bg-success" : s.status === "out" ? "bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-muted-foreground";
        const isOutside = s.status === "out";
        const isNotCheckedIn = s.status !== "in" && s.status !== "out";
        return (
          <Card key={p.id} className="p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border-t-2 border-t-transparent hover:border-t-accent">
            <div className="flex items-start gap-3" onClick={() => openEmployeeDrawer(p.id)}>
              <Circle className={`h-3 w-3 mt-1.5 rounded-full ${color}`} fill="currentColor" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.department ?? "—"}</p>
                <div className="mt-2 text-xs space-y-0.5">
                  <p>
                    {s.status === "in" ? t("in_office") : s.status === "out" ? t("out_office") : t("not_checked")}
                  </p>
                  {s.lastAt && <p>{t("entry_time")}: {new Date(s.lastAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" })}</p>}
                  <p>{t("out_hours_today")}: {fmtHours(s.outH)}</p>
                </div>
              </div>
            </div>
            {(isOutside || isNotCheckedIn) && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  disabled={queryingId === p.id}
                  onClick={(e) => { e.stopPropagation(); sendQuery(p.id, isOutside ? "location_check" : "attendance_reminder"); }}
                >
                  {queryingId === p.id ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : isOutside ? <MapPin className="h-3 w-3 me-1" /> : <Megaphone className="h-3 w-3 me-1" />}
                  {isOutside ? t("location_check") : t("attendance_reminder")}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default memo(OverviewTab);
