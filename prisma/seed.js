const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@mkcyberlabs.in';
  // Pre-calculated bcrypt hash for 'ProductionPassword123!' with 12 rounds
  const hashedPassword = '$2b$12$wChvYlO4UgpwEdBWXtvADuk4jecNA/Q0S6Tjcc433hstex6xo2YIW';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    console.log(`Initializing system: Seeding default admin identity (${adminEmail})...`);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'MK CyberLabs Admin',
        password: hashedPassword,
        role: 'ADMIN',
        onboarded: true,
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
    await prisma.$disconnect();
  });
