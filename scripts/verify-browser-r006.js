const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');

let chromium;
try {
  chromium = require('playwright').chromium;
} catch {
  try {
    chromium = require('/home/openclaw/.npm/_npx/e41f203b7505f1fb/node_modules/playwright').chromium;
  } catch {
    chromium = require('playwright-core').chromium;
  }
}

const projectRoot = path.resolve(__dirname, '..');
const { PrismaClient } = require(path.join(projectRoot, 'prisma/generated/client'));

const PORT = 9005;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';
process.env.DATABASE_URL = TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode < 500) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

/**
 * Authoritatively verifies that an obligation payment undo was fully persisted in the database.
 * Directly asserts:
 * 1. Obligation belongs to the expected user (wrong-user mutation protection).
 * 2. The ObligationOccurrence for the occurrenceKey is deleted or reverted (status is no longer COMPLETED).
 * 3. The linked FinancialTransaction created by Paid is deleted from the database.
 * 4. The obligation nextDueAt is restored to the original due date (not left at the advanced recurrence date).
 *
 * @param {any} prismaClient - Prisma client or mock instance
 * @param {object} options
 * @param {string} options.obligationId
 * @param {string} options.userId
 * @param {string} options.occurrenceKey
 * @param {Date|string} options.expectedRestoredDueAt
 * @param {string} [options.linkedTransactionId]
 */
async function verifyUndoPersistedState(prismaClient, options) {
  const { obligationId, userId, occurrenceKey, expectedRestoredDueAt, linkedTransactionId } = options;

  if (!obligationId) {
    throw new Error('[verifyUndoPersistedState] obligationId is required');
  }

  // 1. Obligation ownership and schedule check
  const obligation = await prismaClient.obligation.findUnique({
    where: { id: obligationId },
    select: { id: true, userId: true, nextDueAt: true, isActive: true },
  });

  if (!obligation) {
    throw new Error(`[verifyUndoPersistedState] Obligation ${obligationId} not found in database`);
  }

  if (userId && obligation.userId !== userId) {
    throw new Error(
      `[verifyUndoPersistedState] Security violation: obligation ${obligationId} belongs to user ${obligation.userId}, expected ${userId}`
    );
  }

  if (expectedRestoredDueAt) {
    const expectedTime = new Date(expectedRestoredDueAt).getTime();
    const actualTime = new Date(obligation.nextDueAt).getTime();
    if (actualTime !== expectedTime) {
      throw new Error(
        `[verifyUndoPersistedState] Schedule not rewound: nextDueAt is ${new Date(obligation.nextDueAt).toISOString()} (${actualTime}), expected ${new Date(expectedRestoredDueAt).toISOString()} (${expectedTime})`
      );
    }
  }

  // 2. Occurrence deletion or reversion check
  const occurrence = await prismaClient.obligationOccurrence.findFirst({
    where: {
      obligationId,
      occurrenceKey,
    },
  });

  if (occurrence && occurrence.status === 'COMPLETED') {
    throw new Error(
      `[verifyUndoPersistedState] Occurrence ${occurrenceKey} still exists with status COMPLETED (id: ${occurrence.id})`
    );
  }

  // 3. Linked transaction deletion check
  if (linkedTransactionId) {
    const tx = await prismaClient.financialTransaction.findUnique({
      where: { id: linkedTransactionId },
    });
    if (tx) {
      throw new Error(
        `[verifyUndoPersistedState] Linked transaction ${linkedTransactionId} was not deleted from database`
      );
    }
  }

  // Lingering transaction query
  const remainingTx = await prismaClient.financialTransaction.findFirst({
    where: {
      obligationId,
      note: { contains: occurrenceKey },
    },
  });
  if (remainingTx) {
    throw new Error(
      `[verifyUndoPersistedState] Lingering financial transaction found for obligation ${obligationId} and occurrenceKey ${occurrenceKey}`
    );
  }

  return {
    verified: true,
    obligationId,
    occurrenceStatus: occurrence ? occurrence.status : 'DELETED',
    restoredNextDueAt: obligation.nextDueAt,
  };
}

/**
 * Runs negative regression assertions for verifyUndoPersistedState to prove failure detection.
 */
