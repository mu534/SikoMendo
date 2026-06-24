import prisma from '../lib/prisma';

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: 'admin@sikomendounion.org.et' },
    include: { accounts: true },
  });
  console.log(JSON.stringify(u, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
