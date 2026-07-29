import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

export interface InjectOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
}

export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json: <T = unknown>() => T;
}

/**
 * Nest/Express stand-in for Fastify's `app.inject()` so existing integration
 * tests keep the same call shape.
 */
export async function inject(
  app: INestApplication,
  options: InjectOptions,
): Promise<InjectResponse> {
  const server = app.getHttpServer() as Server;
  const method = options.method.toLowerCase() as
    | 'get'
    | 'post'
    | 'put'
    | 'patch'
    | 'delete'
    | 'options'
    | 'head';

  let req = request(server)[method](options.url);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      req = req.set(key, value);
    }
  }
  if (options.payload !== undefined) {
    req = req.send(options.payload as object);
  }

  const res = await req;
  const body =
    typeof res.text === 'string' && res.text.length > 0
      ? res.text
      : JSON.stringify(res.body ?? null);

  return {
    statusCode: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body,
    json: <T = unknown>() => res.body as T,
  };
}

export interface NestTestApp {
  inject: (options: InjectOptions) => Promise<InjectResponse>;
  close: () => Promise<void>;
}

export function wrapNestApp(app: INestApplication): NestTestApp {
  return {
    inject: (options) => inject(app, options),
    close: async () => {
      await app.close();
    },
  };
}
