import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  FeatureDisabledError,
  IdPrefix,
  newId,
  NotFoundError,
  Role,
} from '@akp/core';
import type { Prisma } from '@akp/db';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Public, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import { AuditAction } from '../audit/audit.service.js';
import { parseOrganizationSettings } from '../organizations/organization.service.js';

const createConnectionBodySchema = z.object({
  provider: z.enum(['OIDC', 'SAML']),
  name: z.string().min(1),
  config: z.record(z.unknown()),
  clientSecret: z.string().optional(),
  allowedDomains: z.array(z.string()).default([]),
});

const connectionIdParamsSchema = z.object({ connectionId: z.string() });

const startQuerySchema = z.object({ redirectUri: z.string().url() });

@Controller('v1/sso')
@UseGuards(AuthGuard)
export class SsoController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Post('connections')
  @HttpCode(201)
  @Roles(Role.OWNER)
  async createConnection(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createConnectionBodySchema))
    body: z.infer<typeof createConnectionBodySchema>,
  ) {
    if (!this.container.config.security.allowSso) {
      throw new FeatureDisabledError('SSO is disabled by platform policy');
    }
    const org = await this.container.prisma.organization.findUniqueOrThrow({
      where: { id: auth.organizationId },
    });
    const settings = parseOrganizationSettings(org.settings);
    if (!settings.allowSso) {
      throw new FeatureDisabledError('SSO is disabled for this organization');
    }

    const row = await this.container.prisma.ssoConnection.create({
      data: {
        id: newId(IdPrefix.ssoConnection),
        organizationId: auth.organizationId,
        provider: body.provider,
        name: body.name,
        config: body.config as Prisma.InputJsonValue,
        secretCiphertext: body.clientSecret
          ? this.container.encryptor.encrypt(body.clientSecret)
          : null,
        allowedDomains: body.allowedDomains,
      },
    });
    await this.container.services.audit.record({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: AuditAction.SsoConnectionUpserted,
      resourceType: 'sso_connection',
      resourceId: row.id,
    });
    return { id: row.id, name: row.name, provider: row.provider };
  }

  @Get('connections')
  @Roles(Role.ADMIN)
  async listConnections(@CurrentAuth() auth: AuthContext) {
    const rows = await this.container.prisma.ssoConnection.findMany({
      where: { organizationId: auth.organizationId },
    });
    return {
      connections: rows.map((r) => ({
        id: r.id,
        name: r.name,
        provider: r.provider,
        enabled: r.enabled,
        allowedDomains: r.allowedDomains,
      })),
    };
  }

  @Get(':connectionId/start')
  @Public()
  async start(
    @Param(new ZodValidationPipe(connectionIdParamsSchema))
    params: z.infer<typeof connectionIdParamsSchema>,
    @Query(new ZodValidationPipe(startQuerySchema))
    query: z.infer<typeof startQuerySchema>,
  ) {
    const connection = await this.container.prisma.ssoConnection.findUnique({
      where: { id: params.connectionId },
    });
    if (!connection?.enabled) throw new NotFoundError('SSO connection');
    const cfg = connection.config as {
      issuer?: string;
      clientId?: string;
      authorizeUrl?: string;
    };
    const state = newId(IdPrefix.session);
    const authorizeUrl =
      cfg.authorizeUrl ?? `${(cfg.issuer ?? '').replace(/\/$/, '')}/authorize`;
    const url = new URL(authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', cfg.clientId ?? '');
    url.searchParams.set('redirect_uri', query.redirectUri);
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    return { authorizationUrl: url.toString(), state };
  }
}
