import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DepartmentsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [newDept, setNewDept] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editDept, setEditDept] = useState<{ id: string; name_ar: string; head_user_id: string | null } | null>(null);
  const [editForm, setEditForm] = useState({ name_ar: "", head_user_id: "" });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: departments, refetch } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*, profiles:head_user_id (full_name)");
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

  const handleCreate = async () => {
    if (!newDept.trim()) return;
    const { error } = await supabase.from("departments").insert({ name_ar: newDept.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("success") || "تم الإنشاء");
      setNewDept("");
      refetch();
    }
  };

  const openEdit = (d: any) => {
    setEditDept(d);
    setEditForm({ name_ar: d.name_ar || "", head_user_id: d.head_user_id || "" });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editForm.name_ar.trim() || !editDept) return;
    const { error } = await supabase
      .from("departments")
      .update({ name_ar: editForm.name_ar.trim(), head_user_id: editForm.head_user_id || null })
      .eq("id", editDept.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("success") || "تم التحديث");
      setEditOpen(false);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("departments").delete().eq("id", deleteId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("success") || "تم الحذف");
      setDeleteId(null);
      refetch();
    }
  };

  const filtered = (departments ?? []).filter((d: any) => !search || d.name_ar?.toLowerCase().includes(search.toLowerCase()));
  const deptCounts = (profiles ?? []).reduce((acc: any, p: any) => {
    if (p.department_id) {
      acc[p.department_id] = (acc[p.department_id] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold hidden sm:block">{t("departments") || "الأقسام"}</h1>
        
        <div className="flex gap-2 flex-wrap w-full items-center">
          <div className="relative flex-1 sm:flex-initial min-w-0">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t("search")} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="ps-8 w-full sm:w-48 h-9 text-xs sm:text-sm" 
            />
          </div>
          <Input 
            placeholder={t("new_department") || "قسم جديد"} 
            value={newDept} 
            onChange={(e) => setNewDept(e.target.value)} 
            className="w-full sm:w-48 h-9 text-xs sm:text-sm flex-1 sm:flex-initial" 
          />
          <Button onClick={handleCreate} className="h-9 text-xs sm:text-sm shrink-0">
            <Plus className="h-4 w-4 me-1" />
            {t("add") || "إضافة"}
          </Button>
        </div>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("head") || "الرئيس"}</TableHead>
                <TableHead>{t("employees_count") || "عدد الموظفين"}</TableHead>
                <TableHead>{t("actions") || "الإجراءات"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <EmptyState 
                      icon={<Building2 className="h-12 w-12 text-muted-foreground/50" />}
                      title={t("no_data")} 
                      description={t("no_departments_desc") || "لا توجد أقسام"}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name_ar}</TableCell>
                    <TableCell>{d.profiles?.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{deptCounts[d.id] || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)} title={t("edit") || "تعديل"}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(d.id)} title={t("delete") || "حذف"}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("edit_department") || "تعديل القسم"}</DialogTitle>
            <DialogDescription>{t("edit_department_desc") || "قم بتحديث بيانات القسم"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("name") || "اسم القسم"} *</Label>
              <Input value={editForm.name_ar} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("head") || "رئيس القسم"}</Label>
              <Select value={editForm.head_user_id} onValueChange={(v) => setEditForm({ ...editForm, head_user_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("select_head") || "اختر رئيس القسم"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— {t("no_head") || "بدون رئيس"}</SelectItem>
                  {(profiles ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel") || "إلغاء"}</Button>
            <Button onClick={handleEdit} disabled={!editForm.name_ar.trim()}>{t("save") || "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirm_delete") || "تأكيد الحذف"}</DialogTitle>
            <DialogDescription>{t("confirm_delete_dept") || "هل تريد حذف هذا القسم؟ لا يمكن التراجع عن هذا الإجراء."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("cancel") || "إلغاء"}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("delete") || "حذف"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
