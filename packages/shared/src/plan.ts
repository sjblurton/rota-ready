import { z } from 'zod';

export const planSchema = z.enum(['free', 'pro']);

export const plan = planSchema.enum;

export type Plan = z.infer<typeof planSchema>;

const notifiedBySchema = z.enum(['owner', 'rota_ready']);

export const notifiedBy = notifiedBySchema.enum;

type NotifiedBy = z.infer<typeof notifiedBySchema>;

interface PlanAllowance {
  staffNotifiedBy: NotifiedBy;
  staffMemberLimit: number;
  askAboutThisWeek: boolean;
}

export const planAllows = {
  free: { staffNotifiedBy: notifiedBy.owner, staffMemberLimit: 15, askAboutThisWeek: false },
  pro: { staffNotifiedBy: notifiedBy.rota_ready, staffMemberLimit: 15, askAboutThisWeek: false },
} as const satisfies Record<Plan, PlanAllowance>;
