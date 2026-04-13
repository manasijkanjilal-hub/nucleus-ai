import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('johndoe123', 12);
  
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { password: hashedPassword },
    create: {
      email: 'john@doe.com',
      name: 'John Doe',
      password: hashedPassword,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
