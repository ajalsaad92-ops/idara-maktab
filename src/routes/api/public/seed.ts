import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seed")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const ensureUser = async (
          email: string,
          password: string,
          full_name: string,
          role: "admin" | "manager" | "employee",
          department?: string,
        ) => {
          // Look up
          let userId: string | undefined;
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = list?.users?.find((u) => u.email === email);
          if (existing) {
            userId = existing.id;
          } else {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name },
            });
            if (error) throw new Error(`create ${email}: ${error.message}`);
            userId = data.user!.id;
          }
          // profile
          await supabaseAdmin.from("profiles").upsert({
            id: userId!,
            full_name,
            department: department ?? null,
          });
          // role: ensure desired role is present (and remove default 'employee' if upgrading)
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId!);
          await supabaseAdmin.from("user_roles").insert({ user_id: userId!, role });
          return userId!;
        };

        const existingAdmin = await supabaseAdmin.from("profiles").select("id, full_name").eq("full_name", "أحمد المدير").single();
        if (existingAdmin.data) {
          return new Response(JSON.stringify({ ok: true, message: "Already seeded" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const adminId = await ensureUser("admin@test.com", "Admin1234", "أحمد المدير", "admin", "الإدارة العامة");
        const managerId = await ensureUser("manager@test.com", "Manager1234", "خالد المدير", "manager", "مكتب المحافظ");
        const employeeId = await ensureUser("employee@test.com", "Employee1234", "علي الموظف", "employee", "الشؤون الإدارية");

        const dummies = [
          { email: "fatima@test.com", name: "فاطمة حسن", dept: "الأرشيف" },
          { email: "mohammed@test.com", name: "محمد عبدالله", dept: "المراسلات" },
          { email: "sara@test.com", name: "سارة كريم", dept: "المتابعة" },
          { email: "yousef@test.com", name: "يوسف ناصر", dept: "الكتابة" },
          { email: "layla@test.com", name: "ليلى محمود", dept: "الشؤون الإدارية" },
        ];
        const dummyIds: string[] = [];
        for (const d of dummies) {
          const id = await ensureUser(d.email, "Demo1234!", d.name, "employee", d.dept);
          dummyIds.push(id);
        }

        const allEmployees = [employeeId, ...dummyIds];

        const now = new Date();
        for (let d = 2; d >= 0; d--) {
          for (const uid of allEmployees) {
            const day = new Date(now);
            day.setDate(now.getDate() - d);
            const dateStr = day.toISOString().slice(0, 10);
            
            const { data: existingAttendance } = await supabaseAdmin
              .from("attendance")
              .select("id")
              .eq("user_id", uid)
              .eq("event_date", dateStr)
              .limit(1);
            
            if (existingAttendance && existingAttendance.length > 0) {
              continue;
            }
            
            const inAt = new Date(day);
            inAt.setHours(8, Math.floor(Math.random() * 30), 0, 0);
            const outAt = new Date(day);
            outAt.setHours(10 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
            const backAt = new Date(outAt.getTime() + (30 + Math.random() * 60) * 60_000);
            const endAt = new Date(day);
            endAt.setHours(15, 0, 0, 0);
            await supabaseAdmin.from("attendance").insert([
              { user_id: uid, event_type: "in", event_at: inAt.toISOString(), event_date: dateStr },
              { user_id: uid, event_type: "out", reason: "معاملة رسمية", event_at: outAt.toISOString(), event_date: dateStr },
              { user_id: uid, event_type: "in", event_at: backAt.toISOString(), event_date: dateStr },
              { user_id: uid, event_type: "out", reason: "نهاية الدوام", event_at: endAt.toISOString(), event_date: dateStr },
            ]);
          }
        }

        const sampleTasks = [
          { title: "إعداد تقرير شهري للمحافظ", type: "writing", priority: "important", status: "in_progress" },
          { title: "أرشفة مراسلات شهر الماضي", type: "archiving", priority: "normal", status: "new" },
          { title: "متابعة طلب وزارة الداخلية", type: "follow_up", priority: "urgent", status: "in_progress" },
          { title: "مراسلة مكتب رئيس الوزراء", type: "correspondence", priority: "urgent", status: "new" },
          { title: "كتابة مذكرة اجتماع الأسبوع", type: "writing", priority: "normal", status: "completed" },
          { title: "أرشفة قرارات المجلس", type: "archiving", priority: "normal", status: "completed" },
          { title: "متابعة شكاوى المواطنين", type: "follow_up", priority: "important", status: "in_progress" },
          { title: "إعداد جدول أعمال الاجتماع", type: "writing", priority: "important", status: "new" },
          { title: "مراسلة الدوائر الحكومية", type: "correspondence", priority: "normal", status: "in_progress" },
          { title: "تنظيم ملفات الموظفين", type: "other", priority: "normal", status: "new" },
        ] as const;
        const future = (days: number) => {
          const d = new Date();
          d.setDate(d.getDate() + days);
          return d.toISOString().slice(0, 10);
        };

        for (let i = 0; i < sampleTasks.length; i++) {
          const t = sampleTasks[i];
          
          const { data: existingTask } = await supabaseAdmin
            .from("tasks")
            .select("id")
            .eq("title", t.title)
            .limit(1);
          
          if (existingTask && existingTask.length > 0) {
            continue;
          }
          
          const assignees = [allEmployees[i % allEmployees.length]];
          if (i % 3 === 0) assignees.push(allEmployees[(i + 1) % allEmployees.length]);
          const { data: task, error: te } = await supabaseAdmin
            .from("tasks")
            .insert({
              title: t.title,
              type: t.type,
              priority: t.priority,
              status: t.status,
              deadline: future(2 + i),
              description: "مهمة تم إنشاؤها كبيانات تجريبية لاختبار النظام.",
              created_by: managerId,
            })
            .select()
            .single();
          if (te || !task) continue;
          for (const uid of assignees) {
            const { data: existingAssignment } = await supabaseAdmin
              .from("task_assignments")
              .select("id")
              .eq("task_id", task.id)
              .eq("user_id", uid)
              .limit(1);
            
            if (!existingAssignment || existingAssignment.length === 0) {
              await supabaseAdmin.from("task_assignments").insert({
                task_id: task.id,
                user_id: uid,
                assigned_by: managerId,
                is_active: true,
              });
            }
            
            const { data: existingNotification } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("related_task_id", task.id)
              .eq("type", "task_assigned")
              .limit(1);
            
            if (!existingNotification || existingNotification.length === 0) {
              await supabaseAdmin.from("notifications").insert({
                user_id: uid,
                type: "task_assigned",
                message: `مهمة جديدة: ${t.title}`,
                related_task_id: task.id,
              });
            }
          }
          if (i % 2 === 0) {
            await supabaseAdmin.from("task_comments").insert({
              task_id: task.id,
              user_id: assignees[0],
              comment: "بدأت العمل على هذه المهمة.",
            });
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
