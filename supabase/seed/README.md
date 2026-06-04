# Supabase Data Snapshot

This folder contains a CSV snapshot of every table in the `public` schema, exported from the live database.

## Files

- `attendance.csv`
- `notifications.csv`
- `profiles.csv`
- `task_assignments.csv`
- `task_comments.csv`
- `task_shares.csv`
- `task_transfers.csv`
- `tasks.csv`
- `user_roles.csv`

Each file's first row is the column header (matching the table schema in `supabase/migrations/`).

## Editing from GitHub

You can edit any CSV directly in GitHub. Changes are version-controlled like the rest of the code.

> ⚠️ Editing the CSV **does not automatically update the live database**. The CSV is a snapshot for review/version control. To push edits back to the database, import the CSV via the Supabase dashboard (Table Editor → Import data from CSV) or run `\copy public.<table> FROM 'supabase/seed/<table>.csv' WITH CSV HEADER` against the database.

## Refreshing the snapshot

Re-export anytime with:

```bash
for t in attendance notifications profiles task_assignments task_comments task_shares task_transfers tasks user_roles; do
  psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.$t) TO 'supabase/seed/${t}.csv' WITH CSV HEADER"
done
```

## Schema

The structure of every table (columns, types, RLS policies, functions, triggers) lives in `supabase/migrations/` — that is the source of truth for the schema and is also versioned in GitHub.
