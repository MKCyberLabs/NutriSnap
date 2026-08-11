'use server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

async function verifyAdmin(adminUserId?: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('nutrisnap_session_id')?.value || adminUserId;
  if (!sessionId) throw new Error('Unauthorized: No session token');
  
  const user = await prisma.user.findUnique({
    where: { id: sessionId },
    select: { id: true, role: true }
  });
  
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Forbidden: Requires ADMIN role');
  }
  return user;
}


export async function fetchAllUsers(adminUserId?: string) {
  try {
    await verifyAdmin(adminUserId);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Remove password field to prevent hash leak to frontend
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export async function createDbUser(userData: any, adminUserId?: string) {
  try {
    await verifyAdmin(adminUserId);
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!userData.password && !initialPassword) {
      throw new Error('No password provided and ADMIN_INITIAL_PASSWORD is not set');
    }
    const hashedPassword = await bcrypt.hash(userData.password || initialPassword!, 10);
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role,
        telegramId: userData.telegramId || null,
        onboarded: true,
      }
    });
    // Remove password field to prevent hash leak to frontend
    const { password, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  } catch (error: any) {
    console.error("Failed to create user:", error);
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      return { success: false, error: 'A user with this email address already exists in the database.' };
    }
    return { success: false, error: error?.message || 'Failed to create user' };
  }
}

export async function updateDbUser(userId: string, userData: any, adminUserId?: string) {
  try {
    await verifyAdmin(adminUserId);
    const updateData: any = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      telegramId: userData.telegramId || null,
    };
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    // Remove password field to prevent hash leak to frontend
    const { password, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  } catch (error) {
    console.error("Failed to update user:", error);
    return { success: false };
  }
}

export async function deleteDbUser(userId: string, adminUserId?: string) {
  try {
    await verifyAdmin(adminUserId);
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false };
  }
}

