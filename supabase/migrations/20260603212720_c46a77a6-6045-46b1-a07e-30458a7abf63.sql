
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','manager','employee');
CREATE TYPE public.task_type AS ENUM ('writing','archiving','correspondence','follow_up','other');
CREATE TYPE public.task_priority AS ENUM ('normal','important','urgent');
CREATE TYPE public.task_status AS ENUM ('new','in_progress','completed','archived');
CREATE TYPE public.attendance_event AS ENUM ('in','out');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  department TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','manager'))
$$;

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type attendance_event NOT NULL,
  reason TEXT,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Baghdad')::date
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type task_type NOT NULL DEFAULT 'other',
  type_other TEXT,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'normal',
  status task_status NOT NULL DEFAULT 'new',
  deadline DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignments TO authenticated;
GRANT ALL ON public.task_assignments TO service_role;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT ON public.task_transfers TO authenticated;
GRANT ALL ON public.task_transfers TO service_role;
ALTER TABLE public.task_transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(task_id, shared_with_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.task_shares TO authenticated;
GRANT ALL ON public.task_shares TO service_role;
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper: is user a participant of a task (assigned or shared)
CREATE OR REPLACE FUNCTION public.is_task_participant(_task_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments WHERE task_id=_task_id AND user_id=_user_id AND is_active=true
    UNION ALL
    SELECT 1 FROM public.task_shares WHERE task_id=_task_id AND shared_with_user_id=_user_id
    UNION ALL
    SELECT 1 FROM public.tasks WHERE id=_task_id AND created_by=_user_id
  )
$$;

-- ============= POLICIES =============
-- profiles: all authenticated users can read all profiles; users update own; managers/admins update any
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self_or_mgr" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_manager_or_admin(auth.uid()));

-- user_roles: readable to all authenticated (needed to show roles), only admin can modify (via service role)
CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- attendance
CREATE POLICY "attendance_select_own_or_mgr" ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager_or_admin(auth.uid()));
CREATE POLICY "attendance_insert_own" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- tasks
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR public.is_task_participant(id, auth.uid()));
CREATE POLICY "tasks_insert_mgr" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR public.is_task_participant(id, auth.uid()));
CREATE POLICY "tasks_delete_mgr" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- task_assignments
CREATE POLICY "ta_select" ON public.task_assignments FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR user_id = auth.uid() OR public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "ta_insert_mgr" ON public.task_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "ta_update_mgr" ON public.task_assignments FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "ta_delete_mgr" ON public.task_assignments FOR DELETE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- task_comments
CREATE POLICY "tc_select" ON public.task_comments FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "tc_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (public.is_manager_or_admin(auth.uid()) OR public.is_task_participant(task_id, auth.uid())));

-- task_transfers
CREATE POLICY "tt_select" ON public.task_transfers FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "tt_insert" ON public.task_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()) OR from_user_id = auth.uid());

-- task_shares
CREATE POLICY "ts_select" ON public.task_shares FOR SELECT TO authenticated
  USING (public.is_manager_or_admin(auth.uid()) OR shared_with_user_id = auth.uid() OR public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "ts_insert_mgr_or_participant" ON public.task_shares FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()) OR public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "ts_delete_mgr" ON public.task_shares FOR DELETE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_any" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile + default 'employee' role for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
