
# Decisions

## 2026-06-04: Execution Order
- Tasks must be sequential due to heavy file overlap
- T1 (Performance) is foundational - React Query hooks needed by all subsequent tasks
- T7 (Bug Fixes) before T3 (UI) - correct logic before beautifying
- T6 (Mobile) last before integration - responsive polish on completed UI

## 2026-06-04: New Dependencies
- framer-motion - page transitions, AnimatePresence
- nprogress - top-level loading bar
- react-countup - animated counter numbers

