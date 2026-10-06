'use server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSession, requireUser } from '@/lib/session';
import { passwordPolicy } from '@/lib/validation';

// Dynamic dummy hash to prevent user enumeration timing attacks without triggering SAST tools for hardcoded secrets
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

const globalForRateLimiter = globalThis as unknown as {
  dbUsersLoginAttempts: Map<string, { count: number; lastAttempt: number }>;
  dbUsersCleanupInterval: NodeJS.Timeout;
};

// Simple in-memory rate limiter for server action
// Relaxed for development: 50 attempts per 15 mins
const loginAttempts = globalForRateLimiter.dbUsersLoginAttempts || new Map<string, { count: number; lastAttempt: number }>();
if (process.env.NODE_ENV !== 'production') {
  globalForRateLimiter.dbUsersLoginAttempts = loginAttempts;
}

// Simple cleanup interval to prevent memory leaks (runs every 15 mins)
if (!globalForRateLimiter.dbUsersCleanupInterval) {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [id, data] of loginAttempts.entries()) {
      if (now - data.lastAttempt > 15 * 60 * 1000) {
        loginAttempts.delete(id);
      }
    }
  }, 15 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    globalForRateLimiter.dbUsersCleanupInterval = interval;
  }
}

function updateAttempts(identifier: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };

  // Reset the count if the penalty window has expired
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(identifier, { count: attempts.count + 1, lastAttempt: now });
  }
}

export async function updateUserMetrics(userId: string, metrics: any) {
  try {
    await requireUser(userId);
    await prisma.user.update({
      where: { id: userId },
      data: {
        onboarded: true,
        gender: metrics.gender,
        age: Number(metrics.age),
        weight: Number(metrics.weight),
        height: Number(metrics.height)
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update user metrics:", error);
    return { success: false };
  }
}

export async function resetDbUserPassword(userId: string, newPassword: string) {
  try {
    await requireUser(userId, true);
    passwordPolicy.parse(newPassword);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword, requiresPasswordReset: false }
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    await createSession(userId);
    return { success: true };
  } catch (error) {
    console.error("Failed to reset password:", error);
    return { success: false };
  }
}

export async function authenticateDbUser(email: string, password?: string) {
  try {
    const identifier = email.toLowerCase();

    // Rate Limiting Check
    const attempts = loginAttempts.get(identifier);
    const now = Date.now();
    if (attempts && attempts.count >= 50 && now - attempts.lastAttempt < 15 * 60 * 1000) {
      throw new Error('Too many failed login attempts. Please try again in 15 minutes.');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Dummy compare to mitigate user enumeration timing attacks
      if (password) await bcrypt.compare(password, DUMMY_HASH);
      updateAttempts(identifier);
      return null;
    }
    
    // Dynamically calculate if bio data is truly complete
    user.onboarded = user.onboarded && !!(user.age && user.age > 0 && user.weight && user.weight > 0 && user.height && user.height > 0);
    
    if (password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        // Reset rate limit on success
        loginAttempts.delete(identifier);
        await createSession(user.id);
        // Remove password field to prevent hash leak to frontend
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      } else {
        updateAttempts(identifier);
      }
    } else {
      updateAttempts(identifier);
    }
    
    return null;
  } catch (error) {
    console.error("Failed to authenticate user:", error);
    return null;
  }
}
export async function updateUserSettings(userId: string, data: { telegramId?: string, password?: string, timezone?: string, dailyCaloriesGoal?: number, dailyProteinGoal?: number, dailyCarbsGoal?: number, dailyFatGoal?: number, age?: number, weight?: number, height?: number, gender?: string }) {
  try {
    await requireUser(userId);
    const updateData: any = {};
    if (data.telegramId !== undefined) {
      updateData.telegramId = data.telegramId || null;
    }
    if (data.password) {
      passwordPolicy.parse(data.password);
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.dailyCaloriesGoal !== undefined) updateData.dailyCaloriesGoal = data.dailyCaloriesGoal || null;
    if (data.dailyProteinGoal !== undefined) updateData.dailyProteinGoal = data.dailyProteinGoal || null;
    if (data.dailyCarbsGoal !== undefined) updateData.dailyCarbsGoal = data.dailyCarbsGoal || null;
    if (data.dailyFatGoal !== undefined) updateData.dailyFatGoal = data.dailyFatGoal || null;
    
    if (data.age !== undefined) updateData.age = data.age || null;
    if (data.weight !== undefined) updateData.weight = data.weight || null;
    if (data.height !== undefined) updateData.height = data.height || null;
    if (data.gender !== undefined) updateData.gender = data.gender || null;
    
    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    if (data.password) await prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return { success: false };
  }
}
