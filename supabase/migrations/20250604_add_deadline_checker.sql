-- Create a Postgres function to check deadlines and send notifications
-- This is a database function that can be called via cron or directly

CREATE OR REPLACE FUNCTION check_deadlines_and_notify()
RETURNS void AS $$
DECLARE
  task_record RECORD;
  assignee_record RECORD;
  hours_left INTEGER;
  existing_notif INTEGER;
BEGIN
  -- Check for approaching deadlines (within 24 hours)
  FOR task_record IN
    SELECT t.id, t.title, t.deadline, ta.user_id
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.id AND ta.is_active = true
    WHERE t.status NOT IN ('completed', 'archived')
      AND t.deadline IS NOT NULL
      AND t.deadline <= NOW() + INTERVAL '24 hours'
      AND t.deadline > NOW()
  LOOP
    -- Calculate hours left
    hours_left := EXTRACT(EPOCH FROM (task_record.deadline - NOW())) / 3600;
    
    -- Check if notification already exists in last 23 hours
    SELECT COUNT(*) INTO existing_notif
    FROM notifications
    WHERE user_id = task_record.user_id
      AND type = 'task_deadline'
      AND related_task_id = task_record.id
      AND created_at > NOW() - INTERVAL '23 hours';
    
    IF existing_notif = 0 THEN
      INSERT INTO notifications (user_id, type, message, related_task_id, link_data, is_read)
      VALUES (
        task_record.user_id,
        'task_deadline',
        'مهمة "' || task_record.title || '" تنتهي خلال ' || hours_left || ' ساعة',
        task_record.id,
        jsonb_build_object('route', '/tasks', 'task_id', task_record.id),
        false
      );
    END IF;
  END LOOP;

  -- Check for overdue tasks
  FOR task_record IN
    SELECT t.id, t.title, t.priority, ta.user_id
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.id AND ta.is_active = true
    WHERE t.status NOT IN ('completed', 'archived')
      AND t.deadline IS NOT NULL
      AND t.deadline < NOW()
  LOOP
    -- Check if overdue notification already exists in last 23 hours
    SELECT COUNT(*) INTO existing_notif
    FROM notifications
    WHERE user_id = task_record.user_id
      AND type = 'task_overdue'
      AND related_task_id = task_record.id
      AND created_at > NOW() - INTERVAL '23 hours';
    
    IF existing_notif = 0 THEN
      INSERT INTO notifications (user_id, type, message, related_task_id, link_data, is_read)
      VALUES (
        task_record.user_id,
        'task_overdue',
        'مهمة "' || task_record.title || '" تجاوزت موعدها النهائي',
        task_record.id,
        jsonb_build_object('route', '/tasks', 'task_id', task_record.id),
        false
      );
    END IF;
    
    -- Auto-escalate priority to urgent if it was normal or important
    IF task_record.priority IN ('normal', 'important') THEN
      UPDATE tasks SET priority = 'urgent' WHERE id = task_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add new notification types to the enum if using enum
-- If using text type, no need to alter

-- Add comment explaining how to schedule this
COMMENT ON FUNCTION check_deadlines_and_notify() IS 
'Call this function every hour via pg_cron or Supabase Edge Function to check deadlines and send notifications';
