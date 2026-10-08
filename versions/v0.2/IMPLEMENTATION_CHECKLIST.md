# v0.2 Implementation Checklist

## V2-000 Architecture
- [x] V2-0001 v0.1 final baseline identified.
- [x] V2-0002 schema proposal updated against final v0.1.
- [x] V2-0003 Gemini 3.1 Pro High architecture review Gate A repaired and ready for re-review.
- [x] V2-0004 OPEN_QUESTIONS resolved (V2-Q001 through V2-Q006 all resolved).
- [x] V2-0005 migration rehearsal plan approved.

## V2-100 Update foundation
- [x] V2-1001 edit account metadata.
- [x] V2-1002 opening-balance safety rule (editable only when account has zero posted transactions).
- [x] V2-1003 edit standalone income/expense.
- [x] V2-1004 edit transfer atomically.
- [x] V2-1005 edit obligation.
- [x] V2-1006 archive flows.
- [x] V2-1007 linked-transaction restrictions (block generic edit/delete on Wishlist, Loan, Debt, Obligation links).
- [x] V2-1008 authorization negatives.

## V2-200 Personal Debt
- [x] V2-2001 schema/model.
- [x] V2-2002 create RECEIVABLE.
- [x] V2-2003 create PAYABLE.
- [x] V2-2004 additional lend/borrow.
- [x] V2-2005 partial collect.
- [x] V2-2006 partial repay.
- [x] V2-2007 settle.
- [x] V2-2008 overdue/due.
- [x] V2-2009 reminder.
- [x] V2-2010 account balance integration.
- [x] V2-2011 income/expense exclusion.
- [x] V2-2012 UI + responsive.

## V2-300 Loans & EMI
- [x] V2-3001 Loan schema (including emiGeneratesExpense, principalAlreadyRecognized).
- [x] V2-3002 LoanPayment schema (transactionId and obligationOccurrenceId unique scalar FKs).
- [x] V2-3003 add existing running loan snapshot.
- [x] V2-3004 Personal/Home/Vehicle/Education/Gold.
- [x] V2-3005 Product EMI.
- [x] V2-3006 Credit Card EMI rule (snapshot vs purchase conversion).
- [x] V2-3007 create/link EMI obligation & delegation from Obligation fulfillment to LoanService.
- [x] V2-3008 record EMI payment exactly once (occurrence-idempotent).
- [x] V2-3009 known-principal outstanding update.
- [x] V2-3010 unknown-principal no guessing (UI guidance provided).
- [x] V2-3011 reconcile outstanding.
- [x] V2-3012 close/archive.
- [x] V2-3013 UI + responsive.

## V2-400 Wishlist
- [x] V2-4001 schema (transactionId unique scalar FK on WishlistItem).
- [x] V2-4002 create/edit.
- [x] V2-4003 priority/status.
- [x] V2-4004 target price/max budget.
- [x] V2-4005 planned account.
- [x] V2-4006 Mark Purchased.
- [x] V2-4007 optional exactly-once Expense & generic edit/delete protection.
- [x] V2-4008 Wishlist purchase reversal ("Unmark as Purchased" atomic flow).
- [x] V2-4009 archive.
- [x] V2-4010 UI + responsive.

## V2-500 Dashboard
- [x] V2-5001 Money overview read model.
- [x] V2-5002 friends owe me.
- [x] V2-5003 I owe friends.
- [x] V2-5004 loan outstanding.
- [x] V2-5005 next EMI.
- [x] V2-5006 wishlist planned total.
- [x] V2-5007 Today near-term integration.

## V2-600 Reminders
- [x] V2-6001 debt due reminder.
- [x] V2-6002 EMI reminder.
- [x] V2-6003 no second scheduler.
- [x] V2-6004 durable delivery dedupe retained.
- [x] V2-6005 Telegram ownership/idempotency.

## V2-650 Payment Lifecycle, Reminder Management & Credit Cards
- [x] V2-6511 domain-aware Undo Paid (`revertObligationPayment`).
- [x] V2-6512 loan EMI reversal (`LoanService.revertEmiPayment`).
- [x] V2-6521 health reminder edit, pause/resume, delete UI.
- [x] V2-6522 financial obligation edit, pause/resume, delete/archive, payment history.
- [x] V2-6523 schedule change cancels obsolete future unsent deliveries and preserves history.
- [x] V2-6531 Credit Card configuration (`creditLimit`, `statementDay`, `paymentDueDay`, `defaultPaymentAccountId`).
- [x] V2-6532 CreditCardStatement model and service with month-end clamping.
- [x] V2-6533 CreditCardPayment model and service generating TRANSFER transactions.
- [x] V2-6534 Partial-payment status (`OPEN | PARTIAL | PAID`), reminder sync, and full-payment completion.
- [x] V2-6535 Credit Card reversal (`CreditCardService.revertPayment`).
- [x] V2-6536 Credit Card UI (card list, statements, payment history, partial payment modal).
- [x] V2-6541 focused test suites and integration verification.

## V2-700 Final
- [x] V2-7001 full migration rehearsal.
- [x] V2-7002 finance tests.
- [x] V2-7003 debt tests.
- [x] V2-7004 loan tests.
- [x] V2-7005 wishlist tests.
- [x] V2-7006 security tests.
- [x] V2-7007 Today tests.
- [x] V2-7008 full v0.1 regression.
- [x] V2-7009 browser UAT (PASS: All UAT-001..UAT-1100 scenarios verified on https://wealth.mkcyberlabs.in).
- [ ] V2-7010 owner review (Pending Owner review).
