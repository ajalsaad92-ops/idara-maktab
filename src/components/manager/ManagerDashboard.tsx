import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDateTime, fmtHours, todayBaghdad } from "@/lib/format";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { StatusBadge, PriorityBadge } from "@/components/employee/EmployeeDashboard";
import { Plus, Printer, Search, Circle } from "lucide-react";

type Profile = { id: string; full_name: string; department: string | null };

export function ManagerDashboard() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("");

  const load = useCallback(async () => {
    const [p, a, t, ta] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("attendance").select("*").order("event_at", { ascending: false }).limit(500),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_assignments").select("*").eq("is_active", true),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setAttendance(a.data ?? []);
    setTasks(t.data ?? []);
    setAssignments(ta.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayBaghdad();
  const profilesMap: Record<string, Profile> = Object.fromEntries(profiles.map((p) => [p.id, p]));

  // Build per-user today status
  const todayEvents = attendance.filter((a) => a.event_date === today);
  const statusByUser: Record<string, { status: "in" | "out" | "none"; lastAt?: string; outH: number; inH: number }> = {};
  profiles.forEach((p) => {
    const evs = todayEvents
      .filter((e) => e.user_id === p.id)
      .sort((x, y) => new Date(x.event_at).getTime() - new Date(y.event_at).getTime());
    if (evs.length === 0) {
      statusByUser[p.id] = { status: "none", outH: 0, inH: 0 };
      return;
    }
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
    statusByUser[p.id] = {
      status: last.event_type === "in" ? "in" : "out",
      lastAt: evs[0].event_at,
      outH: outMs / 3_600_000,
      inH: inMs / 3_600_000,
    };
  });

  // Productivity
  const productivity = profiles.map((p) => {
    const userAssigns = assignments.filter((a) => a.user_id === p.id);
    const userTasks = userAssigns.map((a) => tasks.find((t) => t.id === a.task_id)).filter(Boolean);
    const total = userTasks.length;
    const completed = userTasks.filter((t: any) => t.status === "completed").length;
    const inProgress = userTasks.filter((t: any) => t.status === "in_progress").length;
    const counts: Record<string, number> = { writing: 0, archiving: 0, correspondence: 0, follow_up: 0 };
    userTasks.forEach((t: any) => { if (counts[t.type] !== undefined) counts[t.type]++; });
    const st = statusByUser[p.id] ?? { inH: 0, outH: 0 };
    return {
      profile: p, total, completed, inProgress, counts,
      inH: st.inH, outH: st.outH,
      score: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  const filteredAttendance = attendance
    .filter((a) => !filterEmp || a.user_id === filterEmp)
    .filter((a) => {
      if (!search) return true;
      const name = profilesMap[a.user_id]?.full_name ?? "";
      return name.includes(search);
    });

  const filteredTasks = tasks.filter((t) => !search || t.title.includes(search));

  const exportAttendance = () => {
    const rows = [
      ["Name", "Event", "Reason", "Date", "Time"],
      ...filteredAttendance.map((a) => [
        profilesMap[a.user_id]?.full_name ?? "",
        a.event_type,
        a.reason ?? "",
        a.event_date,
        new Date(a.event_at).toLocaleTimeString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">{t("dashboard")}</TabsTrigger>
          <TabsTrigger value="productivity">{t("productivity_table")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("attendance_log")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("task_manager")}</TabsTrigger>
          <TabsTrigger value="reports">{t("reports")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <h3 className="text-lg font-bold">{t("employee_status")}</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {profiles.map((p) => {
              const s = statusByUser[p.id];
              const color =
                s.status === "in" ? "bg-success" : s.status === "out" ? "bg-destructive" : "bg-muted-foreground";
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
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
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="productivity" className="pt-4">
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("total_assigned")}</TableHead>
                  <TableHead>{t("total_completed")}</TableHead>
                  <TableHead>{t("in_progress_count")}</TableHead>
                  <TableHead>{t("writing")}</TableHead>
                  <TableHead>{t("archiving")}</TableHead>
                  <TableHead>{t("correspondence")}</TableHead>
                  <TableHead>{t("follow_up")}</TableHead>
                  <TableHead>{t("today_hours_in")}</TableHead>
                  <TableHead>{t("today_hours_out")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((row) => (
                  <TableRow key={row.profile.id}>
                    <TableCell className="font-medium">{row.profile.full_name}</TableCell>
                    <TableCell>{row.total}</TableCell>
                    <TableCell>{row.completed}</TableCell>
                    <TableCell>{row.inProgress}</TableCell>
                    <TableCell>{row.counts.writing}</TableCell>
                    <TableCell>{row.counts.archiving}</TableCell>
                    <TableCell>{row.counts.correspondence}</TableCell>
                    <TableCell>{row.counts.follow_up}</TableCell>
                    <TableCell>{fmtHours(row.inH)}</TableCell>
                    <TableCell>{fmtHours(row.outH)}</TableCell>
                    <TableCell>
                      <Badge className={row.score >= 70 ? "bg-success text-success-foreground" : row.score >= 40 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>
                        {row.score}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8 w-60" />
            </div>
            <select className="border rounded px-2 h-9 bg-background text-sm" value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
              <option value="">{t("all")}</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={exportAttendance}>CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 me-1" /> {t("print")}</Button>
          </div>
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead>{t("entry_time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.slice(0, 200).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{profilesMap[a.user_id]?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.event_type === "in" ? "default" : "destructive"}>
                        {a.event_type === "in" ? t("check_in") : t("check_out")}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.reason ?? "—"}</TableCell>
                    <TableCell>{fmtDateTime(a.event_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3 pt-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8 w-60" />
            </div>
            <Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 me-1" /> {t("create_task")}</Button>
          </div>
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("priority")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("assigned_to")}</TableHead>
                  <TableHead>{t("deadline")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((t) => {
                  const assignedNames = assignments
                    .filter((a) => a.task_id === t.id)
                    .map((a) => profilesMap[a.user_id]?.full_name)
                    .filter(Boolean)
                    .join("، ");
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-xs">{assignedNames || "—"}</TableCell>
                      <TableCell>{t.deadline ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelectedTask(t.id)}>
                          {t.status === "archived" ? "👁" : "✎"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="pt-4">
          <Card className="p-6 print:shadow-none">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{t("monthly_summary")}</h3>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 me-1" /> {t("print")}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("department")}</TableHead>
                  <TableHead>{t("total_assigned")}</TableHead>
                  <TableHead>{t("total_completed")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((r) => (
                  <TableRow key={r.profile.id}>
                    <TableCell>{r.profile.full_name}</TableCell>
                    <TableCell>{r.profile.department ?? "—"}</TableCell>
                    <TableCell>{r.total}</TableCell>
                    <TableCell>{r.completed}</TableCell>
                    <TableCell>{r.score}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateTaskDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={load} />
      {selectedTask && <TaskDialog taskId={selectedTask} onClose={() => { setSelectedTask(null); load(); }} />}
    </div>
  );
}
