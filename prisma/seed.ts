
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@mkcyberlabs.in';
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe123!@#';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    console.log(`Seeding default admin: ${adminEmail}`);
    const hashedPassword = await bcrypt.hash(initialPassword, 12);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'MK CyberLabs Admin',
        password: hashedPassword,
        role: 'ADMIN',
        onboarded: true,
        requiresPasswordReset: true,
      }
    });
    console.log('Admin user created successfully.');
  } else {
    console.log('Admin user already exists. Skipping seed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
