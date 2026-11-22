// Seed script, run with `npm run db:seed` (and automatically by `prisma migrate reset`).
//
// Promotes the account with SEED_ADMIN_EMAIL to admin. Everyone registers as a
// viewer, so this is how the very first admin is created:
//   1. register that email at /register
//   2. npm run db:seed
//
// This runs outside Next.js, so it creates its own Prisma client instead of
// importing src/lib/db.ts (which is marked server-only).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function promoteSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  if (!email) {
    console.log("SEED_ADMIN_EMAIL is not set; no admin promoted.");
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) {
    console.warn(
      `No account for ${email} yet. Register it at /register, then run "npm run db:seed" again.`,
    );
    return;
  }

  if (user.role === "admin") {
    console.log(`${user.email} is already an admin.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  console.log(`Promoted ${user.email} to admin.`);
}

async function main() {
  await promoteSeedAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
