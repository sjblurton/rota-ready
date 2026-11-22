import type { Identity } from '../../lib/auth.js';
import type { Db } from '../../lib/db.js';
import { findUser, upsertUser } from './user-data.js';

export function createUserService({ db }: { db: Db }) {
  return {
    find(userId: string) {
      return findUser(db, userId);
    },

    recordSignIn(identity: Identity) {
      return upsertUser(db, identity);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
