-- Migration file to fix profiles and notification types
-- Renaming and adding any necessary structures to keep database synced with front-end changes.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Ensure type validation allows the updated notification type values
-- Since the front-end now inserts "task_commented" and "task_transferred_in" instead of "comment" and "transfer",
-- we verify if there's any CHECK constraint on types. Currently public.notifications.type is just TEXT,
-- but we make sure there are no other restrictions or we add helpful defaults.
