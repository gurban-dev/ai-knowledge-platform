import type { Role } from '@akp/core';
import type { preHandlerHookHandler } from 'fastify';
import type { AppContainer } from '../container.js';
import type { AuthContext } from '../plugins/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Composition-root container: config, clients, repositories, services. */
    container: AppContainer;
    /** preHandler that verifies the Bearer access token and populates `request.auth`. */
    authenticate: preHandlerHookHandler;
    /** preHandler factory enforcing a minimum role (run after `authenticate`). */
    requireRole: (required: Role) => preHandlerHookHandler;
  }

  interface FastifyRequest {
    /** Populated by `authenticate`; null on unauthenticated routes. */
    auth: AuthContext | null;
  }
}
