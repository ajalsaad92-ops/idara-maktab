import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { fmtDateTime } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/employee/EmployeeDashboard";
import { TaskAttachments } from "@/components/tasks/TaskAttachments";
import { toast } from "sonner";
import { Loader2, Send, ArrowRightLeft, Share2, Paperclip } from "lucide-react";

type Profile = { id: string; full_name: string };

export function TaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { user, role } = useAuth();
  const [task, setTask] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferNote, setTransferNote] = useState("");
  const [shareWith, setShareWith] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const isMgr = role === "admin" || role === "manager";
  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [tres, ares, allAres, sres, cres, trres, allp] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
        supabase.from("task_assignments").select("*").eq("task_id", taskId).eq("is_active", true),
        supabase.from("task_assignments").select("*").eq("task_id", taskId),
        supabase.from("task_shares").select("*").eq("task_id", taskId),
        supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
        supabase.from("task_transfers").select("*").eq("task_id", taskId).order("transferred_at"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (tres.error) throw tres.error;
      setTask(tres.data);
      setAssignments(ares.data ?? []);
      setAllAssignments(allAres.data ?? []);
      setShares(sres.data ?? []);
      setComments(cres.data ?? []);
      setTransfers(trres.data ?? []);
      const all = (allp.data ?? []) as Profile[];
      setAllProfiles(all);
      const map: Record<string, Profile> = {};
      all.forEach((p) => (map[p.id] = p));
      setProfiles(map);
      setNewStatus(tres.data?.status ?? "");
    } catch (err: any) {
      toast.error(err?.message || t("error_generic"));
    }
  }, [taskId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!task) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <p className="p-8 text-center">{t("loading")}</p>
        </DialogContent>
      </Dialog>
    );
  }

  const updateStatus = async () => {
    if (newStatus === "completed" && comments.length === 0) {
      toast.error(t("complete_requires_comment"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("tasks").update({ status: newStatus as any }).eq("id", taskId);
    setBusy(false);
    if (error) return toast.error(error.message);
    // Notify task creator and managers when task is completed
    if (newStatus === "completed" && user) {
      try {
        const recipients = new Set<string>();
        if (task.created_by && task.created_by !== user.id) recipients.add(task.created_by);
        // Fetch managers/admins
        const { data: mgrRoles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "manager"]);
        (mgrRoles ?? []).forEach((r: any) => { if (r.user_id !== user.id) recipients.add(r.user_id); });
        for (const uid of recipients) {
          await supabase.from("notifications").insert({
            user_id: uid,
            type: "task_completed",
            message: `تم إكمال المهمة: ${task.title}`,
            related_task_id: taskId,
            link_data: { route: "/tasks", task_id: taskId } as any,
          });
        }
      } catch { /* non-critical */ }
    }
    toast.success(t("update_status"));
    load();
  };

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: user.id,
      comment: newComment.trim(),
    });
    if (!error) {
      // notify other participants
      const recipients = new Set<string>();
      assignments.forEach((a) => recipients.add(a.user_id));
      shares.forEach((s) => recipients.add(s.shared_with_user_id));
      if (task.created_by) recipients.add(task.created_by);
      recipients.delete(user.id);
      for (const uid of recipients) {
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "task_commented",
          message: `تعليق جديد على: ${task.title}`,
          related_task_id: taskId,
          link_data: { route: "/tasks", task_id: taskId } as any,
        });
      }
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewComment("");
    load();
  };

  const transferTask = async () => {
    if (!transferTo || !user) return;
    setBusy(true);
    // deactivate existing assignments but keep them for audit
    await supabase.from("task_assignments").update({ is_active: false }).eq("task_id", taskId);
    // add new assignment
    const { error: ae } = await supabase.from("task_assignments").insert({
      task_id: taskId,
      user_id: transferTo,
      assigned_by: user.id,
      is_active: true,
    });
    // transfer record
    const fromUser = assignments[0]?.user_id ?? user.id;
    await supabase.from("task_transfers").insert({
      task_id: taskId,
      from_user_id: fromUser,
      to_user_id: transferTo,
      transferred_by: user.id,
      note: transferNote || null,
    });
    await supabase.from("notifications").insert({
      user_id: transferTo,
      type: "task_transferred_in",
      message: `تم نقل مهمة إليك: ${task.title}`,
      related_task_id: taskId,
      link_data: { route: "/tasks", task_id: taskId } as any,
    });
    setBusy(false);
    if (ae) return toast.error(ae.message);
    setTransferTo("");
    setTransferNote("");
    toast.success(t("transfer"));
    load();
  };

  const shareTask = async () => {
    if (!shareWith || !user) return;
    setBusy(true);
    const { error } = await supabase.from("task_shares").insert({
      task_id: taskId,
      shared_with_user_id: shareWith,
      shared_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setShareWith("");
    load();
  };

  const candidateUsers = allProfiles.filter((p) => p.id !== user?.id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
          <div className="flex gap-2 flex-wrap pt-2">
            <Badge variant="outline">{t(task.type as any)}</Badge>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.deadline && <Badge variant="secondary">{t("deadline")}: {fmtDateTime(task.deadline)}</Badge>}
          </div>
        </DialogHeader>

        {task.description && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">{task.description}</div>
        )}

        <div className="text-xs text-muted-foreground">
          {t("assigned_to")}: {assignments.map((a) => profiles[a.user_id]?.full_name).filter(Boolean).join("، ") || "—"}
          {shares.length > 0 && (
            <> · {t("share_with")}: {shares.map((s) => profiles[s.shared_with_user_id]?.full_name).filter(Boolean).join("، ")}</>
          )}
        </div>

        <Tabs defaultValue="status">
          <TabsList className="flex flex-wrap h-auto w-full">
            <TabsTrigger value="status" className="flex-1 min-w-[70px]">{t("status")}</TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 min-w-[90px]">{t("comments")} ({comments.length})</TabsTrigger>
            <TabsTrigger value="attachments" className="flex-1 min-w-[100px]"><Paperclip className="h-3 w-3 me-1" /> {t("attachments")}</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-[70px]">{t("history")}</TabsTrigger>
            <TabsTrigger value="share" className="flex-1 min-w-[90px]">{t("share_with")}</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-3 pt-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">{t("status")}</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t("new")}</SelectItem>
                    <SelectItem value="in_progress">{t("in_progress")}</SelectItem>
                    <SelectItem value="completed">{t("completed")}</SelectItem>
                    {isMgr && <SelectItem value="archived">{t("archived")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={updateStatus} disabled={busy || newStatus === task.status}>
                {t("update_status")}
              </Button>
            </div>

            <Separator />
            <div>
              <h4 className="font-semibold flex items-center gap-2 text-sm"><ArrowRightLeft className="h-4 w-4" /> {t("transfer")}</h4>
              <div className="grid md:grid-cols-2 gap-2 mt-2">
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger><SelectValue placeholder={t("transfer_to")} /></SelectTrigger>
                  <SelectContent>
                    {candidateUsers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder={t("transfer_note")}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  rows={1}
                />
              </div>
              <Button onClick={transferTask} disabled={busy || !transferTo} className="mt-2" size="sm">
                {t("transfer")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-3 pt-3">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">{t("no_data")}</p>}
              {comments.map((c) => (
                <div key={c.id} className="bg-accent/50 rounded p-2 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-semibold">{profiles[c.user_id]?.full_name ?? "—"}</span>
                    <span>{fmtDateTime(c.created_at)}</span>
                  </div>
                  <p>{c.comment}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t("add_comment")}
                rows={2}
              />
              <Button onClick={addComment} disabled={busy || !newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-3 pt-3">
            <TaskAttachments taskId={taskId} />
          </TabsContent>

          <TabsContent value="history" className="space-y-2 pt-3">
            {transfers.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">{t("no_data")}</p>}
            {transfers.map((tr) => (
              <div key={tr.id} className="text-sm border-s-2 border-primary ps-3 py-1">
                <p>
                  <ArrowRightLeft className="inline h-3 w-3 me-1" />
                  {profiles[tr.from_user_id]?.full_name ?? "—"} → {profiles[tr.to_user_id]?.full_name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(tr.transferred_at)}</p>
                {tr.note && <p className="text-xs italic">{tr.note}</p>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="share" className="space-y-3 pt-3">
            <div className="flex gap-2">
              <Select value={shareWith} onValueChange={setShareWith}>
                <SelectTrigger><SelectValue placeholder={t("share_with")} /></SelectTrigger>
                <SelectContent>
                  {candidateUsers
                    .filter((p) => !shares.some((s) => s.shared_with_user_id === p.id))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={shareTask} disabled={busy || !shareWith}>
                <Share2 className="h-4 w-4 me-2" /> {t("share_with")}
              </Button>
            </div>
            <ul className="text-sm space-y-1">
              {shares.map((s) => (
                <li key={s.id} className="px-2 py-1 bg-accent/50 rounded">
                  {profiles[s.shared_with_user_id]?.full_name ?? "—"} · {fmtDateTime(s.shared_at)}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
