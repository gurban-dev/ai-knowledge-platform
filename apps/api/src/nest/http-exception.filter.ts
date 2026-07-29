import {
  Catch,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import {
  type AppError,
  NotFoundError,
  RateLimitError,
  toAppError,
  ValidationError,
  type SerializedError,
} from '@akp/core';
import { ZodError } from 'zod';
import type { Request, Response } from 'express';

function extractZodError(error: unknown): ZodError | null {
  if (error instanceof ZodError) return error;
  if (typeof error === 'object' && error !== null && 'validation' in error) {
    const validation = (error as { validation?: unknown }).validation;
    if (validation instanceof ZodError) return validation;
  }
  return null;
}

function normalize(error: unknown): AppError {
  if (error instanceof NotFoundException) {
    return new NotFoundError('Route');
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 429) return new RateLimitError();
    if (status === 400) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response &&
              typeof (response as { message: unknown }).message === 'string'
            ? (response as { message: string }).message
            : 'Bad request';
      return new ValidationError(message);
    }
    if (status === 404) return new NotFoundError('Route');
  }

  const zodError = extractZodError(error);
  if (zodError) {
    const details = zodError.issues.map((issue) => ({
      path: `/${issue.path.join('/')}`,
      message: issue.message,
    }));
    return new ValidationError('Request validation failed', details);
  }

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const status = Number((error as { statusCode?: unknown }).statusCode);
    if (status === 429) return new RateLimitError();
    if (status === 400) {
      const message = (error as { message?: unknown }).message;
      return new ValidationError(typeof message === 'string' ? message : 'Bad request');
    }
  }

  return toAppError(error);
}

function serialize(error: AppError, requestId: string): { error: SerializedError } {
  const base = error.toJSON();
  return {
    error: {
      ...base,
      message: error.expose ? base.message : 'An unexpected error occurred',
      ...(error.expose ? {} : { details: undefined }),
      requestId,
    },
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & {
        id?: string;
        log?: { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void };
      }
    >();

    if (response.headersSent) return;

    const appError = normalize(exception);
    const requestId = request.id ?? 'unknown';
    const body = serialize(appError, requestId);

    if (appError.statusCode >= 500) {
      request.log?.error(
        { err: appError, cause: appError.cause, reqId: requestId },
        'Unhandled server error',
      );
    } else {
      request.log?.info({ code: appError.code, statusCode: appError.statusCode }, 'Request error');
    }

    response.status(appError.statusCode).json(body);
  }
}
