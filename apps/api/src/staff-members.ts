import {
  byStaffMemberName,
  staffLinkSchema,
  staffMemberDetailsSchema,
  staffMemberSchema,
} from '@rota-ready/shared';
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { VenueMemberLocals, VenueRequestHandler } from './auth.js';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import { Prisma, type StaffMember } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';
import { lockActiveStaffMemberUntilCommit } from './staff-member-lock.js';
import {
  decryptStaffLinkToken,
  encryptStaffLinkToken,
  generateStaffLinkToken,
  hashStaffLinkToken,
} from './staff-link-token.js';

type StaffMemberRequestHandler = VenueRequestHandler<{ staffMemberId: string }>;

const staffMemberIdSchema = z.uuid();

function isPrismaError(error: unknown, code: 'P2002' | 'P2025') {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function newStaffLinkColumns(key: Buffer) {
  const token = generateStaffLinkToken();
  return {
    token,
    columns: {
      staffLinkTokenHash: hashStaffLinkToken(token),
      staffLinkTokenCiphertext: encryptStaffLinkToken(token, key),
    },
  };
}

function activeStaffMemberWhere(venueId: string, staffMemberId: string) {
  const id = staffMemberIdSchema.safeParse(staffMemberId);
  return id.success ? { id: id.data, venueId, archivedAt: null } : null;
}

function toStaffMember({ id, name, role, email, phone }: StaffMember) {
  return staffMemberSchema.parse({ id, name, role, email, phone });
}

export function staffMemberRoutes(db: Db, staffLinkKey: Buffer, clock: Clock): Router {
  const router = Router();

  const listStaffMembers: VenueRequestHandler<object> = async (_req, res) => {
    const staffMembers = await db.staffMember.findMany({
      where: { venueId: res.locals.venue.id, archivedAt: null },
    });
    res.json(staffMembers.map(toStaffMember).sort(byStaffMemberName));
  };

  const addStaffMember: VenueRequestHandler<object> = async (req, res) => {
    const details = parseBody(staffMemberDetailsSchema, req.body, res);
    if (!details) return;
    try {
      const staffMember = await db.staffMember.create({
        data: {
          ...details,
          ...newStaffLinkColumns(staffLinkKey).columns,
          venueId: res.locals.venue.id,
        },
      });
      res.status(201).json(toStaffMember(staffMember));
    } catch (error) {
      if (isPrismaError(error, 'P2002')) return sendError(res, 'staff_member_email_taken');
      throw error;
    }
  };

  async function updateActiveStaffMember(
    res: Response<unknown, VenueMemberLocals>,
    staffMemberId: string,
    data: Prisma.StaffMemberUpdateInput,
  ): Promise<StaffMember | undefined> {
    const where = activeStaffMemberWhere(res.locals.venue.id, staffMemberId);
    if (!where) {
      sendError(res, 'not_found');
      return undefined;
    }
    try {
      return await db.staffMember.update({ where, data });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        sendError(res, 'not_found');
        return undefined;
      }
      if (isPrismaError(error, 'P2002')) {
        sendError(res, 'staff_member_email_taken');
        return undefined;
      }
      throw error;
    }
  }

  const editStaffMember: StaffMemberRequestHandler = async (req, res) => {
    const details = parseBody(staffMemberDetailsSchema, req.body, res);
    if (!details) return;
    const edited = await updateActiveStaffMember(res, req.params.staffMemberId, details);
    if (edited) res.json(toStaffMember(edited));
  };

  const archiveStaffMember: StaffMemberRequestHandler = async (req, res) => {
    const where = activeStaffMemberWhere(res.locals.venue.id, req.params.staffMemberId);
    if (!where) return sendError(res, 'not_found');
    const now = clock.now();
    const outcome = await db.$transaction(async (tx) => {
      if (!(await lockActiveStaffMemberUntilCommit(tx, where))) return 'not_found';
      const upcoming = await tx.shift.findFirst({
        where: { staffMemberId: where.id, endsAt: { gt: now } },
      });
      if (upcoming) return 'staff_member_has_upcoming_shifts';
      await tx.staffMember.update({ where: { id: where.id }, data: { archivedAt: now, email: null } });
      return null;
    });
    if (outcome) return sendError(res, outcome);
    res.status(204).end();
  };

  async function staffLinkTokenOf(staffMember: StaffMember): Promise<string> {
    if (staffMember.staffLinkTokenCiphertext) {
      return decryptStaffLinkToken(staffMember.staffLinkTokenCiphertext, staffLinkKey);
    }
    const { token, columns } = newStaffLinkColumns(staffLinkKey);
    const { count } = await db.staffMember.updateMany({
      where: { id: staffMember.id, staffLinkTokenHash: null },
      data: columns,
    });
    if (count === 1) return token;
    return staffLinkTokenOf(await db.staffMember.findUniqueOrThrow({ where: { id: staffMember.id } }));
  }

  const getStaffLink: StaffMemberRequestHandler = async (req, res) => {
    const where = activeStaffMemberWhere(res.locals.venue.id, req.params.staffMemberId);
    const staffMember = where && (await db.staffMember.findFirst({ where }));
    if (!staffMember) return sendError(res, 'not_found');
    res.json(staffLinkSchema.parse({ token: await staffLinkTokenOf(staffMember) }));
  };

  const regenerateStaffLink: StaffMemberRequestHandler = async (req, res) => {
    const { token, columns } = newStaffLinkColumns(staffLinkKey);
    const regenerated = await updateActiveStaffMember(res, req.params.staffMemberId, columns);
    if (regenerated) res.json(staffLinkSchema.parse({ token }));
  };

  router.get('/', listStaffMembers);
  router.post('/', addStaffMember);
  router.patch('/:staffMemberId', editStaffMember);
  router.post('/:staffMemberId/archive', archiveStaffMember);
  router.get('/:staffMemberId/staff-link', getStaffLink);
  router.post('/:staffMemberId/staff-link/regenerate', regenerateStaffLink);

  return router;
}
