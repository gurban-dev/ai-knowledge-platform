import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IdPrefix, newId } from '@akp/core';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import type { AppContainer } from '../container.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

/**
 * Shared Express/Nest bootstrap used by production `main` and the test harness.
 */
export function configureApp(app: INestApplication, container: AppContainer): void {
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
    disable: (key: string) => void;
  };
  expressApp.set('trust proxy', true);
  expressApp.disable('x-powered-by');

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  app.use((req: Request & { id?: string; log?: unknown }, res: Response, next: NextFunction) => {
    req.id = newId(IdPrefix.session).replace('ses_', 'req_');
    req.log = container.logger.child({ reqId: req.id });
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowed = new Set(container.config.server.corsOrigins);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowed.has(origin)) {
          cb(null, true);
          return;
        }
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 86_400,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Knowledge Platform API')
    .setDescription(
      'Securely connect internal knowledge to AI with observability into retrieval quality, accuracy, cost, and operational health.',
    )
    .setVersion('0.1.0')
    .addServer(container.config.server.publicUrl)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived access token obtained from /v1/auth/login.',
      },
      'bearerAuth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Organization-scoped API key for programmatic and MCP access.',
      },
      'apiKey',
    )
    .addTag('health', 'Liveness, readiness, and metrics')
    .addTag('auth', 'Authentication and session lifecycle')
    .addTag('organizations', 'Organization and membership management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}