async function runUndoNegativeRegressions() {
  // Test 1: Retained COMPLETED occurrence must throw
  let threwOcc = false;
  try {
    await verifyUndoPersistedState({
      obligation: { findUnique: async () => ({ id: 'ob-corrupt-1', userId: 'usr-neg', nextDueAt: new Date('2026-01-14T10:30:00.000Z') }) },
      obligationOccurrence: { findFirst: async () => ({ id: 'occ-corrupt-1', status: 'COMPLETED', occurrenceKey: '2026-01-15' }) },
      financialTransaction: { findUnique: async () => null, findFirst: async () => null },
    }, {
      obligationId: 'ob-corrupt-1',
      userId: 'usr-neg',
      occurrenceKey: '2026-01-15',
      expectedRestoredDueAt: new Date('2026-01-14T10:30:00.000Z'),
    });
  } catch (err) {
    if (err.message.includes('still exists with status COMPLETED')) threwOcc = true;
  }
  if (!threwOcc) throw new Error('Regression assertion failed: verifyUndoPersistedState did not reject retained COMPLETED occurrence');

  // Test 2: Retained linked FinancialTransaction must throw
  let threwTx = false;
  try {
    await verifyUndoPersistedState({
      obligation: { findUnique: async () => ({ id: 'ob-corrupt-2', userId: 'usr-neg', nextDueAt: new Date('2026-01-14T10:30:00.000Z') }) },
      obligationOccurrence: { findFirst: async () => null },
      financialTransaction: { findUnique: async () => ({ id: 'tx-corrupt-2', amount: 3000 }), findFirst: async () => null },
    }, {
      obligationId: 'ob-corrupt-2',
      userId: 'usr-neg',
      occurrenceKey: '2026-01-15',
      expectedRestoredDueAt: new Date('2026-01-14T10:30:00.000Z'),
      linkedTransactionId: 'tx-corrupt-2',
    });
  } catch (err) {
    if (err.message.includes('was not deleted from database')) threwTx = true;
  }
  if (!threwTx) throw new Error('Regression assertion failed: verifyUndoPersistedState did not reject retained linked transaction');

  // Test 3: Unrestored schedule (nextDueAt advanced) must throw
  let threwSched = false;
  try {
    await verifyUndoPersistedState({
      obligation: { findUnique: async () => ({ id: 'ob-corrupt-3', userId: 'usr-neg', nextDueAt: new Date('2026-04-14T10:30:00.000Z') }) },
      obligationOccurrence: { findFirst: async () => null },
      financialTransaction: { findUnique: async () => null, findFirst: async () => null },
    }, {
      obligationId: 'ob-corrupt-3',
      userId: 'usr-neg',
      occurrenceKey: '2026-01-15',
      expectedRestoredDueAt: new Date('2026-01-14T10:30:00.000Z'),
    });
  } catch (err) {
    if (err.message.includes('Schedule not rewound')) threwSched = true;
  }
  if (!threwSched) throw new Error('Regression assertion failed: verifyUndoPersistedState did not reject unrestored nextDueAt');

  // Test 4: Wrong user mutation must throw
  let threwUser = false;
  try {
    await verifyUndoPersistedState({
      obligation: { findUnique: async () => ({ id: 'ob-corrupt-4', userId: 'attacker', nextDueAt: new Date('2026-01-14T10:30:00.000Z') }) },
      obligationOccurrence: { findFirst: async () => null },
      financialTransaction: { findUnique: async () => null, findFirst: async () => null },
    }, {
      obligationId: 'ob-corrupt-4',
      userId: 'victim',
      occurrenceKey: '2026-01-15',
      expectedRestoredDueAt: new Date('2026-01-14T10:30:00.000Z'),
    });
  } catch (err) {
    if (err.message.includes('Security violation')) threwUser = true;
  }
  if (!threwUser) throw new Error('Regression assertion failed: verifyUndoPersistedState did not reject wrong user');
}

