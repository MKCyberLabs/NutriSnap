# v0.2 Test Matrix

## A. Accounting invariants

- V2-T001 LEND decreases source account.
- V2-T002 LEND does not increase Expense.
- V2-T003 DEBT_COLLECT increases receiving account.
- V2-T004 DEBT_COLLECT does not increase Income.
- V2-T005 BORROW increases account.
- V2-T006 BORROW does not increase Income.
- V2-T007 DEBT_REPAY decreases account.
- V2-T008 DEBT_REPAY does not increase Expense.
- V2-T009 TRANSFER still excluded from Income/Expense.
- V2-T010 old v0.1 totals unchanged after migration.

## B. Personal debt

- V2-T020 create receivable.
- V2-T021 create payable.
- V2-T022 partial collection.
- V2-T023 partial repayment.
- V2-T024 additional lending.
- V2-T025 additional borrowing.
- V2-T026 outstanding never negative.
- V2-T027 exact settlement -> SETTLED.
- V2-T028 cross-user debt rejected.
- V2-T029 foreign account rejected.
- V2-T030 repeat collection submission idempotent where operation has an idempotency key.

## C. Loans

- V2-T040 add existing Personal Loan snapshot.
- V2-T041 add Home Loan.
- V2-T042 add Product EMI.
- V2-T043 existing loan creation does not change cash balance.
- V2-T044 existing loan creation does not create Income.
- V2-T045 EMI paid creates one linked Expense when configured.
- V2-T046 duplicate same occurrence does not create second payment.
- V2-T047 known principal component reduces outstanding.
- V2-T048 unknown principal component does not guess reduction.
- V2-T049 explicit reconciliation updates outstanding.
- V2-T050 next EMI recurrence deterministic.
- V2-T051 cross-user loan rejected.
- V2-T052 close loan preserves history.

## D. Wishlist

- V2-T060 create item no account balance change.
- V2-T061 create item no expense.
- V2-T062 edit target/max budget.
- V2-T063 mark ready.
- V2-T064 mark purchased without transaction.
- V2-T065 mark purchased with one expense.
- V2-T066 repeat purchase does not duplicate expense.
- V2-T067 actualPrice persists.
- V2-T068 cross-user wishlist rejected.

## E. Update flows

- V2-T080 account metadata update.
- V2-T081 unsafe opening balance edit blocked according to final rule.
- V2-T082 standalone expense edit recalculates account.
- V2-T083 income edit.
- V2-T084 transfer edit moves balances atomically.
- V2-T085 obligation future edit.
- V2-T086 past occurrence remains immutable.
- V2-T087 generic editor cannot corrupt debt-linked transaction.
- V2-T088 generic editor cannot corrupt loan-linked transaction.

## F. Migration

- V2-T100 v0.1 -> v0.2 PostgreSQL migration PASS.
- V2-T101 row counts preserved.
- V2-T102 account balances preserved.
- V2-T103 monthly totals preserved.
- V2-T104 reminder deliveries preserved.
- V2-T105 historical Investment category rows preserved.

## G. Security

- V2-T120 forged debt ID.
- V2-T121 forged loan ID.
- V2-T122 forged payment ID.
- V2-T123 forged wishlist ID.
- V2-T124 forged account link.
- V2-T125 invalid enum.
- V2-T126 invalid amount.
- V2-T127 no credential fields.
- V2-T128 no payment initiation.

## H. Browser UAT

Desktop + 390px mobile:
- Friends & Family list/create/detail/repay/collect;
- Loans list/add/payment/reconcile;
- Wishlist add/edit/purchase;
- Money overview;
- update flows;
- no horizontal overflow;
- no console blocking errors.

## Integrated acceptance scenario

1. Bank opening balance ₹50,000.
2. Lend friend ₹10,000.
3. Liquid becomes ₹40,000.
4. Monthly Expense unchanged.
5. Friend owes me ₹10,000.
6. Collect ₹4,000.
7. Liquid becomes ₹44,000.
8. Friend owes me ₹6,000.
9. Borrow ₹5,000 from another friend.
10. Liquid becomes ₹49,000.
11. Monthly Income unchanged.
12. I owe friend ₹5,000.
13. Add existing Personal Loan outstanding ₹1,20,000, EMI ₹6,000.
14. Liquid remains ₹49,000.
15. Record EMI paid ₹6,000.
16. Exactly one expense/payment created.
17. Add laptop wishlist target ₹80,000.
18. No balance change.
19. Mark laptop purchased ₹75,000 with expense.
20. Exactly one purchase expense.
21. Full dashboard totals reconcile.

This scenario is release-critical.
