import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, Building2, Trash2, Pencil, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

export default function DepartmentsTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments"],
      queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*, profiles:head_user_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const { data: employees } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("departments").insert({
        name_ar: nameAr,
        name_en: nameEn || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setOpenCreate(false);
      setNameAr("");
      setNameEn("");
      toast.success(t("department_created") || "Department created");
    },
    onError: (err: any) => toast.error(err?.message || t("error_generic")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success(t("department_deleted") || "Department deleted");
    },
    onError: (err: any) => toast.error(err?.message || t("error_generic")),
  });

  const getEmployeeCount = (deptId: string) => {
    return employees?.filter((e: any) => e.department_id === deptId).length || 0;
  };

  const getDeptScore = (deptId: string) => {
    const deptEmployees = employees?.filter((e: any) => e.department_id === deptId);
    if (!deptEmployees?.length) return 0;
    // This would need actual productivity data, returning placeholder
    return 75;
  };

  if (isLoading) {
    return <div className="p-8 text-center">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">{t("departments") || "الأقسام"}</h3>
        <Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 me-1" /> {t("add_department") || "إضافة قسم"}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments?.map((dept: any) => (
          <Card key={dept.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{dept.name_ar}</h4>
                  {dept.name_en && <p className="text-xs text-muted-foreground">{dept.name_en}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(dept)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(dept.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-surface p-2 rounded">
                <p className="text-muted-foreground text-xs">{t("employees") || "الموظفون"}</p>
                <p className="font-semibold flex items-center gap-1">
                  <Users className="h-3 w-3" /> {getEmployeeCount(dept.id)}
                </p>
              </div>
              <div className="bg-surface p-2 rounded">
                <p className="text-muted-foreground text-xs">{t("score") || "النتيجة"}</p>
                <p className="font-semibold">{getDeptScore(dept.id)}%</p>
              </div>
            </div>
            {dept.profiles?.full_name && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("head") || "المدير"}: {dept.profiles.full_name}
              </p>
            )}
          </Card>
        ))}
        {departments?.length === 0 && (
          <EmptyState icon={<Building2 className="h-12 w-12 text-muted-foreground/50" />} title={t("no_data")} description={t("no_results_found")} />
        )}
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add_department") || "إضافة قسم"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("name_ar") || "الاسم (عربي)"}</label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("name_en") || "الاسم (إنجليزي)"}</label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!nameAr.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
