import { NextRequest, NextResponse } from 'next/server';
import { Bot, Context } from 'grammy';
import { prisma } from '@/lib/prisma';
import { mealNutritionalAnalysis, telegramMealNutritionalAnalysis } from '@/ai/flows/meal-nutritional-analysis';
import { NotFoodError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

// Note: Next.js API route edge compatibility - we use Node.js runtime, which is the default in app router.
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'mock');

bot.on('message', async (ctx) => {
  try {
    const telegramId = String(ctx.from!.id);
    const hasPhoto = ctx.message!.photo && ctx.message!.photo.length > 0;
    const caption = hasPhoto ? (ctx.message!.caption || '') : (ctx.message!.text || '');
    
    // Ignore non-text/non-photo messages
    if (!hasPhoto && !caption) return;
    
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

    const successText = `✅ Meal logged successfully!

**Items Detected:**
${itemsText}

**Total Nutritional Value:**
- **Calories:** ${analysisResult.calories} kcal
- **Protein:** ${analysisResult.protein}g
- **Carbs:** ${analysisResult.carbs}g
- **Fat:** ${analysisResult.fat}g
- **Sugar:** ${analysisResult.sugar}g

_${analysisResult.healthInsight}_`;

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
