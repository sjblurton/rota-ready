import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '#src/generated/prisma/client.js';

export type Db = PrismaClient;
export type DbClient = Db | Prisma.TransactionClient;

export function createDb(connectionString: string): Db {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 2_000 }),
  });
}

export function isPrismaError(error: unknown, code: 'P2002' | 'P2025') {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
