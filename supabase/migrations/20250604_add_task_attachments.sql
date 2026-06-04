-- Create task_attachments table for file uploads
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES profiles(id),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- Add RLS policies for task_attachments
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read task attachments"
ON task_attachments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert their own attachments"
ON task_attachments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Allow uploader or admin to delete attachments"
ON task_attachments FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
));

-- Create storage bucket for task attachments
-- Note: This must be done via Supabase Dashboard or Storage API
-- Bucket name: task-attachments
-- Public: false (authenticated read)
-- Policies:
--   - SELECT: authenticated
--   - INSERT: authenticated
--   - DELETE: uploader or admin/manager
