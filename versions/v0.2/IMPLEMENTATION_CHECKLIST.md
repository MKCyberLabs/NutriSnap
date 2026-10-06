# v0.2 Implementation Checklist

## V2-000 Architecture
- [ ] V2-0001 v0.1 final baseline identified.
- [ ] V2-0002 schema proposal updated against final v0.1.
- [ ] V2-0003 Gemini 3.1 Pro High architecture review Gate A repaired and ready for re-review.
- [x] V2-0004 OPEN_QUESTIONS resolved (V2-Q001 through V2-Q006 all resolved).
- [ ] V2-0005 migration rehearsal plan approved.

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
- [ ] V2-3001 Loan schema (including emiGeneratesExpense, principalAlreadyRecognized).
- [ ] V2-3002 LoanPayment schema (transactionId and obligationOccurrenceId unique scalar FKs).
- [ ] V2-3003 add existing running loan snapshot.
- [ ] V2-3004 Personal/Home/Vehicle/Education/Gold.
- [ ] V2-3005 Product EMI.
- [ ] V2-3006 Credit Card EMI rule (snapshot vs purchase conversion).
- [ ] V2-3007 create/link EMI obligation & delegation from Obligation fulfillment to LoanService.
- [ ] V2-3008 record EMI payment exactly once (occurrence-idempotent).
- [ ] V2-3009 known-principal outstanding update.
- [ ] V2-3010 unknown-principal no guessing (UI guidance provided).
- [ ] V2-3011 reconcile outstanding.
- [ ] V2-3012 close/archive.
- [ ] V2-3013 UI + responsive.

## V2-400 Wishlist
- [ ] V2-4001 schema (transactionId unique scalar FK on WishlistItem).
- [ ] V2-4002 create/edit.
- [ ] V2-4003 priority/status.
- [ ] V2-4004 target price/max budget.
- [ ] V2-4005 planned account.
- [ ] V2-4006 Mark Purchased.
- [ ] V2-4007 optional exactly-once Expense & generic edit/delete protection.
- [ ] V2-4008 Wishlist purchase reversal ("Unmark as Purchased" atomic flow).
- [ ] V2-4009 archive.
- [ ] V2-4010 UI + responsive.

## V2-500 Dashboard
- [ ] V2-5001 Money overview read model.
- [ ] V2-5002 friends owe me.
- [ ] V2-5003 I owe friends.
- [ ] V2-5004 loan outstanding.
- [ ] V2-5005 next EMI.
- [ ] V2-5006 wishlist planned total.
- [ ] V2-5007 Today near-term integration.

## V2-600 Reminders
- [ ] V2-6001 debt due reminder.
- [ ] V2-6002 EMI reminder.
- [ ] V2-6003 no second scheduler.
- [ ] V2-6004 durable delivery dedupe retained.
- [ ] V2-6005 Telegram ownership/idempotency.

## V2-700 Final
- [ ] V2-7001 full migration rehearsal.
- [ ] V2-7002 finance tests.
- [ ] V2-7003 debt tests.
- [ ] V2-7004 loan tests.
- [ ] V2-7005 wishlist tests.
- [ ] V2-7006 security tests.
- [ ] V2-7007 Today tests.
- [ ] V2-7008 full v0.1 regression.
- [ ] V2-7009 browser UAT.
- [ ] V2-7010 owner review.
