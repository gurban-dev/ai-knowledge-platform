import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const createConversationBodySchema = z.object({
  title: z.string().max(200).optional(),
  collectionIds: z.array(z.string()).optional(),
});

const askBodySchema = z.object({ question: z.string().min(1).max(8000) });

@Controller('v1/conversations')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get chat() {
    return this.container.services.chat;
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createConversationBodySchema))
    body: z.infer<typeof createConversationBodySchema>,
  ) {
    const c = await this.chat.createConversation({
      organizationId: auth.organizationId,
      userId: auth.userId,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.collectionIds !== undefined ? { collectionIds: body.collectionIds } : {}),
    });
    return {
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.chat.listConversations(auth.organizationId, auth.userId);
    return {
      conversations: rows.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  @Post(':id/messages')
  async ask(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(z.object({ id: z.string() }))) params: { id: string },
    @Body(new ZodValidationPipe(askBodySchema)) body: z.infer<typeof askBodySchema>,
    @Headers('accept') accept: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const answer = await this.chat.ask({
      organizationId: auth.organizationId,
      userId: auth.userId,
      role: auth.role,
      conversationId: params.id,
      question: body.question,
    });

    if ((accept ?? '').includes('text/event-stream')) {
      res.status(200);
      res.setHeader('content-type', 'text/event-stream; charset=utf-8');
      res.setHeader('cache-control', 'no-cache');
      res.setHeader('connection', 'keep-alive');

      const write = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const chunkSize = 24;
      for (let i = 0; i < answer.content.length; i += chunkSize) {
        write('token', { text: answer.content.slice(i, i + chunkSize) });
      }
      for (const citation of answer.citations) {
        write('citation', citation);
      }
      write('done', {
        assistantMessageId: answer.assistantMessageId,
        abstained: answer.abstained,
        groundingConfidence: answer.groundingConfidence,
        latencyMs: answer.latencyMs,
        promptVersion: answer.promptVersion,
        model: answer.model,
      });
      res.end();
      return;
    }

    res.status(200).json(answer);
  }
}
