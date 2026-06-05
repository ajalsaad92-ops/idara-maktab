import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtHours } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { MobileCardList, MobileCard, MobileCardRow } from "@/components/ui/mobile-card-list";

function ProductivityTab({ productivity }: { productivity: any[] }) {
  const { t } = useI18n();
  const { openEmployeeDrawer } = useEmployeeDrawer();
  return (
    <Card className="p-4 overflow-x-auto">
      <div className="hidden md:block">
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
            {productivity.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8">
                  <EmptyState 
                    icon={<BarChart3 className="h-12 w-12 text-muted-foreground/50" />}
                    title={t("no_data")} 
                    description={t("no_productivity_desc")}
                  />
                </TableCell>
              </TableRow>
            ) : (
              productivity.map((row) => (
                <TableRow key={row.profile.id} onClick={() => openEmployeeDrawer(row.profile.id)} className="cursor-pointer transition-colors">
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <MobileCardList>
        {productivity.length === 0 ? (
          <EmptyState 
            icon={<BarChart3 className="h-12 w-12 text-muted-foreground/50" />}
            title={t("no_data")} 
            description={t("no_productivity_desc")}
          />
        ) : (
          productivity.map((row) => (
            <MobileCard key={row.profile.id} onClick={() => openEmployeeDrawer(row.profile.id)}>
              <MobileCardRow label={t("name")} value={row.profile.full_name} />
              <MobileCardRow label={t("total_assigned")} value={row.total} />
              <MobileCardRow label={t("total_completed")} value={row.completed} />
              <MobileCardRow label={t("in_progress_count")} value={row.inProgress} />
              <MobileCardRow label={t("today_hours_in")} value={fmtHours(row.inH)} />
              <MobileCardRow label={t("today_hours_out")} value={fmtHours(row.outH)} />
              <MobileCardRow label={t("score")} value={
                <Badge className={row.score >= 70 ? "bg-success text-success-foreground" : row.score >= 40 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>
                  {row.score}%
                </Badge>
              } />
            </MobileCard>
          ))
        )}
      </MobileCardList>
    </Card>
  );
}

export default memo(ProductivityTab);
