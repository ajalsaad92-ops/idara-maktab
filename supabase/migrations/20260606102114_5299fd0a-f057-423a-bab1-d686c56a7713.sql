
-- exit_requests: re-scope to authenticated
DROP POLICY IF EXISTS "Managers and HR can update all exit requests" ON public.exit_requests;
DROP POLICY IF EXISTS "Managers and HR can view all exit requests" ON public.exit_requests;
DROP POLICY IF EXISTS "Users can create their own exit requests" ON public.exit_requests;
DROP POLICY IF EXISTS "Users can delete their own pending exit requests" ON public.exit_requests;
DROP POLICY IF EXISTS "Users can update their own pending exit requests" ON public.exit_requests;
DROP POLICY IF EXISTS "Users can view their own exit requests" ON public.exit_requests;

CREATE POLICY "exit_requests_mgr_update" ON public.exit_requests FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "exit_requests_select" ON public.exit_requests FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR auth.uid() = employee_id);
CREATE POLICY "exit_requests_insert_own" ON public.exit_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "exit_requests_delete_own_pending" ON public.exit_requests FOR DELETE TO authenticated
  USING (auth.uid() = employee_id AND status = 'pending');
CREATE POLICY "exit_requests_update_own_pending" ON public.exit_requests FOR UPDATE TO authenticated
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (auth.uid() = employee_id AND status = 'pending');

-- manager_queries: restrict updatable fields via trigger (postgres doesn't allow subselects on same table in WITH CHECK against OLD)
CREATE OR REPLACE FUNCTION public.manager_queries_restrict_employee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.employee_id THEN
    IF NEW.manager_id IS DISTINCT FROM OLD.manager_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.query_type IS DISTINCT FROM OLD.query_type
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Employees may only modify their own response';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manager_queries_restrict_emp ON public.manager_queries;
CREATE TRIGGER trg_manager_queries_restrict_emp
  BEFORE UPDATE ON public.manager_queries
  FOR EACH ROW EXECUTE FUNCTION public.manager_queries_restrict_employee_update();

-- Lock down direct execution of internal helpers (still usable inside RLS / definer contexts)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_task_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;
