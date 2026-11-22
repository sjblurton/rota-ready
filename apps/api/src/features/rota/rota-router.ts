import { isWeekStart } from '@rota-ready/shared';
import { Router } from 'express';
import type { RotaServiceDependencies } from './rota-service.js';
import { sendError } from '#src/lib/http-errors.js';
import { rotaController } from './rota-controller.js';
import { createRotaService } from './rota-service.js';
import { shiftController } from './shift-controller.js';
import { createShiftService } from './shift-service.js';

export function rotaRouter(dependencies: RotaServiceDependencies): Router {
  const { db, clock } = dependencies;
  const rotas = rotaController(createRotaService(dependencies), clock);
  const shifts = shiftController(createShiftService({ db }), clock);
  const router = Router();
  router.param('weekStart', (_req, res, next, weekStart: string) => {
    if (!isWeekStart(weekStart)) return sendError(res, 'not_found');
    next();
  });
  router.get('/:weekStart', rotas.getRota);
  router.post('/:weekStart/shifts', shifts.addShift);
  router.patch('/:weekStart/shifts/:shiftId', shifts.editShift);
  router.delete('/:weekStart/shifts/:shiftId', shifts.deleteShift);
  router.post('/:weekStart/publish', rotas.publishRota);
  return router;
}
