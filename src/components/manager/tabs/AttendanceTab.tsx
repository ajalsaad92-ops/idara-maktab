import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/format";
import { Search, Printer, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/empty-state";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { MobileCardList, MobileCard, MobileCardRow } from "@/components/ui/mobile-card-list";

function AttendanceTab({ attendance, profiles, profilesMap, exportAttendance }: any) {
  const { t } = useI18n();
  const { openEmployeeDrawer } = useEmployeeDrawer();
  const [search, setSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("");

  const filteredAttendance = attendance
    .filter((a: any) => !filterEmp || a.user_id === filterEmp)
    .filter((a: any) => {
      if (!search) return true;
      const name = profilesMap[a.user_id]?.full_name ?? "";
      return name.includes(search);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8 w-60" />
        </div>
        <select className="border rounded px-2 h-9 bg-background text-sm" value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
          <option value="">{t("all")}</option>
          {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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
            {filteredAttendance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                    <EmptyState 
                    icon={<Clock className="h-12 w-12 text-muted-foreground/50" />}
                    title={t("no_data")} 
                    description={search ? t("no_results_found") : t("no_attendance_records")} 
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredAttendance.slice(0, 200).map((a: any) => (
                <TableRow key={a.id} onClick={() => openEmployeeDrawer(a.user_id)} className="cursor-pointer transition-colors">
                  <TableCell>{profilesMap[a.user_id]?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.event_type === "in" ? "default" : "destructive"}>
                      {a.event_type === "in" ? t("check_in") : t("check_out")}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.reason ?? "—"}</TableCell>
                  <TableCell>{fmtDateTime(a.event_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <MobileCardList>
          {filteredAttendance.length === 0 ? (
            <EmptyState 
              icon={<Clock className="h-12 w-12 text-muted-foreground/50" />}
              title={t("no_data")} 
              description={search ? t("no_results_found") : t("no_attendance_records")} 
            />
          ) : (
            filteredAttendance.slice(0, 50).map((a: any) => (
              <MobileCard key={a.id} onClick={() => openEmployeeDrawer(a.user_id)}>
                <MobileCardRow label={t("name")} value={profilesMap[a.user_id]?.full_name ?? "—"} />
                <MobileCardRow label={t("type")} value={
                  <Badge variant={a.event_type === "in" ? "default" : "destructive"}>
                    {a.event_type === "in" ? t("check_in") : t("check_out")}
                  </Badge>
                } />
                <MobileCardRow label={t("reason")} value={a.reason ?? "—"} />
                <MobileCardRow label={t("entry_time")} value={fmtDateTime(a.event_at)} />
              </MobileCard>
            ))
          )}
        </MobileCardList>
      </Card>
    </div>
  );
}

export default memo(AttendanceTab);
