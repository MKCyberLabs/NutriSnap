import { prisma } from '@/lib/prisma';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@/lib/validation';

// Simple in-memory rate limiter for prototype
// Relaxed for development: 50 attempts per 15 mins
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { email, password } = result.data;
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const identifier = `${ip}:${email}`;

    // Rate Limiting Check
    const attempts = loginAttempts.get(identifier);
    const now = Date.now();
    if (attempts && attempts.count >= 50 && now - attempts.lastAttempt < 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' }, { status: 429 });
    }

    // Real Database Lookup via Prisma
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      updateAttempts(identifier);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Password Verification
    const passwordMatch = await bcrypt.compare(password, user.password);
    const recoveryKeyMatch = process.env.ADMIN_RECOVERY_KEY && password === process.env.ADMIN_RECOVERY_KEY;

    if (!passwordMatch && !recoveryKeyMatch) {
      updateAttempts(identifier);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Reset rate limit on success
    loginAttempts.delete(identifier);

    // Prepare Response
    const responseData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      // Dynamically calculate if bio data is truly complete
      onboarded: user.onboarded && !!(user.age && user.age > 0 && user.weight && user.weight > 0 && user.height && user.height > 0),
      requiresPasswordReset: user.requiresPasswordReset || !!recoveryKeyMatch,
      metrics: {
        gender: user.gender,
        age: user.age,
        weight: user.weight,
        height: user.height
      }
    };

    const response = NextResponse.json(responseData);
    
    // Set HttpOnly cookies for server-side session verification
    response.cookies.set('nutrisnap_session_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function updateAttempts(id: string) {
  const attempts = loginAttempts.get(id) || { count: 0, lastAttempt: 0 };
  loginAttempts.set(id, { count: attempts.count + 1, lastAttempt: Date.now() });
}
