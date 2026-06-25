import { NextRequest, NextResponse } from 'next/server';
import { Bot, Context } from 'grammy';
import { prisma } from '@/lib/prisma';
import { mealNutritionalAnalysis, telegramMealNutritionalAnalysis } from '@/ai/flows/meal-nutritional-analysis';
import { NotFoodError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay, formatISO } from 'date-fns';

// Note: Next.js API route edge compatibility - we use Node.js runtime, which is the default in app router.
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'mock');

function calculateNutrientTargets(user: any) {
  const gender = user.gender || 'male';
  const age = user.age || 30;
  const weight = user.weight || 70;
  const height = user.height || 175;

  const bmr = gender === 'male'
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;

  const tdee = bmr * 1.5;

  return {
    calories: Math.round(tdee),
    protein: Math.round((tdee * 0.30) / 4),
    carbs: Math.round((tdee * 0.40) / 4),
    fat: Math.round((tdee * 0.30) / 9),
    sugar: 35
  };
}

// Register commands with Telegram so they appear in the autocomplete menu
bot.api.setMyCommands([
  { command: 'help', description: 'Show all available commands' },
  { command: 'goals', description: 'View your daily nutrition goals and remaining limits' },
  { command: 'summary', description: 'View your daily nutrition progress and biometric targets' },
  { command: 'setgoal', description: 'Set a daily macro limit (e.g., /setgoal calories 2000)' },
  { command: 'settimezone', description: 'Set your local timezone (e.g., /settimezone America/New_York)' }
]).catch(console.error);

bot.command('help', async (ctx) => {
  const msg = `🤖 **NutriSnap Bot Commands**

Use the following commands to manage your account:

/help - Show this message
/goals - View your current daily nutrition goals and remaining limits
/setgoal [metric] [value] - Set a daily limit. 
  _Metrics: calories, protein, carbs, fat_
  _Example: /setgoal calories 2000_
/settimezone [timezone] - Set your local timezone so your daily limits reset correctly at midnight.
  _Example: /settimezone Europe/London_

**How to log a meal:**
Simply send a photo of your food, OR type the name of the food (e.g. "Chicken salad with olive oil"). I will automatically analyze its nutritional content!`;

  return ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('start', async (ctx) => {
  return ctx.reply("Welcome to NutriSnap! Send me a photo of your food, or type out what you ate, and I'll calculate the nutrition for you. Type /help to see all settings.");
});

bot.command('setgoal', async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const text = ctx.match; // e.g. "calories 2000"
  
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply("Access Denied: Please contact the administrator to register.");
  
  if (!text) {
    return ctx.reply("Usage: /setgoal [calories|protein|carbs|fat] [number]\nExample: /setgoal calories 2000");
  }
  
  const parts = text.split(' ');
  if (parts.length !== 2) return ctx.reply("Invalid format. Use: /setgoal calories 2000");
  
  const metric = parts[0].toLowerCase();
  const value = parseInt(parts[1], 10);
  
  if (isNaN(value)) return ctx.reply("The goal value must be a number.");
  
  let updateData: any = {};
  if (metric === 'calories') updateData.dailyCaloriesGoal = value;
  else if (metric === 'protein') updateData.dailyProteinGoal = value;
  else if (metric === 'carbs') updateData.dailyCarbsGoal = value;
  else if (metric === 'fat') updateData.dailyFatGoal = value;
  else return ctx.reply("Invalid metric. Valid options: calories, protein, carbs, fat.");
  
  await prisma.user.update({ where: { id: user.id }, data: updateData });
  return ctx.reply(`✅ Your daily ${metric} goal has been set to ${value}.`);
});

bot.command('settimezone', async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const timezone = ctx.match; // e.g. "America/New_York"
  
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply("Access Denied.");
  
  if (!timezone) {
    return ctx.reply("Usage: /settimezone [Timezone]\nExample: /settimezone America/New_York\nFind your timezone here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones");
  }
  
  try {
    // Validate timezone
    new TZDate(new Date(), timezone);
    await prisma.user.update({ where: { id: user.id }, data: { timezone } });
    return ctx.reply(`✅ Timezone updated to ${timezone}. Your daily totals will now reset at midnight in this timezone.`);
  } catch (e) {
    return ctx.reply("❌ Invalid timezone format. Please use IANA format like 'America/New_York' or 'Europe/London'.");
  }
});

