# NutriSnap R001 — Finance CRUD & Reminders CBDS Verification Report

**Date:** 2026-10-08  
**Branch:** `orchestration/finance-crud-reminders-r001`  
**Base Commit:** `4afa5c17e2f227d5000f334c0b210e48c42decb1`  
**cbds Run ID:** `run_m4b5hrvfwv4xw`  
**Orchestrator:** AGY Lead Orchestrator  

---

## 1. Executive Summary & Verdict

- **Local Software Gate:** **PASS** (108/108 life-hub, 50/50 finance, 55/55 reminders, 22/22 security, 16/16 food, 7/7 ui, 6/6 today, 5/5 analysis contract, clean typecheck, clean `git diff --check`).
- **Independent Sol 6.1 Review:** **BLOCKED** by environment bubblewrap sandbox (`bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`), documented in `docs/experiments/NUTRI_R001_SOL_REVIEW_BLOCKED.md`.
- **Status:** **INTEGRATED & VERIFIED LOCALLY — READY FOR BRANCH PUSH (NO MERGE TO MAIN)**.

---

## 2. Review Findings & Resolution Audit

### Prior Sol Review Findings (rpt_m4dgdg0pcvyp2)

| Finding | Severity | Resolution Summary | Evidence File(s) |
| :--- | :--- | :--- | :--- |
| **Finding 1: Foreign default payment account IDs** | P1 | Validated ownership and account type (`BANK`, `CASH`, `WALLET`) on both `createAccount` and `updateAccount`. Added read defense in `getCreditCardDetails` ensuring foreign references return `null`. | `src/lib/finance/finance-service.ts`<br>`src/lib/finance/credit-card-service.ts`<br>`src/lib/finance/transaction-account-crud.test.ts` |
| **Finding 2: Clearing EMI schedule leaves obligation active** | P1 | Atomically deactivates linked obligation (`isActive: false`) and removes pending/snoozed reminder deliveries when EMI amount or schedule date is cleared. | `src/lib/finance/loan-service.ts`<br>`src/lib/finance/loan.test.ts` |
| **Finding 3: Obligation linking not durably idempotent** | P1 | Replaced title/kind search with strict `loan.obligationId` foreign key lookup. Unlinked loans create a new dedicated obligation rather than adopting/hijacking unrelated manual obligations. | `src/lib/finance/loan-service.ts`<br>`src/lib/finance/loan.test.ts` |
| **Finding 4: Monthly day and timezone semantics lost** | P1 | Implemented timezone-aware clamping with `TZDate` and `Asia/Kolkata` default. Preserves target monthly day across February clamping (Feb 28/29) and recovers to Day 31 in March. Synchronizes loan and obligation recurrence. | `src/lib/finance/loan-service.ts`<br>`src/lib/finance/loan.test.ts` |
| **Finding 5: Automatic closure bypasses reminder cleanup** | P1 | Centralized `cleanupLoanRemindersAndObligation` helper invoked across all 4 closure paths: `closeLoan`, `archiveLoan`, full payoff via `recordEmiPayment`, and `reconcileOutstanding('0.00')`. Sets `isActive: false, isArchived: true` and purges pending reminder deliveries. | `src/lib/finance/loan-service.ts`<br>`src/lib/finance/loan.test.ts` |
| **Finding 6: Floating-point conversion in edit payloads** | P2 | Replaced all `parseFloat().toFixed(2)` string conversions in `TransactionForm.tsx`, `AccountForm.tsx`, and `LoanForm.tsx` with clean trimmed decimal strings. Preserves arbitrary Decimal precision end-to-end. | `src/components/finance/TransactionForm.tsx`<br>`src/components/finance/AccountForm.tsx`<br>`src/components/finance/LoanForm.tsx` |

---

### Additional P1 & P2 Findings Addressed in Current Session

#### P1: Prevent editing closed loans from reactivating archived/disabled obligations & stale deliveries
- **Problem:** Updating metadata (e.g. name or notes) on a `CLOSED` loan was reactivating the linked obligation (`isActive: true, isArchived: false`) and could reschedule delivery claims.
- **Fix:** In `src/lib/finance/loan-service.ts` (`updateLoan`), added explicit `isLoanClosed = loan.status === 'CLOSED'` guard. When updating a closed loan:
  1. The obligation remains `isActive: false` and `isArchived: true`.
  2. All pending and snoozed reminder deliveries on the obligation and loan are purged.
  3. No new active obligation is created.
- **Regression Test:** Added Section 5 in `src/lib/finance/loan.test.ts` (`V2-360`) verifying that updating a closed loan preserves `status: 'CLOSED'`, keeps `obligation.isActive === false` and `obligation.isArchived === true`, and produces 0 pending/snoozed reminder deliveries.

#### P1: Protect multiple open/partial credit-card statement cycles from overwriting one another
- **Problem:** `createCreditCardStatement` used a generic `findFirst` for any unarchived `CREDIT_CARD` obligation under the account. If Statement 1 was open (or partial) and Statement 2 was generated, Statement 2 overwrote Statement 1's obligation amount and due date. Additionally, partial payments on Statement 1 overwrote Statement 2's obligation amount, and paying Statement 1 cleared the shared obligation.
- **Fix:** In `src/lib/finance/credit-card-service.ts` (`createCreditCardStatement`):
  1. Inspects existing obligations and their associated active statements.
  2. An existing obligation is reused **only if it has no active (OPEN / PARTIAL / OVERDUE) statement servicing it**.
  3. If another statement cycle is actively open/partial, a **new dedicated cycle-scoped obligation** is created.
  4. In `recordCreditCardPayment`, mutations strictly target `statement.obligation`, leaving overlapping statement obligations untouched.
  5. In `getCreditCardDetails`, `activeStatement` is selected as the earliest due unpaid statement (sorted by `dueDate: 'asc'`), ensuring the soonest due bill is presented first.
