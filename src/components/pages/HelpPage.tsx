import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ClipboardList, FileText, Users, BarChart3 } from "lucide-react";

export function HelpPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">{t("help") || "المساعدة"}</h1>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t("how_it_works") || "كيف يعمل النظام"}</h2>
        
        <Card className="p-4 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t("attendance_workflow") || "دورة الحضور اليومية"}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>{t("attendance_step_1") || "الموظف يصل للمكتب → يضغط تسجيل الدخول"}</li>
            <li>{t("attendance_step_2") || "يريد الخروج → يضغط طلب خروج + يحدد السبب"}</li>
            <li>{t("attendance_step_3") || "يصل الطلب للمدير فورياً → المدير يوافق أو يرفض"}</li>
            <li>{t("attendance_step_4") || "عند الموافقة: يُسجّل وقت الخروج تلقائياً"}</li>
            <li>{t("attendance_step_5") || "عند العودة → يضغط تسجيل العودة"}</li>
            <li>{t("attendance_step_6") || "نهاية اليوم → يضغط إنهاء يوم العمل"}</li>
          </ol>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {t("tasks_workflow") || "دورة المهام"}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>{t("task_step_1") || "المدير ينشئ مهمة + يكلف موظفاً"}</li>
            <li>{t("task_step_2") || "الموظف يرى الإشعار → يفتح المهمة"}</li>
            <li>{t("task_step_3") || "يغير الحالة إلى قيد التنفيذ"}</li>
            <li>{t("task_step_4") || "يضيف تعليقات/تحديثات أثناء العمل"}</li>
            <li>{t("task_step_5") || "يرفق ملفات إن وجدت"}</li>
            <li>{t("task_step_6") || "لإكمال المهمة: يجب إضافة تعليق أولاً ثم تغيير الحالة"}</li>
            <li>{t("task_step_7") || "يمكن تحويل المهمة لموظف آخر مع ملاحظة"}</li>
            <li>{t("task_step_8") || "يمكن مشاركة المهمة مع موظف آخر (يرى ويعلق بدون تحرير)"}</li>
          </ol>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("reports_workflow") || "التقارير والمتابعة"}
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>{t("reports_desc_1") || "المدير يرى لوحة حية بحالة كل موظف"}</li>
            <li>{t("reports_desc_2") || "الضغط على اسم الموظف يفتح ملفه الكامل"}</li>
            <li>{t("reports_desc_3") || "إنتاجية الموظف = (مهام × 10) + (ساعات في المكتب × 2) - (ساعات خارج × 1)"}</li>
            <li>{t("reports_desc_4") || "التقارير الشهرية قابلة للطباعة والتحميل PDF"}</li>
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t("test_scenarios") || "تعليمات الاختبار"}</h2>
        <Card className="p-4 space-y-3">
          <div className="space-y-2">
            <h3 className="font-semibold">{t("scenario_1") || "سيناريو 1: اختبار طلب الخروج"}</h3>
            <p className="text-sm text-muted-foreground">{t("scenario_1_desc") || "سجّل دخول كموظف → اضغط تسجيل الدخول → انتظر 1 دقيقة → اطلب خروجاً → سجّل دخول كمدير → وافق على الطلب → ارجع لحساب الموظف → سجّل العودة"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("scenario_2") || "سيناريو 2: اختبار الإشعارات"}</h3>
            <p className="text-sm text-muted-foreground">{t("scenario_2_desc") || "سجّل دخول كمدير → أنشئ مهمة → كلّف الموظف → سجّل دخول كموظف → افتح الإشعار → الإشعار يأخذك للمهمة"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("scenario_3") || "سيناريو 3: اختبار إكمال المهمة"}</h3>
            <p className="text-sm text-muted-foreground">{t("scenario_3_desc") || "كموظف → افتح المهمة → أضف تعليقاً → غيّر الحالة لـمكتملة"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("scenario_4") || "سيناريو 4: اختبار Drawer الموظف"}</h3>
            <p className="text-sm text-muted-foreground">{t("scenario_4_desc") || "كمدير → افتح جدول الإنتاجية → اضغط على اسم موظف"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("scenario_5") || "سيناريو 5: اختبار الصلاحيات"}</h3>
            <p className="text-sm text-muted-foreground">{t("scenario_5_desc") || "كأدمن → اذهب لإعدادات → إدارة الصلاحيات → امنح المدير صلاحية حذف موظف"}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
