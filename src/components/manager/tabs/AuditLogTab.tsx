import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDateTime } from "@/lib/format";

export default function AuditLogTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("*, profiles:user_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const filteredLogs = (logs || []).filter((log: any) => {
    if (filterType && log.entity_type !== filterType) return false;
    if (filterAction && log.action !== filterAction) return false;
    if (search) {
      const profileName = log.profiles?.full_name || "";
      return profileName.includes(search) || log.action.includes(search) || log.entity_type.includes(search);
    }
    return true;
  });

  const exportCSV = () => {
    const rows = [
      ["Time", "User", "Action", "Entity Type", "Entity ID", "Old Value", "New Value", "IP"],
      ...filteredLogs.map((log: any) => [
        new Date(log.created_at).toISOString(),
        log.profiles?.full_name || "—",
        log.action,
        log.entity_type,
        log.entity_id,
        JSON.stringify(log.old_value || {}),
        JSON.stringify(log.new_value || {}),
        log.ip_address || "—",
      ]),
    ];
    const csv = rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-800",
      status_change: "bg-blue-100 text-blue-800",
      transfer: "bg-orange-100 text-orange-800",
      delete: "bg-red-100 text-red-800",
      in: "bg-green-100 text-green-800",
      out: "bg-yellow-100 text-yellow-800",
    };
    return colors[action] || "bg-slate-100 text-slate-800";
  };

  if (isLoading) {
    return <div className="p-8 text-center">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8 w-60" />
        </div>
        <select className="border rounded px-2 h-9 bg-background text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">{t("all")}</option>
          <option value="task">{t("tasks")}</option>
          <option value="attendance">{t("attendance")}</option>
          <option value="user">{t("employees")}</option>
        </select>
        <select className="border rounded px-2 h-9 bg-background text-sm" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">{t("all")} {t("actions")}</option>
          <option value="create">{t("create")}</option>
          <option value="status_change">{t("status_change")}</option>
          <option value="transfer">{t("transfer_action")}</option>
          <option value="delete">{t("delete")}</option>
        </select>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 me-1" /> CSV
        </Button>
      </div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("time")}</TableHead>
              <TableHead>{t("user")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("entity_type")}</TableHead>
              <TableHead>{t("details")}</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <EmptyState icon={<Filter className="h-12 w-12 text-muted-foreground/50" />} title={t("no_data")} description={t("no_results_found")} />
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(log.created_at)}</TableCell>
                  <TableCell className="text-xs">{log.profiles?.full_name || "—"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{log.entity_type}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {log.old_value && <span className="text-red-500">{JSON.stringify(log.old_value)}</span>}
                    {log.new_value && <span className="text-green-500 ml-2">{JSON.stringify(log.new_value)}</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
