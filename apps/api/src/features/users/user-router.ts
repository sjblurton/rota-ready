import { Router } from 'express';
import { withIdentity, type AuthConfig } from '#src/lib/auth.js';
import type { Db } from '#src/lib/db.js';
import { withUser } from './require-user.js';
import { userController } from './user-controller.js';
import { createUserService } from './user-service.js';

export function userRouter({ db, authConfig }: { db: Db; authConfig: AuthConfig }): Router {
  const controller = userController(createUserService({ db }));
  const router = Router();
  router.put('/', withIdentity(authConfig, controller.recordSignIn));
  router.get('/', withUser(authConfig, db, controller.getCurrentUser));
  return router;
}
