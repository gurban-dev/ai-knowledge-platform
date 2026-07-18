import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Role } from '@akp/core';
import { commonErrorResponses } from '../../lib/http.js';
import { membersResponseSchema, organizationSchema } from './organization.schemas.js';

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  const fastify = app.withTypeProvider<ZodTypeProvider>();
  const { organizations } = fastify.container.services;

  fastify.get(
    '/current',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['organizations'],
        summary: "Get the caller's active organization",
        security: [{ bearerAuth: [] }],
        response: { 200: organizationSchema, ...commonErrorResponses },
      },
    },
    async (request) => {
      const org = await organizations.getById(request.auth!.organizationId);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        createdAt: org.createdAt.toISOString(),
      };
    },
  );

  fastify.get(
    '/current/members',
    {
      // Only admins and owners may enumerate the member directory.
      onRequest: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
      schema: {
        tags: ['organizations'],
        summary: 'List members of the active organization',
        security: [{ bearerAuth: [] }],
        response: { 200: membersResponseSchema, ...commonErrorResponses },
      },
    },
    async (request) => {
      const members = await organizations.listMembers(request.auth!.organizationId);
      return { members };
    },
  );
};
