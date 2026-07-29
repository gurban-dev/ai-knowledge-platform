import {
  Body,
  Controller,
  Get,
  Inject,
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

const updatePlanBodySchema = z.object({
  plan: z.enum(['free', 'starter', 'business', 'enterprise']),
});

@Controller('v1/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get billing() {
    return this.container.services.billing;
  }

  private formatSubscription(sub: Awaited<ReturnType<typeof this.billing.getSubscription>>) {
    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      maxDocuments: sub.maxDocuments,
      maxMembers: sub.maxMembers,
      maxApiKeys: sub.maxApiKeys,
      monthlyBudgetMicros: sub.monthlyBudgetMicros?.toString() ?? null,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    };
  }

  @Get('subscription')
  async getSubscription(@CurrentAuth() auth: AuthContext) {
    const sub = await this.billing.getSubscription(auth.organizationId);
    return this.formatSubscription(sub);
  }

  @Get('budget')
  async getBudget(@CurrentAuth() auth: AuthContext) {
    return this.billing.getBudget(auth.organizationId);
  }

  @Post('plan')
  @Roles(Role.OWNER)
  async updatePlan(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(updatePlanBodySchema))
    body: z.infer<typeof updatePlanBodySchema>,
  ) {
    const sub = await this.billing.updatePlan(auth.organizationId, body.plan, auth.userId);
    return this.formatSubscription(sub);
  }
}
