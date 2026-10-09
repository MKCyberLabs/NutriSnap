# NutriSnap R004 Round 2 — Worker B Repair Notes

**Assigned Agent:** `agy-rohit`
**Working Directory:** `/home/openclaw/Projects/NutriSnap-worker-b`
**Branch:** `worker-b/loans-obligations-reminders`
**Base SHA:** `7b1a06d2af452a4d8280cc8d59634e12fe75aaac`
**Task ID:** `tsk_m4faxzkkg673v`
**Dispatch ID:** `dsp_m4fayfdpcrvp0`

---

## 1. Scope & Exclusive Ownership

Worker B has EXCLUSIVE ownership of:
- `src/lib/finance/loan-service.ts`
- `src/lib/finance/credit-card-service.ts`
- `src/components/finance/LoanForm.tsx`
- `src/app/finance/loans/page.tsx`
- `src/app/finance/bills/page.tsx`
- Relevant tests: `src/lib/finance/loan.test.ts`

Worker A files (`finance-service.ts`, `scheduler.ts`, `debt-service.ts`, `ObligationForm.tsx`) are strictly untouched.

---

## 2. Tickets & Implementation Details

### 1. [P1] SOL-R004-003: Idempotency Key for Partial Statement Payments
- **File:** `src/app/finance/bills/page.tsx`
- **Defect:** `StatementRepaymentModal` submitted payments to `recordCreditCardPayment` without `idempotencyKey`. The backend service only deduplicated partial payments when `idempotencyKey` was provided.
- **Repair:**
  - Added persistent `idempotencyKey` state generated via `generateRepaymentIdempotencyKey()` (`crypto.randomUUID()` or timestamp fallback).
  - Preserved `idempotencyKey` during submission errors/retries in `StatementRepaymentModal` so retried network calls atomically deduplicate without double debits.
  - Reset `idempotencyKey` when opening modal or on successful repayment.

### 2. [P2] SOL-R001-011: Pass Configured User Timezone to LoanForm Callers
- **Files:** `src/lib/finance/loan-service.ts`, `src/app/finance/loans/page.tsx`, `src/components/finance/LoanForm.tsx`
- **Defect:** `getLoans` and `getLoanById` omitted `user.timezone`. `loans/page.tsx` did not pass `timezone` to the three `LoanForm` callers, causing fallback to browser local timezone and date drift in extreme timezones (e.g. Nov 14 instead of Nov 15 in Pacific/Kiritimati).
- **Repair:**
  - Added `user: { select: { timezone: true } }` in `getLoans` and `getLoanById` queries and mapped `user: l.user ? { timezone: l.user.timezone } : null`.
  - In `src/app/finance/loans/page.tsx`, resolved `userTimezone = loans.find(l => l.user?.timezone)?.user?.timezone || session.timezone`.
  - Passed `timezone={userTimezone}` to top and EmptyState `LoanForm` instances, and `timezone={editingLoan?.user?.timezone || userTimezone}` to edit `LoanForm`.
  - In `LoanForm.tsx`, updated `configuredTimezone` to check `loan?.user?.timezone` as well.

### 3. [P2] SOL-R002-006: Legacy Unlinked EMI Reversal Requires Explicit Date
- **File:** `src/lib/finance/loan-service.ts`
- **Defect:** In `revertEmiPayment`, unlinked legacy payments without note tags or linked occurrences silently fell back to retaining `currentLoan.nextEmiDate`. This advanced schedule is not restored, leaving the reverted installment omitted from the schedule.
- **Repair:**
  - In `revertEmiPayment`, when reversing a payment where scheduled date cannot be recovered from tags or linked occurrence, rejection with `throw new Error('Explicit revertToDate required to reverse legacy unlinked payment')` is enforced unless `revertToDate` is explicitly provided.
  - Validates and parses `revertToDate` when provided (`new Date(input.revertToDate)`).

### 4. [P2] SOL-R004-004: Statement Bill Row Lifecycle Controls & Timezone Parsing
- **File:** `src/app/finance/bills/page.tsx`
- **Defect:** `StatementBillRow` omitted Pause/Resume reminder toggle buttons and Archive button. In `StatementRepaymentModal`, `new Date(paymentDate).toISOString()` produced UTC midnight instead of local date in negative-offset timezones.
- **Repair:**
  - Added `onToggleActive` and `onArchive` props to `StatementBillRowProps` and `StatementBillRow`.
  - Implemented `handleToggle` with toast notifications for pausing/resuming statement reminders.
  - Added Pause/Play and Archive action buttons in `StatementBillRow` alongside "Paused" pill indicator when inactive.
  - Added timezone-safe helpers `getInitialPaymentDate(userTz)` and `toPaymentDateIso(paymentDateStr, userTz)` using `@date-fns/tz` with midday anchor (12:00 local time) so calendar dates never shift across midnight in negative-offset timezones.

### 5. [P2] SOL-R004-008: Server-Side Account Type Validation for Statement Repayment
- **File:** `src/lib/finance/credit-card-service.ts`
- **Defect:** `fromAccountId` in `recordCreditCardPayment` was checked for ownership but not account `type`, allowing payments from another credit card.
- **Repair:**
  - In `recordCreditCardPayment`, queried `fromAccount.type`.
  - Enforced that `fromAccount.type !== 'CREDIT_CARD'` with error `'Payment source cannot be a credit card (Source account cannot be the credit card being paid)'` (matching both regex expectations).
  - Enforced `['BANK', 'CASH', 'WALLET'].includes(fromAccount.type)`.

---

## 3. Verification Results & Evidence

1. `npm run typecheck`:
   - Output: `tsc --noEmit` exited 0 with 0 errors.

2. `npm run test:finance`:
   - 74 tests passing (0 failing, 0 skipped).
   - Includes new suite `V2-R004-ROUND2-B: Round 2 Worker B Verification Suite (SOL-R004-003, SOL-R001-011, SOL-R002-006, SOL-R004-004, SOL-R004-008)` in `src/lib/finance/loan.test.ts`.

3. `git diff --check`:
   - Clean, no whitespace or EOF errors.
