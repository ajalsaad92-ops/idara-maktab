-- ============================================================
-- Fix missing database objects referenced by frontend
-- 1. manager_queries table (OverviewTab.tsx, EmployeeDashboard.tsx)
-- 2. attendance.exit_request_id column (ExitRequestsPage.tsx line 71)
-- 3. attendance_event enum 'out_final' value (AttendancePage.tsx, EmployeeDashboard.tsx, ProductivityPage.tsx)
-- ============================================================

-- 1. Add 'out_final' to attendance_event enum
ALTER TYPE public.attendance_event ADD VALUE IF NOT EXISTS 'out_final';

-- 2. Add exit_request_id column to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS exit_request_id UUID REFERENCES public.exit_requests(id) ON DELETE SET NULL;

-- 3. Create manager_queries table
CREATE TABLE IF NOT EXISTS public.manager_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query_type TEXT NOT NULL CHECK (query_type IN ('location_check', 'attendance_reminder')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
    employee_response TEXT,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_queries TO authenticated;
GRANT ALL ON public.manager_queries TO service_role;

-- Enable RLS
ALTER TABLE public.manager_queries ENABLE ROW LEVEL SECURITY;

-- Policies for manager_queries
-- Managers can view queries they sent
CREATE POLICY "mgr_queries_select_mgr"
    ON public.manager_queries FOR SELECT
    TO authenticated
    USING (auth.uid() = manager_id);

-- Employees can view queries addressed to them
CREATE POLICY "mgr_queries_select_emp"
    ON public.manager_queries FOR SELECT
    TO authenticated
    USING (auth.uid() = employee_id);

-- Managers can insert queries
CREATE POLICY "mgr_queries_insert_mgr"
    ON public.manager_queries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = manager_id);

-- Employees can update (respond to) queries addressed to them
CREATE POLICY "mgr_queries_update_emp"
    ON public.manager_queries FOR UPDATE
    TO authenticated
    USING (auth.uid() = employee_id AND status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER manager_queries_updated_at
    BEFORE UPDATE ON public.manager_queries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
