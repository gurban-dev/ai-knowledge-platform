import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { commonErrorResponses } from '../../lib/http.js';
import type { RequestMeta } from './auth.types.js';
import {
  authResultSchema,
  loginBodySchema,
  logoutBodySchema,
  profileSchema,
  refreshBodySchema,
  registerBodySchema,
} from './auth.schemas.js';

function requestMeta(request: FastifyRequest): RequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

/** Tighter limits on unauthenticated credential endpoints to slow brute force. */
const authRateLimit = { max: 10, timeWindow: 60_000 };

export const authRoutes: FastifyPluginAsync = async (app) => {
  const fastify = app.withTypeProvider<ZodTypeProvider>();
  const { auth } = fastify.container.services;

  fastify.post(
    '/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Register a new organization and its first (owner) user',
        body: registerBodySchema,
        response: { 201: authResultSchema, ...commonErrorResponses },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request, reply) => {
      const result = await auth.register(request.body, requestMeta(request));
      void reply.status(201);
      return result;
    },
  );

  fastify.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Authenticate with email and password',
        body: loginBodySchema,
        response: { 200: authResultSchema, ...commonErrorResponses },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request) => auth.login(request.body, requestMeta(request)),
  );

  fastify.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate a refresh token for a fresh access token',
        body: refreshBodySchema,
        response: { 200: authResultSchema, ...commonErrorResponses },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request) => auth.refresh(request.body.refreshToken, requestMeta(request)),
  );

  fastify.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a refresh-token session',
        body: logoutBodySchema,
        response: { 204: z.null(), ...commonErrorResponses },
      },
    },
    async (request, reply) => {
      await auth.logout(request.body.refreshToken, requestMeta(request));
      void reply.status(204);
      return null;
    },
  );

  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Current authenticated user and active organization',
        security: [{ bearerAuth: [] }],
        response: { 200: profileSchema, ...commonErrorResponses },
      },
    },
    async (request) => auth.getProfile(request.auth!.userId),
  );
};
