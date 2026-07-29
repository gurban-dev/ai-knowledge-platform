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
import { ALL_API_SCOPES, ApiScope, FeatureDisabledError, Role } from '@akp/core';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { ApiKeyContext, AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import {
  ApiKeyAuth,
  CurrentApiKey,
  CurrentAuth,
  Roles,
} from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const scopeSchema = z.enum([ApiScope.Wildcard, ...ALL_API_SCOPES] as [string, ...string[]]);

const createApiKeyBodySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  scopes: z.array(scopeSchema).min(1),
  rateLimitPerMinute: z.number().int().min(1).max(10_000).optional(),
  ipAllowlist: z.array(z.string().min(1).max(64)).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

const idParamsSchema = z.object({ id: z.string() });

@Controller('v1/api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get apiKeys() {
    return this.container.services.apiKeys;
  }

  private get organizations() {
    return this.container.services.organizations;
  }

  private async assertApiKeysEnabled(organizationId: string): Promise<void> {
    const settings = await this.organizations.getSettings(organizationId);
    if (!settings.allowApiKeys) {
      throw new FeatureDisabledError('API keys are disabled for this organization');
    }
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.ADMIN)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createApiKeyBodySchema))
    body: z.infer<typeof createApiKeyBodySchema>,
  ) {
    await this.assertApiKeysEnabled(auth.organizationId);
    return this.apiKeys.create({
      organizationId: auth.organizationId,
      name: body.name,
      description: body.description,
      scopes: body.scopes,
      rateLimitPerMinute: body.rateLimitPerMinute,
      ipAllowlist: body.ipAllowlist,
      createdById: auth.userId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(@CurrentAuth() auth: AuthContext) {
    return { keys: await this.apiKeys.list(auth.organizationId) };
  }

  @Get('current')
  @ApiKeyAuth()
  current(@CurrentApiKey() key: ApiKeyContext) {
    return {
      id: key.id,
      organizationId: key.organizationId,
      name: key.name,
      scopes: key.scopes,
    };
  }

  @Post(':id/rotate')
  @Roles(Role.ADMIN)
  async rotate(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
  ) {
    return this.apiKeys.rotate(params.id, auth.organizationId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
  ): Promise<void> {
    await this.apiKeys.revoke(params.id, auth.organizationId);
  }
}
