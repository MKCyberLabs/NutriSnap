# NutriSnap R001 Repair Validation — Orchestration Notes

**Date:** 2026-10-08
**Orchestrator:** Gemini 3.8 Flash High (Lead Orchestrator)
**Run ID:** `run_m4b5hrvfwv4xw`
**Base Commit:** `4afa5c17e2f227d5000f334c0b210e48c42decb1`
**Review Base Commit:** `c7d643c16f8eca8c6faa4424d3fd1ed0d9644beb`

---

## 1. Initial State Assessment & Recovery

### 1.1 Git Worktrees & Branches
- **Orchestration Worktree:** `/home/openclaw/Projects/NutriSnap-finance-orch` on `orchestration/finance-crud-reminders-r001` (HEAD: `c7d643c`).
- **Worker A Worktree:** `/home/openclaw/Projects/NutriSnap-worker-a` on `worker-a/finance-crud-ui`. Reset cleanly to `c7d643c`.
- **Worker B Worktree:** `/home/openclaw/Projects/NutriSnap-worker-b` on `worker-b/loans-obligations-reminders`. Reset cleanly to `c7d643c`.

### 1.2 CBDS Run Status
- Active run: `run_m4b5hrvfwv4xw`.
- Prior review task `tsk_m4djw0enkbwp6` was settled as `blocked` due to sandbox preflight, followed by manual standalone Sol 6.1 review documented in `docs/experiments/NUTRI_R001_SOL_REVIEW_FAIL.md`.
- Bubblewrap sandbox verified functional on host (`codex sandbox -- /bin/true` PASS).
- Test database container `nutrisnap_test_db` (Postgres 15 on port 5433, db `nutrisnap_test`) restarted and verified with `npm run test:finance` (50/50 passing).

---

## 2. Findings Analysis & Repair Strategy

### Finding 1 (P1): Credit-Card Cycle Isolation Breaks on Reversal
- **Root Cause:** `createCreditCardStatement` reused obligations that had no active statements (`o.creditCardStatements.length === 0`), causing paid statement obligations to be reassigned to newer cycles. Reversing payment on the earlier statement (`reverseCreditCardPayment`) modified the reused obligation, clobbering the newer statement's amount and due date.
- **Worker:** Worker A (`agy-manickam`).
- **Files Owned:** `src/lib/finance/credit-card-service.ts`, `src/lib/finance/payment-lifecycle.test.ts`.
- **Fix:** Enforce dedicated 1:1 obligation creation per statement cycle. Do not reuse past obligations across cycles. When reversing a payment, restore only that statement's dedicated obligation.
- **Verification:** Database-backed test with Jan & Feb cycles, full payoff, reversal of Jan, partial payments, and concurrency idempotency.

### Finding 2 (P1): Loan Obligation Linking Unsafe Under Concurrent Edits
- **Root Cause:** Loan was read outside the transaction (`findUnique` at line 727); obligation creation used the pre-read state at line 923. Two concurrent `updateLoan` calls could both observe `obligationId: null` and create two active obligations.
- **Worker:** Worker B (`agy-rohit`).
- **Files Owned:** `src/lib/finance/loan-service.ts`, `src/lib/finance/loan.test.ts`.
- **Fix:** Re-query and lock the loan inside `tx`. If `currentLoan.obligationId` was populated by a competing commit, update the existing obligation rather than creating a duplicate orphan.

### Finding 3 (P1): Clearing Next EMI Date Retains Stale Reminders
- **Root Cause:** `isScheduleCleared` required both `effectiveNextDue === null` AND `!newDueDay`. When `nextEmiDate` was set to null while retaining `dueDay`, the obligation remained active with stale dates and deliveries.
- **Worker:** Worker B (`agy-rohit`).
- **Files Owned:** `src/lib/finance/loan-service.ts`, `src/lib/finance/loan.test.ts`.
- **Fix:** When `effectiveNextDue === null` or `emiAmount` is cleared, atomically deactivate the obligation (`isActive: false`) and remove pending/snoozed deliveries.

