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
