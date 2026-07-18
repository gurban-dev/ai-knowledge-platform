import { z } from 'zod';
import { ALL_ROLES } from '@akp/core';

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const memberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ALL_ROLES as [string, ...string[]]),
  status: z.string(),
  joinedAt: z.string(),
});

export const membersResponseSchema = z.object({
  members: z.array(memberSchema),
});
