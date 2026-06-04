import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Printer } from "lucide-react";

function ReportsPageComponent() {
  const { t } = useI18n();

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*");
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

  const stats = {
    totalEmployees: (profiles ?? []).length,
    totalTasks: (tasks ?? []).length,
    completedTasks: (tasks ?? []).filter((t: any) => t.status === "completed").length,
    todayAttendance: (attendance ?? []).filter((a: any) => a.event_date === new Date().toISOString().split("T")[0]).length,
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-report");
    if (!printContent) return;
    const originalBody = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalBody;
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("reports") || "التقارير"}</h1>
        <Button variant="outline" onClick={handlePrint} className="no-print">
          <Printer className="h-4 w-4 me-1" />
          {t("print") || "طباعة"}
        </Button>
      </div>
      
      <div id="printable-report">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">{t("total_employees") || "إجمالي الموظفين"}</p>
            <p className="text-2xl font-bold">{stats.totalEmployees}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">{t("total_tasks") || "إجمالي المهام"}</p>
            <p className="text-2xl font-bold">{stats.totalTasks}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">{t("completed_tasks") || "المهام المكتملة"}</p>
            <p className="text-2xl font-bold">{stats.completedTasks}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">{t("today_attendance") || "حضور اليوم"}</p>
            <p className="text-2xl font-bold">{stats.todayAttendance}</p>
          </Card>
        </div>

        <Card className="p-8 mt-6">
          <EmptyState 
            icon={<FileText className="h-12 w-12 text-muted-foreground/50" />}
            title={t("no_reports_yet") || "التقارير التفصيلية قريباً"} 
            description={t("reports_desc") || "سيتم إضافة التقارير التفصيلية قريباً"}
          />
        </Card>
      </div>
    </div>
  );
}

export const ReportsPage = memo(ReportsPageComponent);
