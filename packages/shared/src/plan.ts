import { z } from 'zod';

export const planSchema = z.enum(['free', 'pro', 'preview']);

export const plan = planSchema.enum;

export type Plan = z.infer<typeof planSchema>;

const notifiedBySchema = z.enum(['owner', 'rota_ready']);

export const notifiedBy = notifiedBySchema.enum;

type NotifiedBy = z.infer<typeof notifiedBySchema>;

const featureSchema = z.enum(['ask_about_this_week']);

export const feature = featureSchema.enum;

type Feature = z.infer<typeof featureSchema>;

interface PlanAllowance {
  staffNotifiedBy: NotifiedBy;
  staffMemberLimit: number;
  features: readonly Feature[];
}

export const planAllows: Record<Plan, PlanAllowance> = {
  free: { staffNotifiedBy: notifiedBy.owner, staffMemberLimit: 15, features: [] },
  pro: { staffNotifiedBy: notifiedBy.rota_ready, staffMemberLimit: 15, features: [] },
  preview: {
    staffNotifiedBy: notifiedBy.owner,
    staffMemberLimit: 15,
    features: [feature.ask_about_this_week],
  },
};
