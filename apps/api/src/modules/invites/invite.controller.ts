import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@akp/core';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { hashPassword } from '../../lib/crypto.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Public, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const createInviteBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

const acceptInviteBodySchema = z.object({
  token: z.string().min(10),
  name: z.string().min(1),
  password: z.string().min(8),
});

@Controller('v1/invites')
@UseGuards(AuthGuard)
export class InviteController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get invites() {
    return this.container.services.invites;
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.ADMIN)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createInviteBodySchema))
    body: z.infer<typeof createInviteBodySchema>,
  ) {
    const { invite, token } = await this.invites.create({
      organizationId: auth.organizationId,
      email: body.email,
      role: body.role,
      invitedById: auth.userId,
    });
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.invites.list(auth.organizationId);
    return {
      invites: rows.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
      })),
    };
  }

  @Post('accept')
  @Public()
  async accept(
    @Body(new ZodValidationPipe(acceptInviteBodySchema))
    body: z.infer<typeof acceptInviteBodySchema>,
  ) {
    const passwordHash = await hashPassword(
      body.password,
      this.container.config.auth.passwordHashMemoryCost,
    );
    return this.invites.accept({
      token: body.token,
      name: body.name,
      passwordHash,
    });
  }
}
