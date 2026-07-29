import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { AppContainer } from './container.js';
import { AppModule } from './app.module.js';
import { configureApp } from './nest/configure-app.js';

export interface BuildAppOptions {
  container: AppContainer;
}

/**
 * Construct a fully-wired NestJS application. Kept free of side effects (no
 * `listen`) so tests can build the app and drive it via supertest without
 * binding a port.
 */
export async function buildApp(options: BuildAppOptions): Promise<INestApplication> {
  const { container } = options;

  const app = await NestFactory.create(AppModule.forRoot(container), {
    bodyParser: false,
    logger: false,
  });

  configureApp(app, container);
  await app.init();
  return app;
}
