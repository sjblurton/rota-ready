import { currentUserSchema } from '@rota-ready/shared';
import type { Request, Response } from 'express';
import type { User } from '../../generated/prisma/client.js';
import type { Identity } from '../../lib/auth.js';
import type { UserService } from './user-service.js';

function toCurrentUser({ id, email }: User) {
  return currentUserSchema.parse({ id, email });
}

export function userController(users: UserService) {
  return {
    async recordSignIn(_req: Request, res: Response, identity: Identity) {
      res.json(toCurrentUser(await users.recordSignIn(identity)));
    },

    getCurrentUser(_req: Request, res: Response, user: User) {
      res.json(toCurrentUser(user));
    },
  };
}
