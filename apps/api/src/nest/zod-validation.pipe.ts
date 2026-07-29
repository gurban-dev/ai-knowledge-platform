import type { PipeTransform } from '@nestjs/common';
import { ValidationError } from '@akp/core';
import type { ZodType } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: `/${issue.path.join('/')}`,
        message: issue.message,
      }));
      throw new ValidationError('Request validation failed', details);
    }
    return result.data;
  }
}
