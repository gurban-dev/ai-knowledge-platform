import type { FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError, roleSatisfies, UnauthorizedError, type Role } from '@akp/core';

/** Identity resolved from a verified access token and attached to the request. */
export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  sessionId: string;
}

function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Registers authentication/authorization primitives:
 *   - `request.auth`      : populated AuthContext once authenticated.
 *   - `fastify.authenticate` : preHandler that verifies the Bearer access token.
 *   - `fastify.requireRole(role)` : preHandler factory enforcing a minimum role.
 *
 * Access tokens are verified statelessly (signature + claims). Revocation is
 * bounded by the short access-token TTL; refresh tokens carry the revocable,
 * stateful part of the session.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('auth', null);

  const authenticate: preHandlerHookHandler = async (request: FastifyRequest) => {
    const token = extractBearer(request);
    if (!token) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }
    const claims = await fastify.container.jwt.verifyAccessToken(token);
    request.auth = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role as Role,
      sessionId: claims.sid,
    };
  };

  fastify.decorate('authenticate', authenticate);

  fastify.decorate('requireRole', (required: Role): preHandlerHookHandler => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      // requireRole must run after `authenticate` in the preHandler chain.
      if (!request.auth) {
        throw new UnauthorizedError('Authentication required');
      }
      if (!roleSatisfies(request.auth.role, required)) {
        throw new ForbiddenError(`Requires ${required} role or higher`);
      }
    };
  });
};

export default fp(authPlugin, { name: 'auth', dependencies: ['container'] });
