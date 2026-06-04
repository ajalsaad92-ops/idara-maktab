import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Shield } from "lucide-react";

function AuditPageComponent() {
  const { t } = useI18n();

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("*, profiles:user_id (full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-success/10 text-success";
      case "update": return "bg-primary/10 text-primary";
      case "transfer": return "bg-warning/10 text-warning";
      case "delete": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("audit_log") || "سجل المراجعة"}</h1>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("time") || "الوقت"}</TableHead>
              <TableHead>{t("user") || "المستخدم"}</TableHead>
              <TableHead>{t("action") || "الإجراء"}</TableHead>
              <TableHead>{t("entity") || "الكيان"}</TableHead>
              <TableHead>{t("entity_id") || "المعرف"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(auditLogs ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <EmptyState 
                    icon={<Shield className="h-12 w-12 text-muted-foreground/50" />}
                    title={t("no_data")} 
                    description={t("no_audit_desc") || "لا توجد سجلات مراجعة"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (auditLogs ?? []).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell>{log.profiles?.full_name || "—"}</TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell className="font-mono text-sm">{log.entity_id}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const AuditPage = memo(AuditPageComponent);
