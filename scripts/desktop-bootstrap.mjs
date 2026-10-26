import prismaPackage from "@prisma/client";

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();
try {
    await prisma.user.upsert({
        where: { id: "placedv-local-user" },
        create: { id: "placedv-local-user", name: "Local user" },
        update: {},
    });
} finally {
    await prisma.$disconnect();
}
