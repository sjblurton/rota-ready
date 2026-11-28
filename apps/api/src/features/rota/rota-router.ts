import { apiErrorCode, isWeekStart } from '@rota-ready/shared';
import { Router } from 'express';
import type { RotaServiceDependencies } from './rota-service.js';
import { sendError } from '#src/lib/http-errors.js';
import { askController } from './ask-controller.js';
import type { AskService } from './ask-service.js';
import type { AskSettings } from './ask-settings.js';
import { rotaController } from './rota-controller.js';
import { createRotaService } from './rota-service.js';
import { shiftController } from './shift-controller.js';
import { createShiftService } from './shift-service.js';

export function rotaRouter(
  dependencies: RotaServiceDependencies & { asks: AskService; askSettings: AskSettings },
): Router {
  const { db, clock } = dependencies;
  const rotas = rotaController(createRotaService(dependencies), clock);
  const shifts = shiftController(createShiftService({ db, clock }), clock);
  const asks = askController(dependencies.asks, dependencies.askSettings);
  const router = Router();
  router.param('weekStart', (_req, res, next, weekStart: string) => {
    if (!isWeekStart(weekStart)) return sendError(res, apiErrorCode.not_found);
    next();
  });
  router.get('/:weekStart', rotas.getRota);
  router.post('/:weekStart/shifts', shifts.addShift);
  router.patch('/:weekStart/shifts/:shiftId', shifts.editShift);
  router.delete('/:weekStart/shifts/:shiftId', shifts.deleteShift);
  router.post('/:weekStart/publish', rotas.publishRota);
  router.post('/:weekStart/send-updates', rotas.sendUpdates);
  router.post('/:weekStart/copy-last-week', rotas.copyLastWeek);
  router.post('/:weekStart/ask', asks.askAboutThisWeek);
  return router;
}
