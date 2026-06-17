
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

    // Mock User Lookup (Simulating Prisma)
    const isTargetAdmin = email === 'admin@mkcyberlabs.in';
    const isTargetEmployee = email === 'user@nutrisnap.com';
    
    // In production: const user = await prisma.user.findUnique({ where: { email } });
    let mockUser = null;
    
    if (isTargetAdmin) {
      mockUser = {
        id: 'admin-1',
        email: 'admin@mkcyberlabs.in',
        name: 'MK CyberLabs Admin',
        role: 'ADMIN',
        hashedPassword: await bcrypt.hash('ProductionPassword123!', 12),
        onboarded: true
      };
    } else if (isTargetEmployee) {
      mockUser = {
        id: '1',
        email: 'user@nutrisnap.com',
        name: 'Alex Johnson',
        role: 'USER',
        hashedPassword: await bcrypt.hash('ProductionPassword123!', 12),
        onboarded: true
      };
    }

    if (!mockUser) {
      updateAttempts(identifier);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Password Verification
    const passwordMatch = await bcrypt.compare(password, mockUser.hashedPassword);
    const recoveryKeyMatch = process.env.ADMIN_RECOVERY_KEY && password === process.env.ADMIN_RECOVERY_KEY;

    if (!passwordMatch && !recoveryKeyMatch) {
      updateAttempts(identifier);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Reset rate limit on success
    loginAttempts.delete(identifier);

    // Prepare Response
    const responseData = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      onboarded: mockUser.onboarded,
      requiresPasswordReset: !!recoveryKeyMatch,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function updateAttempts(id: string) {
  const attempts = loginAttempts.get(id) || { count: 0, lastAttempt: 0 };
  loginAttempts.set(id, { count: attempts.count + 1, lastAttempt: Date.now() });
}
