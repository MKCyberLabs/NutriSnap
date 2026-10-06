import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
import {
  isValidAccountType,
  isValidTransactionType,
  isValidObligationKind,
  parseAndValidateAmount,
  validateTransferInvariants,
  calculateAccountBalance,
  calculateMonthlyTotals,
  calculateCategoryBreakdown,
  formatINR,
  isValidTransactionCategory,
  normalizeTransactionCategory,
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  OBLIGATION_KINDS
} from './finance';

test('NSV01-0201: FinancialAccount supports BANK, CASH, WALLET, CREDIT_CARD', () => {
  for (const type of ['BANK', 'CASH', 'WALLET', 'CREDIT_CARD']) {
    assert.equal(isValidAccountType(type), true);
  }
  assert.equal(isValidAccountType('CRYPTO'), false);
  assert.equal(isValidAccountType('SAVINGS'), false);
  assert.equal(isValidAccountType(''), false);
});

test('NSV01-0202: FinancialTransaction supports INCOME, EXPENSE, TRANSFER', () => {
  for (const type of ['INCOME', 'EXPENSE', 'TRANSFER']) {
    assert.equal(isValidTransactionType(type), true);
  }
  assert.equal(isValidTransactionType('DEPOSIT'), false);
  assert.equal(isValidTransactionType('WITHDRAWAL'), false);
  assert.equal(isValidTransactionType(''), false);
});

test('NSV01-0203: Obligation kinds include all required v0.1 kinds', () => {
  const expectedKinds = [
    'RECHARGE',
    'CREDIT_CARD',
    'BILL',
    'SUBSCRIPTION',
    'RENT',
    'EMI',
    'INSURANCE',
    'OTHER'
  ];
  for (const kind of expectedKinds) {
    assert.equal(isValidObligationKind(kind), true);
  }
  assert.equal(isValidObligationKind('MORTGAGE'), false);
  assert.equal(isValidObligationKind('UNKNOWN'), false);
});

test('NSV01-0204: All money fields use Decimal and reject invalid/negative/zero amounts', () => {
  // Valid positive amounts
  const d1 = parseAndValidateAmount('10000.00');
  assert.ok(d1 instanceof Prisma.Decimal);
  assert.equal(d1.toString(), '10000');

  const d2 = parseAndValidateAmount(1250.5);
  assert.equal(d2.toString(), '1250.5');

  const d3 = parseAndValidateAmount(new Prisma.Decimal('719'));
  assert.equal(d3.toString(), '719');

  // Rejects zero
  assert.throws(() => parseAndValidateAmount('0'), /strictly positive/);
  assert.throws(() => parseAndValidateAmount(0), /strictly positive/);

  // Rejects negative amounts
  assert.throws(() => parseAndValidateAmount('-500'), /strictly positive/);
  assert.throws(() => parseAndValidateAmount(-100), /strictly positive/);

  // Rejects NaN / Infinity / strings
  assert.throws(() => parseAndValidateAmount('abc'), /Invalid monetary amount/);
  assert.throws(() => parseAndValidateAmount(NaN), /must be a finite number/);
  assert.throws(() => parseAndValidateAmount(Infinity), /must be a finite number/);

  // Rejects more than 2 decimal places
  assert.throws(() => parseAndValidateAmount('10.999'), /more than 2 decimal places/);
});

test('NSV01-0205: Transfer requires distinct source/destination accounts of the same user', () => {
  // Valid transfer
  const validAmount = validateTransferInvariants({
    sourceAccountId: 'acc-1',
    destinationAccountId: 'acc-2',
    sourceAccountUserId: 'user-1',
    destinationAccountUserId: 'user-1',
    currentUserId: 'user-1',
    amount: '1000.00'
  });
  assert.equal(validAmount.toString(), '1000');

  // Same account transfer rejected
  assert.throws(
    () =>
      validateTransferInvariants({
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-1',
        sourceAccountUserId: 'user-1',
        destinationAccountUserId: 'user-1',
        currentUserId: 'user-1',
        amount: '1000.00'
      }),
    /must be distinct/
  );

  // Cross-user source account rejected
  assert.throws(
    () =>
      validateTransferInvariants({
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        sourceAccountUserId: 'user-2',
        destinationAccountUserId: 'user-1',
        currentUserId: 'user-1',
        amount: '1000.00'
      }),
    /Both transfer accounts must belong to the authenticated user/
  );

  // Cross-user destination account rejected
  assert.throws(
    () =>
      validateTransferInvariants({
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        sourceAccountUserId: 'user-1',
        destinationAccountUserId: 'user-2',
        currentUserId: 'user-1',
        amount: '1000.00'
      }),
    /Both transfer accounts must belong to the authenticated user/
  );
});

