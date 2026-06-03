import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CreateTaskDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("writing");
  const [typeOther, setTypeOther] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [assignee, setAssignee] = useState("");
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("profiles").select("id, full_name").then(({ data }) => setEmployees((data ?? []) as any));
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim() || !assignee || !user) return;
    setBusy(true);
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        type: type as any,
        type_other: type === "other" ? typeOther : null,
        description: description || null,
        priority: priority as any,
        deadline: deadline || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !task) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed");
    }
    await supabase.from("task_assignments").insert({
      task_id: task.id,
      user_id: assignee,
      assigned_by: user.id,
      is_active: true,
    });
    await supabase.from("notifications").insert({
      user_id: assignee,
      type: "task_assigned",
      message: `مهمة جديدة: ${title}`,
      related_task_id: task.id,
    });
    setBusy(false);
    toast.success(t("create_task"));
    onOpenChange(false);
    setTitle(""); setDescription(""); setDeadline(""); setAssignee("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("create_task")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="writing">{t("writing")}</SelectItem>
                  <SelectItem value="archiving">{t("archiving")}</SelectItem>
                  <SelectItem value="correspondence">{t("correspondence")}</SelectItem>
                  <SelectItem value="follow_up">{t("follow_up")}</SelectItem>
                  <SelectItem value="other">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("normal")}</SelectItem>
                  <SelectItem value="important">{t("important")}</SelectItem>
                  <SelectItem value="urgent">{t("urgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "other" && (
            <div>
              <Label>{t("other")}</Label>
              <Input value={typeOther} onChange={(e) => setTypeOther(e.target.value)} className="mt-1" />
            </div>
          )}
          <div>
            <Label>{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("deadline")}</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("assigned_to")}</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !assignee}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
