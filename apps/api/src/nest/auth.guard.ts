import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ForbiddenError,
  RateLimitError,
  Role,
  roleSatisfies,
  UnauthorizedError,
} from '@akp/core';
import type { Request } from 'express';
import type { AppContainer } from '../container.js';
import type { ApiKeyContext, AuthContext } from './auth.types.js';
import {
  API_KEY_AUTH_KEY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from './decorators.js';
import { APP_CONTAINER } from './tokens.js';

function extractBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function extractApiKey(request: Request): string | null {
  const headerKey = request.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  const bearer = extractBearer(request);
  if (bearer?.startsWith('akp_')) return bearer;
  return null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(APP_CONTAINER) private readonly container: AppContainer,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & {
      auth?: AuthContext | null;
      apiKey?: ApiKeyContext | null;
    }>();

    const useApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (useApiKey) {
      await this.authenticateApiKey(request);
    } else {
      await this.authenticateJwt(request);
      this.assertRoles(context, request.auth!);
    }

    return true;
  }

  private async authenticateJwt(
    request: Request & { auth?: AuthContext | null },
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }
    const claims = await this.container.jwt.verifyAccessToken(token);
    request.auth = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role as Role,
      sessionId: claims.sid,
    };
  }

  private async authenticateApiKey(
    request: Request & { auth?: AuthContext | null; apiKey?: ApiKeyContext | null },
  ): Promise<void> {
    const secret = extractApiKey(request);
    if (!secret) {
      throw new UnauthorizedError('Missing API key');
    }
    const verified = await this.container.services.apiKeys.verify(secret, {
      ip: request.ip ?? 'unknown',
    });

    const limit =
      verified.rateLimitPerMinute ?? this.container.config.rateLimit.apiKeyPerMinute;
    const windowKey = `akp-akrl:${verified.id}:${Math.floor(Date.now() / 60_000)}`;
    const count = await this.container.redis.incr(windowKey);
    if (count === 1) {
      await this.container.redis.expire(windowKey, 60);
    }
    if (count > limit) {
      throw new RateLimitError('API key rate limit exceeded', { limit, windowSeconds: 60 });
    }

    request.apiKey = verified;
    request.auth = {
      userId: verified.id,
      organizationId: verified.organizationId,
      role: Role.MEMBER,
      sessionId: verified.id,
    };
  }

  private assertRoles(context: ExecutionContext, auth: AuthContext): void {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return;

    const required = requiredRoles[0]!;
    if (!roleSatisfies(auth.role, required)) {
      throw new ForbiddenError(`Requires ${required} role or higher`);
    }
  }
}
