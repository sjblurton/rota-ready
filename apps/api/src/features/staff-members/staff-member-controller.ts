import {
  byStaffMemberName,
  staffLinkSchema,
  staffMemberDetailsSchema,
  staffMemberSchema,
} from '@rota-ready/shared';
import type { Response } from 'express';
import { z } from 'zod';
import type { StaffMember } from '#src/generated/prisma/client.js';
import { parseBody, sendError } from '#src/lib/http-errors.js';
import type { VenueMemberLocals, VenueRequestHandler } from '#src/features/venues/require-venue-member.js';
import type { StaffMemberKey } from './staff-member-data.js';
import type { StaffMemberService } from './staff-member-service.js';

type StaffMemberRequestHandler = VenueRequestHandler<{ staffMemberId: string }>;

const staffMemberIdSchema = z.uuid();

function toStaffMember({ id, name, role, email, phone }: StaffMember) {
  return staffMemberSchema.parse({ id, name, role, email, phone });
}

function staffMemberKeyOrReject(
  res: Response<unknown, VenueMemberLocals>,
  staffMemberId: string,
): StaffMemberKey | undefined {
  const id = staffMemberIdSchema.safeParse(staffMemberId);
  if (!id.success) {
    sendError(res, 'not_found');
    return undefined;
  }
  return { id: id.data, venueId: res.locals.venue.id };
}

export function staffMemberController(staffMembers: StaffMemberService) {
  const listStaffMembers: VenueRequestHandler<object> = async (_req, res) => {
    const list = await staffMembers.list(res.locals.venue.id);
    res.json(list.map(toStaffMember).sort(byStaffMemberName));
  };

  const addStaffMember: VenueRequestHandler<object> = async (req, res) => {
    const details = parseBody(staffMemberDetailsSchema, req.body, res);
    if (!details) return;
    const result = await staffMembers.add(res.locals.venue.id, details);
    if (!result.ok) return sendError(res, result.code);
    res.status(201).json(toStaffMember(result.staffMember));
  };

  const editStaffMember: StaffMemberRequestHandler = async (req, res) => {
    const details = parseBody(staffMemberDetailsSchema, req.body, res);
    if (!details) return;
    const key = staffMemberKeyOrReject(res, req.params.staffMemberId);
    if (!key) return;
    const result = await staffMembers.edit(key, details);
    if (!result.ok) return sendError(res, result.code);
    res.json(toStaffMember(result.staffMember));
  };

  const archiveStaffMember: StaffMemberRequestHandler = async (req, res) => {
    const key = staffMemberKeyOrReject(res, req.params.staffMemberId);
    if (!key) return;
    const result = await staffMembers.archive(key);
    if (!result.ok) return sendError(res, result.code);
    res.status(204).end();
  };

  const getStaffLink: StaffMemberRequestHandler = async (req, res) => {
    const key = staffMemberKeyOrReject(res, req.params.staffMemberId);
    if (!key) return;
    const result = await staffMembers.staffLink(key);
    if (!result.ok) return sendError(res, result.code);
    res.json(staffLinkSchema.parse({ token: result.token }));
  };

  const regenerateStaffLink: StaffMemberRequestHandler = async (req, res) => {
    const key = staffMemberKeyOrReject(res, req.params.staffMemberId);
    if (!key) return;
    const result = await staffMembers.regenerateStaffLink(key);
    if (!result.ok) return sendError(res, result.code);
    res.json(staffLinkSchema.parse({ token: result.token }));
  };

  return {
    listStaffMembers,
    addStaffMember,
    editStaffMember,
    archiveStaffMember,
    getStaffLink,
    regenerateStaffLink,
  };
}
