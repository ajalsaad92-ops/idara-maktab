import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TeamReportDownload } from "@/components/reports/ReportDownload";

function ReportsTab({ productivity, departments }: any) {
  const { t } = useI18n();
  const deptMap = Object.fromEntries((departments ?? []).map((d: any) => [d.id, d.name_ar || d.name_en]));
  return (
    <Card className="p-6 print:shadow-none">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">{t("monthly_summary")}</h3>
        <div className="flex gap-2">
          <TeamReportDownload
            employees={productivity.map((r: any) => ({
              full_name: r.profile.full_name,
              department: r.profile.department_id ? deptMap[r.profile.department_id] ?? "—" : "—",
              completedTasks: r.completed,
              totalHours: r.inH,
              score: r.score,
            }))}
            month={new Date().toLocaleString("ar-IQ", { month: "long" })}
            year={new Date().getFullYear().toString()}
            managerName="المدير"
            institutionName="المراقب"
          />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 me-1" /> {t("print")}
          </Button>
        </div>
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
          {productivity.map((r: any) => (
            <TableRow key={r.profile.id}>
              <TableCell>{r.profile.full_name}</TableCell>
              <TableCell>{r.profile.department_id ? deptMap[r.profile.department_id] ?? "—" : "—"}</TableCell>
              <TableCell>{r.total}</TableCell>
              <TableCell>{r.completed}</TableCell>
              <TableCell>{r.score}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default memo(ReportsTab);
