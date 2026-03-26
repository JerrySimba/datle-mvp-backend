import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });
process.env.NODE_ENV = "test";

const main = async () => {
  const [{ PrismaClient }, { env }] = await Promise.all([import("@prisma/client"), import("../config/env")]);
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction([
      prisma.validationLog.deleteMany(),
      prisma.response.deleteMany(),
      prisma.respondent.deleteMany(),
      prisma.authOtpCode.deleteMany(),
      prisma.account.deleteMany(),
      prisma.study.deleteMany(),
      prisma.company.deleteMany()
    ]);

    console.log(`Test database reset complete for ${env.DATABASE_URL}`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("Test database reset failed.", error);
  process.exitCode = 1;
});
