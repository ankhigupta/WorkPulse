// Explicit, developer-run bootstrap — never invoked automatically on
// server start. Run with: npm run bootstrap:super-admin
// (requires SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in the environment
// or .env — see .env.example).
import { env } from "../src/common/config/env";
import { logger } from "../src/common/logger";
import { prisma } from "../src/common/db/prisma";
import { bootstrapSuperAdmin } from "../src/modules/auth/superAdmin.service";

async function main(): Promise<void> {
  const { SUPER_ADMIN_EMAIL: email, SUPER_ADMIN_PASSWORD: password } = env;

  if (!email || !password) {
    logger.error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set (in .env or the environment) to run this bootstrap.",
    );
    process.exitCode = 1;
    return;
  }

  const result = await bootstrapSuperAdmin(email, password);

  if (result.created) {
    logger.info({ userId: result.userId, email }, "SUPER_ADMIN account created");
  } else {
    logger.info({ userId: result.userId, email }, "SUPER_ADMIN account already exists — nothing to do");
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "SUPER_ADMIN bootstrap failed");
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