bot.command('goals', async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply("Access Denied.");
  
  const defaults = calculateNutrientTargets(user);

  const msg = [
    `🎯 **Your Daily Goals:**`,
    `Timezone: ${user.timezone}`,
    `Calories: ${user.dailyCaloriesGoal || defaults.calories + ' (Biometric)'}`,
    `Protein: ${user.dailyProteinGoal ? user.dailyProteinGoal + 'g' : defaults.protein + 'g (Biometric)'}`,
    `Carbs: ${user.dailyCarbsGoal ? user.dailyCarbsGoal + 'g' : defaults.carbs + 'g (Biometric)'}`,
    `Fat: ${user.dailyFatGoal ? user.dailyFatGoal + 'g' : defaults.fat + 'g (Biometric)'}`,
    ``,
    `Use /setgoal to update these values.`
  ].join('\n');
  
  return ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('summary', async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply("Access Denied.");

  const userTimezone = user.timezone || 'UTC';
  const nowInTz = new TZDate(new Date(), userTimezone);
  const tzStart = startOfDay(nowInTz);
  const tzEnd = endOfDay(nowInTz);
  
  const todayLogs = await prisma.mealLog.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: tzStart, lte: tzEnd }
    }
  });

  let totCal=0, totPro=0, totCarb=0, totFat=0, totSugar=0;
  todayLogs.forEach((log: any) => {
    totCal += log.totalCalories || 0;
    totPro += log.totalProtein || 0;
    totCarb += log.totalCarbs || 0;
    totFat += log.totalFat || 0;
    totSugar += log.totalSugar || 0;
  });

  totCal = Math.round(totCal);
  totPro = Math.round(totPro);
  totCarb = Math.round(totCarb);
  totFat = Math.round(totFat);
  totSugar = Math.round(totSugar);

  const defaults = calculateNutrientTargets(user);
  const gCal = user.dailyCaloriesGoal || defaults.calories;
  const gPro = user.dailyProteinGoal || defaults.protein;
  const gCarb = user.dailyCarbsGoal || defaults.carbs;
  const gFat = user.dailyFatGoal || defaults.fat;
  const gSugar = defaults.sugar; // Default strict limit

  function formatBar(current: number, max: number) {
    const pct = Math.min(Math.round((current / max) * 10), 10);
    const isOver = current > max;
    const emoji = isOver ? '🟥' : '🟩';
    const bar = emoji.repeat(pct) + '⬜️'.repeat(10 - pct);
    return `${bar} ${Math.round((current/max)*100)}%`;
  }

  const msg = `📊 *Daily Nutrition Summary*
_Based on your local timezone (${userTimezone})_

🔥 *Calories:* ${totCal.toLocaleString()} / ${gCal.toLocaleString()} kcal
${formatBar(totCal, gCal)} ${totCal > gCal ? '⚠️ *Limit Reached!*' : ''}

🥩 *Protein:* ${totPro}g / ${gPro}g
${formatBar(totPro, gPro)} ${totPro > gPro ? '⚠️ *Limit Reached!*' : ''}

🍞 *Carbs:* ${totCarb}g / ${gCarb}g
${formatBar(totCarb, gCarb)} ${totCarb > gCarb ? '⚠️ *Limit Reached!*' : ''}

🥑 *Fats:* ${totFat}g / ${gFat}g
${formatBar(totFat, gFat)} ${totFat > gFat ? '⚠️ *Limit Reached!*' : ''}

🍭 *Sugar:* ${totSugar}g / ${gSugar}g
${formatBar(totSugar, gSugar)} ${totSugar > gSugar ? '⚠️ *Limit Reached!*' : ''}`;

  return ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.on('message', async (ctx) => {
  try {
    const telegramId = String(ctx.from!.id);
    const hasPhoto = ctx.message!.photo && ctx.message!.photo.length > 0;
    const caption = hasPhoto ? (ctx.message!.caption || '') : (ctx.message!.text || '');
    
    // Ignore non-text/non-photo messages
    if (!hasPhoto && !caption) return;
    
    // Ignore commands so they aren't processed as meals
    if (caption.startsWith('/')) return;
    
    // 1. Authenticate User
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply("Access Denied: Please contact the administrator to register.");
      return;
    }

    // 2. Reaction (👀)
    try {
      // grammY context has built-in reaction method!
      await ctx.react('👀');
    } catch (e) {
      await ctx.reply("👀 Processing...");
    }

    let localImagePath = undefined;
    if (hasPhoto) {
      const photo = ctx.message!.photo![ctx.message!.photo!.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileLink = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const extMatch = file.file_path?.match(/\.([^.]+)$/);
      const ext = extMatch ? `.${extMatch[1]}` : '.jpg';
      const filename = `${Date.now()}_${telegramId}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      
      localImagePath = `/uploads/${filename}`;
    }

    // 4. Call Telegram-specific Genkit flow
    const telegramTimestampMs = ctx.message!.date * 1000;

    let analysisResult;
    try {
      analysisResult = await telegramMealNutritionalAnalysis({
        mealDescription: caption,
        imagePath: localImagePath,
        telegramTimestamp: telegramTimestampMs,
      });
    } catch (error: any) {
      console.error("Analysis Error:", error);
      try { await ctx.api.setMessageReaction(ctx.chat!.id, ctx.msg!.message_id, []); } catch (e) {}
      
      if (error.name === 'NotFoodError') {
        await ctx.reply(`🚫 **Not Food Detected**\n\n${error.message}`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply("Service currently unavailable, please try again later.");
      }
      return;
    }

    try { await ctx.api.setMessageReaction(ctx.chat!.id, ctx.msg!.message_id, []); } catch (e) {}

    // 5. Save to database
    await prisma.mealLog.create({
      data: {
        userId: user.id,
        category: analysisResult.calculatedCategory,
        time: analysisResult.calculatedTime,
        imagePath: localImagePath,
        description: caption,
        totalCalories: analysisResult.calories,
        totalProtein: analysisResult.protein,
        totalCarbs: analysisResult.carbs,
        totalFat: analysisResult.fat,
        totalFiber: analysisResult.fiber,
        totalSatFat: analysisResult.saturatedFat,
        totalSugar: analysisResult.sugar,
        healthInsight: analysisResult.healthInsight,
        items: {
          create: analysisResult.foodItems.map((item: any) => ({
            name: item.name,
            grams: item.grams,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            saturatedFat: item.saturatedFat,
            sugar: item.sugar,
          })),
        },
      },
    });

    // 6. Send success message
    const itemsText = analysisResult.foodItems.map((item: any) => 
      `- ${item.name}: ${item.calories} kcal, ${item.protein}g P, ${item.carbs}g C, ${item.fat}g F, ${item.sugar}g Sugar`
    ).join('\n');

    // Calculate daily remaining
    let goalsMsg = "";
    if (user.dailyCaloriesGoal || user.dailyProteinGoal || user.dailyCarbsGoal || user.dailyFatGoal) {
      // Find start and end of "today" in user's timezone
      const nowTz = new TZDate(new Date(), user.timezone);
      const startOfTodayIso = formatISO(startOfDay(nowTz));
      const endOfTodayIso = formatISO(endOfDay(nowTz));
      
      const todaysMeals = await prisma.mealLog.findMany({
        where: {
          userId: user.id,
          time: { gte: startOfTodayIso, lte: endOfTodayIso }
        }
      });
      
      let currentCals = 0;
      let currentProtein = 0;
      let currentCarbs = 0;
      let currentFat = 0;
      
      todaysMeals.forEach((m: any) => {
        currentCals += m.totalCalories;
        currentProtein += m.totalProtein;
        currentCarbs += m.totalCarbs;
        currentFat += m.totalFat;
      });
      
      goalsMsg = `\n\n📊 **Remaining Today (${user.timezone})**\n`;
      if (user.dailyCaloriesGoal) {
        const left = Math.max(0, user.dailyCaloriesGoal - Math.round(currentCals));
        goalsMsg += `🔥 Calories: ${left} kcal left\n`;
      }
      if (user.dailyProteinGoal) {
        const left = Math.max(0, user.dailyProteinGoal - Math.round(currentProtein));
        goalsMsg += `🍗 Protein: ${left}g left\n`;
      }
      if (user.dailyCarbsGoal) {
        const left = Math.max(0, user.dailyCarbsGoal - Math.round(currentCarbs));
        goalsMsg += `🍞 Carbs: ${left}g left\n`;
      }
      if (user.dailyFatGoal) {
        const left = Math.max(0, user.dailyFatGoal - Math.round(currentFat));
        goalsMsg += `🥑 Fat: ${left}g left\n`;
      }
    }

    const successText = `✅ Meal logged successfully!

**Items Detected:**
${itemsText}

**Total Nutritional Value:**
- **Calories:** ${analysisResult.calories} kcal
- **Protein:** ${analysisResult.protein}g
- **Carbs:** ${analysisResult.carbs}g
- **Fat:** ${analysisResult.fat}g
- **Sugar:** ${analysisResult.sugar}g

_${analysisResult.healthInsight}_${goalsMsg}`;

    await ctx.reply(successText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error("Grammy webhook error:", error);
  }
});

// Fallback for non-photo messages
bot.on('message', async (ctx) => {
  if (!ctx.message?.photo) {
     const telegramId = String(ctx.from!.id);
     const user = await prisma.user.findUnique({ where: { telegramId } });
     if (!user) {
        await ctx.reply("Access Denied: Please contact the administrator to register.");
        return;
     }
     await ctx.reply("Please send a photo of your meal with an optional caption.");
  }
});

// Next.js API Route Handler
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const update = await req.json();
    await bot.init();
    
    // Process the update in the background so we can respond with 200 OK immediately
    // This prevents Telegram from retrying the webhook and sending duplicate responses
    bot.handleUpdate(update).catch((err) => {
      console.error("Background processing error:", err);
    });
    
    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
