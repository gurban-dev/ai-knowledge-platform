import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const searchBodySchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).optional(),
  collectionId: z.string().optional(),
});

@Controller()
@UseGuards(AuthGuard)
export class SearchController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Post('v1/search')
  async search(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(searchBodySchema)) body: z.infer<typeof searchBodySchema>,
  ) {
    const hits = await this.container.services.search.search({
      organizationId: auth.organizationId,
      userId: auth.userId,
      role: auth.role,
      query: body.query,
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
      ...(body.collectionId !== undefined ? { collectionId: body.collectionId } : {}),
    });
    return { hits };
  }
}
