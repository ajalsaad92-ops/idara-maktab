import { useState, memo, useMemo } from "react";
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
  DialogDescription,
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
import {
  LogIn,
  LogOut,
  CheckCircle2,
  Clock,
  ClockArrowDown,
  ListChecks,
  Loader2,
  AlertCircle,
  CheckCheck,
  XCircle,
  StopCircle,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

/* Exit reason constants (Arabic values for DB) */
const REASON_SHOPPING = "أسواق ومشتريات";
const REASON_OFFICIAL = "معاملة رسمية";
const REASON_EMERGENCY = "ظرف طارئ";
const REASON_DUTY = "واجب رسمي خارجي";
const REASON_OTHER = "أخرى";

/* ------------------------------------------------------------------ */
/* StatCard                                                            */
/* ------------------------------------------------------------------ */
type StatCardProps = { icon: React.ReactNode; label: string; value: string | number };
const StatCard = memo(function StatCard({ icon, label, value }: StatCardProps) {
  const isNumber = typeof value === "number";
  return (
    <Card className="p-2 md:p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-80" />
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1.5 sm:gap-3">
        <div className="p-1 sm:p-2 bg-surface rounded-lg group-hover:scale-110 transition-transform shrink-0">
          {icon}
        </div>
        <div className="text-center sm:text-start min-w-0 w-full">
          <p className="text-[9px] sm:text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm sm:text-xl font-bold">
            {isNumber ? <CountUp end={value as number} duration={2} separator="," /> : value}
          </p>
        </div>
      </div>
    </Card>
  );
});

/* ------------------------------------------------------------------ */
/* 6-state attendance machine                                          */
/* ------------------------------------------------------------------ */
type AttState =
  | "NOT_CHECKED_IN"
  | "CHECKED_IN"
  | "EXIT_REQUESTED"
  | "EXIT_APPROVED"
  | "RETURNED"
  | "DAY_ENDED";

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export function EmployeeDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  // UI state
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Exit-request form
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [duration, setDuration] = useState("1h");
  const [note, setNote] = useState("");

  // End-day form
  const [endDayReason, setEndDayReason] = useState("");
  const [endDayReasonOther, setEndDayReasonOther] = useState("");
  const [endDayTaskId, setEndDayTaskId] = useState("");
  const [endDayNote, setEndDayNote] = useState("");

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */
  const baghdadToday = () => {
    const now = new Date();
    const baghdadOffset = 3 * 60;
    const baghdadNow = new Date(now.getTime() + (baghdadOffset + now.getTimezoneOffset()) * 60000);
    return baghdadNow.toISOString().split("T")[0];
  };

  /* ---------------------------------------------------------------- */
  /* Queries                                                           */
  /* ---------------------------------------------------------------- */

  // 1. Pending manager query (existing)
  const { data: pendingQuery } = useQuery({
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

  // 2. Pending exit request (for EXIT_REQUESTED state)
  const { data: pendingExitReq } = useQuery({
    queryKey: ["pending_exit_request", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const todayStr = baghdadToday();
      const { data } = await (supabase as any)
        .from("exit_requests")
        .select("id, status, reason_type, reviewed_at")
        .eq("employee_id", user.id)
        .eq("status", "pending")
        .gte("requested_at", todayStr + "T00:00:00+03:00")
        .order("requested_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  // 3. Approved exit request (for EXIT_APPROVED state - check-back-in button)
  const { data: approvedExitReq } = useQuery({
    queryKey: ["approved_exit_request", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const todayStr = baghdadToday();
      const { data } = await (supabase as any)
        .from("exit_requests")
        .select("id, status, reason_type, reviewed_at, reviewed_by, attendance_event_id")
        .eq("employee_id", user.id)
        .eq("status", "approved")
        .gte("requested_at", todayStr + "T00:00:00+03:00")
        .order("reviewed_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  // 4. Main data: today attendance + active tasks
  const { data, isLoading } = useQuery({
    queryKey: ["employeeDashboard", user?.id],
    queryFn: async () => {
      if (!user) return { today: [], tasks: [] };
      const todayStr = baghdadToday();

      const [att, tks] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("event_date", todayStr)
          .order("event_at", { ascending: true }),
        supabase
          .from("task_assignments")
          .select("task_id, is_active, tasks(id, title, type, status, priority, deadline, description, created_at)")
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (tks.error) console.error("Tasks query error:", tks.error);

      let activeTasks = (tks.data ?? [])
        .map((a: any) => a.tasks)
        .filter(Boolean)
        .filter((tk: any) => tk.status !== "completed" && tk.status !== "archived");

      // Fallback: direct fetch if RLS blocks the join
      if (activeTasks.length === 0 && (tks.data ?? []).length > 0) {
        const taskIds = (tks.data ?? []).map((a: any) => a.task_id);
        const { data: directTasks } = await supabase
          .from("tasks")
          .select("id, title, type, status, priority, deadline, description, created_at")
          .in("id", taskIds)
          .not("status", "in", '("completed","archived")');
        activeTasks = directTasks ?? [];
      }

      return { today: att.data ?? [], tasks: activeTasks };
    },
    enabled: !!user,
  });

  /* ---------------------------------------------------------------- */
  /* Mutations                                                         */
  /* ---------------------------------------------------------------- */

  // Attendance event mutation (check-in, check-back-in)
  const attMutation = useMutation({
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
    },
  });

  // End-day mutation: insert 'out' event with reason
  const endDayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").insert({
        user_id: user!.id,
        event_type: "out" as any,
        reason: endDayReason === t("exit_reason_other") ? endDayReasonOther : endDayReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeDashboard", user?.id] });
      toast.success(t("success"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("error_generic"));
    },
  });

  // Submit exit request (no attendance 'out' event - manager creates that on approve)
  const submitExitRequest = async () => {
    if (!user) return;
    const rsn = reason === t("exit_reason_other") ? reasonOther || reason : reason;
    const { error } = await (supabase as any).from("exit_requests").insert({
      employee_id: user.id,
      reason_type: rsn,
      reason_text: note || null,
      expected_duration: duration,
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
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
    setExitDialogOpen(false);
    setReason("");
    setReasonOther("");
    setNote("");
    setDuration("1h");
  };

  const checkBackInMutation = useMutation({
    mutationFn: async () => {
      if (!user || !approvedExitReq) return;
      const exitReqId = approvedExitReq.id;
      const managerId = approvedExitReq.reviewed_by;

      const { error: attError } = await supabase.from("attendance").insert({
        user_id: user.id,
        event_type: "in" as any,
        reason: "check_back_in",
      });
      if (attError) throw attError;

      const { data: updated, error: reqError } = await (supabase as any)
        .from("exit_requests")
        .update({ status: "completed" })
        .eq("id", exitReqId)
        .select("id");
      if (reqError) throw reqError;
      if (!updated || updated.length === 0) throw new Error("exit_request_update_failed");

      if (managerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const { error: notifError } = await (supabase as any).from("notifications").insert({
          user_id: managerId,
          type: "check_back_in",
          message: `${profile?.full_name || ""} ${t("check_back_in")}`,
          link_data: { route: "/dashboard" },
          is_read: false,
        });
        if (notifError) console.error("Notification error:", notifError);
      }
    },
    onSuccess: () => {
      // Optimistic: immediately clear approvedExitReq so state machine transitions out of EXIT_APPROVED
      queryClient.setQueryData(["approved_exit_request", user?.id], null);
      // Optimistic: append the new 'in' event so state machine computes RETURNED (not DAY_ENDED)
      queryClient.setQueryData(
        ["employeeDashboard", user?.id],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            today: [
              ...old.today,
              {
                id: `optimistic-${Date.now()}`,
                user_id: user!.id,
                event_type: "in",
                reason: "check_back_in",
                event_at: new Date().toISOString(),
                event_date: baghdadToday(),
              },
            ],
          };
        }
      );
      // Refetch pending + dashboard for DB consistency, but do NOT refetch approved_exit_request
      // because the optimistic setQueryData(null) above is correct and a refetch could re-fetch
      // the 'approved' row before the DB update fully propagates, causing the check-back-in
      // button to reappear momentarily.
      queryClient.invalidateQueries({ queryKey: ["pending_exit_request", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["employeeDashboard", user?.id] });
      toast.success(t("check_back_in"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("error_generic"));
      queryClient.invalidateQueries({ queryKey: ["approved_exit_request", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pending_exit_request", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["employeeDashboard", user?.id] });
    },
  });

  // Respond to manager query
  const respondToQuery = async (response: string) => {
    if (!pendingQuery || !user) return;
    await (supabase as any)
      .from("manager_queries")
      .update({
        status: "answered",
        employee_response: response,
        answered_at: new Date().toISOString(),
      })
      .eq("id", pendingQuery.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

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

  /* ---------------------------------------------------------------- */
  /* Derived state                                                     */
  /* ---------------------------------------------------------------- */
  const today = data?.today ?? [];
  const tasks = data?.tasks ?? [];
  const lastEvent = today[today.length - 1];

  // 6-state machine
  const attState: AttState = (() => {
    if (today.length === 0) return "NOT_CHECKED_IN";

    const lastType = lastEvent?.event_type as string;

    // PRIORITY 1: Approved exit request — employee is out, waiting for check-back-in
    // Must check BEFORE DAY_ENDED because manager approval creates an 'out' event
    if (approvedExitReq && approvedExitReq.status === "approved") {
      return "EXIT_APPROVED";
    }

    // PRIORITY 2: Pending exit request — waiting for manager review
    if (pendingExitReq && pendingExitReq.status === "pending") {
      return "EXIT_REQUESTED";
    }

    // PRIORITY 3: Last event is 'out' and no pending exit = day ended
    if (lastType === "out" && today.length >= 2) {
      return "DAY_ENDED";
    }

    // PRIORITY 4: Last event is 'in'
    if (lastType === "in") {
      // Check if there were any 'out' events before this 'in' = returned from exit
      const outBefore = today.findIndex((e: any) => e.event_type === "out");
      const lastInIndex = today.length - 1;
      if (outBefore >= 0 && outBefore < lastInIndex) {
        return "RETURNED";
      }
      return "CHECKED_IN";
    }

    return "CHECKED_IN";
  })();

  // Compute today hours
  const hours = useMemo(() => {
    let inMs = 0;
    let outMs = 0;
    const now = Date.now();

    // For "outside" states, we need to calculate outside time from approval time
    let outsideStartTime: number | null = null;
    if (attState === "EXIT_APPROVED" && approvedExitReq?.reviewed_at) {
      outsideStartTime = new Date(approvedExitReq.reviewed_at).getTime();
    }

    for (let i = 0; i < today.length; i++) {
      const cur = today[i];
      const next = today[i + 1];
      const start = new Date(cur.event_at).getTime();
      let end: number;

      if (next) {
        end = new Date(next.event_at).getTime();
      } else {
        // For the last event, if it's 'in' (currently in office), use now
        // If it's 'out' (outside), use now but respect outsideStartTime
        if (cur.event_type === "out" && outsideStartTime && i === today.length - 1) {
          end = now;
        } else {
          end = now;
        }
      }

      const delta = Math.max(0, end - start);
      if (cur.event_type === "in") inMs += delta;
      else outMs += delta;
    }

    // If outside and we have an approval time, recalculate outside from approval
    if (attState === "EXIT_APPROVED" && outsideStartTime) {
      outMs = Math.max(0, now - outsideStartTime);
    }

    return { inH: inMs / 3_600_000, outH: outMs / 3_600_000 };
  }, [today, attState, approvedExitReq]);

  // 2h reminder (only when in EXIT_APPROVED state)
  const showReminder = attState === "EXIT_APPROVED" && hours.outH > 2;

  const completedToday = tasks.filter((tk: any) => tk.status === "completed").length;
  const pendingCount = tasks.filter((tk: any) => {
    const s = tk.status;
    return s !== "completed" && s !== "archived";
  }).length;

  const getDeadlineStatus = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0)
      return { label: ` overdue ${Math.floor(-diff / 3600000)}h`, color: "text-danger" };
    if (diff < 86400000)
      return { label: ` due in ${Math.floor(diff / 3600000)}h`, color: "text-warning" };
    return { label: ` due in ${Math.floor(diff / 86400000)}d`, color: "text-muted-foreground" };
  };

  // Check if 4-hour minimum met for end day
  const hasFourHours = hours.inH >= 4;

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
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
              <Button
                size="sm"
                onClick={() => respondToQuery(t("in_office_now"))}
                className="bg-success hover:bg-success/90 text-white"
              >
                {t("in_office_now")}
              </Button>
              <Button
                size="sm"
                onClick={() => respondToQuery(t("coming_soon"))}
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                {t("coming_soon")}
              </Button>
              <Button
                size="sm"
                onClick={() => respondToQuery(t("have_excuse"))}
                variant="outline"
              >
                {t("have_excuse")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Attendance state card with 4 buttons                         */}
      {/* ============================================================ */}
      <Card className="p-6 bg-gradient-to-br from-primary to-[oklch(0.32_0.08_255)] text-primary-foreground border-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{t("attendance")}</p>
            <h2 className="text-2xl font-bold mt-1">
              {/* State labels */}
              {attState === "NOT_CHECKED_IN" && t("not_checked_in_yet")}
              {attState === "CHECKED_IN" &&
                `${t("in_office")} \u00e2\u0080\u00a7 ${fmtTime(today.find((e: any) => e.event_type === "in")?.event_at) ?? ""}`}
              {attState === "EXIT_REQUESTED" && `\u23f3 ${t("pending_exit_review")}`}
              {attState === "EXIT_APPROVED" && `${t("out_office")} \u00e2\u0080\u00a7 ${approvedExitReq?.reason_type ?? ""}`}
              {attState === "RETURNED" &&
                `${t("in_office")} \u00e2\u0080\u00a7 ${fmtTime(lastEvent?.event_at) ?? ""}`}
              {attState === "DAY_ENDED" && `${t("day_ended_summary")} \u00e2\u0080\u00a7 ${fmtHours(hours.inH)}`}
            </h2>
            {lastEvent && attState !== "NOT_CHECKED_IN" && (
              <p className="text-sm opacity-75 mt-1">
                {t("last_event_label")}
                {fmtDateTime(lastEvent.event_at)}
                {lastEvent.reason && ` \u00e2\u0080\u00a7 ${lastEvent.reason}`}
              </p>
            )}
          </div>

          {/* ---- BUTTON 1: Check-in (NOT_CHECKED_IN -> CHECKED_IN) ---- */}
          {attState === "NOT_CHECKED_IN" && (
            <Button
              size="lg"
              onClick={() => attMutation.mutate({ type: "in" })}
              disabled={attMutation.isPending}
              className="text-lg min-w-[120px] min-h-[56px] bg-success hover:bg-success/90 text-success-foreground transition-colors duration-300 px-10 py-7 shadow-md"
            >
              {attMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin me-2" />
              ) : (
                <LogIn className="h-5 w-5 me-2" />
              )}
              {t("check_in")}
            </Button>
          )}

          {/* ---- BUTTON 2: Exit Request (CHECKED_IN -> EXIT_REQUESTED) ---- */}
          {attState === "CHECKED_IN" && (
            <Button
              size="lg"
              onClick={() => setExitDialogOpen(true)}
              className="text-lg min-w-[120px] min-h-[56px] bg-warning hover:bg-warning/90 text-warning-foreground transition-colors duration-300 px-10 py-7 shadow-md"
            >
              <LogOut className="h-5 w-5 me-2" />
              {t("exit_request")}
            </Button>
          )}

          {/* ---- EXIT_REQUESTED: disabled pending ---- */}
          {attState === "EXIT_REQUESTED" && (
            <Button
              size="lg"
              disabled
              className="text-lg min-w-[120px] min-h-[56px] bg-warning/60 text-warning-foreground cursor-not-allowed px-10 py-7 shadow-md"
            >
              <Clock className="h-5 w-5 me-2" />
              {t("pending_exit_review")}
            </Button>
          )}

          {attState === "EXIT_APPROVED" && (
            <Button
              size="lg"
              onClick={() => checkBackInMutation.mutate()}
              disabled={checkBackInMutation.isPending}
              className="text-lg min-w-[120px] min-h-[56px] bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-300 px-10 py-7 shadow-md"
            >
              {checkBackInMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin me-2" />
              ) : (
                <CheckCheck className="h-5 w-5 me-2" />
              )}
              {t("check_back_in")}
            </Button>
          )}

          {/* ---- RETURNED state: show status + exit request + end day ---- */}
          {attState === "RETURNED" && (
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={() => setExitDialogOpen(true)}
                className="text-lg min-w-[120px] min-h-[56px] bg-warning hover:bg-warning/90 text-warning-foreground transition-colors duration-300 px-10 py-7 shadow-md"
              >
                <LogOut className="h-5 w-5 me-2" />
                {t("exit_request")}
              </Button>
            </div>
          )}

          {/* ---- DAY_ENDED: show summary ---- */}
          {attState === "DAY_ENDED" && (
            <Badge className="text-lg px-4 py-2 bg-muted">
              <CheckCircle2 className="h-5 w-5 me-2" />
              {t("end_work_day")}
            </Badge>
          )}
        </div>

        {/* ---- BUTTON 4: End Day (CHECKED_IN -> DAY_ENDED) ---- */}
        {attState === "CHECKED_IN" && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <Button
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={() => setEndDayOpen(true)}
              disabled={attMutation.isPending}
            >
              <StopCircle className="h-4 w-4 me-2" />
              {t("end_work_day")}
            </Button>
          </div>
        )}

        {/* RETURNED also allows end day */}
        {attState === "RETURNED" && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <Button
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={() => setEndDayOpen(true)}
              disabled={attMutation.isPending}
            >
              <StopCircle className="h-4 w-4 me-2" />
              {t("end_work_day")}
            </Button>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <StatCard
          icon={<CheckCircle2 className="text-success" />}
          label={t("today_completed")}
          value={completedToday}
        />
        <StatCard
          icon={<Clock className="text-primary" />}
          label={t("today_hours_in")}
          value={fmtHours(hours.inH)}
        />
        <StatCard
          icon={<ClockArrowDown className="text-destructive" />}
          label={t("today_hours_out")}
          value={fmtHours(hours.outH)}
        />
        <StatCard
          icon={<ListChecks className="text-gold" />}
          label={t("pending")}
          value={pendingCount}
        />
      </div>

      {/* My Tasks */}
      <Card className="p-5">
        <h3 className="text-lg font-bold mb-4">{t("my_tasks")}</h3>
        {tasks.length === 0 ? (
          <EmptyState title={t("no_data")} description={t("no_tasks_assigned")} />
        ) : (
          <div className="grid gap-3">
            {tasks.map((tk: any) => (
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
                          {t("deadline")}:{" "}
                          {new Date(tk.deadline).toLocaleString("ar-IQ", {
                            timeZone: "Asia/Baghdad",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          <span className={`ms-1 ${getDeadlineStatus(tk.deadline).color}`}>
                            {getDeadlineStatus(tk.deadline).label}
                          </span>
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

      {/* ============================================================ */}
      {/* EXIT REQUEST DIALOG                                          */}
      {/* ============================================================ */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
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
                  <SelectItem value={REASON_SHOPPING}>{t("exit_reason_shopping")}</SelectItem>
                  <SelectItem value={REASON_OFFICIAL}>{t("exit_reason_official")}</SelectItem>
                  <SelectItem value={REASON_EMERGENCY}>{t("exit_reason_emergency")}</SelectItem>
                  <SelectItem value={REASON_DUTY}>{t("exit_reason_duty")}</SelectItem>
                  <SelectItem value={REASON_OTHER}>{t("exit_reason_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reason === REASON_OTHER && (
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
            <Button variant="outline" onClick={() => setExitDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={submitExitRequest} disabled={!reason}>
              {t("submit_request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* END DAY DIALOG                                               */}
      {/* ============================================================ */}
      <Dialog open={endDayOpen} onOpenChange={setEndDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("end_work_day")}</DialogTitle>
            <DialogDescription>
              {!hasFourHours && (
                <span className="text-destructive font-medium">
                  <AlertCircle className="h-4 w-4 me-1 inline" />
                  {t("minimum_hours_required")} (4h)
                </span>
              )}
              {hasFourHours && (
                <span className="text-success">
                  <CheckCircle2 className="h-4 w-4 me-1 inline" />
                  {fmtHours(hours.inH)} {t("today_hours_in")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("exit_reason")}</label>
              <Select value={endDayReason} onValueChange={setEndDayReason}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_reason")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed_tasks">{t("completed_tasks")}</SelectItem>
                  <SelectItem value="personal">{t("exit_reason_other")}</SelectItem>
                  <SelectItem value="official">{t("exit_reason_official")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {endDayReason === "personal" && (
              <Input
                placeholder={t("specify_reason")}
                value={endDayReasonOther}
                onChange={(e) => setEndDayReasonOther(e.target.value)}
              />
            )}
            {endDayReason === "completed_tasks" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("my_tasks")}</label>
                <Select value={endDayTaskId} onValueChange={setEndDayTaskId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_task")} />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((tk: any) => (
                      <SelectItem key={tk.id} value={tk.id}>
                        {tk.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Input
              placeholder={t("additional_note")}
              value={endDayNote}
              onChange={(e) => setEndDayNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDayOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!hasFourHours) {
                  toast.error(t("minimum_hours_required"));
                  return;
                }
                if (!endDayReason) {
                  toast.error(t("select_reason"));
                  return;
                }
                endDayMutation.mutate();
                setEndDayOpen(false);
              }}
              disabled={!endDayReason || !hasFourHours || endDayMutation.isPending}
            >
              {endDayMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <StopCircle className="h-4 w-4 me-2" />
              )}
              {t("end_work_day")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task dialog */}
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

/* ------------------------------------------------------------------ */
/* Skeleton                                                           */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* StatusBadge & PriorityBadge                                        */
/* ------------------------------------------------------------------ */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    archived: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge className={`${map[status] ?? ""} border`} variant="outline">
      {t(status as any)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    normal: "bg-slate-100 text-slate-700",
    important: "bg-amber-100 text-amber-800",
    urgent: "bg-red-100 text-red-800",
  };
  return (
    <Badge className={map[priority] ?? ""} variant="outline">
      {t(priority as any)}
    </Badge>
  );
}
