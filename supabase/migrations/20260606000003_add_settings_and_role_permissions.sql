-- Migration to add settings and role_permissions tables
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist and create them
DROP POLICY IF EXISTS "Allow authenticated users to read role_permissions" ON public.role_permissions;
CREATE POLICY "Allow authenticated users to read role_permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow admin to manage role_permissions" ON public.role_permissions;
CREATE POLICY "Allow admin to manage role_permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for settings
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.settings;
CREATE POLICY "Allow authenticated users to read settings"
ON public.settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow admin to manage settings" ON public.settings;
CREATE POLICY "Allow admin to manage settings"
ON public.settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
