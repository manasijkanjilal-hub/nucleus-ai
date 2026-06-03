/**
 * Nucleus AI — Database Seed Script
 *
 * Creates default users (including a Super Admin) so you can log in
 * immediately after setup, plus a sample brand profile.
 *
 * Usage:
 *   cd frontend
 *   npx tsx --require dotenv/config scripts/seed.ts
 *
 * Or via Prisma:
 *   npx prisma db seed
 */

import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const DEFAULT_USERS: SeedUser[] = [
  {
    name: 'Super Admin',
    email: 'superadmin@nucleus-ai.com',
    password: 'SuperAdmin123!',
    role: Role.SUPER_ADMIN,
  },
  {
    name: 'Admin',
    email: 'admin@nucleus-ai.com',
    password: 'admin123',
    role: Role.ADMIN,
  },
  {
    name: 'Demo Editor',
    email: 'editor@nucleus-ai.com',
    password: 'editor1234',
    role: Role.EDITOR,
  },
  {
    name: 'Demo User',
    email: 'demo@nucleus-ai.com',
    password: 'demo1234',
    role: Role.VIEWER,
  },
];

async function main() {
  console.log('🌱 Seeding Nucleus AI database …\n');

  for (const userData of DEFAULT_USERS) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Upsert ensures roles are applied/updated even for pre-existing users.
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        role: userData.role,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      create: {
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    console.log(`  ✔ Upserted "${user.email}" (role: ${user.role})`);
  }

  // Create a sample brand profile for the super admin if none exists.
  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@nucleus-ai.com' },
    include: { brandProfiles: true },
  });

  if (superAdmin && superAdmin.brandProfiles.length === 0) {
    await prisma.brandProfile.create({
      data: {
        name: 'Nucleus AI (Demo Brand)',
        industry: 'Technology / SaaS',
        targetAudience: 'Marketing teams and content creators',
        brandVoice: 'Professional, innovative, and approachable',
        description:
          'AI-powered marketing platform that helps teams create on-brand content at scale.',
        website: 'https://nucleus-ai.com',
        userId: superAdmin.id,
        createdBy: superAdmin.id,
      },
    });
    console.log('  ✔ Created sample brand profile for super admin.');
  }

  console.log('\n✅ Seed complete!\n');
  console.log('  Default credentials:');
  console.log('  ─────────────────────────────────────────────');
  for (const u of DEFAULT_USERS) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}  /  ${u.password}`);
  }
  console.log('  ─────────────────────────────────────────────');
  console.log(
    '\n⚠️  Change these default passwords after first login in production!\n'
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
