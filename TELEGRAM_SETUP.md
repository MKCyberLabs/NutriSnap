# NutriSnap Telegram Bot Integration Guide

This document outlines the complete step-by-step process we followed to integrate a Telegram Bot into the NutriSnap application using Webhooks and the `grammY` framework.

## 1. Database Schema Update
To link Telegram users to our internal application users, we updated the Prisma schema:
- Added `telegramId String? @unique` to the `User` model in `prisma/schema.prisma`.
- Applied the changes to the PostgreSQL database using `docker exec nutrisnap_prod npx prisma db push`.

## 2. Environment Variables Configuration
We added the following keys to our `.env` file to securely handle Telegram requests:
- `TELEGRAM_BOT_TOKEN`: The official API token provided by Telegram's BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: A custom, randomly generated string used to verify that incoming POST requests genuinely originate from Telegram.

## 3. Webhook API Route Implementation
We built a Next.js App Router API endpoint to serve as the Webhook receiver:
- **Dependency**: Swapped to the `grammY` framework (`npm install grammy`) for its modern architecture and built-in Next.js/Web standard support.
- **Location**: `src/app/api/telegram/webhook/route.ts`.
- **Logic**:
  1. **Security**: Verifies the `x-telegram-bot-api-secret-token` header against the `.env` secret.
  2. **Initialization**: Calls `await bot.init()` and `await bot.handleUpdate()` to process the payload.
  3. **Authentication**: Looks up the sender's Telegram ID in the database.
  4. **Processing**: Downloads the highest resolution photo sent by the user to the shared Docker volume (`public/uploads`).
  5. **AI Analysis**: Passes the local image path and caption to the `mealNutritionalAnalysis` Genkit flow (which communicates with the Python AI microservice on port 5000).
  6. **Database Persistence**: Saves the parsed nutritional data (calories, protein, carbs, fat, etc.) into the `MealLog` table.
  7. **Response**: Replies to the user with a formatted markdown message detailing their meal's nutritional value.

## 4. Webhook Registration Script
To link the Telegram Bot token to the Next.js API endpoint, we built a utility script:
- **Location**: `scripts/set-webhook.ts`.
- **Functionality**: Uses `grammY`'s `bot.api.setWebhook` to send the production URL and the `secret_token` to Telegram.

## 5. Deployment & Execution
To deploy these changes to the live Docker environment:
1. **Rebuild**: We rebuilt the Next.js production image to include the new `grammy` dependency and API routes:
   ```bash
   docker compose up -d --build nutrisnap
   ```
2. **Apply Variables**: After manually updating the `.env` file with the real tokens, we restarted the container to inject the new environment variables:
   ```bash
   docker compose up -d nutrisnap
   ```
3. **Register Webhook**: Finally, we executed the setup script to register the domain with Telegram:
   ```bash
   npx tsx scripts/set-webhook.ts https://nutrisnap.mkcyberlabs.in/api/telegram/webhook
   ```

## Next Steps / Maintenance
- If the domain name changes, simply re-run the setup script with the new URL.
- If the bot token changes, update `.env`, restart the container, and re-run the setup script.
