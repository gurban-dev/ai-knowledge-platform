import { ErrorCode } from './error-codes.js';

/**
 * Shape serialized to API clients. Intentionally minimal and stable.
 * `details` carries structured, non-sensitive context (e.g. field validation issues).
 */
export interface SerializedError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  /** Correlation id for support/debugging; populated at the HTTP boundary. */
  requestId?: string;
}

export interface AppErrorOptions {
  /** Structured, client-safe context. */
  details?: unknown;
  /** Underlying error, preserved for logs/traces but never serialized to clients. */
  cause?: unknown;
  /**
   * Whether the error message is safe to expose to end users. Operational/unexpected
   * errors are masked with a generic message at the HTTP boundary.
   */
  expose?: boolean;
}

/**
 * Base class for all deliberate, typed application errors.
 *
 * Every error carries a machine-readable {@link ErrorCode}, an HTTP status code,
 * and an `expose` flag governing whether its message may be shown to clients.
 * The HTTP error handler is the single place that translates these into responses.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;
  override readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
    this.cause = options.cause;
    // V8-only; typed without depending on @types/node in this package.
    (Error as { captureStackTrace?: (target: object, ctor: unknown) => void }).captureStackTrace?.(
      this,
      new.target,
    );
  }

  /** Type guard usable across package boundaries (survives duplicate module instances). */
  static isAppError(value: unknown): value is AppError {
    return (
      value instanceof AppError ||
      (typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        'statusCode' in value &&
        (value as { name?: unknown }).name !== undefined &&
        value instanceof Error)
    );
  }

  toJSON(): SerializedError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Concrete errors — one per common failure mode. Keep constructors terse.   */
/* -------------------------------------------------------------------------- */

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, 422, { details, expose: true });
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(ErrorCode.BAD_REQUEST, message, 400, { details, expose: true });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    super(code, message, 401, { expose: true });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', details?: unknown) {
    super(ErrorCode.FORBIDDEN, message, 403, { details, expose: true });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', details?: unknown) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404, { details, expose: true });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code: ErrorCode = ErrorCode.CONFLICT, details?: unknown) {
    super(code, message, 409, { details, expose: true });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(ErrorCode.RATE_LIMITED, message, 429, { details, expose: true });
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'Plan quota exceeded', details?: unknown) {
    super(ErrorCode.QUOTA_EXCEEDED, message, 402, { details, expose: true });
  }
}

export class BudgetExceededError extends AppError {
  constructor(message = 'Monthly AI spend cap exceeded', details?: unknown) {
    super(ErrorCode.BUDGET_EXCEEDED, message, 402, { details, expose: true });
  }
}

export class InsufficientScopeError extends AppError {
  constructor(message = 'The credential lacks a required scope', details?: unknown) {
    super(ErrorCode.INSUFFICIENT_SCOPE, message, 403, { details, expose: true });
  }
}

export class FeatureDisabledError extends AppError {
  constructor(message = 'This feature is disabled for your organization', details?: unknown) {
    super(ErrorCode.FEATURE_DISABLED, message, 403, { details, expose: true });
  }
}

/** MFA is required to complete authentication; carries a short-lived challenge id. */
export class MfaRequiredError extends AppError {
  constructor(message = 'Multi-factor authentication required', details?: unknown) {
    super(ErrorCode.MFA_REQUIRED, message, 401, { details, expose: true });
  }
}

export class MfaInvalidError extends AppError {
  constructor(message = 'Invalid multi-factor authentication code') {
    super(ErrorCode.MFA_INVALID, message, 401, { expose: true });
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Idempotency key reused with a different request') {
    super(ErrorCode.IDEMPOTENCY_CONFLICT, message, 409, { expose: true });
  }
}

export class PromptInjectionError extends AppError {
  constructor(message = 'Potential prompt injection detected in input', details?: unknown) {
    super(ErrorCode.PROMPT_INJECTION_DETECTED, message, 422, { details, expose: true });
  }
}

export class DependencyFailureError extends AppError {
  constructor(message = 'A downstream dependency failed', cause?: unknown) {
    super(ErrorCode.DEPENDENCY_FAILURE, message, 502, { cause, expose: false });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', cause?: unknown) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, 503, { cause, expose: false });
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, 500, { cause, expose: false });
  }
}

/** Field encryption/decryption failure. Never exposes the underlying reason. */
export class EncryptionError extends AppError {
  constructor(message = 'Failed to encrypt or decrypt data', cause?: unknown) {
    super(ErrorCode.ENCRYPTION_ERROR, message, 500, { cause, expose: false });
  }
}

/**
 * Normalize any thrown value into an {@link AppError}. Unknown/unexpected errors
 * become a non-exposed {@link InternalError} so raw messages never leak to clients.
 */
export function toAppError(err: unknown): AppError {
  if (AppError.isAppError(err)) return err;
  if (err instanceof Error) return new InternalError(err.message, err);
  return new InternalError('An unexpected error occurred', err);
}
