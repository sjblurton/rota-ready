import type { Identity } from '../../lib/auth.js';
import type { DbClient } from '../../lib/db.js';

export function findUser(db: DbClient, id: string) {
  return db.user.findUnique({ where: { id } });
}

export function upsertUser(db: DbClient, { userId, email }: Identity) {
  return db.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: { email },
  });
}
