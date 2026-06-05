import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSearch } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
import { MobileCardList, MobileCard, MobileCardRow } from "@/components/ui/mobile-card-list";
import { StatusBadge, PriorityBadge } from "@/components/employee/EmployeeDashboard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { EmptyState } from "@/components/ui/empty-state";

export function TasksPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as any;
  const [searchQuery, setSearchQuery] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  useEffect(() => {
    if (search?.task_id && !selectedTask) {
      setSelectedTask(search.task_id);
      setTimeout(() => {
        document.getElementById(`task-row-${search.task_id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [search?.task_id]);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: assignments } = useQuery({
    queryKey: ["task_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_assignments").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const filteredTasks = (tasks ?? []).filter((t: any) => !searchQuery || t.title?.includes(searchQuery));
  const profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 bg-muted rounded" />
        <div className="h-64 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl sm:text-2xl font-bold hidden sm:block">{t("tasks") || "إدارة المهام"}</h1>
        <div className="flex gap-2 w-full items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t("search")} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="ps-8 w-full h-9 sm:h-10 text-xs sm:text-sm" 
            />
          </div>
          {(role === "admin" || role === "manager") && (
            <Button size="sm" onClick={() => setOpenCreate(true)} className="shrink-0 h-9 sm:h-10 text-xs sm:text-sm">
              <Plus className="h-4 w-4 me-1" />
              {t("create_task")}
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-x-auto p-4">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("assigned_to") || "المكلف"}</TableHead>
                <TableHead>{t("deadline")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <EmptyState 
                      icon={<Search className="h-12 w-12 text-muted-foreground/50" />}
                      title={t("no_data")} 
                      description={t("no_tasks_desc") || "لا توجد مهام"}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task: any) => {
                  const assignees = (assignments ?? []).filter((a: any) => a.task_id === task.id).map((a: any) => profilesMap[a.user_id]?.full_name).filter(Boolean).join(", ");
                  return (
                    <TableRow 
                      key={task.id} 
                      id={`task-row-${task.id}`}
                      className={`cursor-pointer hover:bg-accent/5 ${selectedTask === task.id ? "bg-accent/10" : ""}`}
                      onClick={() => setSelectedTask(task.id)}
                    >
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.priority || "—"}</TableCell>
                      <TableCell>{assignees || "—"}</TableCell>
                      <TableCell>{task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"}</TableCell>
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
              icon={<Search className="h-12 w-12 text-muted-foreground/50" />}
              title={t("no_data")} 
              description={t("no_tasks_desc") || "لا توجد مهام"}
            />
          ) : (
            filteredTasks.map((task: any) => {
              const assignees = (assignments ?? []).filter((a: any) => a.task_id === task.id).map((a: any) => profilesMap[a.user_id]?.full_name).filter(Boolean).join(", ");
              return (
                <MobileCard key={task.id} onClick={() => setSelectedTask(task.id)}>
                  <MobileCardRow label={t("title")} value={task.title} />
                  <MobileCardRow label={t("status")} value={
                    <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                      {task.status}
                    </Badge>
                  } />
                  <MobileCardRow label={t("priority")} value={task.priority || "—"} />
                  <MobileCardRow label={t("assigned_to") || "المكلف"} value={assignees || "—"} />
                  <MobileCardRow label={t("deadline")} value={task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"} />
                </MobileCard>
              );
            })
          )}
        </MobileCardList>
      </Card>

      <CreateTaskDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={invalidate} />
      {selectedTask && <TaskDialog taskId={selectedTask} onClose={() => { setSelectedTask(null); invalidate(); }} />}
    </div>
  );
}
