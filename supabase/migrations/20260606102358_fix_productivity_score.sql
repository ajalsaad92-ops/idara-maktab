-- Migration: Fix calculate_productivity_score function
-- Created: 2026-06-06
-- Fixes: event_type enum values ('in'/'out'/'out_final' instead of 'check_in'/'check_out')
--        Properly handle out_final in hours calculation

CREATE OR REPLACE FUNCTION calculate_productivity_score(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  completed_count INTEGER;
  hours_in NUMERIC;
  hours_out NUMERIC;
  score INTEGER;
BEGIN
  -- Count completed tasks for this user on this date
  SELECT COUNT(*) INTO completed_count
  FROM task_assignments ta
  JOIN tasks t ON t.id = ta.task_id
  WHERE ta.user_id = p_user_id
    AND t.status = 'completed'
    AND DATE(t.updated_at AT TIME ZONE 'Asia/Baghdad') = p_date;

  -- Calculate hours from attendance events
  -- We compute the time between consecutive in/out events
  -- Event types: 'in', 'out', 'out_final'
  WITH event_pairs AS (
    SELECT
      event_type,
      event_at,
      LAG(event_at) OVER (ORDER BY event_at) as prev_event_at,
      LAG(event_type) OVER (ORDER BY event_at) as prev_event_type
    FROM attendance
    WHERE user_id = p_user_id
      AND DATE(event_at AT TIME ZONE 'Asia/Baghdad') = p_date
    ORDER BY event_at
  )
  SELECT
    COALESCE(SUM(
      CASE 
        WHEN event_type IN ('out', 'out_final') AND prev_event_type = 'in'
        THEN EXTRACT(EPOCH FROM (event_at - prev_event_at)) / 3600
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE 
        WHEN event_type = 'in' AND prev_event_type IN ('out', 'out_final')
        THEN EXTRACT(EPOCH FROM (event_at - prev_event_at)) / 3600
        ELSE 0
      END
    ), 0)
  INTO hours_out, hours_in
  FROM event_pairs;

  -- Correct formula: (completed * 10) + (hours_in * 2) - (hours_out * 1)
  score := LEAST(100,
    (completed_count * 10) +
    (FLOOR(hours_in) * 2) -
    (FLOOR(hours_out) * 1)
  );

  RETURN GREATEST(0, score);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the daily_productivity_scores view to use Baghdad timezone
CREATE OR REPLACE VIEW daily_productivity_scores AS
SELECT
  p.id as user_id,
  p.full_name,
  p.department,
  CURRENT_DATE as date,
  calculate_productivity_score(p.id, CURRENT_DATE) as score
FROM profiles p
WHERE p.id IS NOT NULL;

-- Add comment
COMMENT ON FUNCTION calculate_productivity_score IS 'Calculates daily productivity score: (completed_tasks × 10) + (hours_in × 2) - (hours_out × 1), capped at 0-100. Uses Asia/Baghdad timezone for date boundaries. Event types: in, out, out_final.';