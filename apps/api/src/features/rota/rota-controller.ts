import {
  byStaffMemberName,
  copyLastWeekResultSchema,
  publishResultSchema,
  rotaSchema,
  sendUpdatesResultSchema,
  shiftUpdateKind,
  type ShiftUpdate as ShiftUpdateResponse,
} from '@rota-ready/shared';
import type { Clock } from '#src/lib/clock.js';
import { sendError } from '#src/lib/http-errors.js';
import type { VenueRequestHandler } from '#src/features/venues/require-venue-member.js';
import type {
  RotaService,
  ShiftUpdate,
  StaffMemberToNotify,
  StaffMemberToUpdate,
} from './rota-service.js';
import { toRemovedShift, toShift } from './shift-controller.js';

export type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

function toStaffMemberToNotify({ staffMember: { id, name }, staffLinkToken }: StaffMemberToNotify) {
  return { staffMemberId: id, name, staffLinkToken };
}

function toShiftTimes({ startsAt, endsAt }: { startsAt: Date; endsAt: Date }) {
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function toShiftUpdate(update: ShiftUpdate): ShiftUpdateResponse {
  if (update.kind === shiftUpdateKind.changed) {
    return { kind: update.kind, ...toShiftTimes(update.times), previous: toShiftTimes(update.previous) };
  }
  return { kind: update.kind, ...toShiftTimes(update.times) };
}

function toPublishResult(staffMembers: StaffMemberToNotify[]) {
  return publishResultSchema.parse({
    staffMembers: staffMembers.map(toStaffMemberToNotify).sort(byStaffMemberName),
  });
}

function toSendUpdatesResult(staffMembers: StaffMemberToUpdate[]) {
  return sendUpdatesResultSchema.parse({
    staffMembers: staffMembers
      .map((each) => ({ ...toStaffMemberToNotify(each), updates: each.updates.map(toShiftUpdate) }))
      .sort(byStaffMemberName),
  });
}

export function rotaController(rotas: RotaService, clock: Clock) {
  async function rotaOf(venueId: string, weekStart: string) {
    const { rota, shifts, removedShifts } = await rotas.get(venueId, weekStart);
    const now = clock.now();
    return rotaSchema.parse({
      weekStart,
      status: rota.status,
      shifts: shifts.map((shift) => toShift(shift, rota.status, now)),
      removedShifts: removedShifts.map(toRemovedShift),
    });
  }

  const getRota: RotaRequestHandler = async (req, res) => {
    res.json(await rotaOf(res.locals.venue.id, req.params.weekStart));
  };

  const copyLastWeek: RotaRequestHandler = async (req, res) => {
    const result = await rotas.copyLastWeek(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(
      copyLastWeekResultSchema.parse({
        rota: await rotaOf(res.locals.venue.id, req.params.weekStart),
        skippedShifts: result.skippedShifts,
      }),
    );
  };

  const publishRota: RotaRequestHandler = async (req, res) => {
    const result = await rotas.publish(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(toPublishResult(result.staffMembers));
  };

  const sendUpdates: RotaRequestHandler = async (req, res) => {
    const result = await rotas.sendUpdates(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(toSendUpdatesResult(result.staffMembers));
  };

  return { getRota, publishRota, sendUpdates, copyLastWeek };
}
