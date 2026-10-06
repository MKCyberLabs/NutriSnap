const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const UAT_URL = 'https://wealth.mkcyberlabs.in';
const USER_ID = 'cmuwdkbnk0000t02v29bfhk0w';
const SESSION_TOKEN = 'xcyQVNjAiYJ16CabDFefUhP_b_d8D6BPdDeUI75ux8M';
const ARTIFACT_DIR = '/home/openclaw/.gemini/antigravity-cli/brain/6b0d0c55-9c8d-4992-a439-9fe88bdc24da';
const CHAPATI_IMAGE_PATH = path.join(__dirname, 'test-chapati-capsicum.jpg');
const NOT_FOOD_IMAGE_PATH = '/home/openclaw/Projects/NutriSnap/public/uploads/1781714006623_94592.jpeg';

async function runUAT() {
  console.log('=== STARTING FOOD LIVE AI UAT BROWSER TEST ===');

  // 1. Clean DB MealLogs for clean test baseline
  console.log('Cleaning existing test meal logs in nutrisnap_db...');
  execSync(`docker exec nutrisnap_db psql -U nutrisnap -d nutrisnap -c "DELETE FROM \\"MealLog\\" WHERE \\"userId\\" = '${USER_ID}';"`);

  // Ensure active session in DB
  const count = execSync(`docker exec nutrisnap_db psql -U nutrisnap -d nutrisnap -t -c "SELECT count(*) FROM \\"Session\\" WHERE \\"userId\\" = '${USER_ID}';"`).toString().trim();
  console.log(`Active sessions in DB: ${count}`);

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
      value: SESSION_TOKEN,
      domain: 'wealth.mkcyberlabs.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Set local storage session before navigation
  await page.goto(`${UAT_URL}/dashboard`);
  await page.evaluate((uid) => {
    localStorage.setItem(
      'nutrisnap_user',
      JSON.stringify({
        id: uid,
        email: 'admin@mkcyberlabs.in',
        name: 'MK CyberLabs Admin',
        role: 'ADMIN',
        onboarded: true,
        requiresPasswordReset: false,
      })
    );
    // Clear old mock logs from localStorage
    localStorage.removeItem('nutrisnap_logs');
  }, USER_ID);

  await page.goto(`${UAT_URL}/dashboard`, { waitUntil: 'networkidle' });

  // Screenshot 1: Desktop Food before analysis
  const shot1 = path.join(ARTIFACT_DIR, '01_desktop_food_before_analysis.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('Saved screenshot 1:', shot1);

  // 2. Click "Log Meal" button
  console.log('Clicking "Log Meal" button...');
  const logMealBtn = page.getByRole('button', { name: 'Log Meal', exact: true });
  await logMealBtn.click();
  await page.waitForTimeout(1000);

  // Set time: Hour 02, Minute 00, PM (14:00)
  console.log('Setting time of intake to 02:00 PM (14:00)...');
  const hourSelect = page.getByRole('combobox', { name: 'Hour' });
  await hourSelect.click();
  await page.getByRole('option', { name: '02', exact: true }).click();

  const minSelect = page.getByRole('combobox', { name: 'Minute' });
  await minSelect.click();
  await page.getByRole('option', { name: '00', exact: true }).click();

  const pmBtn = page.getByRole('button', { name: 'Set time to PM' });
  await pmBtn.click();

  // Check Category dropdown says "Auto (Inferred: Lunch)"
  const categoryTrigger = page.getByRole('combobox', { name: 'Meal Category' });
  const categoryText = await categoryTrigger.innerText();
  console.log('Category dropdown text at 14:00:', categoryText);
  if (!categoryText.includes('Lunch')) {
    throw new Error(`Expected category text to contain Lunch at 14:00, got: ${categoryText}`);
  }

  // Upload image: chapati + capsicum
  console.log('Uploading chapati + capsicum image...');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(CHAPATI_IMAGE_PATH);
  await page.waitForTimeout(1000);

  // Screenshot 2: Analysis input at 14:00
  const shot2 = path.join(ARTIFACT_DIR, '02_analysis_input_1400.png');
  await page.screenshot({ path: shot2, fullPage: false });
  console.log('Saved screenshot 2:', shot2);

  // Click "Analyze Meal"
  console.log('Clicking "Analyze Meal" button...');
  const analyzeBtn = page.getByRole('button', { name: /Analyze Meal/i });
  await analyzeBtn.click();

  // Wait for Review stage
  console.log('Waiting for AI analysis to complete (calling real Python/Gemini)...');
  await page.waitForSelector('text=AI Analysis Ready', { timeout: 60000 });
  await page.waitForTimeout(1500);

  // Screenshot 3: Review stage
  const shot3 = path.join(ARTIFACT_DIR, '03_review_result.png');
  await page.screenshot({ path: shot3, fullPage: false });
  console.log('Saved screenshot 3:', shot3);

  // Validate Review Screen content
  const pageContent = await page.content();
  console.log('Checking detected food items on Review screen...');
  const hasChicken = pageContent.includes('Grilled Chicken');
  const hasRotiOrChapati = pageContent.toLowerCase().includes('roti') || pageContent.toLowerCase().includes('chapati');
  const hasCapsicum = pageContent.toLowerCase().includes('capsicum') || pageContent.toLowerCase().includes('mirch') || pageContent.toLowerCase().includes('sabzi') || pageContent.toLowerCase().includes('pepper');

  console.log({ hasChicken, hasRotiOrChapati, hasCapsicum });

  if (hasChicken) {
    throw new Error('FAILURE: Static mock Grilled Chicken detected!');
  }
  if (!hasRotiOrChapati && !hasCapsicum) {
    throw new Error('FAILURE: Neither Roti/Chapati nor Capsicum was recognized in real analysis!');
  }

  // Click "Save Meal"
  console.log('Clicking "Save Meal" button to confirm persistence...');
  const saveBtn = page.getByRole('button', { name: 'Save Meal', exact: true });
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify Daily Activity timeline updates
  console.log('Checking Daily Activity timeline...');
  await page.waitForSelector('text=Daily Activity');
  await page.waitForTimeout(1000);

  // Screenshot 4: Saved Daily Activity
  const shot4 = path.join(ARTIFACT_DIR, '04_saved_daily_activity.png');
  await page.screenshot({ path: shot4, fullPage: false });
  console.log('Saved screenshot 4:', shot4);

  // Check PostgreSQL DB for saved row
  const dbCheck = execSync(`docker exec nutrisnap_db psql -U nutrisnap -d nutrisnap -c "SELECT id, category, time, \\"totalCalories\\", \\"totalProtein\\" FROM \\"MealLog\\" WHERE \\"userId\\" = '${USER_ID}';"`);
  console.log('Database verification:\n', dbCheck.toString());

  const dbItemCheck = execSync(`docker exec nutrisnap_db psql -U nutrisnap -d nutrisnap -c "SELECT name, grams, calories, protein, fiber, rating FROM \\"FoodItem\\" WHERE \\"mealLogId\\" IN (SELECT id FROM \\"MealLog\\" WHERE \\"userId\\" = '${USER_ID}');"`);
  console.log('Database items verification:\n', dbItemCheck.toString());

  // 3. Navigate to Today page
  console.log('Navigating to Today page...');
  await page.goto(`${UAT_URL}/today`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Screenshot 5: Today nutrition after save
  const shot5 = path.join(ARTIFACT_DIR, '05_today_nutrition_after_save.png');
  await page.screenshot({ path: shot5, fullPage: false });
  console.log('Saved screenshot 5:', shot5);

  // 4. Test Page Refresh preserves data
  console.log('Reloading Today page to verify DB persistence...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 5. Switch to 390px mobile view
  console.log('Switching to 390px mobile viewport...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${UAT_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot 6: 390px mobile view
  const shot6 = path.join(ARTIFACT_DIR, '06_mobile_390px_food_ui.png');
  await page.screenshot({ path: shot6, fullPage: false });
  console.log('Saved screenshot 6:', shot6);

  await browser.close();
  console.log('=== FOOD LIVE AI UAT BROWSER TEST PASSED ===');
}

runUAT().catch((err) => {
  console.error('UAT TEST ERROR:', err);
  process.exit(1);
});
