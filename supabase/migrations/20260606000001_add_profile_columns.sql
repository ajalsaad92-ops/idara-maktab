ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS joined_date DATE;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Fix the profiles RLS to allow managers to update any profile
DROP POLICY IF EXISTS "profiles_update_self_or_mgr" ON public.profiles;
CREATE POLICY "profiles_update_self_or_mgr" ON public.profiles 
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_manager_or_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_manager_or_admin(auth.uid()));
