import { useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { todayBaghdad } from "@/lib/format";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { toast } from "sonner";
import CountUp from "react-countup";
import { Card } from "@/components/ui/card";
import { Users, CheckSquare, Clock, Building2, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const OverviewTab = lazy(() => import("./tabs/OverviewTab"));

type Profile = { id: string; full_name: string; department: string | null };

export const prefetchManagerDashboard = async (queryClient: QueryClient) => {
  await queryClient.prefetchQuery({
    queryKey: ["managerDashboard"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const [profRes, attRes, taskRes, assignRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("attendance").select("*").order("event_at", { ascending: false }).limit(500),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("task_assignments").select("*").eq("is_active", true),
      ]);
      if (profRes.error) throw profRes.error;
      if (attRes.error) throw attRes.error;
      if (taskRes.error) throw taskRes.error;
      if (assignRes.error) throw assignRes.error;
      return { profiles: profRes.data, attendance: attRes.data, tasks: taskRes.data, assignments: assignRes.data };
    },
    staleTime: 60000,
  });
};

export function ManagerDashboard() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["managerDashboard"],
    queryFn: async () => {
      const [p, a, tk, ta] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("attendance").select("*").order("event_at", { ascending: false }).limit(500),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("task_assignments").select("*").eq("is_active", true),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      if (tk.error) throw tk.error;
      if (ta.error) throw ta.error;
      return { profiles: (p.data ?? []) as Profile[], attendance: (a.data ?? []), tasks: (tk.data ?? []), assignments: (ta.data ?? []) };
    },
    staleTime: 60_000,
  });

  if (error) toast.error(error?.message || t("error_generic"));

  const profiles = data?.profiles ?? [];
  const attendance = data?.attendance ?? [];
  const tasks = data?.tasks ?? [];
  const assignments = data?.assignments ?? [];
  const today = todayBaghdad();

  // Build per-user today status
  const todayEvents = attendance.filter((a: any) => a.event_date === today);
  const statusByUser: Record<string, { status: "in" | "out" | "none"; lastAt?: string; outH: number; inH: number }> = {};
  profiles.forEach((p) => {
    const evs = todayEvents.filter((e: any) => e.user_id === p.id).sort((x: any, y: any) => new Date(x.event_at).getTime() - new Date(y.event_at).getTime());
    if (evs.length === 0) { statusByUser[p.id] = { status: "none", outH: 0, inH: 0 }; return; }
    let inMs = 0, outMs = 0;
    const now = Date.now();
    for (let i = 0; i < evs.length; i++) {
      const cur = evs[i]; const next = evs[i + 1];
      const start = new Date(cur.event_at).getTime();
      const end = next ? new Date(next.event_at).getTime() : now;
      const d = Math.max(0, end - start);
      if (cur.event_type === "in") inMs += d; else outMs += d;
    }
    const last = evs[evs.length - 1];
    statusByUser[p.id] = { status: last.event_type === "in" ? "in" : "out", lastAt: evs[0].event_at, outH: outMs / 3_600_000, inH: inMs / 3_600_000 };
  });

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["managerDashboard"] }); };

  if (isLoading) return <ManagerDashboardSkeleton />;

  const totalEmployees = profiles.length;
  const todayIn = Object.values(statusByUser).filter(s => s.status === "in").length;
  const activeTasks = tasks.filter((t: any) => t.status !== "completed" && t.status !== "archived").length;
  const completedTasks = tasks.filter((t: any) => t.status === "completed").length;

  const pendingTasks = tasks.filter((t: any) =>
    t.status !== "completed" && t.status !== "archived"
  );
  const overdueTasks = pendingTasks.filter((t: any) => t.deadline && new Date(t.deadline) < new Date());
  const dueTodayTasks = pendingTasks.filter((t: any) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline).toISOString().split("T")[0];
    return d === today;
  });

  const assigneeMap: Record<string, string> = {};
  assignments.forEach((a: any) => { assigneeMap[a.task_id] = a.user_id; });
  const profileMap: Record<string, string> = {};
  profiles.forEach((p: any) => { profileMap[p.id] = p.full_name; });

  return (
    <div className="space-y-6">
      {/* page-header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("employee_status")}</p>
      </div>

      {/* summary-cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("total_employees")}</p>
              <p className="text-2xl font-bold"><CountUp end={totalEmployees} duration={1.5} /></p>
            </div>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-accent" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-success/10 rounded-xl"><Clock className="w-5 h-5 text-success" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("today_attendance")}</p>
              <p className="text-2xl font-bold"><CountUp end={todayIn} duration={1.5} /></p>
            </div>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warning to-accent" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-warning/10 rounded-xl"><CheckSquare className="w-5 h-5 text-warning" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("total_tasks")}</p>
              <p className="text-2xl font-bold"><CountUp end={activeTasks} duration={1.5} /></p>
            </div>
          </div>
        </Card>
        <Card className="p-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-success" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-success/10 rounded-xl"><Building2 className="w-5 h-5 text-success" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("completed_tasks")}</p>
              <p className="text-2xl font-bold"><CountUp end={completedTasks} duration={1.5} /></p>
            </div>
          </div>
        </Card>
      </div>

      {/* status-board */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <OverviewTab profiles={profiles} statusByUser={statusByUser} />
      </Suspense>

      {/* pending-tasks */}
      {pendingTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("pending_tasks") || "المهام المعلقة"}</h2>
            <div className="flex gap-3 text-sm">
              {overdueTasks.length > 0 && (
                <span className="flex items-center gap-1 text-danger"><AlertTriangle className="h-4 w-4" />{overdueTasks.length} {t("overdue") || "متأخرة"}</span>
              )}
              {dueTodayTasks.length > 0 && (
                <span className="flex items-center gap-1 text-warning"><Clock className="h-4 w-4" />{dueTodayTasks.length} {t("due_today") || "تنتهي اليوم"}</span>
              )}
              <span className="flex items-center gap-1 text-success"><CheckSquare className="h-4 w-4" />{completedTasks} {t("completed_this_week") || "مكتملة هذا الأسبوع"}</span>
            </div>
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee") || "الموظف"}</TableHead>
                  <TableHead>{t("title") || "عنوان المهمة"}</TableHead>
                  <TableHead>{t("type") || "النوع"}</TableHead>
                  <TableHead>{t("priority") || "الأولوية"}</TableHead>
                  <TableHead>{t("deadline") || "الموعد النهائي"}</TableHead>
                  <TableHead>{t("status") || "الحالة"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTasks.slice(0, 20).map((task: any) => {
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                  const isDueToday = task.deadline && new Date(task.deadline).toISOString().split("T")[0] === today;
                  const assigneeName = profileMap[assigneeMap[task.id]] || "—";
                  return (
                    <TableRow
                      key={task.id}
                      className={`cursor-pointer transition-colors ${isOverdue ? "bg-danger/5" : isDueToday ? "bg-warning/5" : ""}`}
                      onClick={() => setSelectedTask(task.id)}
                    >
                      <TableCell className="font-medium">{assigneeName}</TableCell>
                      <TableCell>{task.title}</TableCell>
                      <TableCell><Badge variant="outline">{task.type || "—"}</Badge></TableCell>
                      <TableCell><Badge variant={task.priority === "عاجل" ? "destructive" : "secondary"}>{task.priority || "—"}</Badge></TableCell>
                      <TableCell className={isOverdue ? "text-danger font-semibold" : isDueToday ? "text-warning font-semibold" : ""}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell><Badge>{task.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <CreateTaskDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={invalidate} />
      {selectedTask && <TaskDialog taskId={selectedTask} onClose={() => { setSelectedTask(null); invalidate(); }} />}
    </div>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-[400px] rounded" />
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
