require('dotenv').config();
const { PrismaClient } = require('./generated/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@mkcyberlabs.in';
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error('ADMIN_INITIAL_PASSWORD must be set before seeding');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(initialPassword)) {
    throw new Error('ADMIN_INITIAL_PASSWORD must meet the application password policy');
  }
  const hashedPassword = await bcrypt.hash(initialPassword, 12);

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
