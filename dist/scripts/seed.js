"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
