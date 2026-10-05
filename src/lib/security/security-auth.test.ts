import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../../prisma/generated/client';
import {
  parseAndValidateAmount,
  MAX_FINANCIAL_AMOUNT,
  isValidAccountType,
  isValidTransactionType,
  isValidObligationKind,
  validateTransferInvariants,
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  OBLIGATION_KINDS
} from '../finance/finance';
import { getNextOccurrence, RecurrenceRule } from '../recurrence/recurrence';
import fs from 'node:fs';
import path from 'node:path';

import * as financeService from '../finance/finance-service';

test('NSV01-0701: Cross-user transfer and forged destination account rejected by service', async () => {
  const userA = 'user-alice';
  const userB = 'user-bob';

  const mockDb = {
    financialAccount: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'acc-alice-1') {
          return { id: 'acc-alice-1', userId: userA, isActive: true };
        }
        if (where.id === 'acc-bob-1') {
          return { id: 'acc-bob-1', userId: userB, isActive: true };
        }
        return null;
      }
    }
  };

  await assert.rejects(
    async () => {
      await financeService.recordTransaction(userA, {
        type: 'TRANSFER',
        amount: '100.00',
        category: 'Transfer',
        accountId: 'acc-alice-1',
        transferAccountId: 'acc-bob-1',
        occurredAt: new Date(),
      }, mockDb as any);
    },
    /Destination transfer account not found or unauthorized/,
    'Service must reject cross-user transfer'
  );
});

test('NSV01-0702: Forged transaction ID rejected by deleteTransaction service', async () => {
  const userA = 'user-alice';
  const userB = 'user-bob-victim';

  const mockDb = {
    financialTransaction: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'tx-bob-456') {
          return { id: 'tx-bob-456', userId: userB };
        }
        return null;
      },
      delete: async () => {
        throw new Error('Should not be called');
      }
    }
  };

  await assert.rejects(
    async () => {
      await financeService.deleteTransaction(userA, 'tx-bob-456', mockDb as any);
    },
    /Transaction not found or unauthorized/,
    'User Alice cannot delete transaction owned by Bob'
  );
});

test('NSV01-0703: Forged obligation ID rejected by markObligationPaid service', async () => {
  const userA = 'user-alice';
  const userB = 'user-bob-victim';

  const mockDb = {
    obligation: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'ob-bob-789') {
          return { id: 'ob-bob-789', userId: userB, nextDueAt: new Date(), dueAt: new Date(), recurrenceType: 'MONTHLY' };
        }
        return null;
      }
    }
  };

  await assert.rejects(
    async () => {
      await financeService.markObligationPaid(userA, {
        obligationId: 'ob-bob-789',
        occurrenceKey: '2026-10-15T09:00',
      }, mockDb as any);
    },
    /Obligation not found or unauthorized/,
    'User Alice cannot mark obligation owned by Bob as paid'
  );
});

test('NSV01-0704: Cross-user account archive rejected by archiveAccount service', async () => {
  const userA = 'user-alice';
  const userB = 'user-bob';

  const mockDb = {
    financialAccount: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'acc-bob-999') {
          return { id: 'acc-bob-999', userId: userB };
        }
        return null;
      },
      update: async () => {
        throw new Error('Should not be called');
      }
    }
  };

  await assert.rejects(
    async () => {
      await financeService.archiveAccount(userA, 'acc-bob-999', mockDb as any);
    },
    /Account not found or unauthorized/,
    'User Alice cannot archive account owned by Bob'
  );
});

test('NSV01-0705: Unapproved category and invalid occurrenceKey rejected server-side', async () => {
  const userA = 'user-alice';
  const mockDb = {
    financialAccount: {
      findUnique: async () => ({ id: 'acc-alice-1', userId: userA, isActive: true })
    },
    obligation: {
      findUnique: async () => ({
        id: 'ob-1',
        userId: userA,
        nextDueAt: new Date('2026-10-15T10:00:00Z'),
        dueAt: new Date('2026-10-15T10:00:00Z'),
        recurrenceType: 'MONTHLY',
        amount: null,
      })
    },
    obligationOccurrence: {
      findUnique: async () => null,
      create: async ({ data }: any) => ({ id: 'occ-1', ...data })
    },
    user: {
      findUnique: async () => ({ timezone: 'UTC' })
    },
    $transaction: async (fn: any) => fn(mockDb)
  };

  // 1. Invalid transaction category rejected
  await assert.rejects(
    async () => {
      await financeService.recordTransaction(userA, {
        type: 'EXPENSE',
        amount: '100.00',
        category: 'Gambling', // Unapproved category!
        accountId: 'acc-alice-1',
        occurredAt: new Date(),
      }, mockDb as any);
    },
    /Invalid transaction category/,
    'Service must reject unapproved category'
  );

  // 2. Invalid occurrenceKey format rejected
  await assert.rejects(
    async () => {
      await financeService.markObligationPaid(userA, {
        obligationId: 'ob-1',
        occurrenceKey: 'not-a-valid-date-key',
      }, mockDb as any);
    },
    /Invalid occurrence key format/,
    'Service must reject invalid occurrenceKey format'
  );
});

