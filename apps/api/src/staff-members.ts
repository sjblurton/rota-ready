import { byStaffMemberName, staffMemberDetailsSchema, staffMemberSchema } from '@rota-ready/shared';
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { VenueMemberLocals, VenueRequestHandler } from './auth.js';
import type { Db } from './db.js';
import { Prisma, type StaffMember } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';

type StaffMemberRequestHandler = VenueRequestHandler<{ staffMemberId: string }>;

const staffMemberIdSchema = z.uuid();

function isPrismaError(error: unknown, code: 'P2002' | 'P2025') {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function toStaffMember({ id, name, role, email, phone }: StaffMember) {
  return staffMemberSchema.parse({ id, name, role, email, phone });
}

export function staffMemberRoutes(db: Db): Router {
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
        data: { ...details, venueId: res.locals.venue.id },
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
    const id = staffMemberIdSchema.safeParse(staffMemberId);
    if (!id.success) {
      sendError(res, 'not_found');
      return undefined;
    }
    try {
      return await db.staffMember.update({
        where: { id: id.data, venueId: res.locals.venue.id, archivedAt: null },
        data,
      });
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
    const archived = await updateActiveStaffMember(res, req.params.staffMemberId, {
      archivedAt: new Date(),
      email: null,
    });
    if (archived) res.status(204).end();
  };

  router.get('/', listStaffMembers);
  router.post('/', addStaffMember);
  router.patch('/:staffMemberId', editStaffMember);
  router.post('/:staffMemberId/archive', archiveStaffMember);

  return router;
}
