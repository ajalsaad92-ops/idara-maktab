import { useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import CountUp from "react-countup";
import { fmtDateTime, fmtHours, fmtTime } from "@/lib/format";
import { LogIn, LogOut, CheckCircle2, Clock, ClockArrowDown, ListChecks, Loader2, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

type StatCardProps = { icon: React.ReactNode; label: string; value: string | number };
const StatCard = memo(function StatCard({ icon, label, value }: StatCardProps) {
  const isNumber = typeof value === "number";
  return (
    <Card className="p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-80" />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">
            {isNumber ? <CountUp end={value as number} duration={2} separator="," /> : value}
          </p>
        </div>
      </div>
    </Card>
  );
});
export function EmployeeDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [duration, setDuration] = useState("1h");
  const [note, setNote] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: pendingQuery, isLoading: queryLoading } = useQuery({
    queryKey: ["pending_manager_query", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("manager_queries")
        .select("*, profiles:manager_id(full_name)")
        .eq("employee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const respondToQuery = async (response: string) => {
    if (!pendingQuery || !user) return;
    await (supabase as any).from("manager_queries").update({
      status: "answered",
      employee_response: response,
      answered_at: new Date().toISOString(),
    }).eq("id", pendingQuery.id);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    await (supabase as any).from("notifications").insert({
      user_id: pendingQuery.manager_id,
      type: "manager_query_response",
      message: `${profile?.full_name || ""}: ${response}`,
      link_data: { route: "/dashboard" },
      is_read: false,
    });
    queryClient.invalidateQueries({ queryKey: ["pending_manager_query", user.id] });
    toast.success(lang === "ar" ? "تم إرسال ردك" : "Response sent");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["employeeDashboard", user?.id],
    queryFn: async () => {
      if (!user) return { today: [], tasks: [] };
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [att, tks] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .gte("event_at", startOfDay.toISOString())
          .order("event_at", { ascending: true }),
        supabase
          .from("task_assignments")
          .select("task_id, is_active, tasks(id, title, type, status, priority, deadline, description, created_at)")
          .eq("user_id", user.id)
          .eq("is_active", true)
      ]);
      const activeTasks = (tks.data ?? [])
        .map((a: any) => a.tasks)
        .filter(Boolean)
        .filter((tk: any) => tk.status !== "مكتملة" && tk.status !== "مؤرشفة" && tk.status !== "completed" && tk.status !== "archived");
      return { today: att.data ?? [], tasks: activeTasks };
    },
    enabled: !!user,
  });

  const checkMutation = useMutation({
    mutationFn: async ({ type, rsn }: { type: string; rsn?: string }) => {
      const { error } = await supabase.from("attendance").insert({
        user_id: user!.id,
        event_type: type as any,
        reason: rsn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeDashboard", user?.id] });
      setCheckoutOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || t("error_generic"));
    }
  });

  const today = data?.today ?? [];
  const tasks = data?.tasks ?? [];

  const lastEvent = today[today.length - 1];

  // State machine: NOT_CHECKED_IN → IN_OFFICE → OUTSIDE → IN_OFFICE → DAY_ENDED
  // Derived from last attendance event type
  type AttState = "NOT_CHECKED_IN" | "IN_OFFICE" | "OUTSIDE" | "DAY_ENDED";
  const attState: AttState = (() => {
    if (today.length === 0) return "NOT_CHECKED_IN";
    if ((lastEvent.event_type as string) === "out_final") return "DAY_ENDED";
    if (lastEvent.event_type === "in") return "IN_OFFICE";
    return "OUTSIDE";
  })();

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

  const lastOutDuration = attState === "OUTSIDE"
    ? (Date.now() - new Date(lastEvent!.event_at).getTime()) / 3_600_000
    : 0;
  const showReminder = lastOutDuration > 2;

  const completedToday = tasks.filter((tk: any) => tk.status === "مكتملة" || tk.status === "completed").length;
  const pendingCount = tasks.filter((tk: any) => {
    const s = tk.status;
    return s !== "مكتملة" && s !== "completed" && s !== "مؤرشفة" && s !== "archived";
  }).length;

  const submitExitRequest = async (rsn: string, dur: string, nte: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("exit_requests").insert({
      employee_id: user.id,
      reason_type: rsn,
      reason_text: nte || null,
      expected_duration: dur,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "ar" ? "تم إرسال طلب الخروج" : "Exit request sent");
  };

  const handleMain = () => {
    if (attState === "NOT_CHECKED_IN" || attState === "OUTSIDE") {
      checkMutation.mutate({ type: "in" });
    } else if (attState === "IN_OFFICE") {
      setCheckoutOpen(true);
    }
  };

  if (isLoading) {
    return <EmployeeDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Check in/out */}
      {showReminder && (
        <Card className="p-4 bg-warning/10 border-warning text-warning-foreground">
          <p className="font-medium">
            {t("reminder_2h_out")}
          </p>
        </Card>
      )}
      {pendingQuery && (
        <Card className="p-4 bg-primary/10 border-primary">
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-primary">
              {pendingQuery.profiles?.full_name} {t("manager_query_msg")}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => respondToQuery(t("in_office_now"))} className="bg-success hover:bg-success/90 text-white">
                {t("in_office_now")}
              </Button>
              <Button size="sm" onClick={() => respondToQuery(t("coming_soon"))} className="bg-warning hover:bg-warning/90 text-warning-foreground">
                {t("coming_soon")}
              </Button>
              <Button size="sm" onClick={() => respondToQuery(t("have_excuse"))} variant="outline">
                {t("have_excuse")}
              </Button>
            </div>
          </div>
        </Card>
      )}
      <Card className="p-6 bg-gradient-to-br from-primary to-[oklch(0.32_0.08_255)] text-primary-foreground border-0 sm:static fixed bottom-16 left-4 right-4 z-40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{t("attendance")}</p>
            <h2 className="text-2xl font-bold mt-1">
              {attState === "NOT_CHECKED_IN" && (lang === "ar" ? "لم تسجل دخولك بعد" : "Not checked in yet")}
              {attState === "IN_OFFICE" && `${t("in_office")} · ${fmtTime(today.find((e: any) => e.event_type === "in")?.event_at) ?? ""}`}
              {attState === "OUTSIDE" && `${t("out_office")} · ${lastEvent?.reason ?? ""}`}
              {attState === "DAY_ENDED" && (lang === "ar" ? `انتهى يوم العمل · ${fmtHours(hours.inH)}` : `Day ended · ${fmtHours(hours.inH)}`)}
            </h2>
            {lastEvent && attState !== "NOT_CHECKED_IN" && (
              <p className="text-sm opacity-75 mt-1">
                {lang === "ar" ? "آخر تسجيل: " : "Last event: "}
                {fmtDateTime(lastEvent.event_at)}
                {lastEvent.reason && ` · ${lastEvent.reason}`}
              </p>
            )}
          </div>
          {attState !== "DAY_ENDED" && (
            <Button
              size="lg"
              onClick={handleMain}
              disabled={checkMutation.isPending}
              className={`text-lg min-w-[120px] min-h-[56px] transition-colors duration-300 ease-in-out px-10 py-7 shadow-md ${
                attState === "NOT_CHECKED_IN"
                  ? "bg-success hover:bg-success/90 text-success-foreground"
                  : attState === "IN_OFFICE"
                  ? "bg-warning hover:bg-warning/90 text-warning-foreground"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {checkMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin me-2" />
              ) : attState === "NOT_CHECKED_IN" ? (
                <LogIn className="h-5 w-5 me-2" />
              ) : attState === "IN_OFFICE" ? (
                <LogOut className="h-5 w-5 me-2" />
              ) : (
                <LogIn className="h-5 w-5 me-2" />
              )}
              {attState === "NOT_CHECKED_IN"
                ? t("check_in")
                : attState === "IN_OFFICE"
                ? (lang === "ar" ? "طلب خروج" : "Exit Request")
                : attState === "OUTSIDE"
                ? (lang === "ar" ? "تسجيل العودة" : "Check Back In")
                : ""}
            </Button>
          )}
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
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">{t("loading")}</p>
        ) : tasks.length === 0 ? (
          <EmptyState title={t("no_data")} description={lang === "ar" ? "لا توجد مهام مسندة لك حالياً" : "No tasks assigned to you right now"} />
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
            <DialogTitle>{lang === "ar" ? "طلب إذن خروج" : "Exit Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{lang === "ar" ? "سبب الخروج" : "Exit Reason"}</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "اختر السبب" : "Select reason"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="أسواق ومشتريات">{lang === "ar" ? "أسواق ومشتريات" : "Shopping"}</SelectItem>
                  <SelectItem value="معاملة رسمية">{lang === "ar" ? "معاملة رسمية" : "Official errand"}</SelectItem>
                  <SelectItem value="ظرف طارئ">{lang === "ar" ? "ظرف طارئ" : "Emergency"}</SelectItem>
                  <SelectItem value="واجب رسمي خارجي">{lang === "ar" ? "واجب رسمي خارجي" : "Official duty outside"}</SelectItem>
                  <SelectItem value="أخرى">{lang === "ar" ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reason === "أخرى" && (
              <Input
                placeholder={lang === "ar" ? "اذكر السبب" : "Specify reason"}
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
              />
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{lang === "ar" ? "المدة المتوقعة" : "Expected Duration"}</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30m">{lang === "ar" ? "30 دقيقة" : "30 minutes"}</SelectItem>
                  <SelectItem value="1h">{lang === "ar" ? "ساعة" : "1 hour"}</SelectItem>
                  <SelectItem value="2h">{lang === "ar" ? "ساعتين" : "2 hours"}</SelectItem>
                  <SelectItem value="2h+">{lang === "ar" ? "أكثر من ساعتين" : "More than 2 hours"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder={lang === "ar" ? "ملاحظة إضافية (اختياري)" : "Additional note (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                const rsn = reason === "أخرى" ? reasonOther || reason : reason;
                checkMutation.mutate({ type: "out", rsn });
                submitExitRequest(rsn, duration, note);
              }}
              disabled={checkMutation.isPending || !reason}
            >
              {checkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {lang === "ar" ? "إرسال الطلب" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTaskId && (
        <TaskDialog
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            queryClient.invalidateQueries({ queryKey: ["employeeDashboard", user?.id] });
          }}
        />
      )}
    </div>
  );
}

function EmployeeDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
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
