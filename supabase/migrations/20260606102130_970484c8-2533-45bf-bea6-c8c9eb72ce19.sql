
-- Restrict notification inserts (was WITH CHECK true)
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
CREATE POLICY "notif_insert_self_or_mgr"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager_or_admin(auth.uid()));

-- Revoke EXECUTE on remaining SECURITY DEFINER helpers (they're trigger/system functions)
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_queries_restrict_employee_update() FROM PUBLIC, anon, authenticated;
