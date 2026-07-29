import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Role } from '@akp/core';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

@Controller('v1/usage')
@UseGuards(AuthGuard)
export class UsageController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Get('summary')
  @Roles(Role.ADMIN)
  summary(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(usageQuerySchema)) query: z.infer<typeof usageQuerySchema>,
  ) {
    const since = new Date(Date.now() - query.days * 86_400_000);
    return this.container.services.usage.summary(auth.organizationId, since);
  }
}
