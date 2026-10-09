# Worker A: Finance and Backend Repairs — Execution Notes

## Objective
NutriSnap V0.3 Sol Review 10 Actionable Issues Repair Cycle.
Worker A owns:
- `src/lib/finance/finance-service.ts`
- `src/lib/finance/loan-service.ts`
- `src/lib/scheduler.ts`
- Backend regression test files:
  - `src/lib/finance/payment-lifecycle.test.ts`
  - `src/lib/finance/debt.test.ts`
  - `src/lib/finance/loan.test.ts`
  - `src/lib/reminders/scheduler-tick.test.ts`

## Assigned Tickets
1. **SOL-R001-007 (P1)**: Linked-loan occurrence matching conflates previous local date with active EMI
2. **SOL-R004-016 (P1)**: Money overview loses opening debt principal because projection omits provenance notes
3. **SOL-R005-001 (P1)**: Direct EMI reversal bypasses latest-only schedule protection
4. **SOL-R004-017 (P2)**: Bills Undo still reports a loan reversal for historical orphan completions
5. **SOL-R005-002 (P2)**: Expired delivery leases bypass durable maximum-attempt policy
6. **SOL-R003-005 (P2)**: Fully paid card statements excluded from Bills paid-status and Undo UI

## Execution Summary
- [x] Inspect existing implementation and test coverage for each ticket.
- [x] Implement fix for SOL-R001-007 (`matchesLoanActiveEmi` strict local calendar date match) and add test in `payment-lifecycle.test.ts`.
- [x] Implement fix for SOL-R004-016 (`note: true` in `getMoneyOverview` debt transaction select) and add test in `debt.test.ts`.
- [x] Implement fix for SOL-R005-001 (`revertEmiPayment` latest-only protection and fallback) and add test in `loan.test.ts`.
- [x] Implement fix for SOL-R004-017 (`revertObligationPayment` check on `loanRes.alreadyReversed`) and add test in `payment-lifecycle.test.ts`.
- [x] Implement fix for SOL-R005-002 (`processSchedulerTick` max attempts check on expired lease recovery across obligation, debt, and loan branches) and add test in `scheduler-tick.test.ts`.
- [x] Implement fix for SOL-R003-005 (`getObligations` and `getObligationById` expose `isArchived`, include creditCardStatements even if archived) and add test in `payment-lifecycle.test.ts`.
- [x] Run full test suites:
  - `npm run typecheck` (passed, 0 errors)
  - `npm run test:finance` (passed, 104/104 tests)
  - `npm run test:reminders` (passed, 59/59 tests)
  - `npm run test:life-hub` (passed, 152/152 tests)
  - `npm run test:analysis-contract` (passed, 5/5 tests)
- [x] Commit changes to branch `repair/v0.3-worker-a`.
- [x] Report via `cbds done --outcome succeeded ...`.
