import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/employee/EmployeeDashboard";
import { useI18n } from "@/lib/i18n";

import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { MobileCardList, MobileCard, MobileCardRow } from "@/components/ui/mobile-card-list";

function TasksTab({ tasks, assignments, profilesMap, setOpenCreate, setSelectedTask }: any) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const filteredTasks = tasks.filter((t: any) => !search || t.title.includes(search));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8 w-60" />
        </div>
        <Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 me-1" /> {t("create_task")}</Button>
      </div>
      <Card className="p-4 overflow-x-auto">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("assigned_to")}</TableHead>
                <TableHead>{t("deadline")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <EmptyState 
                      icon={<ClipboardList className="h-12 w-12 text-muted-foreground/50" />}
                      title={t("no_data")} 
                      description={search ? t("no_results_found") : t("no_tasks")} 
                      action={<Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 me-1" /> {t("create_task")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((tItem: any) => {
                  const assignedNames = assignments
                    .filter((a: any) => a.task_id === tItem.id)
                    .map((a: any) => profilesMap[a.user_id]?.full_name)
                    .filter(Boolean)
                    .join("، ");
                  return (
                    <TableRow key={tItem.id}>
                      <TableCell className="font-medium">{tItem.title}</TableCell>
                      <TableCell><Badge variant="outline">{tItem.type}</Badge></TableCell>
                      <TableCell><PriorityBadge priority={tItem.priority} /></TableCell>
                      <TableCell><StatusBadge status={tItem.status} /></TableCell>
                      <TableCell className="text-xs">{assignedNames || "—"}</TableCell>
                      <TableCell>{tItem.deadline ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelectedTask(tItem.id)}>
                          {tItem.status === "archived" ? "👁" : "✎"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <MobileCardList>
          {filteredTasks.length === 0 ? (
            <EmptyState 
              icon={<ClipboardList className="h-12 w-12 text-muted-foreground/50" />}
              title={t("no_data")} 
              description={search ? t("no_results_found") : t("no_tasks")} 
              action={<Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 me-1" /> {t("create_task")}</Button>}
            />
          ) : (
            filteredTasks.map((tItem: any) => {
              const assignedNames = assignments
                .filter((a: any) => a.task_id === tItem.id)
                .map((a: any) => profilesMap[a.user_id]?.full_name)
                .filter(Boolean)
                .join("، ");
              return (
                <MobileCard key={tItem.id} onClick={() => setSelectedTask(tItem.id)}>
                  <MobileCardRow label={t("title")} value={tItem.title} />
                  <MobileCardRow label={t("type")} value={<Badge variant="outline">{tItem.type}</Badge>} />
                  <MobileCardRow label={t("priority")} value={<PriorityBadge priority={tItem.priority} />} />
                  <MobileCardRow label={t("status")} value={<StatusBadge status={tItem.status} />} />
                  <MobileCardRow label={t("assigned_to")} value={assignedNames || "—"} />
                  <MobileCardRow label={t("deadline")} value={tItem.deadline ?? "—"} />
                </MobileCard>
              );
            })
          )}
        </MobileCardList>
      </Card>
    </div>
  );
}

export default memo(TasksTab);
