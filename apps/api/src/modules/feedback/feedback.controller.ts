import {
  Body,
  Controller,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IdPrefix, newId, NotFoundError } from '@akp/core';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import { AuditAction } from '../audit/audit.service.js';

const messageIdParamsSchema = z.object({ messageId: z.string() });

const feedbackBodySchema = z.object({
  rating: z.enum(['UP', 'DOWN']),
  reason: z.enum(['INCORRECT', 'INCOMPLETE', 'OUTDATED', 'UNSAFE', 'OTHER']).optional(),
  comment: z.string().max(2000).optional(),
});

@Controller('v1/messages')
@UseGuards(AuthGuard)
export class FeedbackController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Put(':messageId/feedback')
  async upsertFeedback(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(messageIdParamsSchema))
    params: z.infer<typeof messageIdParamsSchema>,
    @Body(new ZodValidationPipe(feedbackBodySchema))
    body: z.infer<typeof feedbackBodySchema>,
  ) {
    const message = await this.container.prisma.message.findFirst({
      where: {
        id: params.messageId,
        organizationId: auth.organizationId,
      },
    });
    if (!message) throw new NotFoundError('Message');

    const row = await this.container.prisma.messageFeedback.upsert({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: auth.userId,
        },
      },
      create: {
        id: newId(IdPrefix.messageFeedback),
        organizationId: auth.organizationId,
        messageId: params.messageId,
        userId: auth.userId,
        rating: body.rating,
        reason: body.reason ?? null,
        comment: body.comment ?? null,
      },
      update: {
        rating: body.rating,
        reason: body.reason ?? null,
        comment: body.comment ?? null,
      },
    });

    await this.container.services.audit.record({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: AuditAction.FeedbackSubmitted,
      resourceType: 'message',
      resourceId: params.messageId,
      metadata: { rating: body.rating },
    });

    return {
      id: row.id,
      rating: row.rating,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
