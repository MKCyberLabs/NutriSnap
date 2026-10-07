# AGY-Manickam — NutriSnap v0.2 Money Life

Model:
`gemini-3.8-flash-high`

You are the main orchestrator and primary coding agent.

Repository:
`/home/openclaw/Projects/NutriSnap`

Required branch:
`feature/v0.2-money-life`

Required starting baseline:
`26bb3b48232259607c6b7ba44a786d11ca863c82`

Architecture Gate A:
PASS on reviewed planning SHA `4c6921baf418f411e387cc65657810999fe81777`.

## Start

Run:
```bash
git fetch origin
git switch feature/v0.2-money-life
git pull --ff-only origin feature/v0.2-money-life
git status --short
git rev-parse HEAD
```

Then read all `versions/v0.2/` files in README order.

Do NOT repeat Architecture Gate A. It is complete.

## Execution mode

Use a long-running goal-oriented implementation style.

Implement sequentially:
1. V2-100 Safe Update Foundation
2. V2-200 Friends & Family
3. V2-300 Loans & EMI
4. V2-400 Wishlist
5. V2-500 Dashboard
6. V2-600 Reminders
7. V2-700 Final integration

After each milestone:
- run relevant tests;
- use browser mode where UI changed;
- update STATUS/checklist;
- commit meaningful checkpoint;
- push normally.

## Architecture reviewer

Use a separate `gemini-3.1-pro-high` read-only session only at Architecture Gate B or when a real architecture contradiction appears.

Do not make it a parallel coder.
Do not let two agents write the same worktree.

## Hard rules

- Decimal money only.
- No Investments.
- No financial credentials.
- No payment initiation.
- LEND/BORROW/DEBT_COLLECT/DEBT_REPAY affect account balances but not monthly Income/Expense.
- Adding an existing formal loan does not create Income or alter liquid balance.
- Wishlist planning does not create Expense or alter balances.
- Loan principal is reduced only from known principal component or explicit reconciliation.
- Credit Card EMI double-count rules from MONEY_RULES.md are mandatory.
- Linked EMI Paid delegates through LoanService.
- Wishlist-linked transaction edits/deletes obey domain protection.
- Every mutation validates authenticated ownership server-side.
- No production migration/deploy until owner gate.
- No force push.
- No autonomous merge.

Use `IMPLEMENTATION_CHECKLIST.md` and `TEST_MATRIX.md`.

Finish implementation with:
`NUTRISNAP V0.2 MONEY LIFE: READY FOR OWNER UAT — DO NOT MERGE`
