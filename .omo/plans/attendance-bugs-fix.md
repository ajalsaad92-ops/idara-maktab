# Work Plan: Attendance & Administration Logical Bug Fixes

## TL;DR

> **Quick Summary**: Fix three logical bugs in EmployeeDashboard, EmployeeManagementPage, and ExitRequestsPage, and verify the 4 employee attendance buttons.
> 
> **Deliverables**:
> - Fix 'out' vs 'out_final' event type mismatch for End Day in `EmployeeDashboard.tsx`.
> - Disable client-side password reset and add helpful admin guidance in `EmployeeManagementPage.tsx`.
> - Isolate note input state per exit request in `ExitRequestsPage.tsx`.
> - Comprehensive test suite for attendance flows.
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 & Task 2 & Task 3 -> Task 4 & Task 5 -> F1-F4

---

## Context

### Original Request
Fix three logical bugs identified in the codebase and test the employee's 4 attendance buttons.

### Interview Summary
**Key Discussions**:
- Mismatch between `out` (temporary) and `out_final` (day end) causes incorrect statuses in the manager's attendance views.
- Client-side auth password updates by admins accidentally reset the admin's own password due to Supabase auth client limitations.
- Exit request notes are shared globally rather than keyed by request ID, leading to UI input mirroring.

### Metis Review
**Identified Gaps** (addressed):
- Zero-intervention QA scenarios are added to all tasks to verify fixes programmatically.
- Guidelines for testing all 4 buttons and transitions are defined.

---

## Work Objectives

### Core Objective
Ensure correctness and consistency in attendance logging, exit requests, and administrator tools by fixing logical defects and verifying button state transitions.

### Concrete Deliverables
- `src/components/employee/EmployeeDashboard.tsx`
- `src/components/pages/EmployeeManagementPage.tsx`
- `src/components/pages/ExitRequestsPage.tsx`

### Definition of Done
- [ ] `npm run build` succeeds without TypeScript or bundling errors.
- [ ] All QA scenarios pass with recorded evidence.

### Must Have
- End day mutation records `out_final`.
- Password reset button disabled or shows modal/toast with instructions.
- Individual note inputs for each exit request.

### Must NOT Have (Guardrails)
- NO direct client-side calling of `auth.updateUser` for resetting other users.
- NO shared state for review note inputs.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: None (Agent QA only)
- **Framework**: none

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - bug fixes):
├── Task 1: Fix End Day event type to out_final [quick]
├── Task 2: Fix Admin Password Reset [quick]
└── Task 3: Fix Exit Request note mirroring [quick]

Wave 2 (After Wave 1 - verification + testing):
└── Task 4: Verify 4 buttons and state machine transitions [quick]

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1**: - - 4
- **2**: - - 4
- **3**: - - 4
- **4**: 1, 2, 3 - F1-F4

### Agent Dispatch Summary
- **1**: **3** - T1 → `quick`, T2 → `quick`, T3 → `quick`
- **2**: **1** - T4 → `quick`
- **FINAL**: **4** - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

## TODOs

