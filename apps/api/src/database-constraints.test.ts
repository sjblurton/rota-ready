import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createPublishedRotaFor,
  createShift,
  createUser,
  createVenueFor,
} from '#test/seed.js';
import { startTestApp, type TestApp } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const MONDAY_9_TO_5 = { startsAt: '2026-11-16T09:00:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' };

describe('Shift snapshot constraints', () => {
  let app: TestApp;
  let sam: { id: string };
  let shift: { id: string };
  let saving: Promise<unknown>;

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    const venue = await createVenueFor(app.db, OWNER, {
      name: 'The Crown',
      timeZone: 'Europe/London',
    });
    sam = await createActiveStaffMember(app.db, venue, SAM);
    const rota = await createPublishedRotaFor(app.db, venue, '2026-11-16');
    shift = await createShift(app.db, rota, sam, MONDAY_9_TO_5);
  });

  afterEach(() => app.close());

  describe('when a told snapshot is saved with all three values', () => {
    beforeEach(() => {
      saving = app.db.shift.update({
        where: { id: shift.id },
        data: {
          toldStaffMemberId: sam.id,
          toldStartsAt: new Date(MONDAY_9_TO_5.startsAt),
          toldEndsAt: new Date(MONDAY_9_TO_5.endsAt),
        },
      });
    });

    it('saves it', async () => {
      await expect(saving).resolves.toMatchObject({ toldStaffMemberId: sam.id });
    });
  });

  describe('when a told snapshot is saved without its end time', () => {
    beforeEach(() => {
      saving = app.db.shift.update({
        where: { id: shift.id },
        data: { toldStaffMemberId: sam.id, toldStartsAt: new Date(MONDAY_9_TO_5.startsAt) },
      });
      saving.catch(() => undefined);
    });

    it('refuses it', async () => {
      await expect(saving).rejects.toThrow('shifts_told_snapshot_complete');
    });
  });

  describe('when previous values are saved without a Staff Member', () => {
    beforeEach(() => {
      saving = app.db.shift.update({
        where: { id: shift.id },
        data: {
          previousStartsAt: new Date(MONDAY_9_TO_5.startsAt),
          previousEndsAt: new Date(MONDAY_9_TO_5.endsAt),
        },
      });
      saving.catch(() => undefined);
    });

    it('refuses them', async () => {
      await expect(saving).rejects.toThrow('shifts_previous_values_complete');
    });
  });

  describe('when a removal is saved ending before it starts', () => {
    beforeEach(() => {
      saving = app.db.shiftRemoval.create({
        data: {
          shiftId: shift.id,
          staffMemberId: sam.id,
          startsAt: new Date(MONDAY_9_TO_5.endsAt),
          endsAt: new Date(MONDAY_9_TO_5.startsAt),
        },
      });
      saving.catch(() => undefined);
    });

    it('refuses it', async () => {
      await expect(saving).rejects.toThrow('shift_removals_times');
    });
  });
});