### Finding 4 (P1): Monthly Recurrence Repair Incomplete
- **Root Cause:** Omitting `dueDay` in `recordEmiPayment` derived targets from already-clamped dates. In `finance-service.ts` (`markObligationPaid`), `nextDueAt` was recalculated without loan day anchoring and overwrote the synchronized loan EMI date (advancing obligation to Mar 28 while loan advanced to Mar 31).
- **Worker:** Worker B (`agy-rohit`).
- **Files Owned:** `src/lib/finance/loan-service.ts`, `src/lib/finance/finance-service.ts`, `src/lib/finance/loan.test.ts`.
- **Fix:** Persist canonical `dueDay`. In `markObligationPaid`, use the synchronized advancement from `recordEmiPaymentInternal` as authoritative.

### Finding 5 (P1): Metadata Edits Override Pause and Snooze State
- **Root Cause:** `updateLoan` unconditionally set `existingOb.isActive = true` and purged `SNOOZED` claims whenever `dueChanged` was true (which was true even when schedule fields were unchanged in value).
- **Worker:** Worker B (`agy-rohit`).
- **Files Owned:** `src/lib/finance/loan-service.ts`, `src/lib/finance/loan.test.ts`.
- **Fix:** Check value-level equality of schedule fields (`emiAmount`, `dueDay`, `nextEmiDate`). On metadata-only edits, do not mutate `obligation.isActive` (preserving paused status) and do not purge `SNOOZED` deliveries.

### Finding 6 (P2): Editing Due Day Leaves Next Date Unchanged
- **Root Cause:** `LoanForm.tsx` submitted both the edited `dueDay` and the stale unchanged `nextEmiDate`; backend gave `nextEmiDate` precedence.
- **Worker:** Worker B (`agy-rohit`).
- **Files Owned:** `src/components/finance/LoanForm.tsx`, `src/lib/finance/loan-service.ts`, `src/lib/finance/loan.test.ts`.
- **Fix:** If `dueDay` changes in `LoanForm`, recalculate `nextEmiDate` or omit stale date. In backend, if `dueDay` is changed while `nextEmiDate` matches the existing loan date, prioritize `dueDay` recalculation.

---

## 3. Worker Dispatches & Reports (CBDS Round 2)

- **Worker A Dispatch:**
  - Task ID: `tsk_m4drq0g247czt`
  - Dispatch ID: `dsp_m4drqemcd9jpj`
  - Pane: `wC:p2` (settled & released)
  - Worktree: `/home/openclaw/Projects/NutriSnap-worker-a`
  - Agent: `agy (agy-manickam)`
  - Status: **COMPLETED / SUCCEEDED**
  - Commit SHA: `d290f78c1f53102109ee07db09ba0fef727c74b5`
  - Files Changed:
    - `src/lib/finance/credit-card-service.ts`
    - `src/lib/finance/payment-lifecycle.test.ts`
  - Findings Resolved: Finding P1 #1 (1:1 cycle obligation isolation, safe reversal, concurrent creation serialization).
  - Tests: `test:finance` (51/51), `test:life-hub` (109/109), `typecheck` clean, `git diff --check` clean.

- **Worker B Dispatch:**
  - Task ID: `tsk_m4drq9m8q9pkh`
  - Dispatch ID: `dsp_m4drqqh8sfv3k`
  - Pane: `wC:p3` (settled & released)
  - Worktree: `/home/openclaw/Projects/NutriSnap-worker-b`
  - Agent: `agy (agy-rohit)`
  - Status: **COMPLETED / SUCCEEDED**
  - Commit SHA: `6e95500d74fb1948e75847fe140325ed90ca64f2`
  - Files Changed:
    - `src/lib/finance/loan-service.ts`
    - `src/lib/finance/finance-service.ts`
    - `src/components/finance/LoanForm.tsx`
    - `src/lib/finance/loan.test.ts`
  - Findings Resolved: Findings P1 #2, #3, #4, #5 and P2 #6 (loan concurrency row locking, schedule clearing with retained dueDay, monthly recurrence anchoring, metadata edit pause/snooze preservation, LoanForm dueDay precedence).
  - Tests: `test:finance` (52/52), `test:reminders` (55/55), `typecheck` clean, `build` clean, `git diff --check` clean.