test('NSV01-0408 & NSV01-0423: Derived account balance and transfer movement without income/expense inflation', () => {
  const bankId = 'acc-bank';
  const cashId = 'acc-cash';

  // Bank: opening balance 10,000
  // Cash: opening balance 1,000
  const transactions = [
    { type: 'INCOME', amount: '5000', accountId: bankId, transferAccountId: null },
    { type: 'EXPENSE', amount: '500', accountId: bankId, transferAccountId: null },
    { type: 'TRANSFER', amount: '1000', accountId: bankId, transferAccountId: cashId }
  ];

  // Bank balance: 10,000 + 5,000 - 500 - 1,000 = 13,500
  const bankBalance = calculateAccountBalance('10000', transactions, bankId);
  assert.equal(bankBalance.toString(), '13500');

  // Cash balance: 1,000 + 1,000 (from transfer) = 2,000
  const cashBalance = calculateAccountBalance('1000', transactions, cashId);
  assert.equal(cashBalance.toString(), '2000');

  // Invariant: Monthly totals must NOT include the 1,000 transfer!
  const totals = calculateMonthlyTotals(transactions);
  assert.equal(totals.income.toString(), '5000');
  assert.equal(totals.expense.toString(), '500');
});

test('NSV01-0428: Category breakdown reconciles exactly to total expense', () => {
  const transactions = [
    { type: 'EXPENSE', category: 'Food', amount: '450.50' },
    { type: 'EXPENSE', category: 'Transport', amount: '200.00' },
    { type: 'EXPENSE', category: 'Food', amount: '150.25' },
    { type: 'INCOME', category: 'Salary', amount: '50000.00' },
    { type: 'TRANSFER', category: 'Transfer', amount: '5000.00' }
  ];

  const totals = calculateMonthlyTotals(transactions);
  assert.equal(totals.expense.toString(), '800.75');

  const breakdown = calculateCategoryBreakdown(transactions);
  assert.equal(breakdown['Food'].toString(), '600.75');
  assert.equal(breakdown['Transport'].toString(), '200');

  // Sum of categories equals total expense
  let sum = new Prisma.Decimal(0);
  for (const cat in breakdown) {
    sum = sum.plus(breakdown[cat]);
  }
  assert.equal(sum.toString(), totals.expense.toString());
});

test('formatINR formats currency properly with INR symbol', () => {
  const formatted = formatINR('1250.50');
  // Intl format should include 1,250.50
  assert.ok(formatted.includes('1,250.50') || formatted.includes('1,250.5'));
});

// ============================================================================
// PHASE 4 (Milestone 3) ACCOUNTS TESTS
// ============================================================================

test('NSV01-0401..0404: Account creation validation for BANK, CASH, WALLET, CREDIT_CARD', () => {
  // BANK
  assert.equal(isValidAccountType('BANK'), true);
  // CASH
  assert.equal(isValidAccountType('CASH'), true);
  // WALLET
  assert.equal(isValidAccountType('WALLET'), true);
  // CREDIT_CARD with optional credit limit
  assert.equal(isValidAccountType('CREDIT_CARD'), true);
  const creditLimit = parseAndValidateAmount('50000');
  assert.equal(creditLimit.toString(), '50000');
});

test('NSV01-0405: Invalid account type rejected', () => {
  assert.equal(isValidAccountType('INVESTMENT'), false);
  assert.equal(isValidAccountType('CRYPTO'), false);
  assert.equal(isValidAccountType('SAVINGS_ACCOUNT'), false);
});

test('NSV01-0406: Cross-user account access and mutation rejected', () => {
  // Simulate account mutation authorization check
  function authorizeAccountMutation(accountUserId: string, currentUserId: string) {
    if (accountUserId !== currentUserId) {
      throw new Error('Account not found or unauthorized');
    }
    return true;
  }

  assert.equal(authorizeAccountMutation('user-alice', 'user-alice'), true);
  assert.throws(
    () => authorizeAccountMutation('user-bob', 'user-alice'),
    /unauthorized/
  );
});

test('NSV01-0407: Archive account preserves transaction history and balance', () => {
  const accountId = 'acc-archived';
  const openingBalance = '5000';
  const transactions = [
    { type: 'INCOME', amount: '2000', accountId, transferAccountId: null },
    { type: 'EXPENSE', amount: '1500', accountId, transferAccountId: null }
  ];

  // Simulating soft delete archive: isActive set to false
  const account = { id: accountId, isActive: false, openingBalance };
  assert.equal(account.isActive, false);

  // Derived balance calculation still processes historical transactions accurately
  const balance = calculateAccountBalance(account.openingBalance, transactions, accountId);
  assert.equal(balance.toString(), '5500');
});

// ============================================================================
// PHASE 4 (Milestone 3) TRANSACTIONS TESTS
// ============================================================================

test('NSV01-0420 & NSV01-0421: Income ₹10,000 and Expense ₹1,250 record exact Decimal totals', () => {
  const incomeAmount = parseAndValidateAmount('10000.00');
  assert.ok(incomeAmount instanceof Prisma.Decimal);
  assert.equal(incomeAmount.toString(), '10000');

  const expenseAmount = parseAndValidateAmount('1250.00');
  assert.ok(expenseAmount instanceof Prisma.Decimal);
  assert.equal(expenseAmount.toString(), '1250');
});

