/**
 * Nucleus AI — Database Seed Script
 *
 * Creates a default admin user so you can log in immediately after setup.
 *
 * Usage:
 *   cd frontend
 *   npx tsx --require dotenv/config scripts/seed.ts
 *
 * Or via Prisma:
 *   npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_USERS = [
  {
    name: 'Admin',
    email: 'admin@nucleus-ai.com',
    password: 'admin123',
  },
  {
    name: 'Demo User',
    email: 'demo@nucleus-ai.com',
    password: 'demo1234',
  },
];

async function main() {
  console.log('🌱 Seeding Nucleus AI database …\n');

  for (const userData of DEFAULT_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`  ✔ User "${userData.email}" already exists — skipping.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
      },
    });

    console.log(`  ✔ Created user "${user.email}" (id: ${user.id})`);
  }

  // Create a sample brand profile for the admin user
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@nucleus-ai.com' },
    include: { brandProfiles: true },
  });

  if (adminUser && adminUser.brandProfiles.length === 0) {
    await prisma.brandProfile.create({
      data: {
        name: 'Nucleus AI (Demo Brand)',
        industry: 'Technology / SaaS',
        targetAudience: 'Marketing teams and content creators',
        brandVoice: 'Professional, innovative, and approachable',
        description:
          'AI-powered marketing platform that helps teams create on-brand content at scale.',
        userId: adminUser.id,
      },
    });
    console.log('  ✔ Created sample brand profile for admin user.');
  }

  console.log('\n✅ Seed complete!\n');
  console.log('  Default credentials:');
  console.log('  ─────────────────────────────────────');
  for (const u of DEFAULT_USERS) {
    console.log(`  Email:    ${u.email}`);
    console.log(`  Password: ${u.password}`);
    console.log('  ─────────────────────────────────────');
  }
  console.log(
    '\n⚠️  Change the default passwords after first login in a production environment!\n'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
