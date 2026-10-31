import "server-only";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  const adapter = new PrismaPg(
    new Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      // One connection keeps queries from overlapping. The local Prisma Dev
      // proxy corrupts unnamed prepared statements when two are in flight.
      // Raise this after moving to a normal PostgreSQL server.
      max: 1,
    }),
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
