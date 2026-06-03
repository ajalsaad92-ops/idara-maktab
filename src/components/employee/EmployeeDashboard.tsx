import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { fmtDateTime, fmtHours, fmtTime } from "@/lib/format";
import { LogIn, LogOut, CheckCircle2, Clock, ClockArrowDown, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Attendance = { id: string; event_type: "in" | "out"; reason: string | null; event_at: string };

export function EmployeeDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [today, setToday] = useState<Attendance[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reason, setReason] = useState<string>("معاملة رسمية");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [{ data: att }, { data: assign }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("event_at", dayStart.toISOString())
        .order("event_at", { ascending: true }),
      supabase
        .from("task_assignments")
        .select("task_id, tasks(*)")
        .eq("user_id", user.id)
        .eq("is_active", true),
    ]);
    setToday((att ?? []) as any);
    setTasks(((assign ?? []) as any[]).map((a) => a.tasks).filter(Boolean));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const lastEvent = today[today.length - 1];
  const isIn = !lastEvent || lastEvent.event_type === "in";
  const nextAction = isIn ? "out" : "in";

  // Compute today hours
  const hours = (() => {
    let inMs = 0;
    let outMs = 0;
    const now = Date.now();
    for (let i = 0; i < today.length; i++) {
      const cur = today[i];
      const next = today[i + 1];
      const start = new Date(cur.event_at).getTime();
      const end = next ? new Date(next.event_at).getTime() : now;
      const delta = Math.max(0, end - start);
      if (cur.event_type === "in") inMs += delta;
      else outMs += delta;
    }
    return { inH: inMs / 3_600_000, outH: outMs / 3_600_000 };
  })();

  const doCheck = async (type: "in" | "out", reasonText?: string) => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      event_type: type,
      reason: reasonText ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(type === "in" ? t("check_in") : t("check_out"));
    setCheckoutOpen(false);
    load();
  };

  const handleMain = () => {
    if (nextAction === "out") {
      setCheckoutOpen(true);
    } else {
      doCheck("in");
    }
  };

  const completedToday = tasks.filter((tk) => tk.status === "completed").length;
  const pendingCount = tasks.filter((tk) => tk.status !== "completed" && tk.status !== "archived").length;

  return (
    <div className="space-y-6">
      {/* Check in/out */}
      <Card className="p-6 bg-gradient-to-br from-primary to-[oklch(0.32_0.08_255)] text-primary-foreground border-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{t("attendance")}</p>
            <h2 className="text-2xl font-bold mt-1">
              {isIn ? t("in_office") : t("out_office")} · {fmtTime(lastEvent?.event_at) ?? ""}
            </h2>
            {lastEvent && (
              <p className="text-sm opacity-75 mt-1">
                {lang === "ar" ? "آخر تسجيل: " : "Last event: "}
                {fmtDateTime(lastEvent.event_at)}
                {lastEvent.reason && ` · ${lastEvent.reason}`}
              </p>
            )}
          </div>
          <Button
            size="lg"
            onClick={handleMain}
            disabled={submitting}
            className={`text-lg px-10 py-7 ${
              nextAction === "out"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-gold hover:bg-gold/90 text-gold-foreground"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin me-2" />
            ) : nextAction === "out" ? (
              <LogOut className="h-5 w-5 me-2" />
            ) : (
              <LogIn className="h-5 w-5 me-2" />
            )}
            {nextAction === "out" ? t("check_out") : today.length === 0 ? t("check_in") : t("return")}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 className="text-success" />} label={t("today_completed")} value={completedToday} />
        <StatCard icon={<Clock className="text-primary" />} label={t("today_hours_in")} value={fmtHours(hours.inH)} />
        <StatCard icon={<ClockArrowDown className="text-destructive" />} label={t("today_hours_out")} value={fmtHours(hours.outH)} />
        <StatCard icon={<ListChecks className="text-gold" />} label={t("pending")} value={pendingCount} />
      </div>

      {/* My Tasks */}
      <Card className="p-5">
        <h3 className="text-lg font-bold mb-4">{t("my_tasks")}</h3>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">{t("loading")}</p>
        ) : tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("no_data")}</p>
        ) : (
          <div className="grid gap-3">
            {tasks.map((tk) => (
              <button
                key={tk.id}
                onClick={() => setSelectedTaskId(tk.id)}
                className="text-start p-4 rounded-lg border hover:border-primary hover:bg-accent/50 transition"
              >
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{tk.title}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{t(tk.type)}</Badge>
                      <StatusBadge status={tk.status} />
                      <PriorityBadge priority={tk.priority} />
                      {tk.deadline && (
                        <Badge variant="secondary" className="text-xs">
                          {t("deadline")}: {tk.deadline}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirm_check_out")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">{t("reason")}</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_reason")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="أسواق">{t("reason_market")}</SelectItem>
                <SelectItem value="معاملة رسمية">{t("reason_official")}</SelectItem>
                <SelectItem value="ظرف طارئ">{t("reason_urgent")}</SelectItem>
                <SelectItem value="أخرى">{t("reason_other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => doCheck("out", reason)} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTaskId && (
        <TaskDialog
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    archived: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return <Badge className={`${map[status] ?? ""} border`} variant="outline">{t(status as any)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    normal: "bg-slate-100 text-slate-700",
    important: "bg-amber-100 text-amber-800",
    urgent: "bg-red-100 text-red-800",
  };
  return <Badge className={map[priority] ?? ""} variant="outline">{t(priority as any)}</Badge>;
}
