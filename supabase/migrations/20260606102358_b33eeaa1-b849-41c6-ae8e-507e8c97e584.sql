
-- Fix 1: Add caller authorization check to calculate_productivity_score
CREATE OR REPLACE FUNCTION public.calculate_productivity_score(p_user_id uuid, p_date date)
RETURNS TABLE(user_id uuid, score numeric, attendance_hours numeric, tasks_completed integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in timestamptz;
  v_out timestamptz;
  v_hours numeric := 0;
  v_tasks integer := 0;
  v_score numeric := 0;
BEGIN
  IF NOT (p_user_id = auth.uid() OR public.is_manager_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT MIN(event_at) FILTER (WHERE event_type = 'in'),
         MAX(event_at) FILTER (WHERE event_type IN ('out', 'out_final'))
    INTO v_in, v_out
  FROM public.attendance
  WHERE attendance.user_id = p_user_id AND event_date = p_date;

  IF v_in IS NOT NULL AND v_out IS NOT NULL THEN
    v_hours := GREATEST(0, EXTRACT(EPOCH FROM (v_out - v_in)) / 3600.0);
  END IF;

  SELECT COUNT(*)::int INTO v_tasks
  FROM public.tasks t
  JOIN public.task_assignments ta ON ta.task_id = t.id
  WHERE ta.user_id = p_user_id
    AND t.status = 'completed'
    AND t.updated_at::date = p_date;

  v_score := LEAST(100, (v_hours * 10) + (v_tasks * 15));

  RETURN QUERY SELECT p_user_id, v_score, v_hours, v_tasks;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_productivity_score(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_productivity_score(uuid, date) TO authenticated;

-- Restrict view access to managers/admins only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'daily_productivity_scores') THEN
    EXECUTE 'REVOKE ALL ON public.daily_productivity_scores FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.daily_productivity_scores TO service_role';
  END IF;
END $$;

-- Fix 2: Tighten manager_queries insert policy to require manager/admin role
DROP POLICY IF EXISTS mgr_queries_insert_mgr ON public.manager_queries;
CREATE POLICY mgr_queries_insert_mgr
  ON public.manager_queries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = manager_id
    AND public.is_manager_or_admin(auth.uid())
  );
