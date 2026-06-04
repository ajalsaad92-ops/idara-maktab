import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { BarChart3, TrendingUp, Clock, Trophy, AlertTriangle, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import CountUp from "react-countup";
import { memo } from "react";

function ProductivityPageComponent() {
  const { t, lang } = useI18n();
  const { openEmployeeDrawer } = useEmployeeDrawer();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: assignments } = useQuery({
    queryKey: ["task_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_assignments").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("event_date", new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0])
        .order("event_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const productivity = useMemo(() => {
    return (profiles ?? []).map((p: any) => {
      const userAssigns = (assignments ?? []).filter((a: any) => a.user_id === p.id);
      const userTasks = userAssigns
        .map((a: any) => (tasks ?? []).find((tk: any) => tk.id === a.task_id))
        .filter(Boolean);
      const total = userTasks.length;
      const completed = userTasks.filter((tk: any) => tk.status === "مكتملة").length;
      const inProgress = userTasks.filter((tk: any) => tk.status === "قيد التنفيذ").length;
      const newTasks = userTasks.filter((tk: any) => tk.status === "جديدة").length;

      // Calculate hours from attendance
      const userAttendance = (attendance ?? [])
        .filter((a: any) => a.user_id === p.id)
        .sort((a: any, b: any) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime());

      let hoursIn = 0;
      let hoursOut = 0;
      for (let i = 0; i < userAttendance.length; i++) {
        const evt = userAttendance[i];
        const nextEvt = userAttendance[i + 1];
        if ((evt.event_type as string) === "in" && nextEvt) {
          const diff = (new Date(nextEvt.event_at).getTime() - new Date(evt.event_at).getTime()) / 3600000;
          if ((nextEvt.event_type as string) === "out" || (nextEvt.event_type as string) === "out_final") {
            hoursIn += diff;
          }
        }
        if ((evt.event_type as string) === "out" && nextEvt && (nextEvt.event_type as string) === "in") {
          const diff = (new Date(nextEvt.event_at).getTime() - new Date(evt.event_at).getTime()) / 3600000;
          hoursOut += diff;
        }
      }

      // Correct formula: (completed * 10) + (hours_in * 2) - (hours_out * 1)
      const score = Math.max(0, Math.min(100, Math.round(
        (completed * 10) + (Math.floor(hoursIn) * 2) - (Math.floor(hoursOut) * 1)
      )));

      return {
        profile: p,
        total,
        completed,
        inProgress,
        newTasks,
        hoursIn: Math.round(hoursIn * 10) / 10,
        hoursOut: Math.round(hoursOut * 10) / 10,
        score,
      };
    });
  }, [profiles, assignments, tasks, attendance]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return productivity;
    const q = searchQuery.toLowerCase();
    return productivity.filter((p: any) =>
      p.profile.full_name?.toLowerCase().includes(q)
    );
  }, [productivity, searchQuery]);

  // Summary stats
  const totalCompleted = filtered.reduce((s: number, p: any) => s + p.completed, 0);
  const avgHoursIn = filtered.length
    ? Math.round((filtered.reduce((s: number, p: any) => s + p.hoursIn, 0) / filtered.length) * 10) / 10
    : 0;
  const topPerformer = filtered.length
    ? filtered.reduce((best: any, p: any) => p.score > best.score ? p : best, filtered[0])
    : null;
  const lowPerformer = filtered.length
    ? filtered.reduce((worst: any, p: any) => p.score < worst.score ? p : worst, filtered[0])
    : null;

  // Bar chart data: tasks per employee
  const barData = filtered.map((p: any) => ({
    name: p.profile.full_name?.split(" ")[0] || "—",
    [t("completed") || "مكتملة"]: p.completed,
    [t("in_progress") || "قيد التنفيذ"]: p.inProgress,
    [t("new_tasks_label") || "جديدة"]: p.newTasks,
  }));

  // Line chart data: daily attendance hours (last 14 days)
  const lineData = useMemo(() => {
    const days: any[] = [];
    for (let d = 13; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000);
      const dateStr = date.toISOString().split("T")[0];
      const dayLabel = date.toLocaleDateString(lang === "ar" ? "ar-IQ" : "en-US", { weekday: "short", day: "numeric" });
      const dayEntry: any = { date: dayLabel };
      // Show top 5 employees
      const top5 = filtered.slice(0, 5);
      top5.forEach((p: any) => {
        const dayAtt = (attendance ?? []).filter(
          (a: any) => a.user_id === p.profile.id && a.event_date === dateStr
        );
        let hIn = 0;
        for (let i = 0; i < dayAtt.length; i++) {
          const evt = dayAtt[i];
          const next = dayAtt[i + 1];
          if ((evt.event_type as string) === "in" && next) {
            const diff = (new Date(next.event_at).getTime() - new Date(evt.event_at).getTime()) / 3600000;
            if ((next.event_type as string) === "out" || (next.event_type as string) === "out_final") {
              hIn += diff;
            }
          }
        }
        dayEntry[p.profile.full_name?.split(" ")[0] || "—"] = Math.round(hIn * 10) / 10;
      });
      days.push(dayEntry);
    }
    return days;
  }, [filtered, attendance, lang]);

  const lineColors = ["#c9a84c", "#1e3a5f", "#22c55e", "#f59e0b", "#ef4444"];

  if (filtered.length === 0 && !searchQuery) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">{t("productivity_table") || "جدول الإنتاجية"}</h1>
        <EmptyState
          icon={<BarChart3 className="h-12 w-12 text-muted-foreground/50" />}
          title={t("no_data")}
          description={t("no_productivity_desc")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {t("productivity_table") || "جدول الإنتاجية"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("productivity_subtitle") || "متابعة أداء الموظفين وإنتاجيتهم"}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("search_employee") || "بحث عن موظف..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-t-2 border-t-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                <CountUp end={totalCompleted} duration={1} />
              </p>
              <p className="text-xs text-muted-foreground">{t("tasks_completed_month") || "مهام مكتملة هذا الشهر"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-t-2 border-t-primary hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                <CountUp end={avgHoursIn} duration={1} decimals={1} />
              </p>
              <p className="text-xs text-muted-foreground">{t("avg_daily_hours") || "متوسط ساعات الحضور"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-t-2 border-t-success hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold text-primary truncate max-w-[120px]">
                {topPerformer?.profile.full_name?.split(" ")[0] || "—"}
              </p>
              <p className="text-xs text-success font-semibold">{topPerformer?.score || 0}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-t-2 border-t-warning hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold text-primary truncate max-w-[120px]">
                {lowPerformer?.profile.full_name?.split(" ")[0] || "—"}
              </p>
              <p className="text-xs text-warning font-semibold">{lowPerformer?.score || 0}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bar Chart: Tasks per employee */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">
            {t("tasks_per_employee") || "إنجاز المهام لكل موظف"}
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="name" type="category" width={60} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend fontSize={11} />
                <Bar dataKey={t("completed") || "مكتملة"} fill="#c9a84c" radius={[0, 4, 4, 0]} />
                <Bar dataKey={t("in_progress") || "قيد التنفيذ"} fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                <Bar dataKey={t("new_tasks_label") || "جديدة"} fill="#94a3b8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t("no_data")}</p>
          )}
        </Card>

        {/* Line Chart: Daily attendance hours */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">
            {t("daily_attendance_chart") || "معدل الحضور اليومي (آخر 14 يوم)"}
          </h3>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={10} angle={-30} textAnchor="end" height={50} />
                <YAxis fontSize={11} domain={[0, 8]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend fontSize={11} />
                {filtered.slice(0, 5).map((p: any, i: number) => (
                  <Line
                    key={p.profile.id}
                    type="monotone"
                    dataKey={p.profile.full_name?.split(" ")[0] || "—"}
                    stroke={lineColors[i % lineColors.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t("no_data")}</p>
          )}
        </Card>
      </div>

      {/* Employee Performance Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p: any) => (
          <Card
            key={p.profile.id}
            className="p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
            onClick={() => openEmployeeDrawer(p.profile.id)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                {p.profile.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "؟"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary truncate">{p.profile.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.profile.department_id ? t("department") : "—"}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t("score") || "النقاط"}</span>
                <span className={`font-bold ${p.score >= 80 ? "text-success" : p.score >= 50 ? "text-warning" : "text-destructive"}`}>
                  {p.score}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    p.score >= 80 ? "bg-success" : p.score >= 50 ? "bg-warning" : "bg-destructive"
                  }`}
                  style={{ width: `${Math.min(100, p.score)}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-success">✅</span>
                <span>{p.completed} {t("completed") || "مكتملة"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-warning">⏳</span>
                <span>{p.inProgress} {t("in_progress") || "قيد التنفيذ"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🏢</span>
                <span>{p.hoursIn}h {t("in_office") || "في المكتب"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🚶</span>
                <span>{p.hoursOut}h {t("outside") || "خارج"}</span>
              </div>
            </div>

            <button className="mt-3 w-full text-xs text-accent font-semibold hover:underline group-hover:text-accent-dark">
              {t("view_details") || "عرض التفاصيل"} →
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default memo(ProductivityPageComponent);
