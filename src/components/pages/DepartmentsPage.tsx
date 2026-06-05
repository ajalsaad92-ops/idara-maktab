import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export function DepartmentsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [newDept, setNewDept] = useState("");

  const { data: departments, refetch } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("departments").select("*, profiles:head_user_id (full_name)");
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
    const { error } = await (supabase as any).from("departments").insert({ name_ar: newDept.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("success") || "تم الإنشاء");
      setNewDept("");
      refetch();
    }
  };

  const filtered = (departments ?? []).filter((d: any) => !search || d.name_ar?.includes(search));
  const deptCounts = (profiles ?? []).reduce((acc: any, p: any) => {
    if (p.department_id) {
      acc[p.department_id] = (acc[p.department_id] || 0) + 1;
    }
    return acc;
  }, {});

  return (
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
