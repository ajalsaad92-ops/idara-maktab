# Idara-Maktab Implementation Plan

## TODOs
- [ ] 1. PERFORMANCE — React Query for all fetches, skeletons, optimistic updates, nprogress, lazy tabs, prefetch
- [ ] 2. REALTIME — Supabase Realtime on attendance/tasks/notifications/task_comments, live indicator, reconnect toast
- [ ] 3. UI OVERHAUL — Design tokens, glass sidebar, topbar, framer-motion transitions, gradient cards, count-up, styled tables, animated buttons, floating labels, empty states
- [ ] 4. EMPLOYEE DETAIL MODAL — Side drawer with 6 sections, EmployeeDrawerContext
- [ ] 5. SMART NOTIFICATIONS — Deep links per type, link_data JSONB, styled cards, mark-all-read, bounce animation
- [ ] 6. MOBILE RESPONSIVENESS — Bottom nav, vertical scroll status board, sticky check-in, full-screen sheets, card-list tables
- [ ] 7. BUG FIXES — Attendance validation, 2hr reminder, midnight auto-finalize, transfer view access, completion comment, new productivity formula, idempotent seed
- [ ] 8. FINAL INTEGRATION — tsc --noEmit, error handling, role testing, README update

## Final Verification Wave
- [ ] F1. TypeScript compilation passes (tsc --noEmit)
- [ ] F2. No console.error or unhandled rejections
- [ ] F3. All Supabase queries have Arabic error toasts
- [ ] F4. Full flow works for all 3 roles (admin, manager, employee)

## Execution Order
Tasks are SEQUENTIAL due to heavy file overlap:
- T1 is foundational (React Query hooks used by all subsequent tasks)
- T7 (Bug Fixes) next — correct logic before beautifying
- T2 (Realtime) — needs React Query from T1
- T3 (UI Overhaul) — visual layer on correct foundation
- T4 (Employee Drawer) — new feature on new UI
- T5 (Smart Notifications) — enhancement using React Query + Realtime
- T6 (Mobile) — responsive polish on completed UI
- T8 (Integration) — final cleanup

## Dependencies Added
- framer-motion — page transitions, animations
- nprogress — loading bar
- react-countup — animated counters
