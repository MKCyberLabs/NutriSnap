import { Bot } from 'grammy';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || token === 'your_bot_token_here') {
  console.error("Please set a valid TELEGRAM_BOT_TOKEN in your .env file.");
  process.exit(1);
}

const bot = new Bot(token);

const url = process.argv[2];

if (!url) {
  console.error("Usage: npx tsx scripts/set-webhook.ts <your_webhook_url>");
  console.error("Example: npx tsx scripts/set-webhook.ts https://nutrisnap.mkcyberlabs.in/api/telegram/webhook");
  process.exit(1);
}

async function setWebhook() {
  try {
    const response = await bot.api.setWebhook(url, {
      secret_token: webhookSecret || undefined,
    });
    if (response) {
      console.log(`✅ Webhook successfully set to: ${url}`);
    } else {
      console.error("❌ Failed to set webhook.");
    }
  } catch (error) {
    console.error("Error setting webhook:", error);
  }
}

setWebhook();
