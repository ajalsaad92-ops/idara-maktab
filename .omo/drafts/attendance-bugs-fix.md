# Draft: Attendance Bugs & Logic Audit Fixes

## Requirements (confirmed)
- Fix endDayMutation in EmployeeDashboard.tsx to insert 'out_final' instead of 'out'.
- Fix password reset in EmployeeManagementPage.tsx: replace client-side auth.updateUser (which changes the admin's password) with an informative warning or instruction to use the Supabase Dashboard, preventing unauthorized password self-updates by admins.
- Fix note input mirroring in ExitRequestsPage.tsx: isolate the reviewNote state so text entered in one request doesn't mirror across other requests.
- Verify all 4 employee attendance buttons: check transition states and ensure constraints are correct.

## Technical Decisions
- Use `out_final` event type for End Day, matching database schema and AttendancePage filters.
- Disable client-side password reset for admins in EmployeeManagementPage.tsx and display a dialog/toast directing the administrator to use the Supabase Dashboard.
- Use a state record dictionary `Record<string, string>` in ExitRequestsPage.tsx mapping `requestId -> noteText` to isolate review note states.

## Open Questions
- None.

## Scope Boundaries
- INCLUDE:
  - Fixes in EmployeeDashboard.tsx, EmployeeManagementPage.tsx, ExitRequestsPage.tsx.
  - Adding end-to-end QA scenarios for verifying all 4 buttons and these three fixes.
- EXCLUDE:
  - Setting up Edge Functions for password reset (since Supabase Dashboard is sufficient).
  - Unrelated features or dialog fixes.
