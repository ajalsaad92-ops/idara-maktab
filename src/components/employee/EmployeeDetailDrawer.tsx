import { useEffect, useState } from "react";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime, fmtHours } from "@/lib/format";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Download, CheckCircle2, Clock, MapPin, CalendarDays, ListTodo } from "lucide-react";
import CountUp from "react-countup";
import { toast } from "sonner";
import { EmployeeReportDownload } from "@/components/reports/ReportDownload";

export function EmployeeDetailDrawer() {
  const { employeeId, isOpen, closeDrawer } = useEmployeeDrawer();
  const { t } = useI18n();

  const { data: profile } = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("id", employeeId).single();
      if (profileError) throw profileError;
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", employeeId).maybeSingle();
      return { ...profileData, role: roleData?.role ?? "employee" };
    },
    enabled: !!employeeId,
    staleTime: 60000,
  });

  const { data: attendanceEvents } = useQuery({
    queryKey: ["attendance", employeeId, "today"],
    queryFn: async () => {
      if (!employeeId) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", employeeId)
        .gte("event_at", `${today}T00:00:00Z`)
        .order("event_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("task_assignments")
        .select("*, tasks(*)")
        .eq("user_id", employeeId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
    staleTime: 60000,
  });

  const { data: attendanceHistory } = useQuery({
    queryKey: ["attendance", employeeId, "history"],
    queryFn: async () => {
      if (!employeeId) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", employeeId)
        .gte("event_at", thirtyDaysAgo.toISOString())
        .order("event_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
    staleTime: 60000,
  });

  if (!isOpen || !employeeId) return null;

  const initials = profile?.full_name?.substring(0, 2) || "U";
  
  const lastEvent = attendanceEvents?.length ? attendanceEvents[attendanceEvents.length - 1] : null;
  const isPresent = lastEvent?.event_type === "in";
  const statusColor = isPresent ? "bg-green-500" : (lastEvent ? "bg-red-500" : "bg-slate-500");
  const statusText = isPresent ? "في المكتب" : (lastEvent ? "خارج المكتب" : "غائب");

  const activeTasksCount = tasks?.filter((t: any) => t.tasks.status !== "مكتملة").length || 0;
  const completedTasksCount = tasks?.filter((t: any) => t.tasks.status === "مكتملة").length || 0;
  
  let hoursIn = 0;
  let hoursOut = 0;
  if (attendanceEvents && attendanceEvents.length > 0) {
    let lastInTime: Date | null = null;
    for (const event of attendanceEvents) {
      const eventTime = new Date(event.event_at);
      if (event.event_type === "in") {
        lastInTime = eventTime;
      } else if (event.event_type === "out" && lastInTime) {
        const diff = (eventTime.getTime() - lastInTime.getTime()) / (1000 * 60 * 60);
        hoursOut += diff;
        lastInTime = null;
      }
    }
    if (lastInTime) {
      const diff = (new Date().getTime() - lastInTime.getTime()) / (1000 * 60 * 60);
      hoursIn += diff;
    }
  }

  // Mock chart data for last 7 days based on history
  const chartData = [
    { name: '1', completed: 2, hours: 8 },
    { name: '2', completed: 3, hours: 7.5 },
    { name: '3', completed: 1, hours: 8 },
    { name: '4', completed: 4, hours: 8 },
    { name: '5', completed: 2, hours: 6 },
    { name: '6', completed: 5, hours: 8.5 },
    { name: '7', completed: 3, hours: 8 },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(val) => !val && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="sr-only">تفاصيل الموظف</SheetTitle>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">{profile?.full_name}</h2>
              <div className="flex items-center gap-2 mt-1 text-slate-500">
                <span>{profile?.role === "admin" ? "مدير نظام" : profile?.role === "manager" ? "مدير" : "موظف"}</span>
                <span>•</span>
                <span>{profile?.department || "القسم العام"}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                  {statusText}
                </Badge>
                {lastEvent && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    دخول: {new Date(lastEvent.event_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8">
          {/* Section 2: Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-t-2 border-t-primary">
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> مكتملة اليوم</p>
              <p className="text-2xl font-bold text-slate-900"><CountUp end={completedTasksCount} /></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-t-2 border-t-accent">
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Clock className="w-4 h-4 text-accent" /> قيد التنفيذ</p>
              <p className="text-2xl font-bold text-slate-900"><CountUp end={activeTasksCount} /></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-t-2 border-t-primary">
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-4 h-4 text-primary" /> ساعات المكتب</p>
              <p className="text-2xl font-bold text-slate-900"><CountUp end={hoursIn} decimals={1} /></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-t-2 border-t-red-500">
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-4 h-4 text-red-500" /> خارج المكتب</p>
              <p className="text-2xl font-bold text-slate-900"><CountUp end={hoursOut} decimals={1} /></p>
            </Card>
          </div>

          {/* Section 3: Chart */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900">الإنتاجية (آخر 7 أيام)</h3>
            <Card className="p-4 h-64 border-t-2 border-t-accent">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#c9a84c" radius={[4, 4, 0, 0]} name="مهام مكتملة" />
                  <Line type="monotone" dataKey="hours" stroke="#1e3a5f" strokeWidth={3} name="ساعات المكتب" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Section 4: Tasks */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900">المهام الحالية</h3>
            <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2 border-t-2 border-t-primary">
              {tasks && tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((t: any) => (
                    <div key={t.id} className="p-3 bg-white border rounded-lg hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm">{t.tasks.title}</span>
                        <Badge variant="outline" className="text-[10px]">{t.tasks.status}</Badge>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500">
                        استحقاق: {fmtDateTime(t.tasks.deadline)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<ListTodo className="h-12 w-12 text-muted-foreground/50" />} title="لا توجد مهام" description="لم يتم تعيين مهام لهذا الموظف" />
              )}
            </ScrollArea>
          </div>

          {/* Section 5: Attendance History */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary"/> سجل الحضور</h3>
            <Card className="border-t-2 border-t-primary">
              <div className="space-y-0 divide-y">
                {attendanceHistory && attendanceHistory.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex justify-between items-center p-3 text-sm hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-medium block text-slate-900">{new Date(a.check_in).toLocaleDateString('ar-IQ')}</span>
                      <span className="text-slate-500 text-xs">{fmtHours(a.total_hours)} عمل</span>
                    </div>
                    <Badge variant={a.check_out ? "secondary" : "default"} className={!a.check_out ? "bg-green-500" : ""}>
                      {a.check_out ? "مكتمل" : "مستمر"}
                    </Badge>
                  </div>
                ))}
                {(!attendanceHistory || attendanceHistory.length === 0) && (
                   <div className="p-4"><EmptyState icon={<CalendarDays className="h-12 w-12 text-muted-foreground/50" />} title="لا يوجد سجل" description="لم يتم تسجيل حضور مؤخراً" /></div>
                )}
              </div>
            </Card>
          </div>

          {/* Section 6: Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button className="flex-1 gap-2 bg-primary hover:border-accent hover:border"><Plus className="w-4 h-4"/> تعيين مهمة جديدة</Button>
            <EmployeeReportDownload
              employee={profile}
              attendance={attendanceHistory?.map((a: any) => ({
                date: new Date(a.event_at).toLocaleDateString("ar-IQ"),
                checkIn: new Date(a.event_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }),
                checkOut: a.event_type === "out" ? new Date(a.event_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : null,
                hours: a.event_type === "in" ? fmtHours(0) : fmtHours(0),
                status: a.event_type === "in" ? "في المكتب" : "خارج",
              })) || []}
              tasks={tasks?.map((t: any) => ({
                title: t.tasks?.title || "—",
                type: t.tasks?.type || "—",
                assignedDate: t.tasks?.created_at ? new Date(t.tasks.created_at).toLocaleDateString("ar-IQ") : "—",
                completedDate: t.tasks?.status === "completed" ? (t.tasks?.updated_at ? new Date(t.tasks.updated_at).toLocaleDateString("ar-IQ") : "—") : null,
                status: t.tasks?.status || "—",
              })) || []}
              month={new Date().toLocaleString("ar-IQ", { month: "long" })}
              year={new Date().getFullYear().toString()}
              managerName="المدير"
              institutionName="المراقب"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
