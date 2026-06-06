import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { todayBaghdad } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";

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
    todayAttendance: (attendance ?? []).filter((a: any) => a.event_date === todayBaghdad()).length,
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-report");
    if (!printContent) {
      toast.error("محتوى التقرير غير موجود");
      return;
    }
    // Open a new window for printing to avoid destroying React DOM
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("فشل فتح نافذة الطباعة. تحقق من إعدادات مانع النوافذ المنبثقة.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${t("reports") || "التقارير"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
          .card-label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
          .card-value { font-size: 24px; font-weight: bold; color: #1e293b; }
          .empty-state { text-align: center; padding: 40px; color: #64748b; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold hidden sm:block">{t("reports") || "التقارير"}</h1>
        <Button variant="outline" onClick={handlePrint} className="no-print w-full sm:w-auto">
          <Printer className="h-4 w-4 me-1" />
          {t("print") || "طباعة"}
        </Button>
      </div>
      
      <div id="printable-report">
        <div className="grid grid-cols-4 gap-2 md:gap-4 print:grid-cols-2">
          <Card className="p-2 sm:p-4 text-center sm:text-start">
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{t("total_employees") || "إجمالي الموظفين"}</p>
            <p className="text-sm sm:text-2xl font-bold">{stats.totalEmployees}</p>
          </Card>
          <Card className="p-2 sm:p-4 text-center sm:text-start">
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{t("total_tasks") || "إجمالي المهام"}</p>
            <p className="text-sm sm:text-2xl font-bold">{stats.totalTasks}</p>
          </Card>
          <Card className="p-2 sm:p-4 text-center sm:text-start">
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{t("completed_tasks") || "المهام المكتملة"}</p>
            <p className="text-sm sm:text-2xl font-bold">{stats.completedTasks}</p>
          </Card>
          <Card className="p-2 sm:p-4 text-center sm:text-start">
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{t("today_attendance") || "حضور اليوم"}</p>
            <p className="text-sm sm:text-2xl font-bold">{stats.todayAttendance}</p>
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
