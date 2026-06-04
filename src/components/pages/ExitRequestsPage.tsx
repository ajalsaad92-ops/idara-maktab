import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, User } from "lucide-react";

export function ExitRequestsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNote, setReviewNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["exit_requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exit_requests")
        .select("*, profiles:employee_id (full_name, role)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("exit-requests-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "exit_requests" } as any,
        () => {
          queryClient.invalidateQueries({ queryKey: ["exit_requests"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleApprove = async (req: any) => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const { error: reqError } = await (supabase as any)
      .from("exit_requests")
      .update({ status: "approved", reviewed_by: user?.id, reviewed_at: now.toISOString(), reviewer_note: reviewNote })
      .eq("id", req.id);
    if (reqError) {
      toast.error(reqError.message);
      return;
    }

    const { data: attEvent, error: attError } = await (supabase as any)
      .from("attendance")
      .insert({
        user_id: req.employee_id,
        event_type: "out",
        reason: req.reason_type + (req.reason_text ? ` - ${req.reason_text}` : ""),
        exit_request_id: req.id,
        timestamp: now.toISOString(),
        date: today,
      })
      .select("id")
      .single();
    if (attError) {
      console.error("Attendance insert failed:", attError.message);
    }

    if (attEvent) {
      await (supabase as any)
        .from("exit_requests")
        .update({ attendance_event_id: attEvent.id })
        .eq("id", req.id);
    }

    await (supabase as any).from("notifications").insert({
      user_id: req.employee_id,
      type: "exit_approved",
      message: t("exit_approved_msg") || "تمت الموافقة على طلب خروجك ✅",
      link_data: { route: "/dashboard" },
      is_read: false,
    });

    toast.success(t("approved") || "تمت الموافقة");
    setReviewNote("");
    refetch();
  };

  const handleReject = async (req: any) => {
    const now = new Date();

    const { error: reqError } = await (supabase as any)
      .from("exit_requests")
      .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: now.toISOString(), reviewer_note: rejectNote })
      .eq("id", req.id);
    if (reqError) {
      toast.error(reqError.message);
      return;
    }

    await (supabase as any).from("notifications").insert({
      user_id: req.employee_id,
      type: "exit_rejected",
      message: (t("exit_rejected_msg") || "تم رفض طلب خروجك ❌") + (rejectNote ? ` — ${rejectNote}` : ""),
      link_data: { route: "/dashboard" },
      is_read: false,
    });

    toast.success(t("rejected") || "تم الرفض");
    setRejectingId(null);
    setRejectNote("");
    refetch();
  };

  const pending = (requests ?? []).filter((r: any) => r.status === "pending");
  const history = (requests ?? []).filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("exit_requests") || "طلبات الخروج"}</h1>
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {t("pending") || "معلقة"} 
          {pending.length > 0 && (
            <Badge variant="secondary" className="me-2">{pending.length}</Badge>
          )}
        </h2>
        
        {pending.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{t("no_pending_requests") || "لا توجد طلبات معلقة"}</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pending.map((req: any) => (
              <Card key={req.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold">{req.profiles?.full_name || "—"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {req.reason_type} {req.reason_text ? `- ${req.reason_text}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("duration") || "المدة"}: {req.expected_duration || "—"}
                    </p>
                    {req.note && (
                      <p className="text-sm text-muted-foreground italic">{req.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(req.requested_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {rejectingId === req.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder={t("rejection_reason") || "سبب الرفض"}
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          className="w-48"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleReject(req)}>
                            <XCircle className="h-4 w-4 me-1" />
                            {t("confirm_reject") || "تأكيد الرفض"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectNote(""); }}>
                            {t("cancel") || "إلغاء"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder={t("reviewer_note") || "ملاحظة"}
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          className="w-48"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(req)} className="bg-success hover:bg-success/90 text-white">
                            <CheckCircle className="h-4 w-4 me-1" />
                            {t("approve") || "موافقة"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectingId(req.id)}>
                            <XCircle className="h-4 w-4 me-1" />
                            {t("reject") || "رفض"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("history") || "السجل"}</h2>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("reviewed_at") || "تاريخ المراجعة"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{req.reason_type}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === "approved" ? "default" : "destructive"}>
                        {req.status === "approved" ? (t("approved") || "تمت الموافقة") : (t("rejected") || "مرفوض")}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