async function main() {
  console.log('=== STARTING NUTRISNAP V0.3 R006 FOCUSED BROWSER VERIFICATION ===');

  const testUserEmail = `browser_r006_${Date.now()}@test.local`;
  const rawSessionToken = crypto.randomBytes(32).toString('base64url');

  console.log('1. Setting up test database entities in isolated PostgreSQL test db...');

  // 1. Create test user with Pacific/Kiritimati timezone (+14)
  const testUser = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: 'Kiritimati Test User',
      timezone: 'Pacific/Kiritimati',
      role: 'USER',
      password: '$2a$10$abcdefghijklmnopqrstuvwxABCDEFGHIJKLMNOPQRSTUVWXYZ012',
      onboarded: true,
      requiresPasswordReset: false,
    },
  });

  // 2. Create session
  await prisma.session.create({
    data: {
      userId: testUser.id,
      tokenHash: hashToken(rawSessionToken),
      expiresAt: new Date(Date.now() + 86400 * 1000 * 7),
    },
  });

  // 3. Create test payment account
  const bankAccount = await prisma.financialAccount.create({
    data: {
      userId: testUser.id,
      name: 'Kiritimati Primary Savings',
      type: 'BANK',
      openingBalance: 100000,
    },
  });

  // 4. Create obligations
  // Obligation A: Fiber Internet - ₹3000 quarterly (MONTHLY, interval 3) -> ₹1000/mo
  // Due at 2026-01-14T10:30:00.000Z.
  // In UTC: 2026-01-14.
  // In Pacific/Kiritimati (+14): 2026-01-15 00:30 (15 Jan 2026)!
  const fiberBill = await prisma.obligation.create({
    data: {
      userId: testUser.id,
      title: 'Fiber Internet Quarterly',
      amount: 3000,
      kind: 'BILL',
      recurrenceType: 'MONTHLY',
      recurrenceInterval: 3,
      dueAt: new Date('2026-01-14T10:30:00.000Z'),
      nextDueAt: new Date('2026-01-14T10:30:00.000Z'),
      accountId: bankAccount.id,
      isActive: true,
    },
  });

  // Obligation B: Annual Cloud Backup - ₹12000 yearly (YEARLY, interval 1) -> ₹1000/mo
  const annualBackup = await prisma.obligation.create({
    data: {
      userId: testUser.id,
      title: 'Cloud Backup Annual',
      amount: 12000,
      kind: 'SUBSCRIPTION',
      recurrenceType: 'YEARLY',
      recurrenceInterval: 1,
      dueAt: new Date('2026-02-01T00:00:00.000Z'),
      nextDueAt: new Date('2026-02-01T00:00:00.000Z'),
      isActive: true,
    },
  });

  // Obligation C: One-time Security Deposit - ₹20000 (ONCE) -> Excluded from recurring budget (₹0/mo)
  const depositBill = await prisma.obligation.create({
    data: {
      userId: testUser.id,
      title: 'Office Security Deposit',
      amount: 20000,
      kind: 'BILL',
      recurrenceType: 'ONCE',
      dueAt: new Date('2026-03-01T00:00:00.000Z'),
      nextDueAt: new Date('2026-03-01T00:00:00.000Z'),
      isActive: true,
    },
  });

  console.log(`Created test user ${testUser.id} (${testUser.email}) with timezone ${testUser.timezone}`);
  console.log(`Created obligations: Fiber Internet (id: ${fiberBill.id}), Cloud Backup (id: ${annualBackup.id}), Deposit (id: ${depositBill.id})`);

  // 2. Start Next.js server on port 9005
  console.log(`2. Starting Next.js production server on port ${PORT}...`);
  const serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: TEST_DB_URL,
    },
    stdio: 'inherit',
  });

  try {
    await waitForServer(`${BASE_URL}/finance/bills`);
    console.log(`Next.js server is ready at ${BASE_URL}!`);

    // 3. Launch Playwright Chromium
    console.log('3. Launching Chromium via Playwright...');
    const browser = await chromium.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    await context.addCookies([
      {
        name: 'nutrisnap_session_id',
        value: rawSessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
    ]);

    const page = await context.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Setup local storage auth
    await page.goto(`${BASE_URL}/finance/bills`);
    await page.evaluate((u) => {
      localStorage.setItem('nutrisnap_user', JSON.stringify(u));
    }, {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: testUser.role,
      timezone: testUser.timezone,
      onboarded: true,
      requiresPasswordReset: false,
    });

    // Reload page to pick up session in React state
    await page.goto(`${BASE_URL}/finance/bills`, { waitUntil: 'networkidle' });
    console.log('Loaded /finance/bills successfully');

    // ==========================================
    // VERIFICATION 1: Recurring-Budget Calculations
    // ==========================================
    console.log('--- Verification 1: Recurring-Budget Calculations (SOL-R005-003) ---');
    // Fiber Internet: ₹3,000 / 3 = ₹1,000
    // Cloud Backup: ₹12,000 / 12 = ₹1,000
    // Deposit: ₹20,000 ONCE = ₹0
    // Total Monthly Recurring expected: ₹2,000
    const bodyText = await page.textContent('body');
    if (!bodyText.includes('Total Monthly Recurring')) {
      throw new Error('Total Monthly Recurring metric card not found in page');
    }
    console.log('✓ "Total Monthly Recurring" metric card found');

    const recurringCardText = await page.locator('text=Total Monthly Recurring').locator('xpath=ancestor::div[contains(@class, "rounded-")]').first().innerText();
    console.log('Recurring Card Content:\n' + recurringCardText);
    if (!recurringCardText.includes('2,000')) {
      throw new Error(`Expected normalized recurring budget ₹2,000, got:\n${recurringCardText}`);
    }
    console.log('✓ PASS: Total Monthly Recurring correctly calculated as ₹2,000 (quarterly + yearly normalized, ONCE excluded)');

    // ==========================================
    // VERIFICATION 2: User Timezone Date Formatting (SOL-R006-001)
    // ==========================================
    console.log('--- Verification 2: User-Configured Timezone Date Resolution (SOL-R006-001) ---');
    const fiberRowText = await page.locator('text=Fiber Internet Quarterly').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first().innerText();
    console.log('Fiber Obligation Row Content:\n' + fiberRowText);

    // In UTC, 2026-01-14T10:30Z would be "14 Jan 2026"
    // In Pacific/Kiritimati (+14), it MUST be "15 Jan 2026"
    if (!fiberRowText.includes('15 Jan 2026')) {
      throw new Error(`Expected due date "15 Jan 2026" in Pacific/Kiritimati, but got:\n${fiberRowText}`);
    }
    console.log('✓ PASS: Due date correctly resolved to user-configured timezone: "15 Jan 2026" (not UTC 14 Jan 2026)');

    // ==========================================
    // VERIFICATION 3: Bills Paid Submission & Toast
    // ==========================================
    console.log('--- Verification 3: Bills Paid Submission (SOL-R006-001) ---');
    const fiberRow = page.locator('text=Fiber Internet Quarterly').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
    const paidButton = fiberRow.locator('button:has-text("Paid")').first();
    await paidButton.click();
    console.log('Clicked "Paid" button');

    // Dialog should open
    await page.waitForSelector('text=Mark as Paid: Fiber Internet Quarterly');
    console.log('Paid dialog opened');

    // Submit payment
    const confirmButton = page.locator('button:has-text("Confirm Paid")').first();
    await confirmButton.click();
    console.log('Submitted payment confirmation');

    // Wait for toast
    await page.waitForSelector('text=Marked as Paid', { timeout: 10000 });
    const toastDescription = await page.locator('text=Marked as Paid').locator('xpath=ancestor::*[contains(@class, "group")]').first().innerText();
    console.log('Toast Content:\n' + toastDescription);

    // Verify toast includes user timezone occurrence key: 2026-01-15
    if (!toastDescription.includes('2026-01-15')) {
      throw new Error(`Expected occurrenceKey 2026-01-15 in toast description, but got: ${toastDescription}`);
    }
    console.log('✓ PASS: Bills Paid submitted with user timezone occurrence key 2026-01-15');

    // Verify occurrence and linked transaction in database
    const occurrence = await prisma.obligationOccurrence.findFirst({
      where: { obligationId: fiberBill.id },
    });
    console.log('Created Occurrence in DB:', occurrence?.occurrenceKey, occurrence?.status);
    if (occurrence?.occurrenceKey !== '2026-01-15') {
      throw new Error(`Expected DB occurrenceKey 2026-01-15, got: ${occurrence?.occurrenceKey}`);
    }
    console.log('✓ PASS: Database occurrenceKey is 2026-01-15');

    const preUndoOccurrenceId = occurrence?.id;
    const preUndoTransactionId = occurrence?.transactionId;
    const preUndoObligation = await prisma.obligation.findUnique({
      where: { id: fiberBill.id },
      select: { nextDueAt: true },
    });
    console.log(`Pre-undo recorded state: occurrenceId=${preUndoOccurrenceId}, transactionId=${preUndoTransactionId}, advanced nextDueAt=${preUndoObligation?.nextDueAt?.toISOString()}`);

    // ==========================================
    // VERIFICATION 4: Bills Undo Paid & Database Persistence (SOL-R007-001)
    // ==========================================
    console.log('--- Verification 4: Bills Undo Paid & Database Persistence (SOL-R007-001) ---');
    await page.waitForTimeout(1000);
    // Find Undo Paid button on Fiber row
    const fiberRowAfterPaid = page.locator('text=Fiber Internet Quarterly').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
    const undoButton = fiberRowAfterPaid.locator('button:has-text("Undo Paid")');
    await undoButton.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Undo Paid button appeared');

    await undoButton.click();
    console.log('Clicked "Undo Paid" button');

    // Wait for Undo toast
    await page.waitForSelector('text=Payment Undone', { timeout: 10000 });
    console.log('✓ Toast confirmed Payment Undone');

    // Authoritative DB verification
    console.log('Asserting persisted database state after Undo Paid via verifyUndoPersistedState...');
    await verifyUndoPersistedState(prisma, {
      obligationId: fiberBill.id,
      userId: testUser.id,
      occurrenceKey: '2026-01-15',
      expectedRestoredDueAt: fiberBill.dueAt,
      linkedTransactionId: preUndoTransactionId,
    });
    console.log('✓ PASS: verifyUndoPersistedState confirmed occurrence deleted/reverted, linked expense deleted, schedule rewound to original dueAt');

    // Reload the browser page to verify server-side state reload
    console.log('Reloading browser page to verify server-side state persistence...');
    await page.reload({ waitUntil: 'networkidle' });

    const fiberRowAfterReload = page.locator('text=Fiber Internet Quarterly').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]').first();
    const fiberRowTextAfterReload = await fiberRowAfterReload.innerText();

    // Verify UI shows the Paid button (not Undo Paid)
    const paidButtonAfterReload = fiberRowAfterReload.locator('button:has-text("Paid")').first();
    await paidButtonAfterReload.waitFor({ state: 'visible', timeout: 5000 });
    const undoButtonAfterReload = fiberRowAfterReload.locator('button:has-text("Undo Paid")');
    const undoVisible = await undoButtonAfterReload.isVisible();
    if (undoVisible) {
      throw new Error('Undo Paid button still visible after page reload - server-side state did not revert!');
    }
    console.log('✓ PASS: Paid button is visible and Undo Paid is gone after reload');

    // Verify UI shows the restored due date "15 Jan 2026"
    if (!fiberRowTextAfterReload.includes('15 Jan 2026')) {
      throw new Error(`Expected restored due date "15 Jan 2026" after reload, but got:\n${fiberRowTextAfterReload}`);
    }
    console.log('✓ PASS: Restored due date "15 Jan 2026" correctly displayed after reload');

    // Negative regression assertions
    console.log('Running negative regression assertions for verifyUndoPersistedState...');
    await runUndoNegativeRegressions();
    console.log('✓ PASS: All negative regression checks passed');

    // Take Desktop Screenshot
    const artifactDir = process.env.ARTIFACT_DIR || path.join(projectRoot, 'artifacts');
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    const desktopScreenshotPath = path.join(artifactDir, 'bills_desktop_verified.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log(`Saved desktop screenshot to ${desktopScreenshotPath}`);

    // ==========================================
    // VERIFICATION 5: Mobile Width (375x667)
    // ==========================================
    console.log('--- Verification 5: Mobile Layout Responsive Rendering (375x667) ---');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload({ waitUntil: 'networkidle' });
    console.log('Reloaded page at mobile viewport (375x667)');

    // Verify recurring budget metric card is visible
    const mobileRecurringText = await page.locator('text=Total Monthly Recurring').locator('xpath=ancestor::div[contains(@class, "rounded-")]').first().innerText();
    if (!mobileRecurringText.includes('2,000')) {
      throw new Error(`Mobile view recurring budget metric mismatch: ${mobileRecurringText}`);
    }
    console.log('✓ PASS: Mobile view renders Total Monthly Recurring metric card correctly (₹2,000)');

    // Verify obligation list is rendered
    const mobileFiberText = await page.locator('text=Fiber Internet Quarterly').first().innerText();
    if (!mobileFiberText) {
      throw new Error('Obligation card missing in mobile view');
    }
    console.log('✓ PASS: Mobile view obligation cards rendered cleanly');

    // Take Mobile Screenshot
    const mobileScreenshotPath = path.join(artifactDir, 'bills_mobile_verified.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log(`Saved mobile screenshot to ${mobileScreenshotPath}`);

    console.log('=== ALL BROWSER VERIFICATIONS PASSED SUCCESSFULLY ===');
    await browser.close();
  } finally {
    console.log('Cleaning up server process and test data...');
    serverProcess.kill('SIGTERM');

    try {
      await prisma.obligationOccurrence.deleteMany({ where: { obligation: { userId: testUser.id } } });
      await prisma.obligation.deleteMany({ where: { userId: testUser.id } });
      await prisma.financialTransaction.deleteMany({ where: { userId: testUser.id } });
      await prisma.financialAccount.deleteMany({ where: { userId: testUser.id } });
      await prisma.session.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
      await prisma.$disconnect();
      console.log('Test data cleaned up cleanly.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Browser verification failed:', err);
    process.exit(1);
  });
}

module.exports = {
  verifyUndoPersistedState,
  runUndoNegativeRegressions,
};
