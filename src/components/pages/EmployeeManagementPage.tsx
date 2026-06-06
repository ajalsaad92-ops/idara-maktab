import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Plus, Eye, Pencil, Trash2, Ban, CheckCircle, KeyRound } from "lucide-react";
import { useEmployeeDrawer } from "@/contexts/EmployeeDrawerContext";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MobileCardList, MobileCard, MobileCardRow } from "@/components/ui/mobile-card-list";

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  department_id?: string;
  phone?: string;
  is_active?: boolean;
  joined_date?: string;
  email?: string;
}

const ROLES = [
  { value: "employee", label: "موظف" },
  { value: "manager", label: "مدير مكتب" },
  { value: "admin", label: "مدير عام" },
];

export function EmployeeManagementPage() {
  const { t } = useI18n();
  const { role, user } = useAuth();
  const { openEmployeeDrawer } = useEmployeeDrawer();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "", email: "", password: "", confirm: "",
    role: "employee", department_id: "", phone: "",
  });
  const [adding, setAdding] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "", role: "employee", department_id: "", phone: "",
  });
  const [editing, setEditing] = useState(false);

  // Password reset dialog
  const [passOpen, setPassOpen] = useState(false);
  const [passId, setPassId] = useState<string | null>(null);
  const [passForm, setPassForm] = useState({ password: "", confirm: "" });
  const [passing, setPassing] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Departments
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("departments").select("id, name_ar, name_en");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await (supabase as any).from("profiles").select("*");
      if (profilesError) throw profilesError;
      const { data: rolesData, error: rolesError } = await (supabase as any).from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;

      return (profilesData || []).map((p: any) => {
        const r = (rolesData || []).find((x: any) => x.user_id === p.id);
        return {
          ...p,
          role: r?.role ?? "employee"
        };
      }) as ProfileRow[];
    },
    staleTime: 60_000,
  });

  // Load settings for org info
  const orgName = "المراقب";

  const filtered = (profiles ?? []).filter((p: ProfileRow) => {
    if (search && !p.full_name?.includes(search) && !p.email?.includes(search)) return false;
    if (filter && filter !== "all") {
      if (filter === "active" && p.is_active === false) return false;
      if (filter === "inactive" && p.is_active !== false) return false;
      if (filter.startsWith("role_") && p.role !== filter.replace("role_", "")) return false;
    }
    return true;
  });

  // ADD EMPLOYEE
  const handleAdd = async () => {
    if (!addForm.full_name || !addForm.email || !addForm.password) {
      toast.error(t("fill_required") || "يرجى ملء الحقول المطلوبة");
      return;
    }
    if (addForm.password !== addForm.confirm) {
      toast.error(t("password_mismatch") || "كلمات المرور غير متطابقة");
      return;
    }
    setAdding(true);
    try {
      if (role !== "admin") {
        throw new Error("Only admins can create employees");
      }
      const { createEmployee } = await import("@/lib/admin.functions");
      await createEmployee({
        data: {
          full_name: addForm.full_name,
          email: addForm.email,
          password: addForm.password,
          role: addForm.role as "admin" | "manager" | "employee",
          department_id: addForm.department_id || null,
          phone: addForm.phone || null,
        },
      });

      toast.success(t("employee_added") || "تم إضافة الموظف بنجاح");
      setAddOpen(false);
      setAddForm({ full_name: "", email: "", password: "", confirm: "", role: "employee", department_id: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setAdding(false);
    }
  };

  // EDIT EMPLOYEE
  const openEdit = (p: ProfileRow) => {
    setEditId(p.id);
    setEditForm({
      full_name: p.full_name || "",
      role: p.role || "employee",
      department_id: p.department_id || "",
      phone: p.phone || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editForm.full_name) {
      toast.error(t("fill_required") || "يرجى ملء الحقول المطلوبة");
      return;
    }
    setEditing(true);
    try {
      if (role !== "admin") {
        throw new Error("Only admins can edit employees");
      }
      const { updateEmployee } = await import("@/lib/admin.functions");
      await updateEmployee({
        data: {
          id: editId!,
          full_name: editForm.full_name,
          role: editForm.role as "admin" | "manager" | "employee",
          department_id: editForm.department_id || null,
          phone: editForm.phone || null,
        }
      });

      toast.success(t("employee_updated") || "تم تحديث بيانات الموظف");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setEditing(false);
    }
  };

  // PASSWORD RESET
  const openPassReset = (id: string) => {
    setPassId(id);
    setPassForm({ password: "", confirm: "" });
    setPassOpen(true);
  };

  const handlePassReset = async () => {
    if (!passForm.password || passForm.password !== passForm.confirm) {
      toast.error(t("password_mismatch") || "كلمات المرور غير متطابقة");
      return;
    }
    setPassing(true);
    try {
      if (passId === user?.id) {
        const { error } = await supabase.auth.updateUser({ password: passForm.password });
        if (error) throw error;
      } else {
        if (role !== "admin") {
          throw new Error("تغيير كلمة مرور موظف آخر يتطلب صلاحية المدير العام");
        }
        const { resetEmployeePassword } = await import("@/lib/admin.functions");
        await resetEmployeePassword({
          data: {
            userId: passId!,
            password: passForm.password,
          }
        });
      }
      toast.success(t("password_reset_success") || "تم تغيير كلمة المرور");
      setPassOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPassing(false);
    }
  };

  // TOGGLE ACTIVE
  const toggleActive = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await (supabase as any).from("profiles").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("success") || "تم التحديث");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // DELETE (soft)
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("profiles").update({ is_active: false }).eq("id", deleteId);
      if (error) throw error;
      toast.success(t("employee_deactivated") || "تم تعطيل الحساب");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const deptName = (id: string) => {
    const d = (departments ?? []).find((dep: any) => dep.id === id);
    return d?.name_ar || d?.name_en || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold hidden sm:block">{t("employees") || "إدارة الموظفين"}</h1>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto items-center">
          <div className="relative flex-1 sm:flex-initial min-w-0">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-8 w-full sm:w-48 h-9 text-xs sm:text-sm"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-xs sm:text-sm flex-1 sm:flex-initial"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{t("all") || "الكل"}</option>
            <option value="active">{t("active") || "نشط"}</option>
            <option value="inactive">{t("inactive") || "معطل"}</option>
            <option value="role_employee">{t("employee") || "موظف"}</option>
            <option value="role_manager">{t("manager") || "مدير"}</option>
            <option value="role_admin">{t("admin") || "أدمن"}</option>
          </select>
          {role === "admin" && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 me-1" />
              {t("add_employee") || "إضافة موظف"}
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("department")}</TableHead>
                <TableHead>{t("phone") || "الهاتف"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions") || "الإجراءات"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <EmptyState
                      icon={<Search className="h-12 w-12 text-muted-foreground/50" />}
                      title={t("no_data")}
                      description={t("no_employees_desc")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p: ProfileRow) => (
                  <TableRow key={p.id}>
                    <TableCell
                      className="font-medium cursor-pointer hover:text-accent"
                      onClick={() => openEmployeeDrawer(p.id)}
                    >
                      {p.full_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                        {ROLES.find(r => r.value === p.role)?.label || p.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.department_id ? deptName(p.department_id) : "—"}</TableCell>
                    <TableCell>{p.phone || "—"}</TableCell>
                    <TableCell>
                      {p.is_active !== false ? (
                        <span className="text-success text-sm">{t("active") || "نشط"}</span>
                      ) : (
                        <span className="text-destructive text-sm">{t("inactive") || "معطل"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEmployeeDrawer(p.id)} title={t("view_details") || "عرض التفاصيل"}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title={t("edit") || "تعديل"}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openPassReset(p.id)} title={t("change_password") || "تغيير كلمة المرور"}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => toggleActive.mutate({ id: p.id, current: p.is_active !== false })}
                          title={p.is_active !== false ? (t("disable") || "تعطيل") : (t("enable") || "تفعيل")}
                        >
                          {p.is_active !== false ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                        </Button>
                        {role === "admin" && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteId(p.id)} title={t("delete") || "حذف"}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <MobileCardList>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-12 w-12 text-muted-foreground/50" />}
              title={t("no_data")}
              description={t("no_employees_desc")}
            />
          ) : (
            filtered.map((p: ProfileRow) => (
              <MobileCard key={p.id}>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs sm:text-sm font-bold truncate flex-1">{p.full_name || "—"}</p>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEmployeeDrawer(p.id)} title={t("view_details") || "عرض"}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(p)} title={t("edit") || "تعديل"}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {role === "admin" && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDeleteId(p.id)} title={t("delete") || "حذف"}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <MobileCardRow label={t("role")} value={
                  <Badge variant={p.role === "admin" ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-4">
                    {ROLES.find(r => r.value === p.role)?.label || p.role}
                  </Badge>
                } />
                <MobileCardRow label={t("department")} value={p.department_id ? deptName(p.department_id) : "—"} />
                <MobileCardRow label={t("phone") || "الهاتف"} value={p.phone || "—"} />
                <MobileCardRow label={t("status")} value={
                  p.is_active !== false ? (
                    <span className="text-success">{t("active") || "نشط"}</span>
                  ) : (
                    <span className="text-destructive">{t("inactive") || "معطل"}</span>
                  )
                } />
              </MobileCard>
            ))
          )}
        </MobileCardList>
      </Card>

      {/* ADD EMPLOYEE DIALOG */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("add_employee") || "إضافة موظف جديد"}</DialogTitle>
            <DialogDescription>{t("add_employee_desc") || "أدخل بيانات الموظف الجديد"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("full_name") || "الاسم الكامل"} *</Label>
              <Input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("email") || "البريد الإلكتروني"} *</Label>
              <Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("password") || "كلمة المرور"} *</Label>
                <Input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("confirm_password") || "تأكيد كلمة المرور"} *</Label>
                <Input type="password" value={addForm.confirm} onChange={(e) => setAddForm({ ...addForm, confirm: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("role") || "الدور"}</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("department") || "القسم"}</Label>
                <Select value={addForm.department_id} onValueChange={(v) => setAddForm({ ...addForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t("none") || "—"} /></SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name_en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("phone") || "رقم الهاتف"}</Label>
              <Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("cancel") || "إلغاء"}</Button>
            <Button onClick={handleAdd} disabled={adding}>{adding ? "..." : (t("add") || "إضافة")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT EMPLOYEE DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("edit_employee") || "تعديل بيانات الموظف"}</DialogTitle>
            <DialogDescription>{t("edit_employee_desc") || "قم بتحديث بيانات الموظف"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("full_name") || "الاسم الكامل"} *</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("role") || "الدور"}</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("department") || "القسم"}</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t("none") || "—"} /></SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name_en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("phone") || "رقم الهاتف"}</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel") || "إلغاء"}</Button>
            <Button onClick={handleEdit} disabled={editing}>{editing ? "..." : (t("save") || "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PASSWORD RESET DIALOG */}
      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("change_password") || "تغيير كلمة المرور"}</DialogTitle>
            <DialogDescription>{t("change_password_desc") || "أدخل كلمة المرور الجديدة"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("new_password") || "كلمة المرور الجديدة"}</Label>
              <Input type="password" value={passForm.password} onChange={(e) => setPassForm({ ...passForm, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("confirm_password") || "تأكيد كلمة المرور"}</Label>
              <Input type="password" value={passForm.confirm} onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPassOpen(false)}>{t("cancel") || "إلغاء"}</Button>
            <Button onClick={handlePassReset} disabled={passing}>{passing ? "..." : (t("save") || "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirm_delete") || "تأكيد التعطيل"}</DialogTitle>
            <DialogDescription>{t("confirm_delete_desc") || "هل تريد تعطيل هذا الحساب؟ لن يتمكن المستخدم من تسجيل الدخول."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("cancel") || "إلغاء"}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "..." : (t("disable") || "تعطيل")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
