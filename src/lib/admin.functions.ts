import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateEmployeeInput = {
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "manager" | "employee";
  department_id?: string | null;
  phone?: string | null;
};

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateEmployeeInput) => {
    if (!input?.email || !input?.password || !input?.full_name) {
      throw new Error("Missing required fields");
    }
    if (input.password.length < 8) throw new Error("Password too short");
    if (!["admin", "manager", "employee"].includes(input.role)) {
      throw new Error("Invalid role");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Create failed");

    const newUserId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: data.full_name,
      department_id: data.department_id ?? null,
      phone: data.phone ?? null,
      is_active: true,
      joined_date: new Date().toISOString().split("T")[0],
    } as any);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });

    return { ok: true, user_id: newUserId };
  });
