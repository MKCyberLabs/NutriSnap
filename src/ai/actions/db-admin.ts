'use server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function fetchAllUsers() {
  try {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export async function createDbUser(userData: any) {
  try {
    const hashedPassword = await bcrypt.hash(userData.password || 'ProductionPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role,
        onboarded: true,
      }
    });
    return { success: true, user };
  } catch (error) {
    console.error("Failed to create user:", error);
    return { success: false };
  }
}

export async function updateDbUser(userId: string, userData: any) {
  try {
    const updateData: any = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
    };
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    return { success: true, user };
  } catch (error) {
    console.error("Failed to update user:", error);
    return { success: false };
  }
}

export async function deleteDbUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false };
  }
}
