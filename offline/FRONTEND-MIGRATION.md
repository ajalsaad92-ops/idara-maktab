# دليل تحويل الواجهة الأمامية للعمل مع السيرفر المحلي

> **للمطوّر فقط** — هذا هو ما يجب تغييره في كود React ليتصل بالسيرفر المحلي بدلاً من Lovable Cloud.

## الوضع الحالي

تم إنشاء **بنية السيرفر المحلي كاملة** في مجلد `offline/`:
- ✅ خادم Node.js + Express يعمل على المنفذ 3000
- ✅ قاعدة بيانات PostgreSQL محلية مع كل الجداول
- ✅ مصادقة JWT بديلة عن Supabase Auth
- ✅ REST API يطابق واجهة Supabase تقريبًا (`/api/db/:table`)
- ✅ سكربتات تثبيت ونسخ احتياطي للويندوز
- ✅ يخدم الـ frontend من مجلد `offline/public/`

## ما تبقى — تعديل الواجهة (Frontend)

التطبيق الحالي يستورد:
```ts
import { supabase } from "@/integrations/supabase/client";
```

ويستخدم استدعاءات مثل:
```ts
const { data } = await supabase.from("tasks").select("*").eq("status", "new");
const { error } = await supabase.auth.signInWithPassword({ email, password });
```

### الخطوات المطلوبة لاحقًا (في أدوار قادمة)

#### 1. إنشاء عميل API محلي بديل
ملف جديد `src/integrations/local-api/client.ts`:
```ts
const API_BASE = "/api";

async function request(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || "خطأ");
  return res.json();
}

// محاكاة واجهة supabase.from()
export const db = {
  from(table: string) {
    return {
      select: () => request(`/db/${table}`),
      insert: (data: any) => request(`/db/${table}`, { method: "POST", body: JSON.stringify(data) }),
      update: (data: any) => ({
        eq: (col: string, val: any) =>
          request(`/db/${table}/${val}`, { method: "PATCH", body: JSON.stringify(data) }),
      }),
      delete: () => ({
        eq: (col: string, val: any) =>
          request(`/db/${table}/${val}`, { method: "DELETE" }),
      }),
      // ... وهكذا
    };
  },
};

export const auth = {
  signIn: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
      .then((r) => {
        localStorage.setItem("auth_token", r.token);
        return r;
      }),
  signOut: () => request("/auth/logout", { method: "POST" }).finally(() => localStorage.removeItem("auth_token")),
  getUser: () => request("/auth/me"),
};
```

#### 2. تعديل `src/lib/auth.tsx`
استبدال كل استدعاءات `supabase.auth.*` بـ `auth.*` من العميل المحلي.

#### 3. استبدال كل `supabase.from(...)` في:
- `src/components/pages/*.tsx` (11 صفحة)
- `src/lib/queries/*` (إن وُجد)
- `src/lib/admin.functions.ts`

عددها التقديري: **30-50 موضع** عبر المشروع.

#### 4. حذف
- مجلد `src/integrations/supabase/` بالكامل
- استيرادات `@/integrations/supabase/client`
- مكتبة `@supabase/supabase-js` من package.json
- ملفات `*.functions.ts` و `*.server.ts` المتعلقة بـ TanStack Start (لأن السيرفر المحلي يحل محلها)

#### 5. تعديل إعدادات البناء (Vite)
- تعطيل SSR في `vite.config.ts`
- إنتاج SPA ثابت في `dist/`
- إضافة سكربت: `npm run build:offline` → ينسخ `dist/` إلى `offline/public/`

#### 6. متغير بيئة للتحكم بالوضع
```ts
const isOffline = import.meta.env.VITE_OFFLINE_MODE === "true";
```
بهذا يمكن الاحتفاظ بنسختين تعملان من نفس الكود.

## أولويات التنفيذ المقترحة

| الأولوية | المهمة | الوقت المتوقع |
|---|---|---|
| 🔴 P0 | عميل API محلي + تعديل `auth.tsx` | جلسة كاملة |
| 🔴 P0 | تعديل صفحات الدخول والإعدادات | جلسة |
| 🟡 P1 | صفحات الحضور والمهام | جلستان |
| 🟡 P1 | لوحة المدير والتقارير | جلسة |
| 🟢 P2 | الإشعارات والمرفقات | جلسة |
| 🟢 P2 | إعداد بناء offline + اختبار شامل | جلسة |

## كيفية الاختبار محليًا (للمطوّر)

```bash
# على جهاز التطوير:
cd offline
cp .env.example .env  # عدّل القيم
npm install
node init-db.mjs      # يفترض Postgres مثبت
node server.mjs       # على http://localhost:3000

# في نافذة أخرى — بناء الواجهة ووضعها داخل offline/public/
cd ..
npm run build         # ينتج dist/
cp -r dist/* offline/public/
```
