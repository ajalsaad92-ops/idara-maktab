-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'task' | 'attendance' | 'user' | 'notification'
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin to read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Allow system to insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to insert audit log
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value, p_ip_address)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task status changes
CREATE OR REPLACE FUNCTION audit_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM insert_audit_log(
            auth.uid(),
            'status_change',
            'task',
            NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status),
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_task_status_change ON tasks;
CREATE TRIGGER audit_task_status_change
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION audit_task_status_change();

-- Create trigger for task transfers
CREATE OR REPLACE FUNCTION audit_task_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = false AND OLD.is_active = true THEN
        PERFORM insert_audit_log(
            auth.uid(),
            'transfer',
            'task',
            NEW.task_id,
            jsonb_build_object('user_id', OLD.user_id, 'is_active', OLD.is_active),
            jsonb_build_object('user_id', NEW.user_id, 'is_active', NEW.is_active),
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_task_transfer ON task_assignments;
CREATE TRIGGER audit_task_transfer
    AFTER UPDATE ON task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION audit_task_transfer();

-- Create trigger for attendance check-in/out
CREATE OR REPLACE FUNCTION audit_attendance_event()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM insert_audit_log(
        NEW.user_id,
        NEW.event_type,
        'attendance',
        NEW.id,
        NULL,
        jsonb_build_object('event_type', NEW.event_type, 'reason', NEW.reason),
        NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_attendance_event ON attendance;
CREATE TRIGGER audit_attendance_event
    AFTER INSERT ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION audit_attendance_event();

-- Create trigger for new user creation
CREATE OR REPLACE FUNCTION audit_user_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM insert_audit_log(
        auth.uid(),
        'create',
        'user',
        NEW.id,
        NULL,
        jsonb_build_object('full_name', NEW.full_name, 'department', NEW.department),
        NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_user_created ON profiles;
CREATE TRIGGER audit_user_created
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_created();

-- Add function to get user's IP
CREATE OR REPLACE FUNCTION get_user_ip()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update insert_audit_log to capture IP
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_ip TEXT;
BEGIN
    v_ip := COALESCE(p_ip_address, get_user_ip());
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value, v_ip)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
