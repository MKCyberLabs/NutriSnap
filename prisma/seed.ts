import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * @fileOverview Prisma Database Seeding Script
 * 
 * This script initializes the database with a default Super Admin account.
 * It enforces password hashing using bcrypt (12 rounds) and uses
 * environment variables for the initial credential.
 */

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@mkcyberlabs.in';
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!initialPassword) {
    console.error('CRITICAL ERROR: ADMIN_INITIAL_PASSWORD environment variable is not set.');
    process.exit(1);
  }

  // Check if the Super Admin already exists to prevent duplicate seeding
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    console.log(`Initializing system: Seeding default admin identity (${adminEmail})...`);
    
    // Hash the password with 12 salt rounds for production-grade security
    const hashedPassword = await bcrypt.hash(initialPassword, 12);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'MK CyberLabs Admin',
        password: hashedPassword,
        role: 'ADMIN',
        onboarded: true,
        // Optional: Force a password reset on first login if using a recovery scenario
        // requiresPasswordReset: true, 
      }
    });
    
    console.log('Seeding successful: Admin user created.');
  } else {
    console.log('System check: Admin user already exists. Skipping seed script.');
  }
}

main()
  .catch((e) => {
    console.error('Seeding Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Ensure the database connection is closed properly
    await prisma.$disconnect();
  });
