import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { AppContainer } from '../../container.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { APP_CONTAINER } from '../../nest/tokens.js';

@Controller('v1/observability')
@UseGuards(AuthGuard)
export class SloController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Get('slo')
  async getSlo() {
    const { config, prisma, redis } = this.container;
    const { slo, serviceName } = config.observability;

    const [database, cache] = await Promise.all([
      prisma
        .$queryRaw`SELECT 1`
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
      redis
        .ping()
        .then((r) => (r === 'PONG' ? ('up' as const) : ('down' as const)))
        .catch(() => 'down' as const),
    ]);

    return {
      service: serviceName,
      availabilityTarget: slo.availabilityTarget,
      latencyBudgetMs: slo.latencyBudgetMs,
      errorBudgetMinutesPerMonth: slo.errorBudgetMinutesPerMonth,
      alertingThreshold: slo.burnAlertThreshold,
      metricsEndpoint: '/metrics',
      current: {
        uptimeSeconds: Math.round(process.uptime()),
        dependencies: { database, redis: cache },
      },
    };
  }
}
