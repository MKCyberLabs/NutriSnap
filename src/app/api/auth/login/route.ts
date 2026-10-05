import { prisma } from '@/lib/prisma';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@/lib/validation';
import { createSession } from '@/lib/session';

// 🛡️ Sentinel: Generate a dummy hash once at startup to prevent user enumeration
// timing attacks. Avoid hardcoding a valid hash string to prevent false-positive SAST alerts.
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

const globalForRateLimiter = globalThis as unknown as {
  authLoginAttempts: Map<string, { count: number; lastAttempt: number }>;
  authCleanupInterval: NodeJS.Timeout;
};

// Simple in-memory rate limiter for prototype
// Relaxed for development: 50 attempts per 15 mins
const loginAttempts = globalForRateLimiter.authLoginAttempts || new Map<string, { count: number; lastAttempt: number }>();
if (process.env.NODE_ENV !== 'production') {
  globalForRateLimiter.authLoginAttempts = loginAttempts;
}

// Simple cleanup interval to prevent memory leaks (runs every 15 mins)
if (!globalForRateLimiter.authCleanupInterval) {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [id, data] of loginAttempts.entries()) {
      if (now - data.lastAttempt > 15 * 60 * 1000) {
        loginAttempts.delete(id);
      }
    }
  }, 15 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    globalForRateLimiter.authCleanupInterval = interval;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { email, password } = result.data;
    const identifier = email.trim().toLowerCase();

    // Rate Limiting Check
    const attempts = loginAttempts.get(identifier);
    const now = Date.now();
    if (attempts && attempts.count >= 10 && now - attempts.lastAttempt < 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' }, { status: 429 });
    }

    // Real Database Lookup via Prisma
    const user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    let passwordMatch = false;

    if (!user) {
      // 🛡️ Sentinel: Mitigate User Enumeration timing attacks by performing a dummy hash comparison
      // when a user lookup returns null, ensuring response time is consistent.
      await bcrypt.compare(password, DUMMY_HASH);
      updateAttempts(identifier);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } else {
      // Password Verification
      passwordMatch = await bcrypt.compare(password, user.password);
    }

    if (!passwordMatch) {
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
      requiresPasswordReset: user.requiresPasswordReset,
      metrics: {
        gender: user.gender,
        age: user.age,
        weight: user.weight,
        height: user.height
      }
    };

    await createSession(user.id);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function updateAttempts(id: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(id) || { count: 0, lastAttempt: 0 };

  // Reset the count if the penalty window has expired
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.set(id, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(id, { count: attempts.count + 1, lastAttempt: now });
  }
}
