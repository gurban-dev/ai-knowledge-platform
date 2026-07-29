import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Role } from '@akp/core';
import type { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { paginationQuerySchema } from '../../lib/http.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

@Controller('v1/audit-logs')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get audit() {
    return this.container.services.audit;
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: z.infer<typeof paginationQuerySchema>,
  ) {
    return this.audit.list(auth.organizationId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
