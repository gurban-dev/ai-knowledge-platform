import { describe, expect, it } from 'vitest';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
  toAppError,
} from './index.js';

describe('AppError', () => {
  it('exposes 4xx errors and masks 5xx by default', () => {
    expect(new ValidationError().expose).toBe(true);
    expect(new InternalError().expose).toBe(false);
  });

  it('serializes to a stable client contract without leaking cause', () => {
    const err = new ValidationError('bad', { fields: ['email'] });
    const json = err.toJSON();
    expect(json).toEqual({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'bad',
      statusCode: 422,
      details: { fields: ['email'] },
    });
    expect(JSON.stringify(json)).not.toContain('cause');
  });

  it('sets the concrete subclass name', () => {
    expect(new NotFoundError('Document').name).toBe('NotFoundError');
    expect(new NotFoundError('Document').message).toBe('Document not found');
  });

  it('recognizes AppError instances via the static guard', () => {
    expect(AppError.isAppError(new ForbiddenError())).toBe(true);
    expect(AppError.isAppError(new Error('nope'))).toBe(false);
    expect(AppError.isAppError('nope')).toBe(false);
  });
});

describe('toAppError', () => {
  it('passes through existing AppErrors unchanged', () => {
    const original = new ForbiddenError();
    expect(toAppError(original)).toBe(original);
  });

  it('wraps native errors as non-exposed InternalError preserving cause', () => {
    const native = new Error('db exploded');
    const wrapped = toAppError(native);
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.expose).toBe(false);
    expect(wrapped.cause).toBe(native);
  });

  it('wraps non-error throwables', () => {
    const wrapped = toAppError('string thrown');
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.statusCode).toBe(500);
  });
});
