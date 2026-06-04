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
import { LogIn, LogOut, CheckCircle2, Clock, ClockArrowDown, ListChecks, Loader2, FolderOpen, StopCircle } from "lucide-react";
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

// 5-state attendance machine
type AttState = "NOT_CHECKED_IN" | "IN_OFFICE" | "PENDING_EXIT" | "OUTSIDE" | "DAY_ENDED";

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

  // Pending manager query
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

  // Pending exit request for THIS employee today
  const { data: pendingExitReq } = useQuery({
    queryKey: ["pending_exit_request", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await (supabase as any)
        .from("exit_requests")
        .select("id, status, reason_type")
        .eq("employee_id", user.id)
        .eq("status", "pending")
        .gte("requested_at", startOfDay.toISOString())
        .order("requested_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 15_000,
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
    toast.success(t("success"));
  };

  // Main data query: today's attendance + active tasks
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

  // Attendance event mutation (check-in, return, end-day)
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
    },
    onError: (err: any) => {
      toast.error(err?.message || t("error_generic"));
    }
  });

  // Submit exit request ONLY (no 'out' attendance event — manager creates that on approve)
  const submitExitRequest = async (rsn: string, dur: string, nte: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("exit_requests").insert({
      employee_id: user.id,
      reason_type: rsn,
      reason_text: nte || null,
      expected_duration: dur,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Notify managers
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["manager", "admin"]);
    if (managers && managers.length > 0) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const notifications = managers.map((m: any) => ({
        user_id: m.user_id,
        type: "exit_request",
        message: `${profile?.full_name || ""} ${t("exit_request")}: ${rsn}`,
        link_data: { route: "/exit-requests" },
        is_read: false,
      }));
      await (supabase as any).from("notifications").insert(notifications);
    }
    toast.success(t("exit_request_sent"));
    queryClient.invalidateQueries({ queryKey: ["pending_exit_request", user.id] });
    setCheckoutOpen(false);
  };

  const today = data?.today ?? [];
  const tasks = data?.tasks ?? [];
  const lastEvent = today[today.length - 1];

  // 5-state machine
  const attState: AttState = (() => {
    if (today.length === 0) return "NOT_CHECKED_IN";
    if ((lastEvent.event_type as string) === "out_final") return "DAY_ENDED";
    if (lastEvent.event_type === "in") {
      // If there's a pending exit request, show PENDING_EXIT
      if (pendingExitReq) return "PENDING_EXIT";
      return "IN_OFFICE";
    }
    // last event is 'out' — employee is outside
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

  if (isLoading) {
    return <EmployeeDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 2h reminder */}
      {showReminder && (
        <Card className="p-4 bg-warning/10 border-warning text-warning-foreground">
          <p className="font-medium">{t("reminder_2h_out")}</p>
        </Card>
      )}

      {/* Manager query banner */}
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

      {/* Attendance state card */}
      <Card className="p-6 bg-gradient-to-br from-primary to-[oklch(0.32_0.08_255)] text-primary-foreground border-0 sm:static fixed bottom-16 left-4 right-4 z-40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{t("attendance")}</p>
            <h2 className="text-2xl font-bold mt-1">
              {attState === "NOT_CHECKED_IN" && t("not_checked_in_yet")}
              {attState === "IN_OFFICE" && `${t("in_office")} · ${fmtTime(today.find((e: any) => e.event_type === "in")?.event_at) ?? ""}`}
              {attState === "PENDING_EXIT" && `⏳ ${t("pending_exit_review")}`}
              {attState === "OUTSIDE" && `${t("out_office")} · ${lastEvent?.reason ?? ""}`}
              {attState === "DAY_ENDED" && `${t("day_ended_summary")} · ${fmtHours(hours.inH)}`}
            </h2>
            {lastEvent && attState !== "NOT_CHECKED_IN" && (
              <p className="text-sm opacity-75 mt-1">
                {t("last_event_label")}{fmtDateTime(lastEvent.event_at)}
                {lastEvent.reason && ` · ${lastEvent.reason}`}
              </p>
            )}
          </div>

          {/* Action buttons based on state */}
          {attState !== "DAY_ENDED" && (
            <div className="flex gap-3">
              {attState === "NOT_CHECKED_IN" && (
                <Button
                  size="lg"
                  onClick={() => checkMutation.mutate({ type: "in" })}
                  disabled={checkMutation.isPending}
                  className="text-lg min-w-[120px] min-h-[56px] bg-success hover:bg-success/90 text-success-foreground transition-colors duration-300 px-10 py-7 shadow-md"
                >
                  {checkMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin me-2" /> : <LogIn className="h-5 w-5 me-2" />}
                  {t("check_in")}
                </Button>
              )}
              {attState === "IN_OFFICE" && (
                <Button
                  size="lg"
                  onClick={() => setCheckoutOpen(true)}
                  className="text-lg min-w-[120px] min-h-[56px] bg-warning hover:bg-warning/90 text-warning-foreground transition-colors duration-300 px-10 py-7 shadow-md"
                >
                  <LogOut className="h-5 w-5 me-2" />
                  {t("exit_request")}
                </Button>
              )}
              {attState === "PENDING_EXIT" && (
                <Button
                  size="lg"
                  disabled
                  className="text-lg min-w-[120px] min-h-[56px] bg-warning/60 text-warning-foreground cursor-not-allowed px-10 py-7 shadow-md"
                >
                  ⏳ {t("pending_exit_review")}
                </Button>
              )}
              {attState === "OUTSIDE" && (
                <>
                  <Button
                    size="lg"
                    onClick={() => checkMutation.mutate({ type: "in" })}
                    disabled={checkMutation.isPending}
                    className="text-lg min-w-[120px] min-h-[56px] bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-300 px-10 py-7 shadow-md"
                  >
                    {checkMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin me-2" /> : <LogIn className="h-5 w-5 me-2" />}
                    {t("check_back_in")}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* End work day button — shown only when IN_OFFICE and after 3+ hours */}
        {attState === "IN_OFFICE" && hours.inH >= 3 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <Button
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={() => checkMutation.mutate({ type: "out_final" })}
              disabled={checkMutation.isPending}
            >
              <StopCircle className="h-4 w-4 me-2" />
              {t("end_work_day")}
            </Button>
          </div>
        )}
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
          <EmptyState title={t("no_data")} description={t("no_tasks_assigned")} />
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

      {/* Exit request dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("exit_request_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("exit_reason")}</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_reason")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="أسواق ومشتريات">{t("exit_reason_shopping")}</SelectItem>
                  <SelectItem value="معاملة رسمية">{t("exit_reason_official")}</SelectItem>
                  <SelectItem value="ظرف طارئ">{t("exit_reason_emergency")}</SelectItem>
                  <SelectItem value="واجب رسمي خارجي">{t("exit_reason_duty")}</SelectItem>
                  <SelectItem value="أخرى">{t("exit_reason_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reason === "أخرى" && (
              <Input
                placeholder={t("specify_reason")}
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
              />
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("expected_duration")}</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30m">{t("duration_30m")}</SelectItem>
                  <SelectItem value="1h">{t("duration_1h")}</SelectItem>
                  <SelectItem value="2h">{t("duration_2h")}</SelectItem>
                  <SelectItem value="2h+">{t("duration_2h_plus")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder={t("additional_note")}
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
                // ONLY submit exit request — NO 'out' attendance event here
                // Manager creates 'out' event on approval
                submitExitRequest(rsn, duration, note);
              }}
              disabled={!reason}
            >
              {t("submit_request")}
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
