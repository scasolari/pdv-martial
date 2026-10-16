import { PrismaClient } from "@prisma/client";

let prisma = global.prisma || new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
