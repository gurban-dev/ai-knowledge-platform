import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import type { AppContainer } from '../container.js';
import { APP_CONTAINER } from './tokens.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const elapsedSec = Number(process.hrtime.bigint() - started) / 1e9;
        let routePath: string | undefined;
        const routeMeta: unknown = req.route;
        if (typeof routeMeta === 'object' && routeMeta !== null && 'path' in routeMeta) {
          const pathValue = Reflect.get(routeMeta, 'path');
          if (typeof pathValue === 'string') routePath = pathValue;
        }
        const route = routePath ? `${req.baseUrl}${routePath}` : req.path;
        const labels = {
          method: req.method,
          route,
          status_code: String(res.statusCode),
        };
        this.container.metrics.httpRequestDuration.observe(labels, elapsedSec);
        this.container.metrics.httpRequestsTotal.inc(labels);
      }),
    );
  }
}
