import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import {
  AppError,
  NotFoundError,
  RateLimitError,
  toAppError,
  ValidationError,
  type SerializedError,
} from '@akp/core';

/**
 * Central error boundary. Every thrown error — domain, validation, framework —
 * is normalized into the platform's stable error envelope. Server errors (5xx)
 * are logged with full context and their messages masked; client errors (4xx)
 * are returned as-is. A `requestId` is always included for support correlation.
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const appError = normalize(error);
    const body = serialize(appError, request.id);

    if (appError.statusCode >= 500) {
      request.log.error(
        { err: appError, cause: appError.cause, reqId: request.id },
        'Unhandled server error',
      );
    } else {
      request.log.info({ code: appError.code, statusCode: appError.statusCode }, 'Request error');
    }

    void reply.status(appError.statusCode).send(body);
  });

  fastify.setNotFoundHandler((request, reply) => {
    const err = new NotFoundError('Route');
    void reply
      .status(err.statusCode)
      .send(serialize(err, request.id));
  });
};

function normalize(error: unknown): AppError {
  // Zod request-validation failures raised by fastify-type-provider-zod.
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      path: issue.instancePath,
      message: issue.message,
    }));
    return new ValidationError('Request validation failed', details);
  }

  // Fastify framework errors carry a statusCode and code we can map cleanly.
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const status = Number((error as { statusCode: unknown }).statusCode);
    if (status === 429) return new RateLimitError();
    if (status === 400) {
      const message =
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Bad request';
      return new ValidationError(message);
    }
  }

  return toAppError(error);
}

function serialize(error: AppError, requestId: string): { error: SerializedError } {
  const base = error.toJSON();
  return {
    error: {
      ...base,
      // Never leak internal messages/details for masked (5xx) errors.
      message: error.expose ? base.message : 'An unexpected error occurred',
      ...(error.expose ? {} : { details: undefined }),
      requestId,
    },
  };
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
