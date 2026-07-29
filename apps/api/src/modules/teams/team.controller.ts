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

const createTeamBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const idParamsSchema = z.object({ id: z.string() });

const addMemberBodySchema = z.object({
  userId: z.string(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

@Controller('v1/teams')
@UseGuards(AuthGuard)
export class TeamController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get teams() {
    return this.container.services.teams;
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.ADMIN)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createTeamBodySchema))
    body: z.infer<typeof createTeamBodySchema>,
  ) {
    const team = await this.teams.create({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      createdAt: team.createdAt.toISOString(),
    };
  }

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.teams.list(auth.organizationId);
    return {
      teams: rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        memberCount: t.members.length,
      })),
    };
  }

  @Post(':id/members')
  @HttpCode(201)
  @Roles(Role.ADMIN)
  async addMember(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
    @Body(new ZodValidationPipe(addMemberBodySchema))
    body: z.infer<typeof addMemberBodySchema>,
  ) {
    const member = await this.teams.addMember(
      auth.organizationId,
      params.id,
      body.userId,
      body.role,
    );
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  async delete(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
  ): Promise<void> {
    await this.teams.delete(auth.organizationId, params.id, auth.userId);
  }
}
