import { beforeEach, describe, expect, it } from 'vitest';
import { askPrompt, ASK_SYSTEM_PROMPT, type WeekToAskAbout } from './ask-prompt.js';

const SAM = { name: 'Sam Jones', role: 'Kitchen' };
const JO = { name: 'Jo Bloggs', role: 'Floor' };
const QUESTION = 'Who is working on Sunday?';

describe('askPrompt', () => {
  let prompt: { system: string; prompt: string };

  describe('when the Week has the October clock change and an Overnight Shift', () => {
    beforeEach(() => {
      const week: WeekToAskAbout = {
        venue: { name: 'The Crown', timeZone: 'Europe/London' },
        weekStart: '2026-10-19',
        status: 'published',
        shifts: [
          {
            startsAt: new Date('2026-10-24T08:00:00.000Z'),
            endsAt: new Date('2026-10-24T16:00:00.000Z'),
            role: null,
            staffMember: SAM,
          },
          {
            startsAt: new Date('2026-10-24T19:00:00.000Z'),
            endsAt: new Date('2026-10-25T02:00:00.000Z'),
            role: 'Bar',
            staffMember: JO,
          },
          {
            startsAt: new Date('2026-10-25T09:00:00.000Z'),
            endsAt: new Date('2026-10-25T17:00:00.000Z'),
            role: null,
            staffMember: SAM,
          },
        ],
      };
      prompt = askPrompt(week, QUESTION);
    });

    it('gives the fixed system prompt', () => {
      expect(prompt.system).toBe(ASK_SYSTEM_PROMPT);
    });

    it("lists each Shift with its day and the Venue's local times, the Staff Member and the Role", () => {
      expect(prompt.prompt).toBe(
        [
          '<rota>',
          'Venue: The Crown',
          'Week: Mon, 19 Oct 2026 to Sun, 25 Oct 2026',
          'Timezone: Europe/London',
          'Status: Published (Staff Members can see it)',
          'Shifts:',
          '- Sat 24 Oct, 09:00–17:00: Sam Jones (Kitchen)',
          '- Sat 24 Oct, 20:00–02:00 (+1): Jo Bloggs (Bar)',
          '- Sun 25 Oct, 09:00–17:00: Sam Jones (Kitchen)',
          '</rota>',
          '',
          '<question>',
          QUESTION,
          '</question>',
        ].join('\n'),
      );
    });
  });

  describe('when the Week is a Draft with no Shifts', () => {
    beforeEach(() => {
      prompt = askPrompt(
        {
          venue: { name: 'The Crown', timeZone: 'Europe/London' },
          weekStart: '2026-11-16',
          status: 'draft',
          shifts: [],
        },
        QUESTION,
      );
    });

    it('says the Rota is a Draft', () => {
      expect(prompt.prompt).toContain('Status: Draft (Staff Members cannot see it yet)');
    });

    it('says there are no Shifts', () => {
      expect(prompt.prompt).toContain('Shifts:\n(no Shifts this Week)');
    });
  });

  describe('when the rows it is given also carry emails, phone numbers, tokens and IDs', () => {
    const SECRETS = [
      'sam@example.com',
      '07700 900123',
      'staff-link-token-abc',
      '1f0e9d8c-7b6a-4c5d-9e8f-0a1b2c3d4e5f',
      '6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d',
    ];

    beforeEach(() => {
      const samWithDetails = {
        ...SAM,
        id: SECRETS[3],
        email: SECRETS[0],
        phone: SECRETS[1],
        staffLinkToken: SECRETS[2],
      };
      const shift = {
        id: SECRETS[4],
        startsAt: new Date('2026-11-16T09:00:00.000Z'),
        endsAt: new Date('2026-11-16T17:00:00.000Z'),
        role: null,
        staffMember: samWithDetails,
      };
      prompt = askPrompt(
        {
          venue: { name: 'The Crown', timeZone: 'Europe/London' },
          weekStart: '2026-11-16',
          status: 'published',
          shifts: [shift],
        },
        QUESTION,
      );
    });

    it('leaves all of them out of the prompt', () => {
      expect(SECRETS.filter((secret) => prompt.prompt.includes(secret))).toEqual([]);
    });
  });
});