- [ ] 1. Fix End Day event type to out_final

  **What to do**:
  - In `src/components/employee/EmployeeDashboard.tsx`, change `endDayMutation` to insert `event_type: "out_final"` instead of `event_type: "out"`.
  - Update `hasEndedDay` logic in `EmployeeDashboard.tsx` to search for `"out_final"` instead of `"out"` without `exit_request_id`.
  - Update `attState` check logic so that if `lastType === "out_final"`, state transitions to `DAY_ENDED`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line changes in a single file.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/components/employee/EmployeeDashboard.tsx:251` - endDayMutation definition
  - `src/components/employee/EmployeeDashboard.tsx:518` - hasEndedDay logic
  - `src/components/employee/EmployeeDashboard.tsx:443` - DAY_ENDED state transition

  **Acceptance Criteria**:
  - [ ] Code change verified visually.
  - [ ] End day records "out_final" in the DB.

  **QA Scenarios**:
  ```
  Scenario: End Day records out_final
    Tool: Bash
    Steps:
      1. Inspect EmployeeDashboard.tsx.
      2. Verify endDayMutation inserts event_type: "out_final".
      3. Verify hasEndedDay uses event_type === "out_final".
    Expected Result: Code successfully updated to out_final.
    Evidence: .omo/evidence/task-1-out-final.txt
  ```

- [ ] 2. Fix Admin Password Reset

  **What to do**:
  - In `src/components/pages/EmployeeManagementPage.tsx`, disable `supabase.auth.updateUser` inside `handlePassReset`.
  - Show a `toast.error` or a dialog info box indicating that updating another user's password client-side is not supported by Supabase for security, and instructs the administrator to use the Supabase Dashboard.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial logic adjustment to prevent self-password reset.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/components/pages/EmployeeManagementPage.tsx:220` - password reset handler

  **Acceptance Criteria**:
  - [ ] Password reset function disabled and warning message shown.

  **QA Scenarios**:
  ```
  Scenario: Password reset warning
    Tool: Bash
    Steps:
      1. Inspect EmployeeManagementPage.tsx.
      2. Verify supabase.auth.updateUser is bypassed and toast.error / warning info is rendered.
    Expected Result: Safe security feedback shown instead of self-password change.
    Evidence: .omo/evidence/task-2-pwd-reset.txt
  ```

- [ ] 3. Fix Exit Request note mirroring

  **What to do**:
  - In `src/components/pages/ExitRequestsPage.tsx`, change `reviewNote` state from a single string to an object `Record<string, string>` where key is `req.id`.
  - Update input field `value` and `onChange` to use `reviewNotes[req.id] || ""`.
  - In `handleApprove`, fetch note by ID and reset only the note for that specific request on success.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Easy React state refactoring.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/components/pages/ExitRequestsPage.tsx:18` - reviewNote state definition
  - `src/components/pages/ExitRequestsPage.tsx:190` - reviewNote input binding

  **Acceptance Criteria**:
  - [ ] Notes input works independently per request.

  **QA Scenarios**:
  ```
  Scenario: Note inputs are isolated
    Tool: Bash
    Steps:
      1. Inspect ExitRequestsPage.tsx.
      2. Verify reviewNotes is a Record mapping request ID to string.
    Expected Result: Isolated state per card.
    Evidence: .omo/evidence/task-3-notes.txt
  ```

- [ ] 4. Verify 4 buttons and state machine transitions

  **What to do**:
  - Test the employee's 4 buttons to ensure they work correctly with the new `out_final` state.
  - Button 1 (Start Work): disables on click.
  - Button 2 (Exit Request): disables on click, stays gray until Button 3 clicked.
  - Button 3 (Check-back-in): enabled only during approved exit, goes back to gray when clicked.
  - Button 4 (End Day): disables when check-in is not clicked, prompts on <= 2h check-in, inserts `out_final` on confirm.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and testing.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2, 3

  **QA Scenarios**:
  ```
  Scenario: Button state flow verification
    Tool: Bash
    Steps:
      1. Verify that all 4 buttons match the specification.
      2. Build the app using npm run build to ensure zero compiler errors.
    Expected Result: Build succeeds with no errors.
    Evidence: .omo/evidence/task-4-build.txt
  ```

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. Verify all evidence files exist.
  Output: `Must Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + lint + `vite build`. Check for clean code structure.
  Output: `Build [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Verify all 4 buttons and movement logs in the UI using Playwright or manual checks.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify all changes are limited strictly to the requested bug fixes.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

- **1**: `fix(attendance): use out_final for end day` - EmployeeDashboard.tsx
- **2**: `fix(admin): block client-side password updates` - EmployeeManagementPage.tsx
- **3**: `fix(exit): isolate review notes state` - ExitRequestsPage.tsx

---

## Success Criteria

### Verification Commands
```bash
npm run build
```

### Final Checklist
- [ ] End day inserts out_final.
- [ ] Reset password directs to Supabase.
- [ ] Notes do not mirror.
