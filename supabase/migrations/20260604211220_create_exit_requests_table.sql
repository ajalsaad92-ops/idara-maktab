-- Create exit_requests table
CREATE TABLE exit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason_type TEXT NOT NULL,
    reason_text TEXT,
    expected_duration TEXT NOT NULL,
    note TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_note TEXT,
    attendance_event_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE exit_requests ENABLE ROW LEVEL SECURITY;

-- Policies for exit_requests
CREATE POLICY "Users can view their own exit requests"
    ON exit_requests FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Users can create their own exit requests"
    ON exit_requests FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Users can update their own pending exit requests"
    ON exit_requests FOR UPDATE
    USING (auth.uid() = employee_id AND status = 'pending');

CREATE POLICY "Users can delete their own pending exit requests"
    ON exit_requests FOR DELETE
    USING (auth.uid() = employee_id AND status = 'pending');

-- Managers and admin can view all exit requests
CREATE POLICY "Managers and HR can view all exit requests"
    ON exit_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role IN ('manager', 'hr', 'admin'))
        )
    );

-- Managers and admin can update all exit requests (to approve/reject)
CREATE POLICY "Managers and HR can update all exit requests"
    ON exit_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.role IN ('manager', 'hr', 'admin'))
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER exit_requests_updated_at 
    BEFORE UPDATE ON public.exit_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_updated_at();