# NutriSnap R004 Round 3 — Worker B Repair Notes

**Assigned Agent:** `agy-rohit`
**Working Directory:** `/home/openclaw/Projects/NutriSnap-worker-b`
**Branch:** `worker-b/loans-obligations-reminders`
**Base SHA:** `6f487849c921f414358b959e00ebdd9d89c58077`
**Task ID:** `tsk_m4fdcv9st39h7`
**Dispatch ID:** `dsp_m4fddd647mffc`

---

## 1. Scope & Exclusive Ownership

Worker B has EXCLUSIVE ownership of:
- `src/components/finance/CreditCardDialog.tsx`
- `src/components/finance/RecordEmiModal.tsx`
- `src/app/finance/bills/page.tsx`
- `src/app/finance/loans/page.tsx`
- `src/app/api/auth/login/route.ts`
- Relevant tests: `src/lib/finance/loan.test.ts`

Worker A files (`finance-service.ts`, `debt-service.ts`, `ObligationForm.tsx`, `payment-lifecycle.test.ts`, `debt.test.ts`) are strictly untouched.

---

## 2. Tickets & Implementation Details

### 1. [P1] SOL-R004-003 — Accounts Statement Repayment Retry Identity (Idempotency Key)
- **File:** `src/components/finance/CreditCardDialog.tsx`
- **Defect:** `CreditCardDialog` (Accounts page) `handleRecordPayment` called `recordCreditCardPayment` without passing an `idempotencyKey`. The backend service only deduplicates partial payments when `idempotencyKey` is provided. Repeated submissions or network retries double-debit the payer and reduce statement balance twice.
- **Repair:**
  - Added module-level helper `generateRepaymentIdempotencyKey(): string` generating UUID / nonce keys prefixed with `cc-repay-`.
  - Added `paymentIdempotencyKey` state to `CreditCardDialog`.
  - Initialized stable per-intent `paymentIdempotencyKey` when opening the payment modal (both via button click and Dialog `onOpenChange(true)`).
  - Passed `idempotencyKey` in payload to `recordCreditCardPayment(session.id, { statementId, fromAccountId, amount, note, idempotencyKey })`.
  - Preserved `paymentIdempotencyKey` across errors/retries in the `catch` block.
  - Reset `paymentIdempotencyKey` only upon successful submission or when closing/reopening the modal for a new payment intent.

### 2. [P1] SOL-R004-009 — RecordEmiModal Retry Identity (Idempotency Key)
- **Files:** `src/components/finance/RecordEmiModal.tsx`, `src/app/finance/loans/page.tsx`
- **Defect:** `RecordEmiModal` submitted EMI payments without an `idempotencyKey`. Retrying a lost response causes the service to debit principal again, create a second expense, and advance `nextEmiDate` again.
- **Repair:**
  - Updated `RecordEmiModalProps['onSubmit']` to accept `idempotencyKey?: string`.
  - Added module-level helper `generateEmiIdempotencyKey(): string` generating UUID / nonce keys prefixed with `emi-pay-`.
  - Maintained stable per-intent `idempotencyKey` in state in `RecordEmiModal` (initialized on mount and refreshed when `open` transitions to true).
  - Forwarded `idempotencyKey` in `onSubmit` payload inside `handleSubmit`.
  - Preserved `idempotencyKey` across catch/error blocks so retries reuse the same identity.
  - Regenerated `idempotencyKey` upon successful submission and modal reopen.
  - Verified `src/app/finance/loans/page.tsx` passes `params` (including `idempotencyKey`) straight into `recordEmiPayment(session.id, params)`.

### 3. [P1] SOL-R004-011 — Isolated Test Datasource in V2-R004-ROUND2-B Suite in loan.test.ts
- **File:** `src/lib/finance/loan.test.ts`
- **Defect:** Test suite `V2-R004-ROUND2-B` instantiated `new PrismaClient()` without specifying `datasourceUrl: TEST_DB_URL`. It fell back to the default `DATABASE_URL` instead of the test database `localhost:5433`/`nutrisnap_test`.
- **Repair:**
  - Updated `new PrismaClient()` to `new PrismaClient({ datasourceUrl: TEST_DB_URL })`.
  - Added preflight assertion before any write verifying `TEST_DB_URL.includes('5433') && TEST_DB_URL.includes('nutrisnap_test')`.
  - Added cleanup of all created test data (credit card payments, statements, loans, occurrences, transactions, obligations, accounts, user) in a `finally` block before `db.$disconnect()`.

### 4. [P2] SOL-R004-004 — Fresh Login Timezone & ObligationForm Callers in Bills Page
- **Files:** `src/app/api/auth/login/route.ts`, `src/app/finance/bills/page.tsx`
- **Defect:**
  - In `login/route.ts`, `responseData` omitted `timezone: user.timezone`, leaving client session without timezone on fresh login.
  - In `bills/page.tsx`, the 3 `<ObligationForm>` callers omitted `timezone={userTimezone}`.
  - In `StatementRepaymentModal`, timezone fell back to browser timezone on fresh login, causing `toPaymentDateIso` date shifts.
- **Repair:**
  - Added `timezone: user.timezone` to `responseData` in `src/app/api/auth/login/route.ts`.
  - In `src/app/finance/bills/page.tsx`:
    - Updated `userTimezone` to fallback to `'Asia/Kolkata'` if none configured.
    - Passed `timezone={userTimezone}` to all 3 `<ObligationForm>` callers (header action, empty state action, and edit modal).
    - In `StatementRepaymentModal`: resolved `tz = userTimezone || obligation?.user?.timezone || 'Asia/Kolkata'` ensuring `toPaymentDateIso(paymentDate, tz)` constructs the midday instant in configured timezone so selecting Nov 15 in `Pacific/Kiritimati` does not drift to Nov 16.

---

## 3. Verification & Results

- `npm run typecheck` — 0 errors.
- `npx tsx --test src/lib/finance/loan.test.ts` — 10/10 test suites passed.
- `npm run test:finance` — 79/79 tests passed against `localhost:5433/nutrisnap_test`.
- Regression suite `V2-R004-ROUND3-B` verifies:
  - Isolated test database connection and preflight assertion.
  - CreditCardDialog idempotency key lifecycle and retry deduplication without duplicate transfer or statement overpayment.
  - RecordEmiModal idempotency key generation and retry deduplication without duplicate expense or principal over-decrement.
  - Login route `responseData` timezone presence.
  - Bills page ObligationForm callers timezone prop and midday anchor date stability in Pacific/Kiritimati.
