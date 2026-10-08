import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import * as financeService from './finance-service';
import * as creditCardService from './credit-card-service';
import { calculateCreditCardUsage } from './finance';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-CRUD: Transaction & Account CRUD, Transfer Invariants, and CC Presentation Suite', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const userA = await db.user.create({
      data: {
        id: `usr-crud-a-${timestamp}`,
        email: `usrcrud-a-${timestamp}@test.local`,
        name: 'CRUD User Alpha',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-crud-b-${timestamp}`,
        email: `usrcrud-b-${timestamp}@test.local`,
        name: 'CRUD User Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    // -------------------------------------------------------------------------
    // 1. Create expense, edit amount/category -> derived balance recomputed
    // -------------------------------------------------------------------------
    const bankRes = await financeService.createAccount(userA.id, {
      name: 'Primary Checking',
      type: 'BANK',
      institution: 'State Bank',
      openingBalance: '5000.00',
    }, db);
    assert.equal(bankRes.success, true);
    const bankId = bankRes.account.id;

    // Record expense ₹1500 (Food)
    const expRes = await financeService.recordTransaction(userA.id, {
      type: 'EXPENSE',
      amount: '1500.00',
      category: 'Food',
      accountId: bankId,
      occurredAt: new Date(),
    }, db);
    assert.equal(expRes.success, true);
    const expId = expRes.transaction.id;

    // Balance after initial expense: 5000 - 1500 = 3500
    let accounts = await financeService.getAccounts(userA.id, db);
    let bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '3500');

    // Edit expense amount to ₹2000 and category to 'Entertainment'
    const editExpRes = await financeService.updateTransaction(userA.id, expId, {
      amount: '2000.00',
      category: 'Entertainment',
    }, db);
    assert.equal(editExpRes.success, true);
    assert.equal(editExpRes.transaction.category, 'Entertainment');
    assert.equal(editExpRes.transaction.amount, '2000');

    // Balance after edit: 5000 - 2000 = 3000
    accounts = await financeService.getAccounts(userA.id, db);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '3000');

    // -------------------------------------------------------------------------
    // 2. Delete expense restores balance
    // -------------------------------------------------------------------------
    const delRes = await financeService.deleteTransaction(userA.id, expId, db);
    assert.equal(delRes.success, true);

    accounts = await financeService.getAccounts(userA.id, db);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '5000');

    // -------------------------------------------------------------------------
    // 3. Edit income, edit transfer
    // -------------------------------------------------------------------------
    // Income ₹3000 -> balance becomes 8000
    const incRes = await financeService.recordTransaction(userA.id, {
      type: 'INCOME',
      amount: '3000.00',
      category: 'Salary',
      accountId: bankId,
      occurredAt: new Date(),
    }, db);
    assert.equal(incRes.success, true);
    const incId = incRes.transaction.id;

    accounts = await financeService.getAccounts(userA.id, db);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '8000');

    // Edit income to ₹4500 -> balance becomes 9500
    const editIncRes = await financeService.updateTransaction(userA.id, incId, {
      amount: '4500.00',
    }, db);
    assert.equal(editIncRes.success, true);

    accounts = await financeService.getAccounts(userA.id, db);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '9500');

    // Create wallet account
    const walletRes = await financeService.createAccount(userA.id, {
      name: 'Cash Wallet',
      type: 'WALLET',
      openingBalance: '1000.00',
    }, db);
    const walletId = walletRes.account.id;

    // Transfer ₹1500 from bank -> wallet
    const xferRes = await financeService.recordTransaction(userA.id, {
      type: 'TRANSFER',
      amount: '1500.00',
      category: 'Transfer',
      accountId: bankId,
      transferAccountId: walletId,
      occurredAt: new Date(),
    }, db);
    const xferId = xferRes.transaction.id;

    // Bank: 9500 - 1500 = 8000. Wallet: 1000 + 1500 = 2500
    accounts = await financeService.getAccounts(userA.id, db);
    assert.equal(accounts.find((a: any) => a.id === bankId).currentBalance, '8000');
    assert.equal(accounts.find((a: any) => a.id === walletId).currentBalance, '2500');

    // Edit transfer amount to ₹2500
    const editXferRes = await financeService.updateTransaction(userA.id, xferId, {
      amount: '2500.00',
    }, db);
    assert.equal(editXferRes.success, true);

    // Bank: 9500 - 2500 = 7000. Wallet: 1000 + 2500 = 3500
    accounts = await financeService.getAccounts(userA.id, db);
    assert.equal(accounts.find((a: any) => a.id === bankId).currentBalance, '7000');
    assert.equal(accounts.find((a: any) => a.id === walletId).currentBalance, '3500');

    // -------------------------------------------------------------------------
    // 4. Reject same-account transfer
    // -------------------------------------------------------------------------
    // Record same-account transfer rejection
    await assert.rejects(
      async () => {
        await financeService.recordTransaction(userA.id, {
          type: 'TRANSFER',
          amount: '500.00',
          category: 'Transfer',
          accountId: bankId,
          transferAccountId: bankId,
          occurredAt: new Date(),
        }, db);
      },
      /Transfer source and destination accounts must be distinct/
    );

    // Update transfer to point to same account rejection
    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, xferId, {
          transferAccountId: bankId,
        }, db);
      },
      /Transfer source and destination accounts must be distinct/
    );

    // -------------------------------------------------------------------------
    // 5. Reject foreign account / transaction update (cross-user isolation)
    // -------------------------------------------------------------------------
    const userBAccRes = await financeService.createAccount(userB.id, {
      name: 'User B Checking',
      type: 'BANK',
      openingBalance: '2000.00',
    }, db);
    const userBAccId = userBAccRes.account.id;

    // User B cannot update User A's transaction
    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userB.id, xferId, { amount: '100.00' }, db);
      },
      /Transaction not found or unauthorized/
    );

    // User B cannot update User A's account
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userB.id, bankId, { name: 'Compromised' }, db);
      },
      /Account not found or unauthorized/
    );

    // User A cannot use User B's account as transfer destination in update
    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, xferId, {
          transferAccountId: userBAccId,
        }, db);
      },
      /Destination transfer account not found or unauthorized/
    );

    // User A cannot reassign transaction to User B's account
    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, incId, {
          accountId: userBAccId,
        }, db);
      },
      /Primary account not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // 6. Reject generic edit on system-linked transactions
    // -------------------------------------------------------------------------
    // Personal debt linked transaction
    const debt = await db.personalDebt.create({
      data: {
        userId: userA.id,
        direction: 'PAYABLE',
        counterpartyName: 'Aunt Sita',
        originalAmount: new Prisma.Decimal('10000.00'),
        status: 'OPEN',
      }
    });

    const debtTx = await db.financialTransaction.create({
      data: {
        userId: userA.id,
        type: 'BORROW',
        amount: new Prisma.Decimal('10000.00'),
        category: 'Personal Debt',
        occurredAt: new Date(),
        accountId: bankId,
        personalDebtId: debt.id,
      }
    });

    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, debtTx.id, { amount: '8000.00' }, db);
      },
      /Linked transaction cannot be modified directly through generic transaction editor/
    );

    // Credit card payment linked transaction
    const ccAcc = await db.financialAccount.create({
      data: {
        userId: userA.id,
        name: 'Amazon ICICI Card',
        type: 'CREDIT_CARD',
        openingBalance: new Prisma.Decimal(0),
        creditLimit: new Prisma.Decimal('100000.00'),
        isActive: true,
      }
    });

    const ccStmt = await db.creditCardStatement.create({
      data: {
        userId: userA.id,
        accountId: ccAcc.id,
        periodKey: '2026-09',
        statementDate: new Date('2026-09-15'),
        dueDate: new Date('2026-10-05'),
        statementAmount: new Prisma.Decimal('15000.00'),
        status: 'OPEN',
      }
    });

    const ccPayTx = await db.financialTransaction.create({
      data: {
        userId: userA.id,
        type: 'TRANSFER',
        amount: new Prisma.Decimal('5000.00'),
        category: 'Credit Card Payment',
        occurredAt: new Date(),
        accountId: bankId,
        transferAccountId: ccAcc.id,
      }
    });

    await db.creditCardPayment.create({
      data: {
        userId: userA.id,
        statementId: ccStmt.id,
        fromAccountId: bankId,
        amount: new Prisma.Decimal('5000.00'),
        transactionId: ccPayTx.id,
      }
    });

    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, ccPayTx.id, { amount: '6000.00' }, db);
      },
      /Linked transaction cannot be modified directly through generic transaction editor/
    );

    // -------------------------------------------------------------------------
    // 7. Credit card usage derivation and available credit
    // -------------------------------------------------------------------------
    // Pure unit calculation verification
    const testUsage = calculateCreditCardUsage(
      0,
      [
        { type: 'EXPENSE', amount: '12000.00', accountId: 'cc-1' },
        { type: 'EXPENSE', amount: '8000.00', accountId: 'cc-1' },
        { type: 'TRANSFER', amount: '5000.00', accountId: 'bank-1', transferAccountId: 'cc-1' }, // payment
        { type: 'INCOME', amount: '1000.00', accountId: 'cc-1' }, // refund
      ],
      'cc-1',
      '50000.00'
    );
    // 12000 + 8000 - 5000 - 1000 = 14000 used; 50000 - 14000 = 36000 available
    assert.equal(testUsage.amountUsed.toString(), '14000');
    assert.equal(testUsage.availableCredit?.toString(), '36000');

    // End-to-end getAccounts presentation verification for credit card
    // Add card expense ₹20000 to ccAcc
    await financeService.recordTransaction(userA.id, {
      type: 'EXPENSE',
      amount: '20000.00',
      category: 'Shopping',
      accountId: ccAcc.id,
      occurredAt: new Date(),
    }, db);

    accounts = await financeService.getAccounts(userA.id, db);
    const cardAccount = accounts.find((a: any) => a.id === ccAcc.id);

    // Expenses: 20000; Payment: 5000; Used: 15000; Limit: 100000; Available: 85000
    assert.equal(cardAccount.amountUsed, '15000');
    assert.equal(cardAccount.availableCredit, '85000');
    assert.equal(cardAccount.creditLimit, '100000');

    // -------------------------------------------------------------------------
    // 8. Paid statements: Fully paid statement not treated as active
    // -------------------------------------------------------------------------
    // Mark ccStmt as fully PAID
    await db.creditCardStatement.update({
      where: { id: ccStmt.id },
      data: { status: 'PAID' }
    });

    const ccDetails = await creditCardService.getCreditCardDetails(userA.id, ccAcc.id, db);
    // Fully paid statement must not be activeStatement
    assert.equal(ccDetails.activeStatement, null);

    // -------------------------------------------------------------------------
    // 9. defaultPaymentAccountId authorization & type validation + read defense
    // -------------------------------------------------------------------------
    // Create a Bank account belonging to userB
    const userBBank = await financeService.createAccount(userB.id, {
      name: 'User B Checking',
      type: 'BANK',
      openingBalance: '1000.00',
    }, db);

    // Create a secondary CREDIT_CARD belonging to userA
    const userACard2 = await financeService.createAccount(userA.id, {
      name: 'User A Secondary Card',
      type: 'CREDIT_CARD',
      openingBalance: '0.00',
      creditLimit: '50000.00',
    }, db);

    // Negative: createAccount with foreign defaultPaymentAccountId
    await assert.rejects(
      async () => {
        await financeService.createAccount(userA.id, {
          name: 'Card with Foreign Default',
          type: 'CREDIT_CARD',
          defaultPaymentAccountId: userBBank.account.id,
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: createAccount with nonexistent defaultPaymentAccountId
    await assert.rejects(
      async () => {
        await financeService.createAccount(userA.id, {
          name: 'Card with Nonexistent Default',
          type: 'CREDIT_CARD',
          defaultPaymentAccountId: 'nonexistent-acc-id',
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: createAccount with CREDIT_CARD as defaultPaymentAccountId
    await assert.rejects(
      async () => {
        await financeService.createAccount(userA.id, {
          name: 'Card with CC Default',
          type: 'CREDIT_CARD',
          defaultPaymentAccountId: userACard2.account.id,
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: updateAccount with foreign defaultPaymentAccountId
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userA.id, ccAcc.id, {
          defaultPaymentAccountId: userBBank.account.id,
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: updateAccount with nonexistent defaultPaymentAccountId
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userA.id, ccAcc.id, {
          defaultPaymentAccountId: 'nonexistent-acc-id',
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: updateAccount referencing the card itself
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userA.id, ccAcc.id, {
          defaultPaymentAccountId: ccAcc.id,
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Negative: updateAccount referencing another credit card
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userA.id, ccAcc.id, {
          defaultPaymentAccountId: userACard2.account.id,
        }, db);
      },
      /Default payment account not found or unauthorized/
    );

    // Positive: updateAccount with valid userA BANK account
    const validUpdateRes = await financeService.updateAccount(userA.id, ccAcc.id, {
      defaultPaymentAccountId: bankId,
    }, db);
    assert.equal(validUpdateRes.success, true);
    assert.equal(validUpdateRes.account.defaultPaymentAccountId, bankId);

    const ccDetailsWithBank = await creditCardService.getCreditCardDetails(userA.id, ccAcc.id, db);
    assert.equal(ccDetailsWithBank.defaultPaymentAccount?.id, bankId);
    assert.equal(ccDetailsWithBank.defaultPaymentAccount?.name, 'Primary Checking');

    // Read defense in getCreditCardDetails: foreign defaultPaymentAccount sanitizes to null
    await db.financialAccount.update({
      where: { id: ccAcc.id },
      data: { defaultPaymentAccountId: userBBank.account.id }
    });
    const ccDetailsSanitized = await creditCardService.getCreditCardDetails(userA.id, ccAcc.id, db);
    assert.equal(ccDetailsSanitized.defaultPaymentAccount, null);

    // Restore valid default payment account
    await db.financialAccount.update({
      where: { id: ccAcc.id },
      data: { defaultPaymentAccountId: bankId }
    });

    // -------------------------------------------------------------------------
    // 10. Exact decimal string preservation (eliminate float distortion)
    // -------------------------------------------------------------------------
    // Transaction amount exact decimal preservation
    const exactTxRes = await financeService.recordTransaction(userA.id, {
      type: 'EXPENSE',
      amount: '12345.67',
      category: 'Shopping',
      accountId: bankId,
      occurredAt: new Date(),
    }, db);
    assert.equal(exactTxRes.success, true);
    assert.equal(exactTxRes.transaction.amount, '12345.67');

    const exactUpdateTxRes = await financeService.updateTransaction(userA.id, exactTxRes.transaction.id, {
      amount: '98765.43',
    }, db);
    assert.equal(exactUpdateTxRes.success, true);
    assert.equal(exactUpdateTxRes.transaction.amount, '98765.43');

    // Account openingBalance & creditLimit exact decimal preservation
    const exactAccRes = await financeService.createAccount(userA.id, {
      name: 'Exact Precision Card',
      type: 'CREDIT_CARD',
      openingBalance: '1000.55',
      creditLimit: '750000.75',
      defaultPaymentAccountId: bankId,
    }, db);
    assert.equal(exactAccRes.success, true);
    assert.equal(exactAccRes.account.openingBalance, '1000.55');
    assert.equal(exactAccRes.account.defaultPaymentAccountId, bankId);

    const updatedAccList = await financeService.getAccounts(userA.id, db);
    const foundAcc = updatedAccList.find((a: any) => a.id === exactAccRes.account.id);
    assert.equal(foundAcc.creditLimit, '750000.75');
    assert.equal(foundAcc.openingBalance, '1000.55');

  } finally {
    await db.$disconnect();
  }
});
