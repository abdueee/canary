// Seed script, run with `npm run db:seed` (and automatically by `prisma migrate reset`).
// Empty for now. Admin promotion (SEED_ADMIN_EMAIL) is added with authentication.

async function main() {
  console.log("Nothing to seed yet.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
