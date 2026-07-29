import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@akp/core';
import type { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import { updateOrganizationSettingsBodySchema } from './organization.schemas.js';

@Controller('v1/organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get organizations() {
    return this.container.services.organizations;
  }

  @Get('current')
  async current(@CurrentAuth() auth: AuthContext) {
    const org = await this.organizations.getById(auth.organizationId);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt.toISOString(),
    };
  }

  @Get('current/members')
  @Roles(Role.ADMIN)
  async members(@CurrentAuth() auth: AuthContext) {
    const members = await this.organizations.listMembers(auth.organizationId);
    return { members };
  }

  @Get('current/settings')
  @Roles(Role.ADMIN)
  settings(@CurrentAuth() auth: AuthContext) {
    return this.organizations.getSettings(auth.organizationId);
  }

  @Put('current/settings')
  @Roles(Role.OWNER)
  updateSettings(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateOrganizationSettingsBodySchema))
    body: z.infer<typeof updateOrganizationSettingsBodySchema>,
  ) {
    return this.organizations.updateSettings(auth.organizationId, body);
  }
}
