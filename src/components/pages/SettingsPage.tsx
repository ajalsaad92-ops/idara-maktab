import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Shield, Bell, Settings, Lock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PERMISSIONS = [
  { key: "view_all_employees", label: "عرض جميع الموظفين" },
  { key: "create_employee", label: "إضافة موظف" },
  { key: "edit_employee", label: "تعديل بيانات موظف" },
  { key: "delete_employee", label: "حذف موظف" },
  { key: "create_task", label: "إنشاء مهمة" },
  { key: "assign_task", label: "تكليف مهمة لموظف" },
  { key: "transfer_task", label: "تحويل مهمة" },
  { key: "view_all_tasks", label: "عرض جميع المهام" },
  { key: "view_productivity", label: "عرض جدول الإنتاجية" },
  { key: "view_attendance", label: "عرض سجل الحضور" },
  { key: "approve_exit_request", label: "الموافقة على طلبات الخروج" },
  { key: "export_reports", label: "تصدير التقارير" },
  { key: "manage_departments", label: "إدارة الأقسام" },
  { key: "view_audit_log", label: "عرض سجل المراجعة" },
  { key: "manage_settings", label: "تعديل الإعدادات" },
];

const ROLES = [
  { key: "employee", label: "موظف" },
  { key: "manager", label: "مدير مكتب" },
  { key: "admin", label: "مدير عام" },
];

// Default permissions on first load
const DEFAULTS: Record<string, Record<string, boolean>> = {
  employee: {},
  manager: {
    create_task: true,
    assign_task: true,
    transfer_task: true,
    view_all_tasks: true,
    view_productivity: true,
    view_attendance: true,
    approve_exit_request: true,
    export_reports: true,
    view_all_employees: true,
  },
  admin: Object.fromEntries(PERMISSIONS.map(p => [p.key, true])),
};

interface PermRow {
  role: string;
  permission_key: string;
  is_granted: boolean;
}

