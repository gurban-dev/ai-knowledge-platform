import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { IdPrefix, IdempotencyConflictError, newId } from '@akp/core';
import type { Request, Response } from 'express';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import type { AppContainer } from '../container.js';
import type { AuthContext } from './auth.types.js';
import { APP_CONTAINER } from './tokens.js';

/**
 * Honors `Idempotency-Key` on mutating authenticated requests.
 * Replays the stored response when the same key+body is retried; conflicts when
 * the key is reused with a different payload hash.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext | null }>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next.handle();
    }
    const keyHeader = req.headers['idempotency-key'];
    if (typeof keyHeader !== 'string' || !keyHeader.trim() || !req.auth) {
      return next.handle();
    }

    const key = keyHeader.trim();
    const organizationId = req.auth.organizationId;
    const bodyText =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const requestHash = createHash('sha256').update(bodyText).digest('hex');

    return from(
      this.container.prisma.idempotencyKey.findUnique({
        where: { organizationId_key: { organizationId, key } },
      }),
    ).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new IdempotencyConflictError();
          }
          if (existing.status === 'COMPLETED' && existing.responseBody != null) {
            res.status(existing.responseStatus ?? 200);
            return of(existing.responseBody);
          }
          return next.handle();
        }

        const ttl = this.container.config.idempotency.ttlSeconds;
        return from(
          this.container.prisma.idempotencyKey.create({
            data: {
              id: newId(IdPrefix.idempotencyKey),
              organizationId,
              key,
              method: req.method,
              path: req.originalUrl,
              requestHash,
              status: 'IN_PROGRESS',
              expiresAt: new Date(Date.now() + ttl * 1000),
            },
          }),
        ).pipe(
          switchMap(() =>
            next.handle().pipe(
              tap((payload) => {
                void this.container.prisma.idempotencyKey
                  .updateMany({
                    where: { organizationId, key, status: 'IN_PROGRESS' },
                    data: {
                      status: 'COMPLETED',
                      responseStatus: res.statusCode,
                      responseBody: payload as object,
                    },
                  })
                  .catch(() => undefined);
              }),
            ),
          ),
        );
      }),
    );
  }
}
