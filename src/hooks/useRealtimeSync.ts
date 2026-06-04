import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const { t, lang } = useI18n();

  useEffect(() => {
    let reconnectToastId: string | number | null = null;

    const channel = supabase.channel("global-sync");

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["attendance"] });
          queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
          queryClient.invalidateQueries({ queryKey: ["managerDashboard"] });
          queryClient.invalidateQueries({ queryKey: ["employeeDashboard"] });
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["managerDashboard"] });
          queryClient.invalidateQueries({ queryKey: ["employeeDashboard"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task_comments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_assignments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task_assignments"] });
          queryClient.invalidateQueries({ queryKey: ["managerDashboard"] });
          queryClient.invalidateQueries({ queryKey: ["employeeDashboard"] });
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exit_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["exit_requests"] });
          queryClient.invalidateQueries({ queryKey: ["employeeDashboard"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_permissions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          if (reconnectToastId) {
            toast.dismiss(reconnectToastId);
            reconnectToastId = null;
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false);
          if (!reconnectToastId) {
            const msg = lang === "ar" ? "جاري إعادة الاتصال..." : "Reconnecting...";
            reconnectToastId = toast.loading(msg, { duration: Infinity });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (reconnectToastId) toast.dismiss(reconnectToastId);
    };
  }, [queryClient, lang]);

  return { isConnected };
}