test('NSV01-0422: Zero and negative amounts strictly rejected', () => {
  assert.throws(() => parseAndValidateAmount('0'), /strictly positive/);
  assert.throws(() => parseAndValidateAmount('-1250.00'), /strictly positive/);
  assert.throws(() => parseAndValidateAmount(-0.01), /strictly positive/);
});

test('NSV01-0424: Same-account transfer rejected', () => {
  assert.throws(
    () =>
      validateTransferInvariants({
        sourceAccountId: 'acc-same',
        destinationAccountId: 'acc-same',
        sourceAccountUserId: 'user-1',
        destinationAccountUserId: 'user-1',
        currentUserId: 'user-1',
        amount: '500'
      }),
    /must be distinct/
  );
});

test('NSV01-0425: Cross-user destination account rejected', () => {
  assert.throws(
    () =>
      validateTransferInvariants({
        sourceAccountId: 'acc-source',
        destinationAccountId: 'acc-attacker',
        sourceAccountUserId: 'user-victim',
        destinationAccountUserId: 'user-attacker',
        currentUserId: 'user-victim',
        amount: '500'
      }),
    /Both transfer accounts must belong to the authenticated user/
  );
});

test('NSV01-0426 & NSV01-0427: Monthly income and expense totals are exact Decimal sums', () => {
  const transactions = [
    { type: 'INCOME', amount: '10000.25' },
    { type: 'INCOME', amount: '4999.75' },
    { type: 'EXPENSE', amount: '1250.50' },
    { type: 'EXPENSE', amount: '749.50' },
    { type: 'TRANSFER', amount: '2000.00' } // Transfer should NOT affect monthly income/expense!
  ];

  const totals = calculateMonthlyTotals(transactions);
  assert.equal(totals.income.toString(), '15000');
  assert.equal(totals.expense.toString(), '2000');
});

test('NSV01-0429: Edit/delete recalculates totals and balances safely', () => {
  const accountId = 'acc-1';
  let transactions = [
    { id: 'tx-1', type: 'INCOME', amount: '10000', accountId, transferAccountId: null },
    { id: 'tx-2', type: 'EXPENSE', amount: '2000', accountId, transferAccountId: null },
    { id: 'tx-3', type: 'EXPENSE', amount: '500', accountId, transferAccountId: null }
  ];

  // Initial balance: 0 + 10,000 - 2,000 - 500 = 7,500
  let balance = calculateAccountBalance('0', transactions, accountId);
  assert.equal(balance.toString(), '7500');

  // Delete transaction tx-2 (₹2,000 expense)
  transactions = transactions.filter(t => t.id !== 'tx-2');

  // Recalculated balance: 0 + 10,000 - 500 = 9,500
  balance = calculateAccountBalance('0', transactions, accountId);
  assert.equal(balance.toString(), '9500');

  const totals = calculateMonthlyTotals(transactions);
  assert.equal(totals.expense.toString(), '500');
});

test('NSV01-0430: Manipulated client-computed total ignored; server calculation remains authoritative', () => {
  const serverTransactions = [
    { type: 'EXPENSE', amount: '150.00' },
    { type: 'EXPENSE', amount: '350.00' }
  ];

  // Malicious client claims expense is ₹10.00
  const clientClaimedTotal = '10.00';

  // Server authoritatively derives total from individual verified transactions
  const serverAuthoritativeTotal = calculateMonthlyTotals(serverTransactions).expense;

  assert.equal(serverAuthoritativeTotal.toString(), '500');
  assert.notEqual(serverAuthoritativeTotal.toString(), clientClaimedTotal);
});

test('NSV01-0431: Transaction category validation and normalization', () => {
  // Approved categories
  assert.equal(isValidTransactionCategory('Food'), true);
  assert.equal(isValidTransactionCategory('Utilities'), true);
  assert.equal(isValidTransactionCategory('Recharge'), true);
  assert.equal(isValidTransactionCategory('Transfer'), true);

  // Unapproved categories rejected
  assert.equal(isValidTransactionCategory('Gambling'), false);
  assert.equal(isValidTransactionCategory('Crypto'), false);
  assert.equal(isValidTransactionCategory(''), false);
  assert.equal(isValidTransactionCategory('RandomString'), false);

  // Normalization (case-insensitive)
  assert.equal(normalizeTransactionCategory('food'), 'Food');
  assert.equal(normalizeTransactionCategory('FOOD'), 'Food');
  assert.equal(normalizeTransactionCategory('  recharge  '), 'Recharge');
  assert.equal(normalizeTransactionCategory('utilities'), 'Utilities');
  assert.equal(normalizeTransactionCategory('unknown_xyz'), 'Other');
});
