import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Bell, Check, ClipboardList, MessageSquare, ArrowRightLeft, Clock, Share2, Info, ShieldCheck, ShieldX, MapPin, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";

const iconMap: Record<string, any> = {
  task_assigned: <ClipboardList className="w-4 h-4 text-primary" />,
  task_commented: <MessageSquare className="w-4 h-4 text-blue-500" />,
  task_transferred_in: <ArrowRightLeft className="w-4 h-4 text-orange-500" />,
  task_deadline: <Clock className="w-4 h-4 text-orange-500" />,
  task_overdue: <Clock className="w-4 h-4 text-red-500" />,
  task_shared: <Share2 className="w-4 h-4 text-purple-500" />,
  check_in_reminder: <Clock className="w-4 h-4 text-warning" />,
  exit_approved: <ShieldCheck className="w-4 h-4 text-success" />,
  exit_rejected: <ShieldX className="w-4 h-4 text-danger" />,
  manager_query: <MapPin className="w-4 h-4 text-primary" />,
  attendance_reminder: <Megaphone className="w-4 h-4 text-warning" />,
  default: <Info className="w-4 h-4 text-slate-500" />,
};

export function NotificationsBell() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [bellBouncing, setBellBouncing] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user?.id!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          // Instant cache update - no network round-trip
          queryClient.setQueryData(["notifications", user.id], (old: any[] = []) => {
            const newNotif = payload.new;
            return [newNotif, ...old].slice(0, 30);
          });
          setBellBouncing(true);
          setTimeout(() => setBellBouncing(false), 1000);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          // Instant cache update for read status changes
          queryClient.setQueryData(["notifications", user.id], (old: any[] = []) =>
            old.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user?.id!)
        .eq("is_read", false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData(["notifications", user?.id]);
      queryClient.setQueryData(["notifications", user?.id], (old: any) =>
        old?.map((n: any) => ({ ...n, is_read: true }))
      );
      return { previous };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["notifications", user?.id], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAsReadAndNavigate = useMutation({
    mutationFn: async (notification: any) => {
      if (!notification.is_read) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notification.id);
      }
      return notification;
    },
    onMutate: async (notification) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData(["notifications", user?.id]);
      queryClient.setQueryData(["notifications", user?.id], (old: any) =>
        old?.map((n: any) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      return { previous };
    },
    onSuccess: (notification) => {
      setIsOpen(false);
      const linkData = notification.link_data as any;
      if (linkData?.route) {
        const rawPage = linkData.route.replace(/^\//, "");
        // "/dashboard" or "/" is the default route (no page param needed)
        const page = (rawPage && rawPage !== "dashboard") ? rawPage : undefined;
        navigate({
          to: "/",
          search: { page, task_id: linkData.task_id } as any,
        });
      } else {
        switch (notification.type) {
          case "check_in_reminder":
          case "exit_approved":
          case "exit_rejected":
          case "manager_query":
          case "attendance_reminder":
            navigate({ to: "/" });
            break;
          case "exit_request":
            navigate({ to: "/", search: { page: "exit-requests" } as any });
            break;
          default:
            if (notification.related_task_id) {
              navigate({ to: "/", search: { page: "tasks", task_id: notification.related_task_id } as any });
            } else {
              navigate({ to: "/" });
            }
            break;
        }
      }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["notifications", user?.id], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const unread = items.filter((i: any) => !i.is_read).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-slate-500 hover:text-primary transition-colors hover:bg-slate-50 rounded-full focus:outline-none focus:ring-2 focus:ring-accent">
          <motion.div animate={bellBouncing ? { y: [0, -8, 0, -4, 0], rotate: [0, -10, 10, -5, 5, 0] } : {}} transition={{ duration: 0.6 }}>
            <Bell className="w-5 h-5" />
          </motion.div>
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white"
              >
                {unread}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b bg-slate-50/50">
          <h4 className="font-bold text-slate-800">{t("notifications")}</h4>
          <AnimatePresence>
            {unread > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button variant="ghost" size="sm" onClick={() => markAllAsRead.mutate()} className="text-xs text-primary hover:bg-primary/10">
                  <Check className="h-3 w-3 me-1" /> {t("mark_all_read")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <Bell className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">{t("no_notifications")}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => markAsReadAndNavigate.mutate(n)}
                  className={`flex gap-3 p-4 text-start transition-colors border-b last:border-0 hover:bg-slate-50 ${
                    !n.is_read ? "bg-primary/5" : "bg-white"
                  }`}
                >
                  <div className="mt-1 shrink-0 bg-white p-1.5 rounded-full shadow-sm border border-slate-100">
                    {iconMap[n.type] || iconMap.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                       {n.type === "task_assigned" ? t("task_assigned_notif") || "تم تعيين مهمة جديدة" : n.type === "task_commented" ? t("task_commented_notif") || "تعليق جديد على المهمة" : n.type === "task_deadline" ? t("task_deadline_notif") || "تنبيه موعد المهمة" : n.type === "task_overdue" ? t("task_overdue_notif") || "مهمة متأخرة" : n.type === "check_in_reminder" ? t("check_in_reminder_notif") || "تذكير بالدوام" : n.type === "exit_approved" ? t("exit_approved_notif") || "تمت الموافقة على الخروج" : n.type === "exit_rejected" ? t("exit_rejected_notif") || "تم رفض طلب الخروج" : n.type === "manager_query" ? t("manager_query_notif") || "استفسار من المدير" : n.type === "attendance_reminder" ? t("attendance_reminder_notif") || "تذكير بالحضور" : t("new_notification") || "إشعار جديد"}
                     </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: lang === 'ar' ? ar : enUS })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
