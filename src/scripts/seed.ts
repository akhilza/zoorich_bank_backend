import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Database ready. No dummy accounts are seeded.');
  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  console.log(`Current registered users: ${userCount}, accounts: ${accountCount}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