export function SettingsPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState("");
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("16:00");
  const [maxExitHours, setMaxExitHours] = useState("2");
  const [notifications, setNotifications] = useState({
    task_assigned: true,
    task_commented: true,
    check_in_reminder: true,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("settings").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  // Initialize settings from DB
  useEffect(() => {
    if (!settings) return;
    for (const s of settings) {
      if (s.key === "org_name" && s.value?.text) setOrgName(s.value.text);
      if (s.key === "work_start" && s.value?.text) setWorkStart(s.value.text);
      if (s.key === "work_end" && s.value?.text) setWorkEnd(s.value.text);
      if (s.key === "max_exit_hours" && s.value?.number) setMaxExitHours(String(s.value.number));
      if (s.key === "notification_config" && s.value) setNotifications(s.value);
    }
  }, [settings]);

  // Permissions data
  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("role_permissions").select("*");
      if (error) throw error;
      return data as PermRow[];
    },
    staleTime: 60_000,
  });

  // Build permissions map from DB + defaults
  const buildPermMap = (): Record<string, Record<string, boolean>> => {
    const map: Record<string, Record<string, boolean>> = {};
    for (const r of ROLES) {
      map[r.key] = { ...DEFAULTS[r.key] };
    }
    if (permData) {
      for (const p of permData) {
        if (!map[p.role]) map[p.role] = {};
        map[p.role][p.permission_key] = p.is_granted;
      }
    }
    return map;
  };

  const [permMap, setPermMap] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (permData !== undefined) {
      setPermMap(buildPermMap());
    }
  }, [permData]);

  // Toggle permission and auto-save
  const togglePerm = async (roleKey: string, permKey: string, current: boolean) => {
    const newVal = !current;
    // Optimistic update
    setPermMap(prev => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], [permKey]: newVal },
    }));

    const { error } = await (supabase as any).from("role_permissions").upsert(
      { role: roleKey, permission_key: permKey, is_granted: newVal },
      { onConflict: "role,permission_key" },
    );
    if (error) {
      toast.error(error.message);
      // Revert
      setPermMap(buildPermMap());
    } else {
      toast.success(t("saved") || "تم الحفظ ✓");
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    }
  };

  const handleSave = async () => {
    const { error } = await (supabase as any).from("settings").upsert([
      { key: "org_name", value: { text: orgName } },
      { key: "work_start", value: { text: workStart } },
      { key: "work_end", value: { text: workEnd } },
      { key: "max_exit_hours", value: { number: parseFloat(maxExitHours) } },
      { key: "notification_config", value: notifications },
    ]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("saved") || "تم الحفظ");
    }
  };

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t("admin_only") || "هذه الصفحة للمدير فقط"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold hidden sm:block">{t("settings") || "الإعدادات"}</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 me-1" />
            {t("general") || "عام"}
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 me-1" />
            {t("permissions") || "الصلاحيات"}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 me-1" />
            {t("notifications") || "الإشعارات"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>{t("org_name") || "اسم المؤسسة"}</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="المراقب" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("work_start") || "بداية يوم العمل"}</Label>
                <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("work_end") || "نهاية يوم العمل"}</Label>
                <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("max_exit_hours") || "الحد الأقصى للخروج (ساعات)"}</Label>
              <Input type="number" value={maxExitHours} onChange={(e) => setMaxExitHours(e.target.value)} min="0" max="8" />
            </div>
          </Card>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            <Save className="h-4 w-4 me-1" />
            {t("save") || "حفظ"}
          </Button>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4 pt-4">
          {permLoading ? (
            <Card className="p-4">
              <p className="text-muted-foreground animate-pulse">{t("loading") || "جاري التحميل..."}</p>
            </Card>
          ) : (
            <>
              {/* Desktop/Tablet table view */}
              <Card className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">{t("permission") || "الصلاحية"}</TableHead>
                      {ROLES.map(r => (
                        <TableHead key={r.key} className="text-center min-w-[120px]">
                          <div className="flex items-center justify-center gap-1">
                            {r.label}
                            {r.key === "admin" && <Lock className="h-3 w-3 text-accent" />}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSIONS.map(perm => (
                      <TableRow key={perm.key}>
                        <TableCell className="font-medium">{perm.label}</TableCell>
                        {ROLES.map(r => {
                          const isGranted = permMap[r.key]?.[perm.key] ?? DEFAULTS[r.key]?.[perm.key] ?? false;
                          const isLocked = r.key === "admin";
                          return (
                            <TableCell key={r.key} className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={isGranted}
                                  disabled={isLocked}
                                  onCheckedChange={() => {
                                    if (!isLocked) togglePerm(r.key, perm.key, isGranted);
                                  }}
                                  className={isLocked ? "border-accent data-[state=checked]:bg-accent data-[state=checked]:border-accent" : ""}
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile card view - one card per role */}
              <div className="md:hidden space-y-3">
                {ROLES.map(r => {
                  const isLocked = r.key === "admin";
                  return (
                    <Card key={r.key} className="p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <p className="font-bold text-sm flex items-center gap-1">
                          {r.label}
                          {isLocked && <Lock className="h-3 w-3 text-accent" />}
                        </p>
                        {isLocked && (
                          <span className="text-[9px] text-muted-foreground">{t("locked") || "مقفلة"}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {PERMISSIONS.map(perm => {
                          const isGranted = permMap[r.key]?.[perm.key] ?? DEFAULTS[r.key]?.[perm.key] ?? false;
                          return (
                            <div key={perm.key} className="flex items-center justify-between text-[11px] py-1">
                              <span className="text-muted-foreground truncate flex-1">{perm.label}</span>
                              <Checkbox
                                checked={isGranted}
                                disabled={isLocked}
                                onCheckedChange={() => {
                                  if (!isLocked) togglePerm(r.key, perm.key, isGranted);
                                }}
                                className={isLocked ? "border-accent data-[state=checked]:bg-accent data-[state=checked]:border-accent ms-2" : "ms-2"}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            <Lock className="h-3 w-3 inline me-1" />
            {t("admin_locked_hint") || "صلاحيات المدير العام مقفلة ولا يمكن تعديلها"}
          </p>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 pt-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t("task_assigned_notifications") || "إشعارات تكليف المهام"}</Label>
              <Switch checked={notifications.task_assigned} onCheckedChange={(v) => setNotifications({ ...notifications, task_assigned: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("task_commented_notifications") || "إشعارات التعليقات"}</Label>
              <Switch checked={notifications.task_commented} onCheckedChange={(v) => setNotifications({ ...notifications, task_commented: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("check_in_reminder_notifications") || "تذكير الحضور"}</Label>
              <Switch checked={notifications.check_in_reminder} onCheckedChange={(v) => setNotifications({ ...notifications, check_in_reminder: v })} />
            </div>
          </Card>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            <Save className="h-4 w-4 me-1" />
            {t("save") || "حفظ"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
