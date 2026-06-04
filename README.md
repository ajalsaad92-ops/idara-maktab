# نظام إدارة الموظفين — idara-maktab

A bilingual (Arabic RTL / English LTR) employee management and task tracking system built for an Iraqi government office. Features real-time updates, productivity analytics, attendance tracking with exit request workflows, smart notifications, and PDF reports.

## 📋 Overview

This system manages daily employee attendance (check-in/check-out with exit request approval flow), task assignment and tracking, productivity scoring, and reporting — all in real-time with bilingual Arabic/English support.

## 🚀 Setup

### Requirements
- Node.js 18+
- A Supabase project with the required tables (see migrations below)

### Installation

1. Clone and install:
```bash
git clone https://github.com/ajalsaad92-ops/idara-maktab.git
cd idara-maktab
npm install
```

2. Set environment variables in `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run Supabase migrations (in order):
   - All SQL files in `supabase/migrations/` — apply them via Supabase Dashboard → SQL Editor
   - Key migrations: `20250604_add_productivity_function.sql`, `20260603225711_add_link_data_to_notifications.sql`
   - Tables beyond auto-generated types: `exit_requests`, `settings`, `departments`, `audit_logs`, `role_permissions`, `manager_queries`, `task_attachments`

4. Run the development server:
```bash
npm run dev
```

5. Seed demo data (idempotent — safe to run multiple times):
```bash
curl -X POST http://localhost:3000/api/public/seed
```

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| مدير عام (Admin) | admin@test.com | Admin1234 |
| مدير مكتب (Manager) | manager@test.com | Manager1234 |
| موظف (Employee) | employee@test.com | Employee1234 |

## 👥 Roles & Permissions

| Permission | موظف | مدير مكتب | مدير عام |
|-----------|-------|-----------|---------|
| عرض جميع الموظفين | ❌ | ✅ | ✅ 🔒 |
| إضافة/تعديل/حذف موظف | ❌ | ❌ | ✅ 🔒 |
| إنشاء مهمة | ❌ | ✅ | ✅ 🔒 |
| تكليف/تحويل مهمة | ❌ | ✅ | ✅ 🔒 |
| عرض جميع المهام | ❌ | ✅ | ✅ 🔒 |
| جدول الإنتاجية | ❌ | ✅ | ✅ 🔒 |
| سجل الحضور | ❌ | ✅ | ✅ 🔒 |
| الموافقة على طلبات الخروج | ❌ | ✅ | ✅ 🔒 |
| تصدير التقارير | ❌ | ✅ | ✅ 🔒 |
| إدارة الأقسام | ❌ | ❌ | ✅ 🔒 |
| سجل المراجعة | ❌ | ❌ | ✅ 🔒 |
| تعديل الإعدادات | ❌ | ❌ | ✅ 🔒 |
| استفسار عن موظف | ❌ | ✅ | ✅ 🔒 |

🔒 = Always enabled for admin (locked in UI). Permissions are stored in `role_permissions` table and editable by admin in Settings → Permissions tab.

## 📖 Usage Guide

### للموظف (Employee)

**Daily Attendance Workflow:**
1. Open the app → press "تسجيل الدخول" (green check-in button)
2. To leave: press "طلب خروج" → fill reason, duration, note → submit
3. Manager approves/rejects → notification sent back
4. On approval: press "تسجيل العودة" (blue return button)
5. End of day: press "إنهاء يوم العمل" → daily summary shown

**Tasks:**
- View assigned tasks in dashboard and /my-tasks page
- Update task status (جديدة → قيد التنفيذ → مكتملة)
- Add comments and attachments
- Completion requires at least one comment

**Manager Query:**
- If manager sends "استفسار عن الموظف", a banner appears with 3 response buttons
- If manager sends "تذكير بالحضور", notification arrives

### لمدير المكتب (Manager)

**Employee Monitoring:**
- Real-time status board showing in-office/outside/not-checked-in
- Click employee name → full detail drawer (stats, charts, tasks, attendance)
- "استفسار عن الموظف" button on outside employees
- "تذكير بالحضور" button on absent employees

**Exit Requests:**
- Pending requests arrive in real-time at /exit-requests
- Approve → attendance event created, employee notified
- Reject → employee notified with reason

**Task Management:**
- Create tasks with deadline (date + time)
- Assign to employees or departments
- Transfer tasks (original assignee keeps view access)
- Share tasks (read + comment access)

**Productivity:**
- Bar chart: tasks per employee (completed/in-progress/new)
- Line chart: daily attendance hours (last 14 days)
- Employee performance cards with productivity score

**Attendance Log:**
- Filter by name, date range, status, department
- Click row → daily timeline with in/out events
- Export to CSV

### للمدير العام (Admin)

All manager features plus:
- **Employee Management** (/employees): Add, edit, disable, delete employees
- **Departments** (/departments): Create, edit, assign department heads
- **Permissions Matrix** (/settings): Toggle permissions per role, auto-saved
- **Audit Log** (/audit): Track all status changes, transfers, admin actions
- **Settings** (/settings): Institution name, work hours, max exit hours
- **Pending Tasks Dashboard**: Overdue/due-today highlighting with clickable rows

## 🔧 Tech Stack

- **Frontend**: React 18 + TypeScript, Vite
- **Routing**: TanStack Router (single `/` route with search params)
- **State**: TanStack Query (staleTime 60s, optimistic updates)
- **Backend**: Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Animation**: Framer Motion, React CountUp
- **Charts**: Recharts
- **PDF**: @react-pdf/renderer
- **Search**: Fuse.js + cmdk (command palette)
- **Onboarding**: driver.js
- **File Upload**: react-dropzone

## ✅ Working Features

- ✅ 4-state attendance machine (NOT_CHECKED_IN → IN_OFFICE → OUTSIDE → DAY_ENDED)
- ✅ Exit request workflow (employee submits → manager approves/rejects → attendance event + notification)
- ✅ Manager query button (استفسار عن الموظف + تذكير بالحضور) with employee response banner
- ✅ Real-time updates via Supabase Realtime (attendance, tasks, notifications, exit_requests)
- ✅ Live connection indicator in topbar
- ✅ Smart notifications with deep links (click → navigate to specific task/exit-request/dashboard)
- ✅ Employee detail drawer (6 sections: header, stats, productivity chart, tasks, attendance, actions)
- ✅ Productivity page with recharts (BarChart + LineChart + performance cards)
- ✅ Correct productivity formula: (completed×10) + (hours_in×2) − (hours_out×1), capped 0-100
- ✅ Attendance page with filters, pagination, detail sheet with daily timeline
- ✅ Task deadline with time picker (date + time stored as ISO)
- ✅ Employee management CRUD (add/edit/disable/delete with dialogs)
- ✅ Settings page with permissions matrix (15 permissions × 3 roles, auto-save)
- ✅ Glass-morphism sidebar with institution name + role badge
- ✅ Role-specific mobile bottom navigation
- ✅ Command palette (Ctrl+K) with Fuse.js search
- ✅ Onboarding tour (driver.js, first login only)
- ✅ PDF report export (employee monthly + team reports)
- ✅ File attachments on tasks (react-dropzone, Supabase Storage)
- ✅ Audit log viewer (color-coded rows, filter, CSV export)
- ✅ Department management with grouping and assignment
- ✅ Skeleton loaders with shimmer animation
- ✅ NProgress route transition bar
- ✅ Bilingual Arabic RTL / English LTR throughout
- ✅ Idempotent seed endpoint

## ⚠️ Known Limitations

- **Password reset for other users**: Client-side `supabase.auth.updateUser()` only works for the current user. Admin resetting another employee's password requires a Supabase Edge Function with service role key (not yet deployed).
- **Midnight attendance finalization**: Requires pg_cron or a scheduled Edge Function to auto-finalize daily outside hours at midnight.
- **Deadline notification cron**: The Edge Function (`supabase/functions/deadline-checker/`) exists but requires deployment and pg_cron scheduling to run hourly.
- **PDF chart rendering**: Charts in PDF use SVG approximation (not recharts). Bar chart in PDF is simplified.
- **Realtime requires Supabase Realtime enabled**: The `postgres_changes` listener requires Realtime to be enabled on the Supabase project for the subscribed tables.

## 📱 Compatibility

- **Browsers**: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- **Mobile**: iOS Safari 15+, Chrome Mobile, responsive down to 375px width
- **Print**: Ctrl+P produces clean printout (sidebar/topbar hidden, navy headers)

## Project Structure

```
src/
├── routes/
│   ├── __root.tsx          # Root layout, NProgress, QueryClient
│   └── index.tsx           # Single route with page param switch
├── components/
│   ├── AppShell.tsx        # Main layout: sidebar + topbar + AnimatePresence
│   ├── layout/
│   │   ├── AppSidebar.tsx  # Role-based glass-morphism sidebar
│   │   └── MobileBottomNav.tsx  # Role-specific bottom nav
│   ├── manager/
│   │   ├── ManagerDashboard.tsx  # Summary cards + OverviewTab + pending tasks
│   │   └── tabs/
│   │       └── OverviewTab.tsx    # Employee status board + query buttons
│   ├── employee/
│   │   ├── EmployeeDashboard.tsx # 4-state attendance + tasks + exit request
│   │   └── EmployeeDetailDrawer.tsx  # 6-section Sheet drawer
│   ├── pages/
│   │   ├── TasksPage.tsx        # Task list with auto-open dialog from URL
│   │   ├── AttendancePage.tsx   # Filters + pagination + detail sheet
│   │   ├── ProductivityPage.tsx # Recharts + performance cards
│   │   ├── EmployeeManagementPage.tsx  # CRUD with dialogs
│   │   ├── ExitRequestsPage.tsx # Real-time approve/reject
│   │   ├── SettingsPage.tsx     # General + permissions matrix + notifications
│   │   ├── DepartmentsPage.tsx  # Department management
│   │   ├── AuditPage.tsx        # Audit log viewer
│   │   ├── ReportsPage.tsx      # Reports with print + PDF
│   │   └── HelpPage.tsx         # System documentation
│   ├── tasks/
│   │   └── CreateTaskDialog.tsx # Task creation with date+time deadline
│   ├── NotificationsBell.tsx   # Deep-linked notification dropdown
│   └── ui/                     # shadcn/ui components
├── contexts/
│   └── EmployeeDrawerContext.tsx  # Global employee drawer state
├── hooks/
│   └── useRealtimeSync.ts      # Supabase Realtime subscriptions
├── lib/
│   ├── i18n.tsx                 # ~270 bilingual keys
│   └── auth.tsx                 # Auth context + useAuth hook
├── integrations/supabase/
│   └── client.ts               # Supabase client
└── styles.css                   # Design tokens, animations, print styles
```

## License

MIT