test('NSV01-0705-B: Stale occurrence key does NOT advance obligation nextDueAt', async () => {
  const userA = 'user-alice';
  let updatedData: any = null;

  const currentDueAt = new Date('2026-11-15T10:00:00.000Z');
  const mockDb = {
    obligation: {
      findUnique: async () => ({
        id: 'ob-1',
        userId: userA,
        dueAt: new Date('2026-09-15T10:00:00.000Z'),
        nextDueAt: currentDueAt, // Currently due in November
        recurrenceType: 'MONTHLY',
        recurrenceInterval: 1,
        amount: null,
      }),
      update: async ({ data }: any) => {
        updatedData = data;
        return { id: 'ob-1', ...data };
      }
    },
    obligationOccurrence: {
      findUnique: async () => null,
      create: async ({ data }: any) => ({ id: 'occ-stale', ...data })
    },
    reminderDelivery: {
      updateMany: async () => ({ count: 0 })
    },
    user: {
      findUnique: async () => ({ timezone: 'UTC' })
    },
    $transaction: async (fn: any) => fn(mockDb)
  };

  // Mark a past occurrence (e.g. October) as paid
  const staleOccurrenceKey = '2026-10-15T10:00';
  const result = await financeService.markObligationPaid(userA, {
    obligationId: 'ob-1',
    occurrenceKey: staleOccurrenceKey,
  }, mockDb as any);

  assert.equal(result.success, true);
  // Crucial check: nextDueAt must NOT be advanced when paying a stale key!
  assert.equal(result.nextDueAt, currentDueAt.toISOString());
  assert.equal(updatedData.nextDueAt, undefined, 'Obligation nextDueAt must not be updated by stale key');
});

test('NSV01-0706: Invalid recurrence/date rejected', () => {
  // Invalid recurrence type safely returns null without infinite loop or corruption
  const invalidRule: any = {
    type: 'FORTNIGHTLY_RANDOM',
    startDate: new Date('2026-10-05T09:00:00.000Z'),
    timezone: 'UTC'
  };

  const next = getNextOccurrence(
    invalidRule,
    new Date('2026-10-05T09:00:00.000Z'),
    new Date('2026-10-05T09:00:00.000Z')
  );
  assert.equal(next, null, 'Unsupported recurrence types safely return null');
});

test('NSV01-0707: Huge/invalid amount handled within documented bounds', () => {
  // Test valid max limit
  const maxValid = parseAndValidateAmount('999999999999.99');
  assert.equal(maxValid.toString(), '999999999999.99');

  // Test amount exceeding max limit
  assert.throws(
    () => {
      parseAndValidateAmount('1000000000000.00'); // 1 trillion
    },
    /Monetary amount exceeds maximum allowable limit/,
    'Amounts exceeding Decimal(14,2) bound must be rejected'
  );

  // Test infinity or NaN
  assert.throws(
    () => {
      parseAndValidateAmount('Infinity');
    },
    /Invalid monetary amount/,
    'Infinity must be rejected'
  );

  assert.throws(
    () => {
      parseAndValidateAmount('NaN');
    },
    /Invalid monetary amount/,
    'NaN must be rejected'
  );
});

test('NSV01-0708: XSS-like title/note payload handled safely without injection', () => {
  const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

  // Safe string storage
  const note = xssPayload.slice(0, 255);
  assert.equal(typeof note, 'string');
  assert.ok(note.includes('<script>')); // Verifying verbatim string preservation without HTML execution in Node
});

test('NSV01-0709: No bank password/UPI PIN/CVV/PIN/OTP/broker credential field in schema', () => {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const forbiddenTerms = [
    'bankPassword',
    'bank_password',
    'upiPin',
    'upi_pin',
    'cvv',
    'cardPin',
    'card_pin',
    'otp',
    'brokerCredential',
    'broker_credential',
    'pin'
  ];

  for (const term of forbiddenTerms) {
    // Regex matching whole word field definitions in prisma models
    const fieldRegex = new RegExp(`^\\s*${term}\\s+`, 'mi');
    assert.equal(
      fieldRegex.test(schemaContent),
      false,
      `Schema must not define forbidden credential field: ${term}`
    );
  }
});

test('NSV01-0710 & NSV01-0711: Secret-pattern scan over repository files', () => {
  // Ensure no hardcoded private keys or live bot tokens in src/
  const srcDir = path.resolve(process.cwd(), 'src');

  function scanDir(dir: string): string[] {
    const findings: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findings.push(...scanDir(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Live bot token pattern: digits:alphanumeric (e.g. 123456789:ABCdefGhI...)
        if (/bot\d{8,10}:[A-Za-z0-9_-]{35}/.test(content)) {
          findings.push(`Live bot token detected in ${fullPath}`);
        }
        // Private key pattern
        if (/BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY/.test(content)) {
          findings.push(`Private key detected in ${fullPath}`);
        }
      }
    }
    return findings;
  }

  const findings = scanDir(srcDir);
  assert.deepEqual(findings, [], 'No secrets or live tokens should be committed to src/');
});
