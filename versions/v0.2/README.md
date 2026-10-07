# NutriSnap v0.2 — Money Life Implementation Package

Status: READY FOR IMPLEMENTATION
Implementation branch: `feature/v0.2-money-life`
v0.1 merged base: `26bb3b48232259607c6b7ba44a786d11ca863c82`
Frozen planning source: `4c6921baf418f411e387cc65657810999fe81777`
Architecture Gate A: PASS

v0.2 expands Money from basic accounts/transactions/bills into a practical personal-finance organizer for real life.

## Product scope

### Existing v0.1 retained
- Accounts
- Income / Expense / Transfer
- Bills & Subscriptions
- Recharge
- Generic reminders
- Today aggregation
- Green responsive UI
- Live Food AI / Python-Gemini flow

### v0.2 adds
1. Safe edit/update flows for existing financial records.
2. Money lent to friends/family.
3. Money borrowed from friends/family.
4. Running loans:
   - Personal Loan
   - Home Loan
   - Vehicle Loan
   - Education Loan
   - Gold Loan
   - Credit Card EMI
   - Product EMI
   - Other
5. EMI tracking for phones/electronics and other purchases.
6. Wishlist / planned-purchase budgeting.
7. Money dashboard integration for debts, loans, EMI and wishlist.

## Explicitly out of scope

- Investments.
- Stocks.
- Mutual funds.
- Crypto.
- Broker sync.
- Investment advice.
- Net-worth analytics that depend on investments.
- Bank credential/API sync.
- Automatic loan statement scraping.
- Credit score.
- Tax accounting.

Investments will be a separate future module with its own architecture.

## Source-of-truth order

1. `ARCHITECTURE_REVIEW_A.md`
2. `MASTER_PLAN.md`
3. `ARCHITECTURE.md`
4. `DATA_MODEL.md`
5. `MONEY_RULES.md`
6. `UX_AND_ROUTES.md`
7. `MIGRATION_PLAN.md`
8. `IMPLEMENTATION_CHECKLIST.md`
9. `TEST_MATRIX.md`
10. `AGENT_MODEL_STRATEGY.md`
11. `OPEN_QUESTIONS.md`
12. `STATUS.md`

## Implementation gate

Architecture Gate A is PASS. Owner has explicitly started v0.2.

AGY-Manickam may begin V2-100 on `feature/v0.2-money-life`.

Do not re-open resolved architecture questions unless implementation proves a real contradiction.
