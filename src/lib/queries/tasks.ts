import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type TaskAssignment = Tables<"task_assignments">;
type TaskComment = Tables<"task_comments">;
type TaskTransfer = Tables<"task_transfers">;
type TaskShare = Tables<"task_shares">;

export const taskKeys = {
  all: ["tasks"] as const,
  list: () => ["tasks", "list"] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
  assignments: (taskId?: string) => ["tasks", "assignments", taskId] as const,
  allAssignments: () => ["tasks", "assignments"] as const,
  userTasks: (userId: string) => ["tasks", "user", userId] as const,
  comments: (taskId: string) => ["tasks", "comments", taskId] as const,
  transfers: (taskId: string) => ["tasks", "transfers", taskId] as const,
  shares: (taskId: string) => ["tasks", "shares", taskId] as const,
};

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    staleTime: 60_000,
  });
}

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId ?? ""),
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      return data as Task | null;
    },
    enabled: !!taskId,
    staleTime: 60_000,
  });
}

export function useUserTasks(userId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.userTasks(userId ?? ""),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("task_assignments")
        .select("task_id, tasks(*)")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return ((data ?? []) as any[]).map((a) => a.tasks).filter(Boolean) as Task[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useTaskAssignments(taskId?: string) {
  return useQuery({
    queryKey: taskKeys.assignments(taskId),
    queryFn: async () => {
      let q = supabase.from("task_assignments").select("*").eq("is_active", true);
      if (taskId) q = q.eq("task_id", taskId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaskAssignment[];
    },
    staleTime: 60_000,
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TaskComment[];
    },
    enabled: !!taskId,
    staleTime: 60_000,
  });
}

export function useTaskTransfers(taskId: string) {
  return useQuery({
    queryKey: taskKeys.transfers(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_transfers")
        .select("*")
        .eq("task_id", taskId)
        .order("transferred_at");
      if (error) throw error;
      return (data ?? []) as TaskTransfer[];
    },
    enabled: !!taskId,
    staleTime: 60_000,
  });
}

export function useTaskShares(taskId: string) {
  return useQuery({
    queryKey: taskKeys.shares(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_shares")
        .select("*")
        .eq("task_id", taskId);
      if (error) throw error;
      return (data ?? []) as TaskShare[];
    },
    enabled: !!taskId,
    staleTime: 60_000,
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: status as any })
        .eq("id", taskId);
      if (error) throw error;
    },
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(taskId) });
      const prev = qc.getQueryData<Task>(taskKeys.detail(taskId));
      if (prev) {
        qc.setQueryData<Task>(taskKeys.detail(taskId), { ...prev, status: status as any });
      }
      return { prev, taskId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(taskKeys.detail(ctx.taskId), ctx.prev);
      }
      toast.error("حدث خطأ أثناء تحديث الحالة");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      title: string;
      type: string;
      typeOther?: string;
      description?: string;
      priority: string;
      deadline?: string;
      createdBy: string;
      assigneeId: string;
    }) => {
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title: params.title,
          type: params.type as any,
          type_other: params.type === "other" ? (params.typeOther ?? null) : null,
          description: params.description || null,
          priority: params.priority as any,
          deadline: params.deadline || null,
          created_by: params.createdBy,
        })
        .select()
        .single();
      if (error || !task) throw error ?? new Error("Failed to create task");

      await supabase.from("task_assignments").insert({
        task_id: task.id,
        user_id: params.assigneeId,
        assigned_by: params.createdBy,
        is_active: true,
      });
      await supabase.from("notifications").insert({
        user_id: params.assigneeId,
        type: "task_assigned",
        message: `مهمة جديدة: ${params.title}`,
        related_task_id: task.id,
      });
      return task;
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "حدث خطأ أثناء إنشاء المهمة");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      taskId: string;
      userId: string;
      comment: string;
      taskTitle: string;
      recipientIds: string[];
    }) => {
      const { error } = await supabase.from("task_comments").insert({
        task_id: params.taskId,
        user_id: params.userId,
        comment: params.comment,
      });
      if (error) throw error;
      // notify
      for (const uid of params.recipientIds) {
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "task_commented",
          message: `تعليق جديد على: ${params.taskTitle}`,
          related_task_id: params.taskId,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "حدث خطأ");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(vars.taskId) });
    },
  });
}

export function useTransferTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      taskId: string;
      fromUserId: string;
      toUserId: string;
      transferredBy: string;
      note?: string;
      taskTitle: string;
    }) => {
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", params.taskId);
      const { error } = await supabase.from("task_assignments").insert({
        task_id: params.taskId,
        user_id: params.toUserId,
        assigned_by: params.transferredBy,
        is_active: true,
      });
      if (error) throw error;
      await supabase.from("task_transfers").insert({
        task_id: params.taskId,
        from_user_id: params.fromUserId,
        to_user_id: params.toUserId,
        transferred_by: params.transferredBy,
        note: params.note || null,
      });
      await supabase.from("notifications").insert({
        user_id: params.toUserId,
        type: "task_transferred_in",
        message: `تم نقل مهمة إليك: ${params.taskTitle}`,
        related_task_id: params.taskId,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "حدث خطأ أثناء النقل");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useShareTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      taskId: string;
      sharedWith: string;
      sharedBy: string;
    }) => {
      const { error } = await supabase.from("task_shares").insert({
        task_id: params.taskId,
        shared_with_user_id: params.sharedWith,
        shared_by: params.sharedBy,
      });
      if (error) throw error;
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "حدث خطأ");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.shares(vars.taskId) });
    },
  });
}
