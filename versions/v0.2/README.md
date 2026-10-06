# NutriSnap v0.2 — Money Life Planning Package

Status: ARCHITECTURE FROZEN FOR FUTURE IMPLEMENTATION
Planning branch: `planning/v0.2-money-life`
Base checkpoint: `86f24b6edc1904ae84d64655c29f7f976730fff6`

v0.2 expands Money from basic accounts/transactions/bills into a practical personal-finance organizer for real life.

## Product scope

### Existing v0.1 retained
- Accounts
- Income / Expense / Transfer
- Bills & Subscriptions
- Recharge
- Generic reminders
- Today aggregation

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

1. `MASTER_PLAN.md`
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `MONEY_RULES.md`
5. `UX_AND_ROUTES.md`
6. `MIGRATION_PLAN.md`
7. `IMPLEMENTATION_CHECKLIST.md`
8. `TEST_MATRIX.md`
9. `AGENT_MODEL_STRATEGY.md`
10. `OPEN_QUESTIONS.md`
11. `STATUS.md`

## Important version boundary

Do not begin v0.2 implementation until the active v0.1 Food Live AI/UAT work is complete and the owner explicitly starts v0.2.

This planning branch exists so architecture can be reviewed without modifying the active v0.1 implementation branch.
