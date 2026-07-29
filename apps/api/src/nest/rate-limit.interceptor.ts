import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { RateLimitError } from '@akp/core';
import type { Request, Response } from 'express';
import { type Observable, from, switchMap } from 'rxjs';
import type { AppContainer } from '../container.js';
import type { AuthContext } from './auth.types.js';
import { APP_CONTAINER } from './tokens.js';

/**
 * Redis-backed rate limiting. Authenticated requests are keyed by user id;
 * anonymous requests fall back to client IP. Auth credential endpoints get a
 * tighter limit (10/min) matching the previous Fastify route config.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext | null }>();
    const res = context.switchToHttp().getResponse<Response>();
    const path = req.path;

    if (path === '/health/live' || path === '/health/ready' || path === '/metrics') {
      return next.handle();
    }

    const isAuthCredential =
      (req.method === 'POST' &&
        (path === '/v1/auth/register' ||
          path === '/v1/auth/login' ||
          path === '/v1/auth/mfa/complete' ||
          path === '/v1/auth/refresh' ||
          path === '/v1/auth/google/exchange' ||
          path === '/v1/auth/google/credential')) ||
      (req.method === 'GET' && path === '/v1/auth/google/start');

    const { rateLimit: cfg } = this.container.config;
    const max = isAuthCredential ? 10 : cfg.max;
    const windowMs = isAuthCredential ? 60_000 : cfg.windowMs;
    const windowSec = Math.ceil(windowMs / 1000);
    const bucket = Math.floor(Date.now() / windowMs);
    const identity = req.auth?.userId ?? req.ip ?? 'unknown';
    const redisKey = `akp-rl:${identity}:${path}:${bucket}`;

    return from(
      (async () => {
        try {
          const count = await this.container.redis.incr(redisKey);
          if (count === 1) {
            await this.container.redis.expire(redisKey, windowSec);
          }
          const remaining = Math.max(0, max - count);
          res.setHeader('x-ratelimit-limit', String(max));
          res.setHeader('x-ratelimit-remaining', String(remaining));
          if (count > max) {
            res.setHeader('retry-after', String(windowSec));
            throw new RateLimitError();
          }
        } catch (error) {
          // Propagate intentional rate-limit denials; fail open on Redis outages
          // so auth/health traffic is not turned into opaque 500s.
          if (error instanceof RateLimitError) throw error;
        }
      })(),
    ).pipe(switchMap(() => next.handle()));
  }
}
