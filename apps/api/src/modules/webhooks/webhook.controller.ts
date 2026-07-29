import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@akp/core';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import { WEBHOOK_EVENTS } from './webhook.service.js';

const createEndpointBodySchema = z.object({
  url: z.string().url(),
  description: z.string().max(500).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

const idParamsSchema = z.object({ id: z.string() });

@Controller('v1/webhooks')
@UseGuards(AuthGuard)
export class WebhookController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get webhooks() {
    return this.container.services.webhooks;
  }

  @Post('endpoints')
  @HttpCode(201)
  @Roles(Role.ADMIN)
  async createEndpoint(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createEndpointBodySchema))
    body: z.infer<typeof createEndpointBodySchema>,
  ) {
    const { endpoint, secret } = await this.webhooks.createEndpoint({
      organizationId: auth.organizationId,
      userId: auth.userId,
      url: body.url,
      ...(body.description !== undefined ? { description: body.description } : {}),
      events: [...body.events],
    });
    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      secret,
      createdAt: endpoint.createdAt.toISOString(),
    };
  }

  @Get('endpoints')
  @Roles(Role.ADMIN)
  async listEndpoints(@CurrentAuth() auth: AuthContext) {
    const rows = await this.webhooks.listEndpoints(auth.organizationId);
    return {
      endpoints: rows.map((e) => ({
        id: e.id,
        url: e.url,
        events: e.events,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  @Delete('endpoints/:id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  async deleteEndpoint(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
  ): Promise<void> {
    await this.webhooks.deleteEndpoint(auth.organizationId, params.id, auth.userId);
  }
}
