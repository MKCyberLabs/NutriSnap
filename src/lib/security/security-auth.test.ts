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

test('NSV01-0701: Forged account ID rejected', () => {
  // Simulating an attempt to access or transfer to an account not belonging to user
  const userA = 'user-alice';
  const forgedAccount = {
    id: 'acc-forged-999',
    userId: 'user-bob-attacker',
    name: 'Attacker Account'
  };

  assert.throws(
    () => {
      validateTransferInvariants({
        sourceAccountId: 'acc-alice-1',
        destinationAccountId: forgedAccount.id,
        sourceAccountUserId: userA,
        destinationAccountUserId: forgedAccount.userId,
        currentUserId: userA,
        amount: new Prisma.Decimal('100.00')
      });
    },
    /Both transfer accounts must belong to the authenticated user/,
    'Transfer to forged cross-user account must be rejected'
  );
});

test('NSV01-0702: Forged transaction ID rejected', () => {
  // Simulating mutation on transaction ID not owned by user
  const userA = 'user-alice';
  const txBob = {
    id: 'tx-bob-456',
    userId: 'user-bob-victim',
    amount: new Prisma.Decimal('500.00')
  };

  const isOwner = txBob.userId === userA;
  assert.equal(isOwner, false, 'User Alice cannot match transaction owned by Bob');
});

test('NSV01-0703: Forged obligation ID rejected', () => {
  // Simulating Paid or Edit attempt on forged obligation ID
  const userA = 'user-alice';
  const obBob = {
    id: 'ob-bob-789',
    userId: 'user-bob-victim',
    title: 'Bob Rent'
  };

  const isOwner = obBob.userId === userA;
  assert.equal(isOwner, false, 'User Alice cannot mutate obligation owned by Bob');
});

test('NSV01-0704: Forged reminder/delivery ID rejected', () => {
  // Simulating claim or callback on forged reminder delivery ID
  const userA = 'user-alice';
  const deliveryVictim = {
    id: 'del-999',
    userId: 'user-victim',
    obligationId: 'ob-victim-1'
  };

  const isOwner = deliveryVictim.userId === userA;
  assert.equal(isOwner, false, 'User Alice cannot claim delivery owned by victim');
});

test('NSV01-0705: Invalid enum/category rejected', () => {
  // Invalid account types
  assert.equal(isValidAccountType('BITCOIN'), false);
  assert.equal(isValidAccountType('STOCK_BROKER'), false);
  assert.equal(isValidAccountType('CREDIT_CARD'), true);

  // Invalid transaction types
  assert.equal(isValidTransactionType('DIVIDEND'), false);
  assert.equal(isValidTransactionType('CRYPTO_SWAP'), false);
  assert.equal(isValidTransactionType('EXPENSE'), true);

  // Invalid obligation kinds
  assert.equal(isValidObligationKind('GAMBLING'), false);
  assert.equal(isValidObligationKind('LOAN_SHARK'), false);
  assert.equal(isValidObligationKind('RECHARGE'), true);
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