---

## 4. Sol Review Round 2 & Round 3 Bounded Repairs

### 4.1 Sol Review Round 2 (Reviewed SHA: `7cef742abbb238f79c04f134fa9c0bd872a8db54`)
- **Verdict:** `FAIL` (5 evidenced P1 findings, no P0).
- **Findings Identified:**
  1. `P1`: Loan metadata edit resubmits `00:00Z` midnight timestamp, causing false `dueChanged` triggering pause/snooze loss.
  2. `P1`: Paid credit-card cycles retain monthly recurrence; scheduler tick creates reminders for paid cycles.
  3. `P1`: Loan closure (`closeLoan`/`archiveLoan`) reads loan before tx, potentially missing a concurrently linked obligation.
  4. `P1`: `ObligationForm.tsx` initializes `dueAt` from `nextDueAt`, replacing recurrence anchor on edit.
  5. `P1`: Changing `dueDay` overrides an explicit `nextEmiDate: null`.

### 4.2 Round 3 Dispatches
- **Worker A Dispatch (Repair 3-A):**
  - Task ID: `tsk_m4dtg58sxq19y`
  - Dispatch ID: `dsp_m4dtgpj2jx62d`
  - Pane: `wC:p4` (settled & released)
  - Worktree: `/home/openclaw/Projects/NutriSnap-worker-a`
  - Agent: `agy (agy-manickam)`
  - Status: **COMPLETED / SUCCEEDED**
  - Commit SHA: `bb6b966ff2be7cf9cee33ca8f7959aa8db1565ec`
  - Files Changed:
    - `src/lib/finance/credit-card-service.ts`
    - `src/lib/finance/payment-lifecycle.test.ts`
  - Findings Resolved: Finding P1 #2 (CC cycle obligation deactivation on payoff with `recurrenceType: 'ONCE'`, `isActive: false`, purge deliveries; safe restoration on reversal).
  - Tests: `test:finance` (54/54), `test:reminders` (55/55), `typecheck` clean, `git diff --check` clean.

- **Worker B Dispatch (Repair 3-B):**
  - Task ID: `tsk_m4dtgfjsw51rm`
  - Dispatch ID: `dsp_m4dth45artzjt`
  - Pane: `wC:p5` (settled & released)
  - Worktree: `/home/openclaw/Projects/NutriSnap-worker-b`
  - Agent: `agy (agy-rohit)`
  - Status: **COMPLETED / SUCCEEDED**
  - Commit SHA: `fae4d7944a90272a9c763893cfdc4441d4fb90a0`
  - Files Changed:
    - `src/components/finance/LoanForm.tsx`
    - `src/components/finance/ObligationForm.tsx`
    - `src/lib/finance/finance-service.ts`
    - `src/lib/finance/loan-service.ts`
    - `src/lib/finance/loan.test.ts`
  - Findings Resolved: Findings P1 #1, #3, #4, #5 (LoanForm exact timestamp preservation & calendar date comparison in loan-service.ts; loan closure re-read lock `SELECT FOR UPDATE` inside tx; ObligationForm & finance-service recurrence anchor `dueAt` preservation; explicit `nextEmiDate: null` honored on `dueDay` edits).
  - Tests: `test:finance` (54/54), `test:reminders` (55/55), `test:life-hub` (110/110), `typecheck` clean, `build` clean, `git diff --check` clean.