- **Regression Test:** Added test `V2-653e` in `src/lib/finance/payment-lifecycle.test.ts` testing two overlapping statement cycles (`2026-10` and `2026-11`), verifying:
  - Statement 2 gets an independent obligation (`ob2Id !== ob1Id`).
  - Statement 1's obligation amount (₹20,000), due date (Nov 5), and pending delivery remain intact when Statement 2 is created.
  - Partial payment of ₹5,000 on Statement 1 updates only Statement 1's obligation to ₹15,000; Statement 2's obligation remains ₹35,000.
  - Full payment of Statement 1 marks Statement 1 paid; Statement 2's obligation remains active with ₹35,000.
  - Partial and full payment on Statement 2 complete independently, culminating in `activeStatement: null` with full audit history in `allStatements`.

---

## 3. Credit-Card Statement Generation Audit & Open Product Decisions (P2)

### Current Architecture
- Credit card statement creation currently accepts explicit statement amounts (`statementAmount`) and due dates (`dueDate`) from user entry (or external bank statement sync).
- The helper `calculateStatementDates(statementDay, paymentDueDay, year, monthIndex)` deterministically calculates billing dates and due dates with month-end clamping (Feb 28/29, Apr 30).

### Audit Findings & Open Product Decisions (`NSV01-Q014` / `V2-Q003`)
1. **Ledger vs Bank Statement Amount Reconciliation:**
   - A credit card ledger balance reflects logged transactions (`expenses - payments`).
   - However, actual bank statements include bank-applied interest charges, late fees, annual card fees, and cashback/reward credits that may not be recorded as manual transactions.
   - **Product Decision Required:** When statement generation is triggered automatically, should NutriSnap:
     - **Option A (Recommended):** Pre-fill the statement amount as a *suggested* amount derived from ledger transactions during the cycle period `[prevStatementDate, currentStatementDate]`, but require user confirmation before final posting.
     - **Option B (Strict Auto):** Automatically create the statement from raw ledger transactions without user confirmation. (Risk: discrepancies with the official bank bill).
2. **Cycle Anchor for New Accounts:**
   - If an account has `statementDay` configured but no prior statement exists, the initial cycle start date defaults to account creation date or the first transaction date.
   - **Product Decision:** Define canonical cycle anchor behavior for first-cycle statement generation when no historical statement exists.

---

## 4. Deterministic Verification Evidence

### Test Suite Execution Summary

| Suite / Gate | Command | Result | Duration | Tests Passed |
| :--- | :--- | :--- | :--- | :--- |
| **Analysis Contract** | `npm run test:analysis-contract` | **PASS** | 156ms | 5 / 5 |
| **Meal / Food Invariants** | `npm run test:food` | **PASS** | 134ms | 16 / 16 |
| **Reminder & Recurrence** | `npm run test:reminders` | **PASS** | 1761ms | 55 / 55 |
| **Today Dashboard Scoping** | `npm run test:today` | **PASS** | 168ms | 6 / 6 |
| **Security & Auth Routing** | `npm run test:security` | **PASS** | 407ms | 22 / 22 |
| **UI Design & Formatting** | `npm run test:ui` | **PASS** | 196ms | 7 / 7 |
| **Finance & Double-Entry** | `npm run test:finance` | **PASS** | 2526ms | 50 / 50 |
| **Integrated Life-Hub Acceptance** | `npm run test:life-hub` | **PASS** | 2216ms | 108 / 108 |
| **Git Diff Cleanliness** | `git diff --check` | **PASS** | < 1s | Clean |
| **TypeScript Strict Check** | `npm run typecheck` | **PASS** | 5.8s | 0 errors |
| **Local Software Gate** | `./scripts/verify-v02-local.sh` | **PASS** | 24s | All gates PASS |

### Next.js Production Build Notice
- Next.js production build (`next build`) in this environment is constrained by available RAM (~338MB available, whereas Next.js 15 requires > 1.8GB as documented in `DEVELOPMENT_BASELINE.md` and checked in `scripts/verify-v02-local.sh`).
- TypeScript strict checking (`tsc --noEmit`) passes with 0 errors.

---

## 5. Independent Review Status

- **Review Task:** `tsk_m4djw0enkbwp6` in cbds run `run_m4b5hrvfwv4xw`.
- **Reviewer:** Codex (`gpt-6.1-sol`, `high` reasoning effort, read-only).
- **Dispatch Outcome:** **BLOCKED by environment sandbox**.
- **Evidence:** Documented in `docs/experiments/NUTRI_R001_SOL_REVIEW_BLOCKED.md`. The bubblewrap sandbox failed with:
  ```text
  bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
  ```
- **Review Verdict:** **BLOCKED** (per instructions, no false PASS claim is made).

---

## 6. Safety & Security Guardrails

- **Zero Credential Exposure:** No bank passwords, PINs, OTPs, CVVs, or broker credentials are stored or requested.
- **Double-Entry Integrity:** `TRANSFER` transactions move value between user-owned accounts without inflating income or expense totals.
- **Authorization:** Ownership checks enforced server-side on all mutations.
- **No Production Operations:** No merge to `main`, no deployment, and no production data access was performed.
