# v0.2 Open Questions

Resolve before or during Architecture Gate A.

## V2-Q001 — Credit Card EMI treatment

Need one explicit policy to avoid double-counting:
- purchase expense at conversion time vs;
- each EMI payment as expense.

Recommended v0.2 default:
For an already-running Credit Card EMI added as a snapshot, record future EMI cash payments only. Do not reconstruct or create the historical full purchase expense.

## V2-Q002 — Opening balance correction

Should v0.2 add a formal balance adjustment ledger type?

Recommended initial rule:
- openingBalance editable only when account has no transactions;
- otherwise explicit reconciliation feature can be added later.

## V2-Q003 — Loan payment principal split

Recommended:
principal/interest split optional.
Never calculate a principal split from EMI amount alone.

## V2-Q004 — Debt interest

Should friend/family debts support interest?

Recommended v0.2:
NO.
Track principal only.
Add interest later if actually needed.

## V2-Q005 — Wishlist savings allocation

Should wishlist track money saved/reserved?

Recommended v0.2:
NO virtual reservation ledger.
Track target/max budget and purchase state only.
A future Savings Goals module can handle earmarked savings.

## V2-Q006 — Existing EMI obligations

Recommended:
Do not auto-convert.
Allow owner/user to explicitly link an existing EMI obligation to a newly created Loan.
