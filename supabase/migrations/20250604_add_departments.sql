-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    head_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add department_id to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id);

-- Add RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read departments"
ON departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to manage departments"
ON departments FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Insert default departments
INSERT INTO departments (name_ar, name_en) VALUES
('الإدارة العامة', 'General Administration'),
('مكتب المحافظ', "Governor's Office"),
('الشؤون الإدارية', 'Administrative Affairs'),
('الشؤون المالية', 'Financial Affairs'),
('الشؤون القانونية', 'Legal Affairs'),
('العلاقات العامة', 'Public Relations')
ON CONFLICT DO NOTHING;

-- Update existing profiles to set department_id based on department text
UPDATE profiles
SET department_id = d.id
FROM departments d
WHERE profiles.department = d.name_ar;

-- Create function to get department employees
CREATE OR REPLACE FUNCTION get_department_employees(dept_id UUID)
RETURNS TABLE (
    employee_id UUID,
    full_name TEXT,
    role TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, ur.role, true
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.department_id = dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to assign task to department
CREATE OR REPLACE FUNCTION assign_task_to_department(
    p_task_id UUID,
    p_department_id UUID,
    p_assigned_by UUID
)
RETURNS void AS $$
DECLARE
    emp RECORD;
BEGIN
    FOR emp IN SELECT employee_id FROM get_department_employees(p_department_id)
    LOOP
        INSERT INTO task_assignments (task_id, user_id, assigned_by, is_active)
        VALUES (p_task_id, emp.employee_id, p_assigned_by, true)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO notifications (user_id, type, message, related_task_id, link_data, is_read)
        VALUES (
            emp.employee_id,
            'task_assigned',
            'تم إسناد مهمة جديدة للقسم',
            p_task_id,
            jsonb_build_object('route', '/tasks', 'task_id', p_task_id),
            false
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
