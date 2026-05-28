import { loadEnvConfig } from "@next/env";
import { PrismaClient, UserRole } from "@prisma/client";

loadEnvConfig(process.cwd());

const db = new PrismaClient();

function getEmailArg() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error("Usage: bunx tsx scripts/make-admin.ts <email>");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email: ${email}`);
  }

  return email;
}

async function main() {
  const email = getEmailArg();

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isSuspended: true,
    },
  });

  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      role: UserRole.ADMIN,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isSuspended: true,
      updatedAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        message: "User promoted to ADMIN",
        previousRole: user.role,
        user: updated,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
