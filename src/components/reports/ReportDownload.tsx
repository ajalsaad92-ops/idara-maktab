import React, { useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { EmployeeReportPDF, TeamReportPDF } from "./ReportPDF";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EmployeeReportDownload({
  employee,
  attendance,
  tasks,
  month,
  year,
  managerName,
  institutionName,
}: {
  employee: any;
  attendance: any[];
  tasks: any[];
  month: string;
  year: string;
  managerName: string;
  institutionName: string;
}) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    setShowDialog(true);
    setProgress(0);
    setTimeout(() => setProgress(33), 500);
    setTimeout(() => setProgress(66), 1500);
    setTimeout(() => setProgress(100), 2500);
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={handleClick}>
        <Download className="w-4 h-4" /> {t("export_report") || "تصدير التقرير"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generating_report") || "جاري إنشاء التقرير..."}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              {progress < 33 && <Loader2 className="h-5 w-5 animate-spin" />}
              {progress >= 33 && <span className="text-green-500">✓</span>}
              <span className={progress >= 33 ? "text-muted-foreground" : ""}>
                {t("collecting_data") || "جاري تجميع البيانات..."}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {progress < 66 && <Loader2 className="h-5 w-5 animate-spin" />}
              {progress >= 66 && <span className="text-green-500">✓</span>}
              <span className={progress >= 66 ? "text-muted-foreground" : ""}>
                {t("creating_report") || "جاري إنشاء التقرير..."}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {progress < 100 && <Loader2 className="h-5 w-5 animate-spin" />}
              {progress >= 100 && <span className="text-green-500">✓</span>}
              <span className={progress >= 100 ? "text-muted-foreground" : ""}>
                {t("ready_download") || "جاهز للتحميل"}
              </span>
            </div>
            {progress >= 100 && (
              <div className="flex justify-center pt-4">
                <PDFDownloadLink
                  document={
                    <EmployeeReportPDF
                      employee={employee}
                      attendance={attendance}
                      tasks={tasks}
                      month={month}
                      year={year}
                      managerName={managerName}
                      institutionName={institutionName}
                    />
                  }
                  fileName={`report-${employee.full_name}-${month}-${year}.pdf`}
                >
                  {({ loading }) => (
                    <Button disabled={loading}>
                      <Download className="w-4 h-4 me-2" />
                      {t("download_pdf") || "تحميل PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TeamReportDownload({
  employees,
  month,
  year,
  managerName,
  institutionName,
}: {
  employees: any[];
  month: string;
  year: string;
  managerName: string;
  institutionName: string;
}) {
  const { t } = useI18n();

  return (
    <PDFDownloadLink
      document={
        <TeamReportPDF
          employees={employees}
          month={month}
          year={year}
          managerName={managerName}
          institutionName={institutionName}
        />
      }
      fileName={`team-report-${month}-${year}.pdf`}
    >
      {({ loading }) => (
        <Button variant="outline" className="gap-2" disabled={loading}>
          <Download className="w-4 h-4" />
          {loading ? (t("generating") || "جاري الإنشاء...") : (t("export_team_report") || "تصدير تقرير الفريق")}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
