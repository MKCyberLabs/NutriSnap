'use server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function updateUserMetrics(userId: string, metrics: any) {
  try {
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
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        requiresPasswordReset: false
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to reset password:", error);
    return { success: false };
  }
}

export async function authenticateDbUser(email: string, password?: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    
    // Dynamically calculate if bio data is truly complete
    user.onboarded = user.onboarded && !!(user.age && user.age > 0 && user.weight && user.weight > 0 && user.height && user.height > 0);
    
    if (password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        // Remove password field to prevent hash leak to frontend
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to authenticate user:", error);
    return null;
  }
}

export async function updateUserSettings(userId: string, data: { telegramId?: string, password?: string, timezone?: string, dailyCaloriesGoal?: number, dailyProteinGoal?: number, dailyCarbsGoal?: number, dailyFatGoal?: number, age?: number, weight?: number, height?: number, gender?: string }) {
  try {
    const updateData: any = {};
    if (data.telegramId !== undefined) {
      updateData.telegramId = data.telegramId || null;
    }
    if (data.password) {
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
    return { success: true };
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return { success: false };
  }
}
