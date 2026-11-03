import { PrismaClient } from "@prisma/client";
import { runSeed } from "./index";

const prisma = new PrismaClient();
runSeed(prisma)
  .then((msg) => console.log(msg))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
