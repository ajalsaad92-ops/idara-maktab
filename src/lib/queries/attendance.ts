import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Attendance = Tables<"attendance">;

export const attendanceKeys = {
  all: ["attendance"] as const,
  today: (userId: string) => ["attendance", "today", userId] as const,
  history: (filters?: { userId?: string; limit?: number }) =>
    ["attendance", "history", filters] as const,
};

export function useTodayAttendance(userId: string | undefined) {
  return useQuery({
    queryKey: attendanceKeys.today(userId ?? ""),
    queryFn: async () => {
      if (!userId) return [];
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("event_at", dayStart.toISOString())
        .order("event_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useAttendanceHistory(filters?: {
  userId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: attendanceKeys.history(filters),
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*")
        .order("event_at", { ascending: false });
      if (filters?.userId) q = q.eq("user_id", filters.userId);
      q = q.limit(filters?.limit ?? 500);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    staleTime: 60_000,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("attendance")
        .insert({ user_id: userId, event_type: "in" as const });
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: attendanceKeys.today(userId) });
      const prev = qc.getQueryData<Attendance[]>(
        attendanceKeys.today(userId),
      );
      const optimistic: Partial<Attendance> = {
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: "in",
        event_at: new Date().toISOString(),
        reason: null,
      };
      qc.setQueryData<Attendance[]>(attendanceKeys.today(userId), (old) => [
        ...(old ?? []),
        optimistic as Attendance,
      ]);
      return { prev, userId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(attendanceKeys.today(ctx.userId), ctx.prev);
      }
      toast.error("حدث خطأ أثناء تسجيل الدخول");
    },
    onSettled: (_d, _e, userId) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
      qc.invalidateQueries({ queryKey: attendanceKeys.history() });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason?: string;
    }) => {
      const { error } = await supabase.from("attendance").insert({
        user_id: userId,
        event_type: "out" as const,
        reason: reason ?? null,
      });
      if (error) throw error;
    },
    onMutate: async ({ userId, reason }) => {
      await qc.cancelQueries({ queryKey: attendanceKeys.today(userId) });
      const prev = qc.getQueryData<Attendance[]>(
        attendanceKeys.today(userId),
      );
      const optimistic: Partial<Attendance> = {
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: "out",
        event_at: new Date().toISOString(),
        reason: reason ?? null,
      };
      qc.setQueryData<Attendance[]>(attendanceKeys.today(userId), (old) => [
        ...(old ?? []),
        optimistic as Attendance,
      ]);
      return { prev, userId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(attendanceKeys.today(ctx.userId), ctx.prev);
      }
      toast.error("حدث خطأ أثناء تسجيل الخروج");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(vars.userId) });
      qc.invalidateQueries({ queryKey: attendanceKeys.history() });
    },
  });
}
