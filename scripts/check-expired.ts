// Local-dev equivalent of hitting POST /api/cron/revoke -- run with
// `pnpm revoke:check` (tsx scripts/check-expired.ts).
//
// Uses a relative import rather than the `@/lib/revocation` alias: that
// alias is wired up for Next.js's own bundler (see tsconfig.json paths),
// but this script runs standalone via plain tsx, which does not resolve
// tsconfig path aliases on its own.
import { checkAndRevokeExpired } from "../lib/revocation";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await checkAndRevokeExpired();
  console.log(JSON.stringify(result, null, 2));
}

// Disconnect before exiting -- calling process.exit() while Prisma's
// connection is still open/closing can crash the process on Windows
// (libuv assertion in src/win/async.c) even though the script's work
// already completed successfully.
main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
